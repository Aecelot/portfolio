
# Runtime‑First RAG — Development Plan
**Context:** Chunking, embedding, entitying, graph features, and FAISS build occur offline (ample compute). Retrieval runs inside the game runtime (tight CPU/GPU + memory budgets). This plan implements a low‑latency, low‑memory retrieval stack without sacrificing relevance.

---

## 0) Objectives, KPIs, and Constraints

### Primary Objectives
1. **Latency:** p95 end‑to‑end retrieval ≤ 2.0 ms (entity‑first path ≤ 0.5 ms) on PC/console CPU.
2. **Memory:** ≤ 150 MB resident for active shards (index + metadata + caches).
3. **Quality:** ≥ 95% of current cross‑encoder rerank MAP@10 after distillation.
4. **Stability:** Hot‑swap shard loads during level transitions without stalls (>60 FPS).

### KPIs to Track
- p50/p90/p95 latency (per path: cache hit / entity‑first / ANN).
- Recall@k and MRR/MAP@k against a gold query suite.
- CPU time (ANN, scorer, packer), memory footprint (index, caches).
- Cache hit rate by **(normalized_query, state_hash)** key.
- Shard load/unload time; streaming IO throughput.
- Fallback rate to **global** shard; OOM or timeouts.

### Constraints
- CPU‑only viable on mid‑tier hardware; no mandatory GPU usage.
- No network dependency; fully offline in shipping builds.
- Deterministic behavior under fixed seed and versioned artifacts.

---

## 1) Work Breakdown Structure (WBS)

### Phase A — Offline Build Pipeline Upgrades (Weeks 1–3)
A1. **Corpus Sharder**
- Output per‑level/scene shard folders with FAISS + metadata.
- Routing table emits `level_id`, optional `quest_phase` mapping, and default `global` shard.
- **Deliverable:** `artifacts/routing/` + `artifacts/<shard>/` trees.

A2. **Vector Compression & FAISS Indexing**
- Train OPQ/PQ codebooks; build HNSW (or IVF‑PQ) per shard.
- Persist codebooks, quantized codes, and HNSW graph.
- **Deliverable:** `{faiss.index, codebook.bin, vectors.codes, vectors.shape.json}` per shard.

A3. **Entity→TopN Candidate Cache**
- For each entity and frequent entity pairs, precompute top‑N (e.g., 32) chunk IDs by offline heavy scoring.
- **Deliverable:** `entity_topn.json` per shard (and `global/`).

A4. **Distilled Reranker (Tiny Scorer)**
- Generate q–doc pairs; run cross‑encoder offline to produce target scores.
- Train logistic regression or 2‑layer MLP on features:
  - `semantic_sim, entity_overlap, type_match, canon_level, graph_boost, bm25_lite`
- **Deliverable:** `tiny_scorer.json` (weights, feature norms, version).

A5. **BM25‑Lite Sparse Index per Shard**
- Tokenize and store compact postings for the shard only.
- **Deliverable:** `bm25.idx` + `term_dict.json` per shard.

A6. **Pre‑Packed Context Strips**
- For each chunk, generate three variants (abstract, quote‑first, stat‑first) with token budgets.
- **Deliverable:** `context_strips.jsonl` per shard.

A7. **Schema & Versioning**
- Artifact manifest: version, hash, feature set, index params, language, locale.
- **Deliverable:** `manifest.json` per shard; `routing_manifest.json` global.

---

### Phase B — Runtime Retrieval Service (Weeks 2–5)
B1. **Shard Router**
- Inputs: `level_id`, `quest_phase`, `active_entities[]`.
- Policy: strict route to shard; fallback: `global` if missing.
- **Deliverable:** `router/ShardRouter.h/.cpp` with async prefetch hooks.

B2. **Shard Loader (MMAP + Async)**
- Memory‑map FAISS codes and metadata; async load next shard on transition signal.
- LRU manage in‑RAM shards: `current`, `global`, `prefetch_next`.
- **Deliverable:** `storage/ShardLoader.h/.cpp` + thread‑safe guards.

B3. **Entity‑First Fast Path**
- If `active_entities` non‑empty, fetch union/intersection of `entity_topn.json` for those entities.
- Apply Tiny Scorer over candidates; skip ANN entirely when possible.
- **Deliverable:** `retrieval/EntityFastPath.h/.cpp`.

B4. **ANN Path (Shard‑Local)**
- HNSW search over quantized codes; tunable efSearch by profile.
- Optional prefilter: entity bitsets or type filter reduce candidate pool before ANN.
- **Deliverable:** `retrieval/ANNAdapter.h/.cpp` with metrics hooks.

B5. **BM25‑Lite Mixer**
- Tokenize query; compute BM25 on shard postings; produce normalized score.
- **Deliverable:** `ranking/BM25Lite.h/.cpp`.

