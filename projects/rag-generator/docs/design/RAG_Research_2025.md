# RAG Research Dossier — Best Practices & Latest Methods (Updated 2025-10-06)

> Purpose: Concise, implementation‑ready synthesis of state‑of‑the‑art Retrieval‑Augmented Generation (RAG) methods for production systems, with emphasis on hybrid retrieval, graph‑aware techniques, chunking, reranking, prompt/context optimization, and rigorous evaluation.

---

## 1) Executive Summary

- **Hybrid retrieval wins**: combine dense vector search with graph signals or sparse/BM25, plus a lightweight reranker. Expect consistent **+5–15%** gains in precision@k versus dense‑only baselines in recent studies.
- **Graph‑aware RAG** (GraphRAG) is particularly effective for narrative/enterprise corpora: build/induce a knowledge graph from your text and **boost results by entity proximity** (k‑hop/PPR). Use when queries are broad or require global synthesis.
- **Corrective/Selective retrieval**: add a retrieval‑quality gate (CRAG) and only expand or rewrite queries when the first‑stage retrieval is weak — improves robustness and avoids polluting context windows.
- **Query rewriting & fusion**: Multi‑Query (MQ) + RAG‑Fusion (reciprocal rank fusion) increases coverage while keeping latency bounded; HyDE helps zero/few‑shot setups and ambiguous asks.
- **Chunking is task‑dependent**: fixed or shallow semantic chunking plus hierarchical summaries (RAPTOR) and/or auto‑merging yields practical wins without runaway costs; avoid over‑engineering.
- **Reranking is a strong lever**: efficient cross‑encoder or LLM‑as‑judge rerankers (where budget allows) consistently improve hit‑rates and reduce token waste.
- **Budgeted context packing**: deterministic policies with per‑type caps, hard includes, and prompt compression reduce drift, leaks, and cost.
- **Evaluate continuously** with RAG‑specific frameworks (ARES/RAGAS/TruLens). Track precision@k, groundedness, answer relevance, spoiler‑leaks, and token‑waste.

---

## 2) Retrieval Techniques

### 2.1 Dense + Graph (GraphRAG)
- Build a graph of **entities and relations** from your corpus (auto‑extracted or curated).
- Retrieve top‑K via vectors, then **boost by graph proximity** (neighbors, PPR) and content priority.
- Use for “global” queries (e.g., multi‑document story arcs, organizational relationships).

**Implementation notes**
- Store edges in SQLite/Redis; cache k‑hop expansions (60–300 s).
- Down‑weight hub nodes; cap degree to avoid popularity bias.
- Apply **hard filters** (act/era/spoiler) before scoring.

### 2.2 Dense + Sparse (Hybrid)
- Merge vector top‑K with BM25/SPLADE/lexical top‑K; deduplicate; rerank.
- Especially effective on numeric, code‑like, or jargon‑heavy text where lexical signals matter.

### 2.3 Multi‑Query & Fusion
- Generate 3–8 paraphrases/sub‑questions with a small LLM.
- Retrieve per query; combine with **Reciprocal Rank Fusion (RRF)**; rerank.
- Degrade gracefully under latency pressure by adapting #queries.

### 2.4 HyDE (Hypothetical Document Embeddings)
- Synthesize a short hypothetical answer; embed that to retrieve.
- Useful when queries are underspecified or the index is noisy.

### 2.5 Corrective RAG (CRAG) Gate
- **Evaluate retrieval quality** cheaply; if low, trigger MQ/HyDE/web‑style expansion; else proceed.
- Prevents bad context from propagating into generation.

---

## 3) Chunking & Indexing

### 3.1 Practical defaults
- **Chunk size**: 250–500 tokens; **overlap**: 10–15% (only when spans break mid‑sentence).
- Keep **stable IDs** and **consistent metadata** (type, era/act, spoiler, entities/tags, language).

### 3.2 Hierarchical retrieval
- Maintain short **node summaries** for sections; retrieve summaries first, then expand into leaf chunks (RAPTOR/auto‑merging).

### 3.3 Semantic chunking caveats
- Semantic boundaries help coherence but add compute. Favor **simple rules + summaries** unless you have clear wins on your data.

### 3.4 Embeddings
- Proven open models for local/offline: **gte‑small/base** (fast), **bge‑m3** (multilingual, multi‑granularity). Domain models (e.g., legal/biomed) can outperform generalists in specialized corpora.

---

## 4) Reranking

- **Cross‑encoder rerankers** (e.g., BGE‑Reranker family, Voyage Rerank‑2.x, Cohere Rerank v3) provide robust lifts with moderate latency; run only on merged top‑N (e.g., 20–50).
- **LLM‑as‑judge** (RankGPT‑style) achieves SOTA listwise ranking but is expensive; consider for nightly batch re‑ordering or premium queries.
- Efficiency tricks: short‑text reranking (first 256–512 tokens), title‑boosting, and early‑exit thresholds.

