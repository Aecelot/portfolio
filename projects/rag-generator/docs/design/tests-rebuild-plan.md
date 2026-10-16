# Lore RAG Test Suite Rebuild Plan

Purpose: simplify the suite to 4 fast, offline core tests, archive legacy tests, and make CI runs complete in under 60s.

## Scope
- Replace existing sprawl with core unit-style coverage for chunking, embedding, vector indexing, and retrieval.
- Archive all current tests under [tests/legacy](tests/legacy) and exclude from CI.
- Default test run: pytest executes exactly four new tests; optional local profiles run legacy or heavy tests.

## Core components and targets
- Chunking via [MarkdownChunker.process_markdown_file()](backend/pipeline/ingestion/chunk_md.py:442)
- Embedding via [EmbeddingBuilder._generate_embeddings()](backend/pipeline/indexing/build_embeddings.py:166)
- Vector indexing via [FAISSBuilder._build_flat_ip_index()](backend/pipeline/indexing/build_faiss.py:179) with fallback [FAISSBuilder._build_simple_index()](backend/pipeline/indexing/build_faiss.py:274)
- Retrieval via [RetrievalService.retrieve()](backend/api/retriever.py:1237) in offline/mock mode

## Directory actions
- Create [tests/legacy](tests/legacy) and move all existing test files there (keep [tests/__init__.py](tests/__init__.py) at root).
- Add four new core tests:
  - [tests/test_chunking_core.py](tests/test_chunking_core.py)
  - [tests/test_embedding_core.py](tests/test_embedding_core.py)
  - [tests/test_vector_index_core.py](tests/test_vector_index_core.py)
  - [tests/test_retrieval_core.py](tests/test_retrieval_core.py)
- Add [pytest.ini](pytest.ini) at repo root to restrict discovery and exclude legacy.
- Optionally add [tests/conftest.py](tests/conftest.py) for shared fixtures and deterministic RNG.

## Runtime guarantees
- Offline by default: mock external model loads; no network access required.
- Deterministic: seeded RNG; small synthetic inputs.
- Fast: ≤60s total in CI on a standard runner; typical <10s locally.

## New core tests (design)

### 1) Chunking: [tests/test_chunking_core.py](tests/test_chunking_core.py)
- Arrange: create a temp .md with h1/h2/h3 structure and long paragraphs to cross token thresholds.
- Monkeypatch config loader to return a minimal dict (no file I/O) for [MarkdownChunker.process_markdown_file()](backend/pipeline/ingestion/chunk_md.py:442):
  - chunking.token_target ≈ 320, token_min ≈ 120, token_max ≈ 450, overlap_pct ≈ 0.15.
- Act: instantiate MarkdownChunker and call process_markdown_file on the temp file.
- Assert:
  - At least 1 chunk produced with header_path populated.
  - Each chunk token_count within [token_min, token_max] unless intentionally split; long sections are split.
  - Domain type returns a sensible default (e.g., "general_lore").

### 2) Embedding: [tests/test_embedding_core.py](tests/test_embedding_core.py)
- Monkeypatch [EmbeddingBuilder._load_config()](backend/pipeline/indexing/build_embeddings.py:45) to a minimal vectorization config.
- Replace sentence_transformers.SentenceTransformer with a small Fake that:
  - get_sentence_embedding_dimension() returns fixed d (e.g., 32).
  - encode(texts, batch_size, normalize_embeddings, convert_to_numpy, show_progress_bar) returns deterministic vectors and applies L2 norm if requested.
- Act: call [EmbeddingBuilder._generate_embeddings()](backend/pipeline/indexing/build_embeddings.py:166) on 3 short texts.
- Assert:
  - Shape (3, d) and dtype float32.
  - Rows have unit norm when normalize=True.
  - No disk writes; no network calls.

### 3) Vector indexing: [tests/test_vector_index_core.py](tests/test_vector_index_core.py)
- Monkeypatch [FAISSBuilder._load_config()](backend/pipeline/indexing/build_faiss.py:52) so index.type is either 'faiss_flat_ip' or fallback-friendly.
- Generate small normalized vectors (e.g., (20, 16)).
- If faiss is present, build with [FAISSBuilder._build_flat_ip_index()](backend/pipeline/indexing/build_faiss.py:179); else exercise [FAISSBuilder._build_simple_index()](backend/pipeline/indexing/build_faiss.py:274).
- Assert:
  - Index object created and contains the expected number of vectors.
  - For FAISS path, can run a 1-NN search that returns k results without error.

