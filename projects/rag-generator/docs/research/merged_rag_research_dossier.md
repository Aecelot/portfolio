# Unified Research Dossier: Real‑Time On‑Device RAG for Lore RAG

This document merges four internal research notes into a single, project-scoped blueprint for improving Retrieval‑Augmented Generation in Lore RAG. It synthesizes the latest techniques in retrieval, prompt construction, graph use, caching, memory, and runtime hardening, and maps them to the current codebase and operations.

Source documents merged
- optimizing_rag_on_device.md
- advanced_rag_optimizations.md
- pathrag_system_design.md
- runtime_optimization_suggestions.md

Project context and current architecture
Lore RAG_RAG_Generator currently provides ingestion, indexing, retrieval, prompting, and generation for Logres lore and NPC dialogue. Key touchpoints in this repo include [README.md](README.md), [api/retriever.py](api/retriever.py), [src/retrieval/router.py](src/retrieval/router.py), [src/retrieval/rerank_bge_m3.py](src/retrieval/rerank_bge_m3.py), [src/embeddings/arctic_embed.py](src/embeddings/arctic_embed.py), [index/build_embeddings.py](index/build_embeddings.py), [index/build_faiss.py](index/build_faiss.py), [src/index/faiss_hnsw.py](src/index/faiss_hnsw.py), [ingestion/build_jsonl.py](ingestion/build_jsonl.py), [ingestion/link_entities.py](ingestion/link_entities.py), [generation/prompts.py](generation/prompts.py), [generation/generator.py](generation/generator.py), [generation/llm_client.py](generation/llm_client.py), [config/rag.xml](config/rag.xml), and [src/rag/config/rag.xml](src/rag/config/rag.xml).

Runtime constraints to design for
- Development environment: abundant CPU/GPU/RAM for offline computation.
- Runtime target: on-device consoles/PCs with tight budgets (about 2 GB RAM total, ~200 MB VRAM or CPU-only), minimal latency for dialogue, and strict token budgets. End-to-end p95 latency targets are 16–33 ms with TTFT under 120 ms when streaming.

Strategic theme
Push expensive work offline (authoring, analysis, distillation, compilation, index building) and ship compact runtime assets. At runtime, run a planned, adaptive, cache-first retrieval and a structured, token-tight prompt packer that exploits graph paths, episodic/social memory, and per-character caches.

Retrieval architecture and index optimization
- Compressed and distilled ANN: Use knowledge-distilled indexes and product quantization to reduce memory while maintaining recall. Favor IVF-PQ or HNSW with tuned parameters depending on collection size. Map into [index/build_faiss.py](index/build_faiss.py) and [src/index/faiss_hnsw.py](src/index/faiss_hnsw.py). Consider reduced embedding dimensions to shrink index footprint.
- One-pass hybrid dense+lexical: Adopt a fused hybrid search that aligns lexical and dense scoring within one index pass instead of sequential BM25 then ANN. Integrate light lexical priors or precomputed neural-sparse postings to keep runtime transformer cost zero. Route via [src/retrieval/router.py](src/retrieval/router.py) and score merge in [api/retriever.py](api/retriever.py).
- Quantization and binary embeddings: Ship int8 PQ codes and, where acceptable, binary hashing to reduce index RAM and accelerate similarity. Ensure the builder in [index/build_embeddings.py](index/build_embeddings.py) emits compressed artifacts and records codebook drift for health checks.
- Hardware-aware execution: Where NPUs or tensor cores are available, pin embedding computation or heavy prefill to accelerators. For CPU-only SKUs, use memory-mapped arrays and small batch sizes to bound latency.

Prompt packing and evidence formatting under token constraints
- Path-first, text-second: Replace flat concatenation with PathRAG-style path evidence. Retrieve minimal relational paths that connect query-relevant entities, then render short path abstracts as evidence. Implement packer logic in [generation/prompts.py](generation/prompts.py) and ensure [generation/generator.py](generation/generator.py) reserves budget for path abstracts.
- Hierarchical and clustered context: Use attributed communities or scene-based clusters so that included context is topically focused. Export micro-summaries per community during ingestion and prefer cluster-level inclusion over scattered snippets.
- Structured prompt schema: Use a role- and plan-aware schema with strict slots: scene profile, actors, motifs, path list, facts, quotes, rules, constraints, and output contract. Represent evidence by short IDs with one-line abstracts to maximize relevance density. Enforce deduplication and continuity keys to prevent repetition.
- Prompt compression and summarization: Pre-summarize long lore sources into ultra-short synopses and key-fact strips at build time. Include rationale-like justification lines only where they disambiguate, keeping the runtime prompt compact and high-signal.

