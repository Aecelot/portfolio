# Lore RAG On-device Context Quality Plan: PathRAG, Graph Memory, Prompt Design, and Runtime

This document proposes a set of non-invasive, out-of-the-box improvements to maximize the quality of inputs the on-device LLM receives for dialogue generation and plot construction, without implementing them yet.

Key themes: Graph-first retrieval (PathRAG), session/narrative memory, prompt construction tuned for story beats, and runtime-optimized reranking and indexing.

Linked file touchpoints for reference:
- [api/retriever.py](api/retriever.py)
- [src/retrieval/router.py](src/retrieval/router.py)
- [generation/prompts.py](generation/prompts.py)
- [generation/generator.py](generation/generator.py)
- [npc_server.py](npc_server.py)
- [npc_generator.py](npc_generator.py)
- [index/build_embeddings.py](index/build_embeddings.py)
- [index/build_faiss.py](index/build_faiss.py)
- [src/index/faiss_hnsw.py](src/index/faiss_hnsw.py)
- [ingestion/link_entities.py](ingestion/link_entities.py)
- [ingestion/build_jsonl.py](ingestion/build_jsonl.py)
- [data/entities.xml](data/entities.xml)
- [data/alias_map.json](data/alias_map.json)
- [config/rag.xml](config/rag.xml)
- [src/rag/config/rag.xml](src/rag/config/rag.xml)

1. Objectives
- Provide the LLM with the most relevant, canonical, and coherent context for each turn.
- Maintain narrative continuity and character consistency across turns and scenes.
- Keep latency and footprint within on-device constraints while allowing quality-first modes on desktop.

2. Architecture Additions (no code yet)
2.1 GraphStore abstraction
- Load a typed entity graph from [data/entities.xml](data/entities.xml), enriched with aliases from [data/alias_map.json](data/alias_map.json).
- Expose high-level queries (conceptual, no API surface defined here):
  - Neighbors by relation types and weights.
  - Shortest paths with constrained relation sequences and maximum lengths.
  - K-hop expansions seeded by recognized entities with degree and type limits.
- Default in-process representation for on-device use; optional Neo4j backend for development and desktop.

2.2 PathRAG retrieval flow
- Entity extraction and normalization using alias map and canonical IDs.
- Domain pinning with the existing router to limit search to relevant collections before ANN.
- Graph expansion: expand k-hop around seeds and compute constrained shortest paths between seeds and candidate nodes.
- Scoring prior: add graph-distance/path-coverage weighting to candidate chunks before vector search.
- ANN search with tuned FAISS parameters; lower k due to higher-precision priors.
- Lightweight rerank that combines lexical, dense, and graph features; heavy cross-encoder configurable but off by default on-device.
- Return path evidence alongside retrieved chunks for prompt construction.

2.3 Prompt construction upgrades
- Add a “Path Evidence” section: concise, human-readable summaries of the most explanatory graph paths that connect query entities to retrieved chunks.
- Add a “Scene Memory” section: rolling narrative memory including entities in scene, relationships, unresolved hooks, and stance sliders.
- Strict token budgeting for both sections to fit device constraints; adjustable at runtime via config.

2.4 Session and narrative memory
- Maintain a light, durable store of per-session narrative state (e.g., JSON or SQLite) to drive continuity.
- Keep a beat graph for the session: which entities interacted, how relationships changed, which hooks are open.
- Provide rolling scene summaries with decay and pinning, allowing prompts to include only the most salient beats.

2.5 Runtime-optimized indexing and cache
- Memory-map vectors and metadata to reduce RAM pressure.
- Prefer HNSW for small and IVF-PQ for larger collections; tune efSearch, M, nprobe, and codebooks for device profiles.
- Add a tiny hot cache tier for extremely popular nodes/paths/chunks.

3. Prompt design details
3.1 Path Evidence section (conceptual schema)
- For each selected path, include:
  - Path summary in natural language.
  - Node and relation highlights that justify relevance.
  - A compact provenance identifier that ties to retrieved chunks.
- Selection heuristics:
  - Prefer paths that connect multiple query entities or bridge to canon anchors.
  - Penalize cycles and very generic relation types.
  - Cap total tokens; favor 2–4 high-value paths.

3.2 Scene Memory section (conceptual schema)
- Entities in scene: canonical IDs and roles.
- Relationship deltas since last turn: brief bullets (e.g., trust +1, tension −1).
- Unresolved hooks: short, actionable items or mysteries.
- Stance sliders per NPC: e.g., friendliness, fear, curiosity.
- Last-turn recap: one or two sentences, decayed over time.

3.3 Persona/stylebook integration
- Ensure persona constraints and style guidelines are visible after scene memory and before evidence.
- Add a short “continuity constraints” list derived from canon to reduce contradictions.

4. Reranking strategies
- Lightweight default: combine lexical scores, ANN similarities, and graph priors (distance, path count, path strength).
- Heavy cross-encoder (e.g., BGE) remains available behind a config flag for desktop quality-first runs.
- Cache recent rerank features keyed by normalized query entities to avoid recomputation during bursts.

