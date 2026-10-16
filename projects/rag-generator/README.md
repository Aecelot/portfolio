# RAG Generator

> **Example project, early prototype.** This is a sanitized copy of an early prototype / MVP, published as
> a code sample. It is **not used in production**. The original was built on private game-world lore;
> that content is removed and replaced by a small public-domain corpus (see `corpus/`). Source commit:
> `f956897` (snapshot of 2026-10-16). Some tests fail, as they did in the original; see
> [Status](#status).

A retrieval-augmented generation (RAG) prototype for question answering over a body of narrative text.
It covers the full path from documents to grounded answers:

```
corpus/*.md
   │  chunk by headings, link named entities (data/entities.xml, data/alias_map.json)
   ▼
store/meta.jsonl           ← src/rag/pipeline/ingestion
   │  embed chunks, build FAISS index
   ▼
vectors + FAISS index      ← src/rag/pipeline/indexing
   │  hybrid search, graph-based evidence, cross-encoder rerank
   ▼
ranked evidence            ← src/rag/pipeline/retrieval, src/rag/core/graphfast
   │  prompt building, LLM call
   ▼
grounded answer            ← src/rag/pipeline/generation, src/rag/prompt_enhancement
```

## What it demonstrates

- **Ingestion**: Markdown chunking with token bounds, entity linking against an alias map, and quality
  gates (entity coverage, rejection rate) in `src/rag/pipeline/ingestion`.
- **Retrieval**: FAISS vector search, a compact graph store for entity relationships ("GraphFast"), a
  query router and a multi-signal scoring engine in `src/rag/api` and `src/rag/core`.
- **Evaluation**: golden-query evaluation and KPI collection (recall, entity hit rate, latency) in
  `tools/evaluate_golden_retrieval.py`, `src/rag/kpi_collector.py` and `config/rag/evaluation_config.xml`.
- **Prompting**: structured prompt assembly with injected memory and evidence in
  `src/rag/prompt_enhancement`.
- **Configuration**: XML-driven pipeline settings in `config/rag/`.
- **Design notes**: `docs/` holds the design documents and research notes written while building it. The files in `docs/research/` are AI-assisted literature summaries that I used as input, not original research.

## Sample corpus

`corpus/` has four chapters of Sir Thomas Malory's *King Arthur and the Knights of the Round Table*
(Project Gutenberg eBook #36462, public domain in the US). It stands in for the private lore used in
the original.

## Try it

Python 3.11. Use UTF-8 mode on Windows (`set PYTHONUTF8=1`).

```bash
pip install -r requirements.txt

# 1. Ingest the sample corpus into chunks with linked entities
python -m src.rag.pipeline.ingestion.build_jsonl     # writes storage/store/meta.jsonl

# 2. Run the tests
python -m pytest tests
```

Checked when this copy was made: step 1 runs and exports 21 chunks with 138 linked entities from one
chapter. Embedding and indexing (`make embed`, `make index`) download an embedding model and were not run.

## Status

- This is a prototype. Several modules were rewritten during development, and parts of the `Makefile`
  and the demo scripts refer to an earlier layout.
- Tests: some pass and some fail. The failures were already present in the original and are not
  fixed here: `test_embedding_core`, parts of `test_context_injection`, `test_graphfast_basic`,
  `test_graphfast_loaders` and `test_graphfast_service`. (`test_chunking_core` failed in the original and
  passes here after a small fix to the XML type annotations.) `test_retrieval` and the golden-retrieval
  tests need a built index under `storage/store/`.
- Retrieval fallbacks return small hard-coded mock results (paraphrased from the corpus) when no index
  is present.
- No production use, no security review, no load testing.

## Layout

```
corpus/                sample documents (public domain)
data/                  entity list and alias map for the sample corpus
config/rag/            XML pipeline configuration
src/rag/               pipeline, retrieval API, GraphFast graph store, scoring, KPI collection
src/npc/               memory bridge used by the prompt enhancement code
tests/                 unit and integration tests
tools/                 evaluation, index checks, graph build tools
apps/frontend/         KPI dashboard (static HTML)
docs/                  design documents and research notes
```