Neural retriever distillation and offline precomputation
- Distilled retrievers: Train small, domain-tuned dual-encoders via listwise distillation using a strong cross-encoder teacher. Reduce embedding dimension (for example to 256–384) while targeting ≥95% of teacher MAP on [data/gold_queries.json](data/gold_queries.json). Ship the student at runtime; keep the teacher offline for validation.
- Synthetic data augmentation: Generate synthetic (question, passage) pairs with a powerful LLM over Logres lore to amplify tail coverage. Feed these into retriever training to improve robustness to diverse player phrasings.
- Index precomputation and knowledge caching: Precompute graph features, retrieval clusters, and hot path catalogs. Cache frequently co-retrieved chunks and popular answers; overlap retrieval with generation paths where your inference stack supports it. Persist compact caches in [store/](store).
- Episodic memory precomputation: Convert raw conversation logs into structured episodic fragments offline, capturing facts, preferences, and causal links across sessions. Store a compact, queryable memory that can be selectively surfaced in prompts.

Graph-enhanced retrieval for narrative coherence
- Knowledge graph backbone: Maintain a typed entity graph sourced from [data/entities.xml](data/entities.xml) and alias expansions from [data/alias_map.json](data/alias_map.json). Use it to anchor retrieval, disambiguate entities, and supply relational evidence.
- PathRAG retrieval flow: For queries that imply multi-hop reasoning or continuity, expand k-hop neighborhoods around recognized entities, compute constrained shortest paths, apply graph-distance priors in candidate scoring, and return the top few paths as prompt evidence. Integrate these priors upstream of ANN so k can be reduced without recall loss. Implement hooks in [api/retriever.py](api/retriever.py) and [src/retrieval/router.py](src/retrieval/router.py).
- Hybrid graph-text scoring: Rerank candidates using a blend of lexical, dense, and graph features. Keep heavy cross-encoder rerankers behind configuration flags for desktop quality runs; on device, use a lightweight rerank that respects graph connectivity.

Semantic caching, episodic memory, and learned retrieval policies
- Semantic cache: Cache recent retrievals and partial generation states keyed by normalized query signatures and local narrative state. Tune replacement by reuse likelihood and quest-phase locality. Persist in a small memory tier and optionally to [store/](store) between sessions.
- Cache-augmented generation spectrum: For small, fixed KBs (e.g., a single locale or region), consider preloading significant knowledge into model prefix caches or long-context memory to skip retrieval in some modes.
- Episodic and social memory: Maintain three tiers: episodic (recent events with decay), semantic (slow lore), and social (light scalar edges like trust, fear, debt, respect). Use these signals to select motifs and paths and to bias prompts without heavy tokens.
- Learned retrieval policies: Train a tiny policy to choose retrieval modality and depth per turn (skip, fast entity path, ANN, or hybrid), based on plan type, uncertainty margins, and time budget. Favor policies that can be evaluated in microseconds.

Model-agnostic runtime techniques
- KV-cache reuse and prefix caching: Reuse model key/value caches across turns. Separate stable prefix segments (scene cue sheets, per-character voice primers, canonical constraints) from per-turn content to amortize prefill cost. Implement cache wiring in [generation/llm_client.py](generation/llm_client.py).
- Structured outputs and contracts: Constrain outputs to simple schemas and explicit style/tone contracts to reduce rambling and token waste. Require short citations by ID to improve grounding and enable deterministic post-gen validation.
- Footprint reduction: Quantize LLM and embedder weights, prune redundant layers if supported, and enable efficient attention kernels. Limit prompt size through strict slot budgets and deduplication.
- Evaluation and alignment: Validate that the model uses supplied evidence. If it ignores context, adjust prompt structure and provide exemplar pairs during fine-tuning or preference tuning.