### 4) Retrieval (offline): [tests/test_retrieval_core.py](tests/test_retrieval_core.py)
- Instantiate RetrievalService in offline mode: ensure both embedding_model and faiss_index are None so code paths use mock results inside [RetrievalService.retrieve()](backend/api/retriever.py:1237).
- Use representative queries ("Sir Ector", "House Pendragon", "magic").
- Assert:
  - Results is a list of dicts; each has 'content' and optional 'entities'.
  - len(results) ≤ requested k; no exceptions thrown.
- Do not rely on presence of artifacts in store/; tests remain self-contained.

## Auxiliary config files

### pytest.ini (root)

```ini
[pytest]
testpaths = tests
norecursedirs = legacy
addopts = -q
```

### Optional tests/conftest.py

```python
import os
import random
import numpy as np
import pytest

@pytest.fixture(autouse=True, scope="session")
def _seed_all():
    random.seed(1337)
    np.random.seed(1337)
    os.environ["PYTHONHASHSEED"] = "1337"

@pytest.fixture
def fake_sentence_transformer(monkeypatch):
    class FakeModel:
        def get_sentence_embedding_dimension(self):
            return 32
        def encode(self, texts, batch_size=64, normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False):
            import numpy as _np
            rng = _np.random.default_rng(123)
            vecs = rng.standard_normal((len(texts), 32), dtype=_np.float32)
            if normalize_embeddings:
                vecs = vecs / _np.linalg.norm(vecs, axis=1, keepdims=True)
            return vecs
    import sentence_transformers
    monkeypatch.setattr(sentence_transformers, "SentenceTransformer", lambda *_args, **_kw: FakeModel())
    return True
```

## CI integration
- CI command: `pytest -q` (pytest.ini enforces fast path).
- Legacy excluded via norecursedirs; no network required, so runners do not need model caches or GPUs.
- Optionally add a separate manual workflow/job to run legacy tests: `pytest -q tests/legacy`.

## Migration steps
1) Create [tests/legacy](tests/legacy) and move all existing tests there (keep [tests/__init__.py](tests/__init__.py) at root).
2) Add [pytest.ini](pytest.ini) and optional [tests/conftest.py](tests/conftest.py).
3) Add four core tests listed above.
4) Validate locally: `pytest -q` collects exactly 4 tests and passes in <60s.
5) Update CI workflow to run `pytest -q` at repo root.
6) Document how to run legacy tests locally (see below).

## How to run
- Core suite (CI/default): `pytest -q`
- Legacy only: `pytest -q tests/legacy`
- With detailed output: remove -q or run `pytest -vv`

## Rationale
- Targets the actual seams of the pipeline with minimal dependencies.
- Reduces flakiness from heavy model downloads and FAISS variants.
- Keeps legacy artifacts available for reference without blocking CI.

## Risks and mitigations
- Risk: FAISS binary not present → Mitigation: fallback path via [FAISSBuilder._build_simple_index()](backend/pipeline/indexing/build_faiss.py:274).
- Risk: Code drift breaks mocks → Mitigation: keep fixture adapters small and update when interfaces change.
- Risk: Hidden regressions outside core → Mitigation: keep legacy tests runnable on-demand and add smoke tags later if needed.

## Acceptance criteria
- `pytest -q` executes only the 4 core tests and passes in <60s on CI.
- No real model or index downloads occur; tests pass offline.
- Legacy tests reside under [tests/legacy](tests/legacy) and are not collected by default.

---

# Extended Test Suite Rebuild Plan (Comprehensive Version)

This document extends and deepens the earlier plan. It formalizes design goals, migration mechanics, coverage boundaries, mocking patterns, runtime contracts, CI wiring, and future-proofing guidelines. The intent is to deliver a deterministic, offline, maintainable, and fast test suite centered on four core systems, while preserving all existing tests as “legacy” for optional/manual execution.

Targets and canonical code anchors:
- Chunking entrypoint: [MarkdownChunker.process_markdown_file()](backend/pipeline/ingestion/chunk_md.py:442)
- Embedding entrypoint: [EmbeddingBuilder._generate_embeddings()](backend/pipeline/indexing/build_embeddings.py:166)
- Vector indexing (FAISS + fallback): [FAISSBuilder._build_flat_ip_index()](backend/pipeline/indexing/build_faiss.py:179), [FAISSBuilder._build_simple_index()](backend/pipeline/indexing/build_faiss.py:274)
- Retrieval (mock/offline): [RetrievalService.retrieve()](backend/api/retriever.py:1237)

