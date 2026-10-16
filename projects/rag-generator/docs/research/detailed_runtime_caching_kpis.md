
# Runtime Engineering, Caching, Quantization, and KPI Deep Dive for Lore RAG

This document expands the runtime- and operations-side improvements from the unified dossier into concrete engineering practices, budgets, data formats, cache policies, CPU-only execution, model preparation, telemetry, and acceptance criteria tailored to Lore RAG’s on-device target.

Repository touchpoints (runtime/ops)
- [api/retriever.py](api/retriever.py)
- [src/retrieval/router.py](src/retrieval/router.py)
- [src/retrieval/rerank_bge_m3.py](src/retrieval/rerank_bge_m3.py)
- [src/embeddings/arctic_embed.py](src/embeddings/arctic_embed.py)
- [generation/llm_client.py](generation/llm_client.py)
- [generation/prompts.py](generation/prompts.py)
- [generation/generator.py](generation/generator.py)
- [ingestion/build_jsonl.py](ingestion/build_jsonl.py)
- [index/build_embeddings.py](index/build_embeddings.py)
- [index/build_faiss.py](index/build_faiss.py)
- [src/index/faiss_hnsw.py](src/index/faiss_hnsw.py)
- [kpi_collector.py](kpi_collector.py)
- [scripts/monitor_faiss_kpis.py](scripts/monitor_faiss_kpis.py)
- [dashboard/rag_kpi_dashboard.html](dashboard/rag_kpi_dashboard.html)
- [config/rag.xml](config/rag.xml)
- [src/rag/config/rag.xml](src/rag/config/rag.xml)

Target constraints and SLOs
- Runtime budget: ~2 GB RAM total, CPU-only preferred; 200 MB VRAM may be present but not relied upon.
- Latency SLO: p50 ≤ 12 ms, p95 ≤ 25 ms for retrieval+packing; TTFT ≤ 120 ms with streaming UI.
- Footprint SLO: resident retrieval+cache ≤ 150 MB typical; worst-case hubs ≤ 220 MB.
- Quality floor (retrieval): ≥ 0.95× teacher MAP/Recall@k vs. [data/gold_queries.json](data/gold_queries.json).

1) CPU-only runtime architecture

Process and threading model
- Single process hosting:
  - Retrieval service (entity prefilter → ANN/hybrid → fuse → rerank)
  - Prompt packer and generation orchestrator
  - Lightweight memory stores (episodic/social)
- Threading:
  - Thread-pool for retrieval steps (ANN + sparse lookup + rerank) sized to CPU cores.
  - LLM decode thread with cooperative scheduling to avoid contention.
  - IO thread for memory-mapped shard swaps (off game-thread).
- Affinity and priorities:
  - Retrieval pool uses lower priority to avoid starving render thread.
  - Pin background shard preload to specific cores to reduce cache thrash.

Memory pools and allocators
- Pre-allocate fixed-size arenas for:
  - Query embeddings (float32/float16 buffers)
  - ANN result buffers (indices/scores)
  - Sparse postings lookup workspace
  - Prompt packer scratch (string tables, ID sets)
- Avoid per-turn heap churn; recycle arenas via ring buffers.

Lazy model/component lifecycle
- Embedder loaded on first use; unloaded after 5 minutes idle.
- Heavy reranker kept disabled by default on device; desktop flag re-enables with small batch sizes.
- Memory-mapped indices and metadata; never fully copy to RAM.

Touchpoints: [generation/llm_client.py](generation/llm_client.py), [api/retriever.py](api/retriever.py), [src/retrieval/router.py](src/retrieval/router.py)

2) Model preparation: distillation and quantization

Teacher→student plan (offline)
- Teacher cross-encoder (offline only) labels top-k rankings; student dual-encoder (MiniLM class) trained with listwise objective.
- Output head at 384D (preferred) with optional 256D export via PCA/OPQ head for tighter budgets.

