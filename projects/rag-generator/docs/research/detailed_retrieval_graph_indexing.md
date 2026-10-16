# Retrieval, Graph, and Indexing Deep Dive for Lore RAG Runtime RAG

This document expands the retrieval-side improvements from the unified dossier into concrete designs, data schemas, offline build pipelines, and runtime behaviors specific to Lore RAG. It focuses on embeddings, indexing, hybrid dense+lexical search, graph/PathRAG, reranking, routing/sharding, and evaluation.

Repository touchpoints
- api/retriever.py
- src/retrieval/router.py
- src/retrieval/rerank_bge_m3.py
- src/embeddings/arctic_embed.py
- index/build_embeddings.py
- index/build_faiss.py
- src/index/faiss_hnsw.py
- ingestion/link_entities.py
- ingestion/build_jsonl.py
- data/entities.xml
- data/alias_map.json
- config/rag.xml
- src/rag/config/rag.xml

1) Embedding model specialization and compression

Goals
- Reduce runtime latency and memory while preserving ≥95% of teacher MAP on data/gold_queries.json.
- Emit lower-dimension vectors (256–384D) to shrink FAISS footprint and speed distance ops.
- CPU-first inference with int8 where possible.

Offline training pipeline (Listwise distillation)
- Teachers:
  - Cross-encoder (e.g., bge-reranker-v2-m3) used offline only to produce graded relevance lists per query.
  - Strong dual-encoder (e.g., Arctic L) to seed negatives/hard negatives.
- Students:
  - Small dual-encoder (MiniLM-sized) with an output head sized to 256–384D.
- Data:
  - Gold: data/gold_queries.json pairs where available.
  - Synthetic: LLM-generated QA over corpus with coverage of entities, relations, events; include paraphrases and multilingual variants if relevant.
- Loss:
  - Listwise soft labels: minimize KL between student scores over candidate set and teacher normalized scores.
  - In-batch negatives with temperature scaling; add contrastive margin on top-1 vs. hard negatives.
  - Optional orthogonality or variance regularizers to keep embeddings information-dense at low dimensions.
- Hard negative mining:
  - Mine with current student against corpus; iterate 1–2 rounds to keep the student sharp on confusers (similar factions, names, homonyms).

Dimensionality reduction and normalization
- Head projection: train student with 384D head; export a 256D variant (last PCA layer) if latency constraints demand it.
- Length normalization: L2-normalize embeddings at build time; keep runtime query normalization enabled (cheap).
- Quantization:
  - Post-training INT8 quantization for CPU inference.
  - Validate top-1/top-3 deltas vs. FP16 student on gold_queries and synthetic sets.

Runtime loader updates
- src/embeddings/arctic_embed.py
  - Add model choices: teacher (dev-only), student-fp16 (dev validation), student-int8 (runtime).
  - Single-example batch inference; pin threads; no gradient graphs.
  - Optional ONNX/ORT EP CPU for portable, fast inference.

KPIs and acceptance
- Maintain ≥0.95× teacher MAP@k and ≥0.95× Recall@k on data/gold_queries.json.
- P95 embedding latency per query on target CPU ≤ 2 ms.
- Model RAM ≤ 300 MB; cold load ≤ 300 ms.

2) Index construction and compression

Index type selection heuristic
- Small shards (≤250k vectors): HNSW (M=32–48) with efConstruction set to 2–4× P95 efSearch.
- Medium shards (250k–5M): IVF-PQ with OPQ; nlist ≈ 4√N; m (subquantizers) s.t. code size ≤ 16–32 bytes; nprobe tuned per device profile.
- Very memory-constrained: FlatIP + externally compressed vectors (int8/OPQ); accept lower recall but ultra-low RAM.

Builder pipeline
- index/build_embeddings.py
  - Build-time OPQ training on stratified sample; export codebooks.
  - Persist per-chunk metadata: entity IDs, type, node degree, motif tags (if available), shard assignment keys (scene, locale).