B6. **Tiny Scorer (Distilled Reranker)**
- Feature assembly (cheap): semantic_sim (from ANN distance), entity_overlap, type_match, canon_level, graph_boost, bm25_lite.
- Apply logistic/MLP with JSON weights; SIMD‑friendly code.
- **Deliverable:** `ranking/TinyScorer.h/.cpp` + unit tests against offline golden outputs.

B7. **Packer & Caching**
- **Cache key:** `(norm_query_or_signature, state_hash)`.
- Cache **final packed** context (already token‑bounded).
- Packer only concatenates pre‑built context strips based on caller `intent` (quote/abstract/stat).
- **Deliverable:** `packing/ContextPacker.h/.cpp` + `cache/ResultCache.h/.cpp`.

B8. **Public API (In‑Process or IPC)**
- `RetrieveFast(Request) -> Response`
- Request fields: `query?`, `level_id`, `quest_phase?`, `active_entities[]?`, `intent`, `profile`, `locale`.
- Response: `contexts[]` (text, chunk_id, features), `timings`, `shard_id`, `path_used`.
- **Deliverable:** `api/RetrieveFast.h/.cpp` + bindings (the game engine C++/Blueprint).

---

### Phase C — Profiles, Tuning, and Tooling (Weeks 4–6)
C1. **Performance Profiles**
- `profiles/low.json` (handheld), `profiles/console.json`, `profiles/cinematic.json` with efSearch, topK, cache sizes, thread counts.
- Hot‑switch on mode change (e.g., photo mode, hub areas).

C2. **Benchmark Harness**
- Synthetic & real queries; warm and cold runs; multithread scenarios.
- Track per‑module timings, memory snapshots, and cache hit rates.
- Export CSV + flamegraphs.
- **Deliverable:** `tools/bench/bench_retrieval` + CI job with trend charts.

C3. **A/B Quality Evaluator**
- Compare Tiny Scorer vs cross‑encoder rerank orders on static set.
- Plot MAP/MRR deltas; threshold gating for releases.
- **Deliverable:** `tools/quality/compare_rerank.py` + report.md.

C4. **Shard Build Dashboard**
- Validate manifests, codebook compatibility, posting sizes, strip counts.
- **Deliverable:** `tools/builddash/` HTML report + JSON summaries.

---

### Phase D — Integration & Rollout (Weeks 6–8)
D1. **the game engine Integration**
- Blueprint node & C++ API wrappers (async tasks + latent pins).
- Example gameplay callers (barks, codex lookup, quest hint).

D2. **Streaming & Transitions**
- Level streaming hooks trigger `prefetch_next` shard load.
- Verify frame‑time spikes < 2 ms during swaps.

D3. **Failover & Safeguards**
- On shard load failure: degrade to `global` with a stricter topK and safe prompts.
- Watchdogs for stalled IO; backoff and retry with telemetry.

D4. **Content Ops Playbook**
- How to produce new shards, validate, and ship deltas.
- Version pinning and roll‑back procedure.

---

## 2) Detailed Technical Specs

### 2.1 Artifact Layout (Offline Output)
```
artifacts/
  routing/
    routing_manifest.json
  global/
    faiss.index
    codebook.bin
    vectors.codes
    vectors.shape.json
    manifest.json
    entity_topn.json
    bm25.idx
    term_dict.json
    context_strips.jsonl
  level_arthur/
    ...
  level_slums/
    ...
```

**`manifest.json`**
```json
{
  "version": "rag-shard-v3",
  "encoder": "bge-small-1.5-int8",
  "faiss": {"type":"HNSW_PQ","M":32,"efConstruction":200,"pq":{"m":16,"nbits":8}},
  "opq":{"m":16},
  "locale":"en-US",
  "features":["entity_bitset","type","canon","graph_boost","bm25_lite","strips_v2"],
  "counts":{"chunks": 9821, "entities": 1462}
}
```

**`entity_topn.json`** (excerpt)
```json
{
  "house_pendragon": ["c_1042","c_778","c_390", "..."],
  "sir_ector": ["c_992","c_1001","c_777"]
}
```

**`context_strips.jsonl`** (one per line)
```json
{"chunk_id":"c_1042","abstract":"... ≤180t","quote":""..." ≤160t","stat":"HP:..., Weakness:... ≤120t"}
```