INT8 quantization pipeline (offline)
- Calibrate on a balanced sample from corpus (entities, locations, events, ambiguous names).
- Verify numeric stability (cosine drift < 0.01 median).
- Export ONNX/ORT CPU-friendly model with INT8 weights and per-channel scales.

Runtime embedder integration
- [src/embeddings/arctic_embed.py](src/embeddings/arctic_embed.py): add student-int8 runtime path; thread pinning; batch_size=1; L2 normalize.
- Budget: ≤ 300 MB RAM, ≤ 2 ms p95 per embedding.

LLM-side efficiency
- Prefer 2B–7B LLMs, quantized (INT4/8). Maintain per-character prefix KV caches in [generation/llm_client.py](generation/llm_client.py).
- Grammar-constrained decoding for structured outputs to reduce retries.

3) Storage and artifact layout

Shard packaging
- Per shard:
  - dense_index.faiss (HNSW/IVF-PQ)
  - embeddings.bin (optional external mmap’d matrix; only for FlatIP)
  - sparse_postings.csr (+ vocab)
  - metadata.rowmap.jsonl (id→row; entities, types, scene, locale, action profiles)
  - hot_nodes.bin (tiny cache of frequent entity vectors/ids)
- Global:
  - store/index_report.json (health metrics)
  - store/path_catalog.bin (+ index.json)
  - store/meta.jsonl (artifact versions, checksums)

File IO policy
- All large assets opened with memory-mapping.
- Keep shard size 50–200 MB for cache locality and fast swaps.
- Preload next-scene shards on level transition events.

Touchpoints: [index/build_embeddings.py](index/build_embeddings.py), [index/build_faiss.py](index/build_faiss.py), [src/index/faiss_hnsw.py](src/index/faiss_hnsw.py)

4) Caching strategies and policies

Semantic result cache (turn-level)
- Key: (norm_query_sig, state_hash), where state_hash = hash(speaker, listener, scene_id, quest_phase, dialogue_act).
- Value: fused candidates (ids/scores) + path IDs + packer-ready strip IDs.
- Replacement: reuse-likelihood with decay; bias to keep items touched across multiple consecutive turns.

Prefix KV cache (LLM)
- Key: (character_id, scene_id, locale, constraints_hash).
- Value: KV tensors for prefix tokens (scene cue + voice card + constraints).
- Eviction: LRU with time-based decay; cap by memory budget.

Hot node cache
- Per shard tiny in-RAM map of frequent entity vectors and associated chunk IDs (neighbors).
- Warmed at scene load; flushed on scene exit.

RAGCache-inspired overlap
- Overlap retrieval with LLM prefill:
  - Immediately stream packer header (speakers + scene + constraints) and start prefill using prefix KV while retrieval completes candidates.
  - Append evidence slots just-in-time; if late, continue with minimal pack to hit TTFT.

Cache priming
- On scene enter:
  - Prime hot nodes, top 1–2 paths for current protagonists/antagonists, and a few high-frequency facts/rules.
- On expected act (combat, negotiation):
  - Pre-fetch action-profiled strips (threaten, bargain) for current entities.

Cache footprint and limits
- Resident budget for caches ≤ 60 MB combined (semantic + KV + hot nodes).
- Report eviction rate; target ≤ 10% under steady state.

Touchpoints: [generation/llm_client.py](generation/llm_client.py), [api/retriever.py](api/retriever.py)

5) Adaptive processing and uncertainty-aware packing

Query classification
- classify(query, game_ctx) → critical | important | casual
  - critical: combat/quest/time-sensitive → full pipeline under tighter k
  - important: dialogue with stakes → mid pipeline
  - casual: fluff/lore → fast path (entity-first or cache-only if confident)

Time-budget aware schedule
- Start timer at route enter; every substage checks remaining budget:
  - Lexical prefilter (1–2 ms)
  - ANN top-k (2–3 ms)
  - Sparse lookup (≤ 1 ms)
  - Graph prior add (≤ 1 ms)
  - Lightweight rerank (2–3 ms)
- If budget tight, skip downstream stages; pack with current best.