---

## 5) Query Understanding

- **Entity resolution**: alias tables + exact/regex matching to seed graph neighbors.
- **Routing**: if detection says “definition/overview”, bias to summaries; if “factoid”, bias to leaf chunks.
- **Rewrite policy**: trigger on low retrieval quality, ambiguous queries, or long‑form synthesis asks.

---

## 6) Context Packing & Prompting

- Reserve **≥50%** of context for the answer.
- Order: system → session vars → author’s note → **hard‑includes** (scene/active entities) → type‑balanced top‑K → recent dialogue.
- **Per‑type caps** (e.g., ≤2 locations, ≤2 factions) and **deterministic tie‑breaks** (priority → doc_id).
- Add **source‑attribution** tags to chunks and instruct the model to cite them back for auditability.
- Consider **prompt compression** (token pruning/selective context) if hitting context limits.

---

## 7) Evaluation & Telemetry

- **Offline**: precision@k for retrieval, groundedness/faithfulness and answer relevance for generation (ARES/RAGAS). Build task‑aligned fixtures.
- **Online**: token‑waste (unused context), spoiler‑leak rate, latency p50/p95, cache hit‑rate.
- **A/B**: compare scorer weights and chunk sizes; watch stability (same input ⇒ same top‑3 most of the time).
- Use judge‑consistency or small tuned judges to stabilize LLM‑based evals.

---

## 8) Recommended Production Patterns

- **Two‑stage retrieval**: Dense top‑K with filters → graph/sparse fusion → rerank top‑N.
- **Adaptive controls**: turn on MQ/HyDE **only when** the quality gate fails.
- **Hot caches**: memoize results by (scene vars, intent hash) for 30–120 s.
- **Author‑time linting**: validate required metadata, spoiler bounds, dangling relations.
- **Nightly maintenance**: rebuild embeddings for changed docs; refresh graph centrality; sample canary queries.

---

## 9) Tooling & Stack Tips

- **Vector DB**: Qdrant/FAISS for local; Pinecone/Weaviate managed.
- **Graph Store**: SQLite/Redis for light edge lookups; Neo4j for heavy graph analytics.
- **Embeddings**: gte‑small/base for speed; bge‑m3 for multilingual; consider domain‑specific Voyage models for legal/financial.
- **Rerankers**: bge‑reranker‑v2/v2.5 (open), Cohere Rerank v3 (hosted), Voyage rerank‑2.x (hosted).
- **Eval**: ARES for automated judges; RAGAS/TruLens for pipelines and dashboards.

---

## 10) What to Try First (90‑day plan)

1. **Baseline**: fixed 300‑token chunks; gte‑small; Qdrant; top‑K=24; simple cosine.
2. **Hybrid**: add BM25 merge + bge‑reranker on top‑24 → top‑8.
3. **Graph boost**: entity aliasing + k‑hop whitelist + composite score.
4. **Query rewriting**: gate with CRAG; enable MQ (3 rewrites) or HyDE on fails only.
5. **Hierarchical**: add summaries (RAPTOR/auto‑merge) for overview queries.
6. **Optimize**: caches, prompt compression, deterministic packing.
7. **Evaluate**: weekly A/B on fixtures; cut token waste <25%, leaks → zero.

---

## Appendix A — Minimal Scorer Template

```
final_score = 0.55 * cosine_sim \
            + 0.20 * graph_proximity \
            + 0.15 * reranker_score \
            + 0.10 * priority
```
- Calibrate weights on your fixtures; enforce spoiler/act filters **before** scoring.

---

## Appendix B — References (curated identifiers)

- GraphRAG (Edge et al., 2024; Microsoft Research preprint/blog).
- Corrective RAG (CRAG) — Yan et al., 2024 (arXiv:2401.15884).
- Self‑RAG — Asai et al., 2023 (arXiv:2310.11511).
- RAPTOR — Manning et al., 2024 (arXiv:2401.18059; OpenReview 2024).
- HyDE — Gao et al., 2022 (arXiv:2212.10496).
- Multi‑Query / Rewrite‑Retrieve‑Read — Ma et al., 2023 (EMNLP 2023) and later MQ rewrites (2024–2025).
- Reranking — Cohere Rerank v3; Voyage rerank‑2.x; BGE‑Reranker v2/v2.5; RankGPT; PE‑Rank (2024).
- Embeddings — thenlper/gte‑small; BAAI/bge‑m3 (multi‑lingual/multi‑function).
- Evaluation — ARES (NAACL 2024); RAGAS (EACL 2024 demo); TruLens (framework).
- Prompt/Context compression — xRAG (NeurIPS 2024); surveys on token pruning and LLMLingua/Selective‑Context.