- index/build_faiss.py
  - Choose index type per shard size and device profile from config/rag.xml.
  - Train IVF/OPQ; add vectors in chunks; write faiss index; write sidecar metadata (posting offsets, rowmap).
  - Export HNSW connectivity stats, IVF bucket balance, codebook error metrics to store/index_report.json.

Knowledge-distilled (KD) index option
- Optional: Train a student ANN (e.g., distilled HNSW parameters) to mimic a teacher index’s top-k ranking on a validation set (Lu et al. KD-Index spirit).
- Procedure:
  - Collect query→top-k from teacher (big HNSW or exhaustive).
  - Optimize student parameters (M, efSearch schedule, pruning thresholds) to minimize discordance with teacher ranking on top-k.
- Benefit: Lower memory M, lower efSearch with preserved recall.

Memory mapping and shard files
- Memory-map index and metadata arrays (numpy memmap for metadata, FAISS mmap where supported).
- Keep shard sizes bounded for OS page cache friendliness (e.g., 50–200 MB per shard).
- Provide “hot node” cache files (tiny) with frequent entity vectors and their immediate neighbors.

Parameter templates (starting points)
- HNSW:
  - M: 32 (small), 48 (medium), 64 (desktop quality-first)
  - efConstruction: 200–400
  - efSearch (runtime p95 targets): 64 (mobile), 96 (console), 128 (desktop)
- IVF-PQ:
  - nlist: ~4√N
  - m (subquantizers): 16 or 32
  - bits per codebook: 8
  - nprobe: 4–24 scaled by device profile
  - OPQ dims: 64–128 rotation dims

KPIs and acceptance
- p95 query time for ANN step ≤ 2.0 ms on device.
- Recall@k within 5% of teacher HNSW baseline at matched k.
- Index density (B/vector) recorded and stable; drift alerts on codebook error.

3) Hybrid dense + lexical single-pass retrieval

Motivation
- Avoid sequential BM25 + ANN passes. Fuse lexical priors with dense scores to reduce passes and keep latency low.

Offline neural-sparse postings (no runtime transformer)
- Build SPLADE/uniCOIL weights offline:
  - ingestion/build_jsonl.py emits canonicalized text strips.
  - Offline job produces per-chunk sparse term weights; prune to top-K terms (e.g., K=64) per chunk, quantize to 8-bit.
  - Export postings: term → list[(doc_id, w_q), …] packed by shard; write compact CSR.

Score alignment
- At retrieval time:
  - Compute dense score sd = cos(q, d).
  - Compute lexical score sl by summing shared term weights using a tiny inverted index lookup.
  - Normalize both to comparable ranges:
    - z-score by shard statistics or min-max per shard window.
    - Or logit-scale both into [0, 1].
  - Final score s = α·sd + (1−α)·sl, with α device/profile dependent (e.g., 0.7 console, 0.6 desktop if lexical is strong).

One-pass pipeline
- Pre-filter:
  - Fast entity/type filters (IDs present, type matches plan).
  - Optional “action profiles” filter to discard chunks irrelevant for current dialogue act.
- Candidate gathering:
  - ANN search with reduced topk (e.g., k=24 rather than 100+) given strong priors.
  - For these docs only, look up sparse postings from an in-memory or memory-mapped mini-lexicon keyed by stemmed terms from the query and plan metadata (speaker, location).
- Score fuse and select:
  - Compute fused score; keep top-Kf (e.g., 8–12) and pass to reranker.

Runtime structures
- Per-shard:
  - dense_index.faiss
  - sparse_postings.csr (compressed, quantized)
  - lexicon.vocab (tiny string table or hashing dict)
  - metadata.rowmap.jsonl (ids → offsets, entity/type info)

KPIs and acceptance
- Blended score lift: ΔMAP vs. dense-only > +2–4 points on gold/all.
- Same p95 latency as dense-only (within ±0.3 ms) due to small postings lookups.
- Reduced final k needed (e.g., k=6) without hurting top-3.

4) Graph/PathRAG integration

GraphStore data model
- Nodes: entity_id, type (character, faction, location, artifact, event), attributes (aliases, canonical name), centrality, degree.
- Edges: (src, dst, relation_type, weight, timestamps/chapters), optional motif tags (betrayal, debt, rivalry).
- Source: data/entities.xml as primary; alias expansion from data/alias_map.json; enrichment via ingestion/link_entities.py.