These anchors are stable seam points that let us validate behavior without external dependencies, network downloads, or environment coupling.

## 1) Rationale and Goals

- Determinism first:
  - No network I/O (no model downloads, no HTTP calls).
  - No hidden global state; seeded RNG.
  - Only small, synthetic, programmatically generated data.
- Speed and focus:
  - CI must complete “core” tests in under 60 seconds (hard cap).
  - Four tests in total for CI; zero “slow” labels in default profile.
- Maintainability:
  - Each test isolates a single core responsibility and asserts a crisp, observable contract.
  - Test failure messages point to user-actionable guidance, not just stack traces.
- Safety and optional depth:
  - All existing tests moved to tests/legacy for opt-in use locally.
  - We keep a pathway to re-enable e2e/smoke in separate workflows or local runs.

Non-goals:
- We do not attempt to exercise GPU paths, cross-encoder reranker flows, or hybrid retrieval pipelines in CI by default.
- We do not require FAISS to be present; we must gracefully fallback.

## 2) Architecture Map for Testability

- Chunking:
  - Deterministic behavior via in-memory markdown and a monkeypatched config for [MarkdownChunker._load_config](backend/pipeline/ingestion/chunk_md.py:71).
  - Quality gates driven by token counts from [MarkdownChunker._count_tokens](backend/pipeline/ingestion/chunk_md.py:312) (approximation acceptable for tests).
- Embedding:
  - “Fake model” replacing SentenceTransformer (no download), plugged into [EmbeddingBuilder.__init__](backend/pipeline/indexing/build_embeddings.py:33) and exercised through [EmbeddingBuilder._generate_embeddings()](backend/pipeline/indexing/build_embeddings.py:166).
  - Verifies output shape and normalization invariants.
- Vector Indexing:
  - FAISS path (if available) through [FAISSBuilder._build_flat_ip_index()](backend/pipeline/indexing/build_faiss.py:179).
  - Fallback path through [FAISSBuilder._build_simple_index()](backend/pipeline/indexing/build_faiss.py:274) using stored vectors and metadata shape sanity.
- Retrieval:
  - Mock path in [RetrievalService._mock_search](backend/api/retriever.py:1428) and [RetrievalService._mock_search_simple](backend/api/retriever.py:1689), reached by ensuring no FAISS index and no embedding model are attached in [RetrievalService.retrieve()](backend/api/retriever.py:1237).
  - Validates response shape, k cap, and absence of exceptions across representative queries.

## 3) Source-of-Truth Contracts

### 3.1 Chunking: Contract

- Given a markdown document with nested headers (h1/h2/h3), [MarkdownChunker.process_markdown_file()](backend/pipeline/ingestion/chunk_md.py:442) must:
  - Produce ≥1 chunk.
  - Each chunk includes: section_id, domain_type, chunk_index, header_path, token_count, and content text (see [ChunkMetadata](backend/pipeline/ingestion/chunk_md.py:24)).
  - Token counts lie within [token_min, token_max]; longer sections are split via [_split_long_content](backend/pipeline/ingestion/chunk_md.py:393).
  - Default domain_type is “general_lore” when auto-detection doesn’t match (see [_determine_domain_type](backend/pipeline/ingestion/chunk_md.py:170)).

### 3.2 Embedding: Contract

- Given N texts, [EmbeddingBuilder._generate_embeddings](backend/pipeline/indexing/build_embeddings.py:166) returns:
  - A matrix of shape (N, D) where D matches FakeModel.get_sentence_embedding_dimension().
  - Dtype float32.
  - If normalization is enabled in config, rows have unit L2 norm ±1e-3 tolerance.

### 3.3 Vector Indexing: Contract

- Given vectors shaped (M, D) and normalized:
  - With FAISS present, [FAISSBuilder._build_flat_ip_index()](backend/pipeline/indexing/build_faiss.py:179) produces an index accepting queries and returning k nearest neighbors without error.
  - Without FAISS, fallback [FAISSBuilder._build_simple_index()](backend/pipeline/indexing/build_faiss.py:274) constructs an in-memory cosine searcher of size M; exposed vector/metadata shapes match inputs.

### 3.4 Retrieval: Contract