Runtime optimization plan mapped to this repository
- Embedding model changes: Replace large embedding models during runtime with distilled, quantized variants that emit 256–384D vectors. Update loaders in [src/embeddings/arctic_embed.py](src/embeddings/arctic_embed.py) and builders in [index/build_embeddings.py](index/build_embeddings.py). Memory-map embedding matrices for read-only access.
- FAISS index selection and tuning: For small shards, prefer HNSW with tuned M and efSearch; for larger ones, IVF-PQ with compact codebooks. Reduce top-k once graph priors and router pinning are active. Implement in [index/build_faiss.py](index/build_faiss.py) and [src/index/faiss_hnsw.py](src/index/faiss_hnsw.py).
- Reranking strategy: Make cross-encoder usage conditional and limited to quality-first desktop. Default to a lightweight reranker in [src/retrieval/rerank_bge_m3.py](src/retrieval/rerank_bge_m3.py) or replace with a lexical/embedding hybrid that executes within a fixed time budget.
- Query planning: Add a retrieval planner above the retriever to select plans such as dialogue reply, plot hook, lore fact, NPC agenda. Plans dictate which stores to query (entity cache, path catalog, ANN shard, episodic memory) and the evidence slot recipe. Wire the planner into [src/retrieval/router.py](src/retrieval/router.py) and the call path from [api/retriever.py](api/retriever.py).
- Path catalog export: Author or extract graph paths offline, annotate with motifs, and export a compact path catalog. Ship as a small dictionary keyed by path IDs. Build during ingestion in [ingestion/link_entities.py](ingestion/link_entities.py) and [ingestion/build_jsonl.py](ingestion/build_jsonl.py).
- Prompt schema and packer: Implement a slot-based packer in [generation/prompts.py](generation/prompts.py) that emits structured, deduped evidence with IDs, one-liners, scene cue sheets, motifs, and an output contract. Ensure [generation/generator.py](generation/generator.py) enforces token budgets and packs citations.
- Episodic and social memory store: Add a light store in [npc_server.py](npc_server.py) or [npc_generator.py](npc_generator.py) to persist scene-level events and social scalars. Provide a compact read API to prompt packers and planners.
- Adaptive processing: Introduce query importance classification and time-budget-aware retrieval in [api/retriever.py](api/retriever.py), falling back to minimal processing for casual queries and enabling fuller pipelines for critical turns.
- CPU-only readiness: Provide a CPU-only runtime that avoids GPU reliance. Pre-allocate small working buffers, use memory-mapped assets, and keep models lazy-loaded and unloadable when idle.

Purpose-built prompt design for Lore RAG
- Per-call schema: Each call should include scene profile, speakers with voice cards, motifs, selected path IDs with abstracts, facts, quotes, rules, continuity keys, and an output contract with maximum tokens and required citations.
- Pointer-first packing: Put only IDs and ultra-short abstracts in the prompt. Expand referenced IDs to full text after generation for player-visible tooltips or logs rather than in the model input.
- Dialogue-act slot recipes: For acts such as threaten, bargain, rebut, ask, pack different slot mixes (e.g., leverage fact, taboo rule, past quote) to reduce rambling and keep line cadence crisp.
- Per-character prefix caches: Store a small voice primer per character and reuse across turns to reduce tokens and prefill cost.

Three-tier memory model
- Episodic memory: Last N turns, key promises, outcomes, inventory deltas with strong decay.
- Semantic memory: Canonical lore facts and codex entries tied to canonical IDs.
- Social memory: Light floats per pair (trust, fear, debt, respect). Use to bias motif selection and as explicit numbers in the prompt where appropriate.

Neural sparse offline postings
- Build neural sparse term weights offline (for example SPLADE/uniCOIL) and ship tiny postings per shard so that lexical grounding is precise without running a transformer at runtime. Blend postings hits with dense scores during candidate assembly.

Path selection policy
- Train a tiny classifier or gradient-boosted model offline that maps speaker, listener, quest phase, last turns, and social state to top 2–3 motifs or path IDs. Use this to pick which paths to include, making selection smarter than naive recency while keeping runtime cost negligible.

Multi-pass generation that fits budgets
- Plan → Draft → Polish using the main model plus a micro style-rewriter pass that only sees a voice card ID and the raw line. Optional grammar-constrained decoding for structured responses reduces retries and keeps outputs compact.