Path catalog export (offline)
- Generate meaningful shortest paths (constrained by relation types) between frequently co-occurring entities:
  - Subjects: characters in same scenes, questline pairs, faction leaders to factions, artifacts to owners.
  - k shortest/meaningful with relation constraints (max length L=3–4).
- Annotate with motifs (debt, rivalry, oath, betrayal).
- Export compact path entries:
  - id: P-#### (uint32)
  - nodes: [entity_id…] (uint32 array)
  - rels: [type_id…] (uint16 array)
  - abstract: ≤ 120 chars one-liner
  - anchors: set(entity_id) for fast relevance filtering
  - provenance: doc_ids/strips ids that support the path
- Store: store/path_catalog.bin (COO/CSR-like), store/path_catalog_index.json.

Runtime path selection
- Seeds: recognized entities from the query + scene memory (speaker, listener, current location).
- Filter paths whose anchors intersect seeds; rank by motif fit, recency, degree penalty, and path length.
- Select 2–3 top paths; expand to 2–3 evidence strips each (quotes, facts, rules) via provenance IDs.
- Output to the prompt packer as compact IDs + abstracts.

Graph priors in candidate scoring
- For each candidate chunk:
  - Compute path coverage: fraction of candidate’s entity mentions that lie on selected paths.
  - Graph distance prior: min distance from query seeds to candidate-associated nodes.
  - Path strength: aggregated edge weights and motif matches.
- Combine with dense/lexical scores:
  - s’ = s + β·coverage + γ·(1 / (1 + distance)) + δ·path_strength
  - Typical β=0.1–0.2, γ=0.05–0.1, δ=0.05 tuned by profile.

Path policy (learned)
- Train a tiny classifier (2-layer MLP or gradient boosted trees) to pick motifs and/or top path IDs from features:
  - F: speaker_id, listener_id, location_id, quest_phase, dialogue_act, last_turn_entities, social scalars.
- Labels: motifs/paths used in “good” answers from offline evals/simulated dialogues.
- Runtime: microseconds per inference; deterministic fallback is heuristic rules.

KPIs and acceptance
- Multi-hop questions: +5–10 points top-1 accuracy vs. no-graph baselines on curated multi-hop sets.
- Token savings: ≤ 900 total prompt tokens while improving coherence.
- Path correctness rate ≥ 95% (valid in narrative graph).

5) Reranking strategy

Default lightweight reranker (on-device)
- Features per candidate:
  - Dense similarity, lexical overlap, graph priors (coverage/distance), entity coverage, recency, shard topicality.
- Model:
  - Linear or shallow MLP; score = w·x; calibrate with isotonic regression.
- Time budget:
  - Operate within 3–6 ms on Kf candidates (≤12).

Progressive reranking
- Phase 1 (lexical + entity coverage): 1–2 ms.
- Phase 2 (dense similarity recheck + graph prior): 2–3 ms, only if time remains.
- Phase 3 (optional cross features): small cross terms if headroom exists.

Optional cross-encoder (desktop, config flag)
- src/retrieval/rerank_bge_m3.py gate behind config/rag.xml flags.
- Apply on top-4 only; batch size 1–2; measure and respect time budget.

KPIs and acceptance
- Lift in nDCG/MAP with ≤6 ms median added latency on device.
- Stability across scenes (no regressions >2 points MAP in any scene category).

6) Routing and sharding

Router pinning keys
- Based on:
  - locale/language
  - scene/region id
  - quest_phase
  - dominant entity types (character/faction/location)
  - dialogue_act or action (threaten, bargain, ask)
- src/retrieval/router.py computes pinning; fallback shard is global.

Shard assignment and lifecycle
- index/build_embeddings.py tags items with shard keys during build (deterministic function).
- Shard swap:
  - Memory-map hot shards (scene-local); lazy-load neighbors on first access.
  - Preload next-scene shards on scene transition events to avoid cold starts.