### 2.2 Public API (C++)
```cpp
struct RetrieveRequest {
  std::string query;            // optional free text
  std::string level_id;         // required
  std::string quest_phase;      // optional
  std::vector<std::string> active_entities; // optional
  std::string intent;           // e.g., "lore.factography", "dialogue", "stats"
  std::string profile;          // "low" | "console" | "cinematic"
  std::string locale;           // e.g., "en-US"
};

struct RetrievedContext {
  std::string text;             // pre-packed
  std::string chunk_id;
  float score;
  std::string path_used;        // "cache"|"entity"|"ann"
};

struct RetrieveResponse {
  std::vector<RetrievedContext> contexts;
  std::string shard_id;
  std::map<std::string, double> timings_ms;  // "route", "load", "ann", "bm25", "score", "pack"
  std::string path_used;
};
```

### 2.3 Runtime Decision Flow
1. **Compute `state_hash`** from `(level_id, quest_phase, active_entities[], locale, intent)`.
2. **Cache Lookup** by `(normalized_query_or_signature, state_hash)` → hit? return.
3. **Route** to shard (prefer scene shard; else `global` as fallback).
4. **Entity‑First Path** if `active_entities` present:
   - Retrieve union/intersection candidates from `entity_topn.json`.
   - Compute features & Tiny Scorer → select top‑k → pack strips → cache → return.
5. **ANN Path** otherwise:
   - Optional: prefilter by entity/type bitsets if provided.
   - HNSW+PQ search → semantic sims → BM25‑lite on shard → feature vector → Tiny Scorer → top‑k → pack → cache → return.

### 2.4 Tiny Scorer Inference
```cpp
// Features: [sem_sim, entity_overlap, type_match, canon_level, graph_boost, bm25_norm, bias]
// Logistic regression example
float dot = w0*sem + w1*ent + w2*typ + w3*can + w4*grf + w5*bm25 + b;
float prob = 1.f / (1.f + std::exp(-dot));
```

### 2.5 Profiles
**`profiles/console.json`**
```json
{
  "efSearch": 96,
  "topK": 6,
  "cache": {"entries": 2048, "ttl_s": 120},
  "threads": 2,
  "bm25": true,
  "entity_first_min_entities": 1
}
```

---

## 3) Engineering Tasks & Estimates

> Estimates are conservative, assuming 1 senior C++ engineer + 1 tools engineer + 0.5 data engineer.

| ID | Task | Owner | Estimate |
|---|---|---|---|
| A1 | Sharder & router manifest generator | Tools | 3d |
| A2 | OPQ/PQ training + FAISS build scripts | Data | 4d |
| A3 | Entity→TopN cache generation | Tools | 2d |
| A4 | Distillation pipeline + Tiny Scorer exporter | Data | 5d |
| A5 | BM25‑lite sharded indexer | Tools | 3d |
| A6 | Context strip generator (three variants) | Tools | 2d |
| A7 | Manifest + validation CLI | Tools | 2d |
| B1 | ShardRouter (C++) | Runtime | 3d |
| B2 | ShardLoader (MMAP + async) | Runtime | 5d |
| B3 | Entity‑first fast path | Runtime | 3d |
| B4 | ANN adapter (HNSW+PQ) | Runtime | 4d |
| B5 | BM25‑lite mixer | Runtime | 3d |
| B6 | Tiny Scorer | Runtime | 3d |
| B7 | Packer + ResultCache | Runtime | 3d |
| B8 | Public API + the game engine bindings | Runtime | 4d |
| C1 | Profiles & config hot‑switch | Runtime | 2d |
| C2 | Benchmark harness + CI | Tools | 4d |
| C3 | A/B quality evaluator | Data | 3d |
| C4 | Build dashboard | Tools | 3d |
| D1 | the game engine integration examples | Runtime | 2d |
| D2 | Streaming transition tests | Runtime | 3d |
| D3 | Failover & watchdogs | Runtime | 2d |
| D4 | Content Ops Playbook | Tools | 2d |

Total ~ **55–60 engineering days** (~3 sprints with overlap).

---

## 4) Acceptance Criteria

- **Latency:** p95 ≤ 2 ms (ANN path) and ≤ 0.5 ms (entity path) on target PC/console testbed; cache hits ≤ 0.2 ms.
- **Memory:** Resident ≤ 150 MB with `current + global` shards; streaming swap < 2 ms frame spike.
- **Quality:** Tiny Scorer MAP@10 ≥ 95% of cross‑encoder baseline; no >2% regression in Recall@10 on gold set.
- **Determinism:** Same inputs → identical outputs across runs with fixed artifacts.
- **Stability:** 4h soak test with shard swaps shows zero leaks and <0.5% timeouts.

---

## 5) Test Plan

### Unit Tests
- Router selects correct shard given routing_manifest.
- Entity fast path returns expected candidate set unions/intersections.
- ANN adapter returns consistent neighbors vs FAISS reference.
- Tiny Scorer parity with offline scorer within ε ≤ 1e‑4.
- Packer respects token budgets and intent variants.