- Given representative queries, [RetrievalService.retrieve()](backend/api/retriever.py:1237) with no index and no model:
  - Executes mock search paths.
  - Returns list[dict] with fields: content, similarity (when present, 0..1), optional entities, optional metadata keys.
  - Respects k cap (≤ requested k; default upstream contract ≤5).

## 4) Directory and File Layout

- New “core” tests (collected in CI):
  - [tests/test_chunking_core.py](tests/test_chunking_core.py)
  - [tests/test_embedding_core.py](tests/test_embedding_core.py)
  - [tests/test_vector_index_core.py](tests/test_vector_index_core.py)
  - [tests/test_retrieval_core.py](tests/test_retrieval_core.py)
- Legacy tests:
  - Create [tests/legacy](tests/legacy) and move all existing files there except [tests/__init__.py](tests/__init__.py).
  - Exclude `legacy/` via pytest.ini norecursedirs.
- Config:
  - Root [pytest.ini](pytest.ini)
  - Optional [tests/conftest.py](tests/conftest.py) for RNG seeding and fixtures.

## 5) Pytest Configuration

Recommended pytest.ini:

```
[pytest]
testpaths = tests
norecursedirs = legacy
addopts = -q
```

- testpaths only includes tests.
- norecursedirs ignores tests/legacy/.
- addopts -q keeps CI output concise.

Optional markers:
- If we later add a slow smoke test, we’ll adopt markers and default to `-m "not slow"`.

## 6) Shared Fixtures and Seeding (tests/conftest.py)

Purposes:
- Enforce deterministic RNG.
- Provide a Fake SentenceTransformer that mirrors API used in [EmbeddingBuilder._generate_embeddings()](backend/pipeline/indexing/build_embeddings.py:166).
- Provide a context fixture to monkeypatch config loaders to in-memory dicts.

Example (concise):

```
import os
import random
import numpy as np
import pytest

@pytest.fixture(autouse=True, scope="session")
def _seed_all():
    random.seed(1337)
    np.random.seed(1337)
    os.environ["PYTHONHASHSEED"] = "1337"

@pytest.fixture
def fake_sentence_transformer(monkeypatch):
    class FakeModel:
        def get_sentence_embedding_dimension(self):
            return 32
        def encode(self, texts, batch_size=64, normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False):
            rng = np.random.default_rng(123)
            vecs = rng.standard_normal((len(texts), 32), dtype=np.float32)
            if normalize_embeddings:
                norms = np.linalg.norm(vecs, axis=1, keepdims=True)
                norms[norms == 0] = 1.0
                vecs = vecs / norms
            return vecs
    import sentence_transformers
    monkeypatch.setattr(sentence_transformers, "SentenceTransformer", lambda *_args, **_kw: FakeModel())
    return True

@pytest.fixture
def minimal_chunking_config():
    return {
        "chunking": {
            "token_target": 320,
            "token_min": 120,
            "token_max": 450,
            "overlap_pct": 0.15
        },
        "domains": {}
    }
```

## 7) Core Test Specifications

### 7.1 tests/test_chunking_core.py

Intent: validate that [MarkdownChunker.process_markdown_file()](backend/pipeline/ingestion/chunk_md.py:442) produces structurally correct chunks and respects token bounds, using temp markdown and a minimal in-memory config.

Scope:
- Header detection priority (h3 → h2 → h1 fallback).
- Long-section splitting via [_split_long_content](backend/pipeline/ingestion/chunk_md.py:393).
- Non-empty content with at least minimal quality gates per [_should_reject_chunk](backend/pipeline/ingestion/chunk_md.py:371).

Plan (pseudocode):
1) Monkeypatch [MarkdownChunker._load_config](backend/pipeline/ingestion/chunk_md.py:71) to return minimal_chunking_config.
2) Create a temp .md file:
   - h1 “World”
   - h2 “Magic”
   - h3 “Basics”
   - h3 “Advanced” with repeated sentences to exceed token_max.
3) Call process_markdown_file.
4) Assert:
   - total_chunks ≥ 1
   - For chunks from “Advanced” section, total yields >1 via splitting
   - token_count within [token_min, token_max] for all yielded chunks unless explicitly testing split boundaries
   - header_path present; section_id non-empty and stable (format insensitive)
5) Negative check:
   - Whitespace-only body should be rejected per “Empty content”.

Edge-case note:
- Token estimation is approximate; we keep assertions tolerant (e.g., verify split occurred, not exact counts).