Fallback logic
- If pinned shards produce <K_min candidates, add adjacent shards (scene neighbors, same locale).
- If still insufficient, consult global shard.

KPIs and acceptance
- Shard routing accuracy ≥ 95% (no need to fallback in first pass).
- Shard swap time ≤ 50 ms off the game thread; visible latency spikes ≤ 0.5 ms on game thread.

7) Evaluation, KPIs, and experiments

Offline evals
- Gold queries: data/gold_queries.json
- Synthetic QA: cover multi-hop, aliasing, ambiguous names, event reasoning.
- Metrics: Recall@k, MRR/MAP@k, nDCG@k, path correctness, entity coverage.

Online shadow evals
- Mirror 1% of live queries to a background runner using the heavy teacher stack.
- Compare candidate divergence, log disagreements for retraining.

Ablations
- Dense only vs. hybrid dense+lexical
- No-graph vs. graph-priors+paths
- HNSW vs. IVF-PQ at same memory budget
- Reranker off vs. lightweight vs. heavy on desktop

Health checks
- Index health: codebook drift, HNSW connectivity, posting list balance (export to store/index_report.json).
- Latency budgets: per-module timers (entity match, ANN, postings lookup, fuse, rerank).

Acceptance thresholds (device profile)
- Retrieval p95 (ANN + postings + fuse + rerank) ≤ 8 ms.
- End-to-end retrieval + pack ≤ 16–25 ms depending on profile.
- Evidence utilization ≥ 85%, unsupported claims ≤ 1% (downstream).
- Memory: resident retrieval system ≤ 150 MB typical (indices + caches).

Risks and mitigations
- Token creep from path abstracts:
  - Strict budget and truncation; prefer IDs + one-liners; limit to 2–3 paths.
- Graph coverage gaps or alias errors:
  - Expand alias map; add canonical anchors; log misses to improve the graph.
- Latency regressions when enabling lexical postings:
  - Keep postings sparse, quantized, and capped; measure and prune terms to top-64 per doc.
- Overfitting of learned path policy:
  - Regularize; add heuristic backstops; evaluate on holdout scenes and new content drops.

Implementation sequence (retrieval scope)
- Week 1–2:
  - Student embedder distilled and quantized; builder emits 384D vectors.
  - Build HNSW/IVF-PQ per shard; export health reports.
  - Router pinning and shard swap logic; basic KPIs wired.
- Week 3–4:
  - Neural-sparse postings offline and integrated; fused scores online.
  - Lightweight reranker with progressive schedule.
  - GraphStore in-memory with path catalog export and packer integration.
- Week 5–6:
  - Learned path policy; uncertainty-aware packing; action profiles.
  - Full ablations; set device-profile parameters; finalize budgets.

File and config mapping
- Embeddings: index/build_embeddings.py, src/embeddings/arctic_embed.py
- Indices: index/build_faiss.py, src/index/faiss_hnsw.py, store/index_report.json
- Hybrid retrieval: api/retriever.py, src/retrieval/router.py (fuser)
- Graph: ingestion/link_entities.py, ingestion/build_jsonl.py, data/entities.xml, data/alias_map.json, store/path_catalog.bin
- Reranking: src/retrieval/rerank_bge_m3.py (gated), lightweight in api/retriever.py
- Config: config/rag.xml, src/rag/config/rag.xml

Appendix: minimal data schemas (conceptual)

Chunk metadata (JSONL)
- id: string (global)
- shard: string
- entities: [entity_id]
- types: [enum]
- scene_ids: [int]
- locale: string
- action_profiles: [enum] // optional
- text_abstract: string (≤120 chars)
- quote_ids: [Q-id] // optional

Sparse postings (CSR-like)
- vocab: term_id → term_string
- postings: term_id → [(doc_row, weight_uint8)] packed
- doc_row → doc_id via rowmap.jsonl

Path catalog
- id: uint32
- nodes: [uint32]
- rels: [uint16]
- anchors: [uint32]
- motif: [uint8] // bitmask
- abstract: string (≤120 chars)
- provenance: [doc_id] // optional