### Integration Tests
- End‑to‑end retrieval with fixture shards (small) for all paths.
- Cache behavior (hit/miss/evict/TTL); state_hash impacts keys.
- BM25‑lite adds expected ranking lift on tail queries.
- Manifest version mismatch triggers safe fallback.

### Performance Tests
- Bench 1k synthetic queries, variable `active_entities` density.
- Cold vs warm shard load; streaming overlap tests.
- Thread contention under the game engine game loop.

### Content Validation
- Build dashboard flags overly large postings, disproportionate entity_topn, missing strips.
- Linting for manifests & profile coverage.

---

## 6) Risk Register & Mitigations

- **R1: Tiny Scorer underfits** → Expand feature set (position stats, length norms) and add monotonicity constraints; iterate distillation data.
- **R2: Shard imbalance (hot shard too big)** → Split by sub‑areas or quest arcs; tune entity‑first coverage thresholds.
- **R3: IO stalls on HDD/slow SSD** → Background prefetch earlier; add double‑buffered memory maps.
- **R4: Locale drift** → Separate per‑locale artifacts; locale in state_hash; strict manifest check.
- **R5: Content ops bottleneck** → Provide delta‑builds & validation CLI; pre‑commit hooks for lore changes.

---

## 7) Pseudocode Highlights

### Router + Fast Path
```cpp
auto key = make_cache_key(norm_query_or_sig(req), state_hash(req));
if (cache.get(key, resp)) return resp;

auto shard = router.route(req.level_id, req.quest_phase);
loader.ensureLoaded(shard);

Candidates cand;
if (!req.active_entities.empty()) {
  cand = entityFastPath(shard.entityTopN, req.active_entities);
  if (cand.size() >= K_MIN) return packAndCache(cand);
}

cand = annAdapter.search(shard.faiss, queryVector(req), profile.efSearch);
cand = bm25Mixer.blend(cand, req.query, shard.bm25Index);
auto ranked = tinyScorer.rank(cand);
return packAndCache(ranked);
```

### Tiny Scorer (LogReg)
```cpp
Features f = assembleFeatures(hit, req); // cheap, no transformer
float score = sigmoid(dot(w, f) + b);
```

### Context Packing
```cpp
const Strip& s = chooseStrip(chunkId, req.intent); // abstract | quote | stat
appendWithBudget(buffer, s.text, budget);
```

---

## 8) Telemetry & Observability

- **Counter/timer** per module: route, load, entity, ann, bm25, score, pack, total.
- **Cache stats:** size, hit%, evictions, TTL expiries.
- **Shard IO:** load ms, mapped bytes, current/global/prefetch presence.
- **Quality hooks:** optional sampler that logs top‑k for offline replay against cross‑encoder.

Export: JSON lines to file in dev builds; aggregated to CSV for CI trend charts.

---

## 9) Content‑Ops SOP (for Designers & Writers)

1. Update lore sources → run `tools/build.sh --targets shard:all`.
2. Validate dashboard report → fix red flags.
3. Sign artifacts (`manifest.sig`) and bump `routing_manifest.json` version.
4. Drop into game `Content/RAG/artifacts/`.
5. Smoke test with `/Debug/RAGConsole` UE commandlets (ad‑hoc queries).

---

## 10) Rollout Plan

- **Milestone 1 (Week 3):** Sharded artifacts + ANN path working E2E; baseline benchmarks.
- **Milestone 2 (Week 5):** Entity‑first fast path + Tiny Scorer; quality parity achieved.
- **Milestone 3 (Week 6):** Profiles + BM25‑lite + caching tuned; hit latency targets.
- **Milestone 4 (Week 8):** the game engine integration, streaming swaps stable; content‑ops playbook complete.

---

## 11) Open Questions (Track but do not block)
- Minimum strip budgets per intent across languages?
- Whether to include **pairwise** entity_topn caches beyond top 2 entities (size vs hit rate).
- Exact efSearch per platform SKU (collect via profiler after Milestone 2).

---

## 12) Appendix — CLI & Config Examples

**Build CLI**
```
ragbuild shard --input data/ --out artifacts/ --route routes.yaml
ragbuild pq --vectors vectors.f32 --opq 16 --pq 16x8 --out artifacts/
ragbuild entity-topn --k 32 --out artifacts/
ragbuild strips --budget 180,160,120 --out artifacts/
ragbuild validate --artifacts artifacts/ --report out/report.html
```

**Runtime INI**
```
[RAG]
Profile=console
CacheEntries=2048
CacheTTL=120
ShardDir=Content/RAG/artifacts/
```

---

**Owner:** Runtime Lead (C++), Tools Lead (Python/Go), Data Lead (Python/Sklearn/ONNX)  
**Review cadence:** Twice‑weekly tech sync; weekly KPI dashboards in CI.