Uncertainty-aware packing
- If top-2 margin < τ (e.g., 0.05), pack both with disagreement labels; else pack only top-1.
- Reduces average token cost without increasing errors.

6) Reranking and quality-control at runtime

Default lightweight rerank
- Feature set: dense score, lexical overlap, graph coverage, entity coverage, recency, shard topicality.
- Model: linear or shallow MLP trained offline; isotonic calibration.
- Cap to ≤ 12 candidates; ≤ 6 ms p95.

Desktop “quality-first” mode
- Enable [src/retrieval/rerank_bge_m3.py](src/retrieval/rerank_bge_m3.py) via flags in [config/rag.xml](config/rag.xml); batch 2–4; timeboxed.

7) Safety, integrity, and adversarial controls

Post-gen validation
- Required citations by ID; unknown IDs rejected (firebreak).
- DFA-based taboo filters and timeline/canon checks (deterministic).
- Fallback lines for violations; optional micro-repair pass bounded to ≤ 40 tokens.

Input fencing
- Player input isolated in a dedicated slot; never concatenated into system constraints; sanitize punctuation and control chars.

Evidence watermarking
- All strips carry short IDs; dashboards track unsupported claim rate.

8) Telemetry, KPIs, and dashboards

Metrics to collect (core)
- Player-facing perf: end-to-end latency (p50/p95/p99), TTFT, frame impact, stall rate, cold start.
- Retrieval quality: Recall@k, MRR/MAP/nDCG, blended score lift, entity coverage, path correctness.
- Grounding: evidence utilization %, unsupported claim %, canon violation ppm, prompt redundancy %, context waste % (optional attention probes/ablation).
- Retrieval efficiency: cache hit rate by key; fast-path usage; prefilter effectiveness; candidates/ms @efSearch; shard routing accuracy; shard swap time; index health (codebook drift, HNSW avg degree, posting list balance).
- Generation efficiency: tokens in/out; KV reuse ratio; speculative accept rate; grammar hit %; latency breakdown (prefill/decode/post).
- Memory/footprint: resident size; index density; cache footprint and eviction rate; artifact sizes.
- Safety/tone: taboo ppm, style adherence %, toxicity flags (as applicable).
- Experience/business: dialogue satisfaction, branch coherence, engagement metrics (optional).

Instrumentation points
- Wrap stages in [api/retriever.py](api/retriever.py) and [generation/generator.py](generation/generator.py) with micro-timers.
- Emit structured events via [kpi_collector.py](kpi_collector.py) (JSONL).
- Background monitor in [scripts/monitor_faiss_kpis.py](scripts/monitor_faiss_kpis.py) aggregates p95/rolling windows.
- Visualize in [dashboard/rag_kpi_dashboard.html](dashboard/rag_kpi_dashboard.html).

Telemetry schema (JSONL, conceptual)
{
  "ts": "iso8601",
  "scene_id": "arthur_slums",
  "quest_phase": "Q12_Prep",
  "dialogue_act": "threaten",
  "latency_ms": {"route":1.2,"ann":1.7,"postings":0.4,"fuse":0.3,"rerank":1.8,"pack":2.1,"prefill":18.3,"decode":42.7},
  "kpi": {"ttft_ms":108,"kv_reuse":0.76,"cache_hit":true,"unsupported_claims":0,"evidence_utilization":1.0},
  "scores": {"top1":0.82,"margin12":0.06},
  "safety": {"taboo":false,"style_ok":true},
  "quality": {"recall_at_6":1,"map_at_6":0.92}
}

Target bands (first pass)
- Retrieval p95 ≤ 8 ms; end-to-end retrieval+pack ≤ 16–25 ms by device profile.
- Cache hit ≥ 35%; fast-path usage ≥ 50% in dialogue scenes.
- Evidence utilization ≥ 85%; unsupported claims ≤ 1%; canon violations < 50 ppm.
- Resident memory typical ≤ 150 MB.

9) Testing strategy and acceptance

Load and endurance
- Script player simulators for common flows (barter, threaten, gossip); run for hours; check memory plateau and absence of leaks.