Additional low-latency upgrades to layer on
- Retrieval and indexing: action-aware routing to skip chunks that cannot satisfy the intended act; contrastive retrieval tuning from telemetry toward action success; uncertainty-aware packing that includes two candidates only when the tiny scorer margin is small; state-diff indices that emphasize what changed; narrative hotspot boosting to preserve topical coherence within a scene.
- Prompt and schema: dialogue-act slots; scene cue sheets cached and referenced by ID; pointer-first with lazy expansion after generation; continuity keys minted for new claims; motif budgets capped and rotated to keep tokens predictable.
- World state and planning: event-sourced world model for “last N” entity events; HTN/GOAP micro-plans cached per locale and template arcs; ethical rails and taboos implemented as small deterministic automata.
- Model-side efficiency and quality: per-character prefix KV caches; speculative decoding with a tiny draft head; grammar-constrained decoding for structured outputs; a micro style rewriter on the final line using only the voice card ID.
- Authoring and graph pipeline: graph tool as a compiler front-end; export compact path catalog, motif tags, and beat templates; keep live databases out of runtime builds.
- Tooling, testing, and ops: player simulators for common interaction flows; an A/B guardrails checklist on shards before shipping; outcome-aware dashboards to detect regressions and roll back content shards when needed.
- Multilingual and accessibility: cross‑lingual artifacts keyed by IDs with locale-specific strips selected at the last step; a readability regulator to enforce sentence and clause length per device profile.
- Security and integrity: watermarked evidence IDs and deterministic post-generation mapping; adversarial prompt shields by fencing user text into a safe slot.

Guardrails that assist creativity
- Hard constraints live in the packer (canon minimum, forbidden reveals). Soft nudges come from motifs, social scores, and beat skeletons so the model stays inside rails while keeping dialog natural.

KPI framework and instrumentation
- Player-facing performance and stability: latency percentiles end-to-end and TTFT, frame impact, stall rates, cold start.
- Retrieval quality: Recall@k, MRR/MAP/nDCG, blended score lift from lexical priors, entity coverage, path correctness.
- Evidence use and grounding: evidence utilization, unsupported claim rate, canon violation rate, redundancy and context waste, quote vs abstract effectiveness.
- Retrieval system efficiency: cache hit rates, fast-path usage, prefilter effectiveness, ANN efficiency, shard routing accuracy, swap time, index health.
- Generation efficiency: tokens in/out, KV reuse ratio, speculative acceptance, grammar-constrained hit rates, latency breakdown, power.
- Memory and footprint: resident set, index density, cache footprint, artifact sizes.
- Content and ops: build times, distilled scorer parity, motif/path policy accuracy, locale coverage.
- Safety and tone: taboo violations, style adherence, toxicity flags.
- Business and experience: dialogue satisfaction, branch coherence, engagement.
- Instrumentation quick wins: per-module timers, the game engine telemetry hooks, shadow eval on 1% of live queries, A/B feature flags, dashboards. Integrate capture into [kpi_collector.py](kpi_collector.py), [scripts/monitor_faiss_kpis.py](scripts/monitor_faiss_kpis.py), and [dashboard/rag_kpi_dashboard.html](dashboard/rag_kpi_dashboard.html).

Phased roadmap tailored to device profiles
- Phase A (weeks 1–2): Distilled, quantized embedder; memory-mapped vectors; baseline planner and prompt schema; HNSW/IVF-PQ tuned indices; conditional reranking default-off on device.
- Phase B (weeks 3–4): Path catalog export; path policy; episodic and social memory store; pointer-first packing; per-character prefix caches.
- Phase C (weeks 5–6): Hybrid dense+lexical one-pass retrieval; neural sparse offline postings; adaptive processing by query type and time budget; CPU-only mode optimizations.
- Phase D (weeks 7–8): Graph priors live; reduce top-k; lightweight hybrid reranker; multi-pass generation with micro style rewriter; grammar-constrained decoding for structured outputs.
- Phase E (ongoing): KPI dashboards and guardrails; AB tests for packing variants; periodic retriever distillation with fresh synthetic data; index health maintenance and shard rebalancing.

Risks and mitigations
- Token bloat: Strict budgets, dedupe across turns, prefer IDs and one-liners, and truncate least salient slots.
- Graph gaps or aliasing errors: Expand aliases during ingestion, test graph coverage, provide fallbacks to canonical anchors.
- Latency regressions: Keep heavy components behind flags, cache graph features, and lower k thanks to better upstream filtering.
- Consistency drift: Pin critical canon facts and continuity keys until resolved; validate outputs for forbidden reveals and unsupported claims.
- Memory pressure: Enforce byte budgets for caches and models and unload inactive components during quiet periods.