### 7.2 tests/test_embedding_core.py

Intent: validate shape and normalization properties of [EmbeddingBuilder._generate_embeddings()](backend/pipeline/indexing/build_embeddings.py:166) without real model downloads.

Plan:
1) Monkeypatch [EmbeddingBuilder._load_config](backend/pipeline/indexing/build_embeddings.py:45) to return:
   - vectorization.embedding_model: “FakeModel”
   - vectorization.normalize_embeddings: true
   - vectorization.batch_size: small (e.g., 8)
2) monkeypatch sentence_transformers.SentenceTransformer to FakeModel (fixture).
3) Instantiate EmbeddingBuilder; call _generate_embeddings on three short texts.
4) Assert:
   - embeddings.shape == (3, 32)
   - dtype float32
   - Each row norm within [1-1e-3, 1+1e-3]
5) Sanity: normalization off path (optional): set normalize_embeddings=false and assert row norms differ from ~1.0.

### 7.3 tests/test_vector_index_core.py

Intent: verify both FAISS and fallback index builders in [FAISSBuilder](backend/pipeline/indexing/build_faiss.py:34) can construct indexes from small vectors and accept queries.

Plan:
1) Monkeypatch [FAISSBuilder._load_config](backend/pipeline/indexing/build_faiss.py:52) to yield:
   ```
   {
     "vectorization": {
       "index": {
         "type": "faiss_flat_ip",
         "hnsw": {},
         "ivf": {}
       }
     }
   }
   ```
2) Synthesize normalized vectors: V in R^(20×16).
3) Try FAISS path:
   - If import faiss succeeds, call [FAISSBuilder._build_flat_ip_index](backend/pipeline/indexing/build_faiss.py:179).
   - Query: transform one vector into shape (1, D), run `index.search(...)` — or if the wrapper signature differs, adapt to minimal supported call (`index.search` returning distances, indices).
4) Fallback path:
   - If FAISS import fails, call [FAISSBuilder._build_simple_index](backend/pipeline/indexing/build_faiss.py:274) and assert the index exposes the right lengths or callable search analog.
5) Assertions:
   - No exceptions; index build returns object.
   - “Vector count present” matches V rows.

Notes:
- This test must not read from disk (no store/vectors.npy).
- We don’t persist any index file (pure in-memory test).

### 7.4 tests/test_retrieval_core.py

Intent: validate [RetrievalService.retrieve()](backend/api/retriever.py:1237) mock path returns well-formed results and honors k cap, with no vector artifacts.

Plan:
1) Construct RetrievalService with default config path [backend/config/rag.xml](backend/config/rag.xml). The service handles missing FAISS gracefully; we do not need to load vectors.
2) Force state to offline:
   - `service.faiss_index = None`
   - `service.embedding_model = None`
3) Queries:
   - “Tell me about Sir Ector”
   - “What is House Pendragon?”
   - “Describe magic in Logres”
4) Call `service.retrieve(query, top_k=3)` and assert:
   - `isinstance(results, list)`
   - `len(results) <= 3`
   - Top result includes ‘content’ key; optional ‘entities’ list fine
5) Negative path:
   - Empty/whitespace query either raises validation or returns empty list. Accept either outcome; assert no crash.

## 8) Migration Mechanics: Moving Legacy Tests

Target directory: [tests/legacy](tests/legacy)

Move every file in tests/ except:
- [tests/__init__.py](tests/__init__.py)
- The four new core tests