5. Index and runtime tuning
- Memory mapping: store indices and embeddings in files opened with mmap to reduce peak RAM.
- FAISS HNSW tuning: adjust M and efSearch per collection size for best recall-latency tradeoff.
- IVF-PQ tuning: choose nlist and codebooks to fit device cache; warm hot buckets.
- Reduce k after adding graph priors and router pinning; rely on better upstream filtering.

6. Entity normalization and canonicalization
- Single “EntityReference” shape end to end to avoid mixed dict/string formats.
- Normalize early in ingestion; carry IDs and types through indexing and retrieval.
- Prefer canonical ID display names in prompts to reduce LLM confusion.

7. Evaluation plan and KPIs
- Relevance: top-1 and top-3 accuracy versus [data/gold_queries.json](data/gold_queries.json).
- Narrative continuity: judge improvements in consistency across multi-turn tests.
- Latency: p50/p95 end-to-end retrieval time on device profiles.
- Footprint: peak RAM and storage on target devices.
- Ablations: with/without router pinning, with/without graph priors, with/without scene memory and path evidence.

8. Out-of-the-box enhancements
- Path-of-Thought snippet: a brief model-visible reasoning trail derived from graph paths, distinct from chain-of-thought content.
- Negative constraints: explicit “do not contradict” bullets extracted from canon for entities present in the scene.
- Episodic decay: discount older beats unless they reappear via graph paths to current entities.
- Micro-distilled exemplars: pre-generate tiny, high-signal summaries for central nodes to include when they appear in paths.
- Contrastive evidence: include one counter-evidence bullet to reduce hallucination on ambiguous topics.
- Template arcs: optional pre-authored arc patterns to suggest plausible next beats while respecting canon constraints.

9. Tracks for adoption (choose based on device profile)
- Track A — On-device baseline:
  - In-memory graph, router pinning, Path Evidence and Scene Memory, lightweight rerank, memmapped indices.
  - Target: ~2 GB RAM, ~5 GB storage, p95 under 25 ms retrieval.
- Track B — Graph-first with Neo4j (optional):
  - Use Neo4j during development and on desktop for richer queries; keep in-memory fallback for devices.
  - Same prompts and memory as Track A.
- Track C — Mobile-constrained performance:
  - Aggressive k reduction, lightweight rerank only, IVF-PQ small codebooks, micro hot-node cache, minimal Scene Memory.
  - Target: ~1 GB RAM, p95 under 20 ms retrieval.
- Track D — Quality-first desktop:
  - Keep cross-encoder available for high-value turns, larger HNSW efSearch, full Scene Memory and Path Evidence.
  - Target: 8–16 GB RAM, accept higher p95 for better top-1 precision.

10. Risks and mitigations
- Over-tokenization: Strict budgets and truncation; prefer path compression and summarization.
- Graph gaps: Add alias expansion and fallback to canonical anchors; monitor graph coverage in tests.
- Latency regressions: Keep heavy rerankers behind flags; cache graph features; lower k thanks to priors.
- Consistency drift: Pin critical canon facts in prompts and in scene memory until resolved.

11. File touchpoints and responsibilities
- Retrieval and priors: [api/retriever.py](api/retriever.py), [src/retrieval/router.py](src/retrieval/router.py)
- Prompt composition: [generation/prompts.py](generation/prompts.py), [generation/generator.py](generation/generator.py)
- Session memory: [npc_server.py](npc_server.py), [npc_generator.py](npc_generator.py)
- Index/runtime: [index/build_embeddings.py](index/build_embeddings.py), [index/build_faiss.py](index/build_faiss.py), [src/index/faiss_hnsw.py](src/index/faiss_hnsw.py)
- Entities and aliases: [ingestion/link_entities.py](ingestion/link_entities.py), [ingestion/build_jsonl.py](ingestion/build_jsonl.py), [data/entities.xml](data/entities.xml), [data/alias_map.json](data/alias_map.json)
- Config toggles: [config/rag.xml](config/rag.xml), [src/rag/config/rag.xml](src/rag/config/rag.xml)

12. Phased roadmap (planning only)
- Phase A: Graph-first retrieval and router pinning; return path evidence in retrieval responses.
- Phase B: Prompt updates (Path Evidence and Scene Memory) and session memory store.
- Phase C: Runtime hardening (memmap, FAISS tuning, tiny hot cache) and lightweight rerank as default.
- Phase D: Optional Neo4j backend for richer path queries in development and desktop.

13. Non-goals
- No change to canonical content in corpus; only retrieval, memory, and prompting layers.
- No forced dependency on external databases for devices.

14. Glossary
- PathRAG: Retrieval strategy that uses graph paths as priors and as evidence in prompts.
- Router pinning: Pre-selecting relevant collections before vector search to reduce noise.
- Beat graph: Session-time graph of story beats and relationship changes.

15. Acceptance checks for future implementation (to guide tests)
- Retrieval fails if the entity graph is empty in environments that expect graph priors.
- Prompts include Path Evidence and Scene Memory when entities are recognized and history exists.
- With router pinning and graph priors, k can be reduced without hurting top-3 accuracy on [data/gold_queries.json](data/gold_queries.json).

End of planning document.