Reference highlights
- Index compression and KD‑Index for compact ANN and product quantization for speed/size.
- Fused hybrid dense+lexical graphs for single-pass search with high QPS.
- PathRAG and ArchRAG for structured, path-centric and hierarchical context.
- RAGCache and cache-augmented strategies to reduce TTFT and reuse intermediate work.
- PREMem-style episodic memory to shift reasoning into precomputed memories and improve small-model performance.
- Distillation and synthetic QA generation to specialize small retrievers with high teacher parity.

Acceptance checks for future implementation
- Retrieval should fail early if the entity graph is expected but missing in environments configured for graph priors.
- Prompts include path evidence and scene memory when entities are recognized and history exists.
- With router pinning and graph priors, reduce k without hurting top-3 accuracy against [data/gold_queries.json](data/gold_queries.json).
- KPI targets achieved: device p95 retrieval ≤ 25 ms, TTFT ≤ 120 ms, cache hit ≥ 35%, evidence utilization ≥ 85%, unsupported claims ≤ 1%, resident memory typical ≤ 150 MB.

File mapping index
- Retrieval and priors: [api/retriever.py](api/retriever.py), [src/retrieval/router.py](src/retrieval/router.py).
- Prompt composition: [generation/prompts.py](generation/prompts.py), [generation/generator.py](generation/generator.py).
- Session memory: [npc_server.py](npc_server.py), [npc_generator.py](npc_generator.py).
- Index/runtime: [index/build_embeddings.py](index/build_embeddings.py), [index/build_faiss.py](index/build_faiss.py), [src/index/faiss_hnsw.py](src/index/faiss_hnsw.py).
- Entities and aliases: [ingestion/link_entities.py](ingestion/link_entities.py), [ingestion/build_jsonl.py](ingestion/build_jsonl.py), [data/entities.xml](data/entities.xml), [data/alias_map.json](data/alias_map.json).
- Config toggles: [config/rag.xml](config/rag.xml), [src/rag/config/rag.xml](src/rag/config/rag.xml).
- KPIs and dashboards: [kpi_collector.py](kpi_collector.py), [scripts/monitor_faiss_kpis.py](scripts/monitor_faiss_kpis.py), [dashboard/rag_kpi_dashboard.html](dashboard/rag_kpi_dashboard.html).

Appendix A: Runtime configuration guidance
- Memory budgeting: Allocate explicit byte budgets for models, indices, caches, and working tensors under 2 GB total. Keep 5–10% headroom for fragmentation.
- Latency envelopes: Target p50 ≈ 12 ms, p95 ≈ 25 ms, p99 ≈ 50 ms for end-to-end retrieval+packing on device.
- CPU-only pipeline: Prefer memory-mapped reads, small fixed-size pools, and lock-free data structures where possible. Avoid large transient allocations.
- Reranking policy: Default off on device; enable only on desktop or in slow scenes. When on, cap candidates aggressively and run within a strict time budget.
- Sharding and routing: Route by scene/quest/locale to minimize active shard size. Keep a micro hot-node cache for extremely popular paths/chunks.

Appendix B: Authoring and export workflow
- Author in a graph-friendly tool during development and validate canon and constraints there.
- Export to compact runtime assets: a path catalog keyed by small IDs with motifs, voice cards per character, micro-summaries per community, and neural-sparse postings per shard.
- Verify artifact integrity and budget adherence in CI. Keep [store/index_report.json](store/index_report.json) and related artifacts to track codebook drift, HNSW connectivity, and posting list balance.

Appendix C: Monitoring targets (suggested initial bands)
- Latency p95 via ANN path ≤ 2.0 ms for retrieval; TTFT ≤ 120 ms with streaming.
- Cache hit ≥ 35% overall; fast-path usage ≥ 50% in dialogue.
- Recall@6 and MAP@6 ≥ 95% of cross-encoder baseline after distillation.
- Evidence utilization ≥ 85%; unsupported claims ≤ 1%; canon violations < 50 ppm; style adherence ≥ 90%.
- Resident memory typical ≤ 150 MB, worst-case hubs ≤ 220 MB.

Appendix D: Glossary
- PathRAG: Retrieval that uses graph paths as priors and as evidence in prompts.
- Router pinning: Preselecting relevant collections before vector search to reduce noise and latency.
- Beat graph: Session-time graph of story beats and relationship changes used to keep narrative continuity.

End of dossier.