Examples (to be moved):
- [tests/test_embedding_builder.py](tests/test_embedding_builder.py)
- [tests/test_retrieval_direct.py](tests/test_retrieval_direct.py)
- [tests/test_retrieval_edge_cases.py](tests/test_retrieval_edge_cases.py)
- [tests/test_phase4_improvements.py](tests/test_phase4_improvements.py)
- [tests/test_faiss_loading.py](tests/test_faiss_loading.py)
- [tests/test_llm_integration_e2e.py](tests/test_llm_integration_e2e.py)
- [tests/test_full_pipeline.py](tests/test_full_pipeline.py)
- [tests/test_entity_linker.py](tests/test_entity_linker.py)
- [tests/test_config_fix.py](tests/test_config_fix.py)
- [tests/test_comprehensive_improvements.py](tests/test_comprehensive_improvements.py)
- [tests/test_api_consolidated_fixed.py](tests/test_api_consolidated_fixed.py)
- [tests/test_error_handling.py](tests/test_error_handling.py)
- [tests/test_faiss_import.py](tests/test_faiss_import.py)
- [tests/test_faiss_kpi.py](tests/test_faiss_kpi.py)
- [tests/test_faiss_loading.py](tests/test_faiss_loading.py)
- [tests/test_full_export.py](tests/test_full_export.py)
- [tests/test_generation.py](tests/test_generation.py)
- [tests/test_generator_config.py](tests/test_generator_config.py)
- [tests/test_generator_improvements.py](tests/test_generator_improvements.py)
- [tests/test_generator.py](tests/test_generator.py)
- [tests/test_indexing.py](tests/test_indexing.py)
- [tests/test_ingestion_pipeline_consolidated.py](tests/test_ingestion_pipeline_consolidated.py)
- [tests/test_llm_client_improvements.py](tests/test_llm_client_improvements.py)
- [tests/test_npc_api.py](tests/test_npc_api.py)
- [tests/test_npc_with_real_rag.py](tests/test_npc_with_real_rag.py)
- [tests/test_openrouter_api.py](tests/test_openrouter_api.py)
- [tests/test_openrouter_simple.py](tests/test_openrouter_simple.py)
- [tests/test_performance.py](tests/test_performance.py)
- [tests/test_phase4_retrieval_api.py](tests/test_phase4_retrieval_api.py)
- [tests/test_phase4_step1.py](tests/test_phase4_step1.py)
- [tests/test_phase4_step2.py](tests/test_phase4_step2.py)
- [tests/test_phase4_step3.py](tests/test_phase4_step3.py)
- [tests/test_phase4_step4.py](tests/test_phase4_step4.py)
- [tests/test_quality_gates.py](tests/test_quality_gates.py)
- [tests/test_simple_retrieval.py](tests/test_simple_retrieval.py)
- [tests/test_utils.py](tests/test_utils.py)

CI will ignore tests/legacy via pytest.ini.

## 9) CI Wiring

Default step:
- `pytest -q`

Why this suffices:
- pytest.ini restricts discovery to tests and excludes legacy.
- No cache or model downloads required.
- Works for Windows and Linux runners (no shell-specific commands).

Optional separate jobs:
- “legacy-smoke” job that runs a subset of legacy tests (tag later).
- “full-legacy” job (manual trigger) for deep regression.

## 10) Developer Workflows

- Core CI-default suite:
  - `pytest -q`
- Local legacy:
  - `pytest -q tests/legacy`
- Verbose debugging:
  - `pytest -vv`
- Single test focus:
  - `pytest tests/test_chunking_core.py::test_splits_long_sections -vv`

## 11) Mocking and Isolation Guidelines

- Never call real SentenceTransformer or FAISS-dependent paths in CI defaults.
- Use monkeypatch for:
  - Config loader of chunker and builders.
  - SentenceTransformer class import in [EmbeddingBuilder.__init__](backend/pipeline/indexing/build_embeddings.py:33).
- Data generation:
  - Use reproducible RNG; no reliance on file content in lore/ for core tests.

## 12) Performance Budgets

- Core suite: ≤60 seconds total; individual tests generally < 3s.
- Avoid progress bars and heavy loops; tiny inputs (<50 instances).
- Keep vector dimensionality small (≤32) and counts low (≤20).

## 13) Error Messaging / Assertions

- Chunking:
  - If zero chunks produced, show header summary and token thresholds.
- Embedding:
  - If shape mismatch, print expected dimension from fake model.
  - If normalization deviates, include mean norm and tolerance.
- Indexing:
  - If FAISS import present but API call fails, emit version-hint guidance.
- Retrieval:
  - If not list or wrong shape, dump one example item.

## 14) Example Test Skeletons

Chunking (illustrative, not exhaustive):
```
def test_chunking_headers_and_splits(tmp_path, monkeypatch, minimal_chunking_config):
    from backend.pipeline.ingestion.chunk_md import MarkdownChunker
    monkeypatch.setattr(MarkdownChunker, "_load_config", lambda self, _: minimal_chunking_config)
    content = "# World\n\n## Magic\n\n### Basics\n\nShort.\n\n### Advanced\n\n" + ("This is a long sentence. " * 300)
    p = tmp_path / "doc.md"
    p.write_text(content, encoding="utf-8")
    chunker = MarkdownChunker()
    result = chunker.process_markdown_file(p)
    assert result.total_chunks >= 1
    assert all(c.token_count > 0 for c in result.chunks)
    assert any("Advanced" in " ".join(c.header_path) for c in result.chunks)
```

Embedding:
```
def test_embedding_shape_and_norm(monkeypatch, fake_sentence_transformer):
    from backend.pipeline.indexing.build_embeddings import EmbeddingBuilder
    def fake_cfg(_self, _path):
        return {"vectorization": {"embedding_model": {"value": "fake"}, "normalize_embeddings": True, "batch_size": 8}}
    monkeypatch.setattr(EmbeddingBuilder, "_load_config", fake_cfg)
    eb = EmbeddingBuilder("any.xml")
    X = eb._generate_embeddings(["a", "b", "c"])
    assert X.shape == (3, 32)
    import numpy as np
    norms = np.linalg.norm(X, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-3)
```

Indexing:
```
def test_index_builds_with_or_without_faiss(monkeypatch):
    from backend.pipeline.indexing.build_faiss import FAISSBuilder
    def fake_cfg(_self, _path):
        return {"vectorization": {"index": {"type": "faiss_flat_ip", "hnsw": {}, "ivf": {}}}}
    monkeypatch.setattr(FAISSBuilder, "_load_config", fake_cfg)
    import numpy as np
    V = np.random.randn(20, 16).astype("float32")
    V /= np.linalg.norm(V, axis=1, keepdims=True)
    builder = FAISSBuilder("any.xml")
    try:
        idx = builder._build_flat_ip_index(V)
        # Optionally probe a query if API available
    except Exception:
        idx = builder._build_simple_index(V)
    assert idx is not None
```

Retrieval:
```
def test_retrieval_mock_mode():
    from backend.api.retriever import RetrievalService
    svc = RetrievalService()
    svc.faiss_index = None
    svc.embedding_model = None
    results = svc.retrieve("Tell me about Sir Ector", top_k=3)
    assert isinstance(results, list)
    assert len(results) <= 3
    if results:
        assert "content" in results[0]
```

## 15) Backward Compatibility and Escape Hatches

- Developers may still run any legacy test manually.
- We can add a local-only smoke for FAISS presence and mark it `@pytest.mark.slow` later; CI default remains fast.

## 16) Risk Register

- FAISS API variance:
  - Symptom: `.search` signature differences across wheels.
  - Mitigation: keep the test minimal; if `.search` throws, fall back to simple index path.
- SentenceTransformer import errors:
  - Mitigation: monkeypatch at import callsite; avoid any model downloads.
- Platform path differences (Windows vs POSIX):
  - Mitigation: use `pathlib.Path` and `tmp_path` for file ops; no hard-coded separators.

## 17) Success Criteria

- `pytest -q` (on a clean machine) collects and runs exactly 4 tests and passes.
- Runtime ≤ 60 seconds consistently.
- No internet access required.
- Clear failure diagnostics if invariants regress.

## 18) Implementation Checklist (Actionable)

- Create [tests/legacy](tests/legacy).
- Move all existing tests (except [tests/__init__.py](tests/__init__.py)) into `tests/legacy`.
- Add [pytest.ini](pytest.ini) defining `norecursedirs = legacy`.
- Add [tests/conftest.py](tests/conftest.py) with:
  - seeded RNG
  - fake sentence transformer fixture
  - minimal chunking config fixture
- Create core tests:
  - [tests/test_chunking_core.py](tests/test_chunking_core.py)
  - [tests/test_embedding_core.py](tests/test_embedding_core.py)
  - [tests/test_vector_index_core.py](tests/test_vector_index_core.py)
  - [tests/test_retrieval_core.py](tests/test_retrieval_core.py)
- Local validation:
  - `pytest -q` returns 4 passing tests.

## 19) Mapping Old → Legacy

Categorize by behavior:

- Heavy model / integration:
  - [tests/test_llm_integration_e2e.py](tests/test_llm_integration_e2e.py)
  - [tests/test_full_pipeline.py](tests/test_full_pipeline.py)
  - [tests/test_retrieval_integration.py](tests/test_retrieval_integration.py)
- Retrieval API and edge cases:
  - [tests/test_retrieval_direct.py](tests/test_retrieval_direct.py)
  - [tests/test_retrieval_edge_cases.py](tests/test_retrieval_edge_cases.py)
  - [tests/test_phase4_retrieval_api.py](tests/test_phase4_retrieval_api.py)
- Indexing / FAISS specific:
  - [tests/test_faiss_import.py](tests/test_faiss_import.py)
  - [tests/test_faiss_loading.py](tests/test_faiss_loading.py)
  - [tests/test_indexing.py](tests/test_indexing.py)
- Generator and API:
  - [tests/test_generator.py](tests/test_generator.py)
  - [tests/test_generator_config.py](tests/test_generator_config.py)
  - [tests/test_generator_improvements.py](tests/test_generator_improvements.py)
  - [tests/test_api_consolidated_fixed.py](tests/test_api_consolidated_fixed.py)
- Etc.

All above go under tests/legacy/ and excluded from CI default.

## 20) Future Extensions (Not for CI default)

- Add a once-a-day/nightly job to run a tagged smoke e2e test against a known, small vector/index bundle.
- Add contract tests around reranker integration through [BGERerankerV2M3.rerank_batch()](backend/pipeline/retrieval/rerank_bge_m3.py:279) guarded by an availability check and `@pytest.mark.slow`.

## 21) References to Key APIs (for maintainers)

- Markdown chunking:
  - [MarkdownChunker.process_markdown_file()](backend/pipeline/ingestion/chunk_md.py:442)
  - [MarkdownChunker._split_long_content()](backend/pipeline/ingestion/chunk_md.py:393)
  - [MarkdownChunker._should_reject_chunk()](backend/pipeline/ingestion/chunk_md.py:371)
- Embedding:
  - [EmbeddingBuilder._generate_embeddings()](backend/pipeline/indexing/build_embeddings.py:166)
  - [EmbeddingBuilder._load_config()](backend/pipeline/indexing/build_embeddings.py:45)
- Index building:
  - [FAISSBuilder._build_flat_ip_index()](backend/pipeline/indexing/build_faiss.py:179)
  - [FAISSBuilder._build_simple_index()](backend/pipeline/indexing/build_faiss.py:274)
  - [FAISSBuilder._validate_inputs()](backend/pipeline/indexing/build_faiss.py:134) (not used in core tests; prefer in-memory)
- Retrieval service:
  - [RetrievalService.retrieve()](backend/api/retriever.py:1237)
  - [RetrievalService._mock_search()](backend/api/retriever.py:1428)
  - [RetrievalService._mock_search_simple()](backend/api/retriever.py:1689)

## 22) Appendix: Example Minimal Config Dicts

Chunking minimal config:
```
{
  "chunking": {
    "token_target": 320,
    "token_min": 120,
    "token_max": 450,
    "overlap_pct": 0.15
  },
  "domains": {}
}
```

Embedding minimal config:
```
{
  "vectorization": {
    "embedding_model": {"value": "fake"},
    "normalize_embeddings": true,
    "batch_size": 8
  }
}
```

Index minimal config:
```
{
  "vectorization": {
    "index": {
      "type": "faiss_flat_ip",
      "hnsw": {},
      "ivf": {}
    }
  }
}
```

## 23) Appendix: Troubleshooting Cheatsheet

- Symptom: Embedding test tries to download a model.
  - Cause: SentenceTransformer not monkeypatched.
  - Fix: Ensure tests/conftest.py fixture is applied; verify import path matches usage in [EmbeddingBuilder.__init__](backend/pipeline/indexing/build_embeddings.py:33).

- Symptom: FAISS path throws TypeError on `index.add` or `index.search`.
  - Cause: Wheel API signature mismatch.
  - Fix: Catch exception and exercise fallback [FAISSBuilder._build_simple_index()](backend/pipeline/indexing/build_faiss.py:274) path.

- Symptom: Chunking token counts differ across machines.
  - Cause: tiktoken availability vs fallback logic in [_count_tokens](backend/pipeline/ingestion/chunk_md.py:312).
  - Fix: Keep assertions broad (e.g., “split occurred” vs exact thresholds).

- Symptom: Retrieval test returns empty list for valid queries.
  - Cause: Different mock route or filters; ensure [RetrievalService.initialize](backend/api/retriever.py:349) isn’t forcing missing artifacts into error states.
  - Fix: Directly call `retrieve` in mock mode with `faiss_index=None` and `embedding_model=None`.

## 24) Final Acceptance

The suite is considered rebuilt when:
- Only the four core tests run in CI.
- All pass consistently in under 60 seconds without internet.
- Legacy tests are preserved under tests/legacy and excluded by default.

Once implemented, add a short “How to run tests” section in README pointing to this plan for details.
