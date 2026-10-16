Optimizing RAG for Real-Time On-Device Game Deployment
Retrieval-Augmented Generation (RAG) systems for video games must deliver fast, memory-efficient performance on local hardware, enabling NPC dialogues and lore Q&A without server calls. On-device RAG confers privacy, minimal latency, and offline reliability, but demands careful optimization of retrieval and generation pipelines
amd.com
. The latest 2024–2025 research offers numerous techniques to meet these challenges. Below, we survey advances in six key areas and highlight promising methods for building a runtime-constrained RAG pipeline that is optimized during development and efficient during gameplay.
Low-Latency, Low-Memory Retrieval Architectures
Real-time game settings require millisecond-level retrieval with a small memory footprint. Recent works focus on compressing vector indexes and accelerating search:
Compressed ANN Indexes: Knowledge Distillation for Indexes can drastically shrink memory usage without losing much accuracy. For example, Lu et al. (NeurIPS 2023) train a lightweight quantized index (student) to mimic a high-accuracy graph-based ANN index (teacher). The distilled index (KD-Index) was 40× smaller than a state-of-the-art ANN (HNSW) yet achieved comparable recall
neurips.cc
neurips.cc
. Such index distillation uses teacher–student training to preserve top-$k$ rankings
neurips.cc
, yielding compact indices ideal for consoles/PCs with limited RAM.
Approximate Nearest Neighbor Graphs: Graph-based ANN structures like HNSW (Hierarchical Navigable Small World) remain popular for speed. Recent research extends HNSW to hybrid dense-sparse retrieval to avoid multiple retrieval passes. Chen et al. (2024) propose a single graph index for hybrid vectors, concatenating dense and sparse embeddings
arxiv.org
arxiv.org
. By aligning dense vs. lexical scoring scales and using a two-stage search (dense-first, then dense+sparse refinement), their method achieves the same accuracy with 8.9–11.7× higher QPS (queries per second) than sequential dense-then-sparse retrieval
arxiv.org
. In practice, this means game queries can be answered an order of magnitude faster by searching one fused index rather than running BM25 and vector search separately.
Quantization and Binary Embeddings: Vector quantization (VQ) and binary hashing are being adopted in industry-scale vector DBs to save memory
rohan-paul.com
rohan-paul.com
. For instance, int8 product quantization can cut index size ~4× and even increase query speed with only minor recall loss
rohan-paul.com
rohan-paul.com
. These techniques allow storing large lore embeddings on-device (e.g. in 8-bit or binary form) to meet console memory limits.
Specialized Hardware & Models: When available, AI accelerators can offload heavy computations. AMD’s recent demo of on-device RAG used a Ryzen AI NPU for embeddings and a 3B-param LLM, splitting work between NPU and GPU to maximize throughput
amd.com
amd.com
. The LLM was pre-quantized and run with a hybrid NPU/GPU inference scheme (NPU for high-compute phases, GPU for high-bandwidth phases) to keep response times low
amd.com
. This shows that pairing optimized models with console/PC AI hardware (NPUs or GPU tensor cores) can achieve high compute performance within a power budget. Similarly, using smaller “lightweight” LLMs (2B–7B parameters, distilled or quantized) can drastically reduce latency for in-game deployment
odsc.medium.com
liquid.ai
.
Key Takeaways: Cutting-edge retrieval architectures emphasize approximation and compression to boost speed/efficiency. Product-quantized or knowledge-distilled indexes maintain strong recall while fitting in memory. Graph-based ANN search (e.g. HNSW) yields low latency, and new one-pass hybrid retrieval merges lexical and semantic search for efficiency
arxiv.org
. Leveraging hardware accelerators and smaller quantized models further ensures that on-device RAG can meet real-time game performance requirements.
Prompt Packing and Evidence Formatting under Token Constraints
Even with fast retrieval, formatting the retrieved evidence for the LLM is critical to maximize relevance given limited context windows. Recent research explores how to pack more pertinent info into fewer tokens and present it in a model-friendly way:
Path-Based Context Summaries: Traditional RAG simply concatenates top-$n$ documents (“flat” context), which can introduce redundancy and exhaust the token budget
arxiv.org
arxiv.org
. Graph-structured RAG methods instead select key facts and relations to include. PathRAG (Chen et al., 2025) builds an indexing graph of lore (entities as nodes, relations as edges) and retrieves only the most relevant relational paths connecting query-related nodes
arxiv.org
arxiv.org
. These paths are converted into a concise textual prompt. By pruning extraneous neighbors and focusing on a few high-value connections, PathRAG reduces redundant info and guides the LLM to more logical, coherent answers
arxiv.org
arxiv.org
. Across multiple benchmarks it outperformed earlier graph-based RAG variants while consuming fewer prompt tokens
arxiv.org
arxiv.org
.
Hierarchical Context and Clustering: Rather than dumping all raw text chunks, researchers use hierarchical grouping to improve relevance density. ArchRAG (Wang et al., 2025) clusters the knowledge graph into attributed communities and builds a hierarchical index
arxiv.org
. At query time it retrieves whole relevant communities (and sub-nodes within them) instead of individual disjoint chunks. This approach improved QA accuracy and cut token usage, by ensuring the included context is topically focused and avoiding “random” irrelevant text
arxiv.org
arxiv.org
. Hierarchically structuring lore (for example by story arcs, factions, locations) and retrieving at the cluster level could similarly yield well-organized prompt context for narrative games.
Structured Prompt Formats: The way evidence is formatted in the prompt influences how well the LLM utilizes it. Recent strategies include presenting retrieved facts as lists, tables, or pseudo-code rather than a raw paragraph. Graph-based RAG research has noted that linearizing a subgraph into a structured template (e.g. a bulleted list of relations, or a JSON-like format) can improve coherence
emergentmind.com
. By explicitly delineating entities and their attributes/relations, the model can more easily identify the connections. This is especially useful under long contexts – a structured format helps prevent critical facts from being “lost in the middle” of a long prompt
emergentmind.com
. In practice, developers can use prompt engineering to tag or section evidence (e.g. <LoreExcerpt>…</LoreExcerpt>) so that the LLM clearly sees what is context vs. user query.
Prompt Compression and Summarization: When the raw text for a knowledge source is very large (e.g. a long lore book in-game), one approach is to summarize or distill it offline, and use the summary at runtime. Some pipelines now include an LLM or algorithmic step to pre-summarize documents into 1–2 sentence synopses or extract key facts, effectively trading offline computation for shorter prompts. Chan et al. (2025) argue that if the knowledge corpus is small enough, one can even preload all of it into the prompt (see “Cache-Augmented Generation” below) – but for larger corpora, automated summarization or selecting only the most relevant sections is vital. Techniques like rationale extraction (having an LLM highlight the justification sentences for an answer) can yield a more focused evidence pack
aclanthology.org
, maximizing usefulness per token.
Key Takeaways: Under tight token budgets, quality trumps quantity for context. Cutting-edge methods like PathRAG filter and format retrieved knowledge to pack the most relevant information in the prompt
arxiv.org
. Organizing evidence into structured or hierarchical forms (paths, tables, communities) makes it easier for the LLM to integrate context without wasting tokens on noise
arxiv.org
emergentmind.com
. Game developers should invest in prompt engineering: by pre-formatting lore snippets (e.g. bolding character names, enumerating item stats) and by merging overlapping facts, the prompt can convey more with less.
Neural Retriever Distillation and Offline Precomputation
To keep runtime lightweight, modern RAG systems push as much work as possible to offline training or indexing. Two trends in 2025 are (1) distilling large retriever models into smaller ones specialized for your game domain, and (2) precomputing complex structures (graphs, caches, etc.) during development so that retrieval at runtime is trivial.
Retriever Distillation: Large dual-encoders or cross-encoders can achieve high retrieval accuracy but are often too slow or memory-hungry to deploy on-device. Instead, you can use them as teachers to train a compact student. Tamber et al. (2025) demonstrate this with listwise distillation from a powerful cross-encoder: the student retriever is trained not just on correct vs. incorrect passages, but to replicate the ranking of top-$k$ results from the teacher
arxiv.org
. This provides richer training signals and yielded consistent gains in specialized retrieval tasks
arxiv.org
. In practice, one could fine-tune a MiniLM or other small model on relevance data labeled by a larger model (or by an LLM generating synthetic queries). The result is a fast, domain-tuned retriever that maintains much of the teacher’s accuracy. Such distilled retrievers can also use smaller embedding dimensions (e.g. 256 instead of 768) to further cut index size and memory.
Synthetic Data Augmentation: A related offline approach is using LLMs themselves to generate training data for retrievers (often called “Self-Distillation” or synthetic QA). Recent systems like SynTRiever (2024) prompt a large LLM with lore passages to generate plausible questions and then train a retriever on those (question, passage) pairs
aclanthology.org
arxiv.org
. This can imbue the retriever with knowledge of subtle domain specifics without costly human annotation. By the time of deployment, the retriever has essentially “read” the entire lore and can handle niche player queries even on-device.
Index Precomputation and Caching: Many pipelines now precompute expensive operations so that runtime retrieval is just lookups. A prime example is precomputing a knowledge graph or embedding index during development (as was done in the Logres project’s ingestion phase). Another example is RAGCache (Jin et al., 2024), which analyzes retrieval patterns to cache intermediate results for reuse
arxiv.org
. RAGCache organizes retrieved knowledge into a tree structure cached across GPU and CPU memory, and overlaps retrieval with generation to hide latency
arxiv.org
. In experiments, it cuts time-to-first-token by up to 4× and doubles throughput versus a vanilla FAISS setup
arxiv.org
. The key idea is to reuse work: if multiple queries access overlapping lore pieces, those embeddings or decoder key/value states can be stored and recalled instantly instead of recomputed. For games with finite lore sets, a “knowledge cache” of popular facts or recently used chunks can significantly reduce redundant computation.
Episodic Memory Precomputation: In dialogue-heavy games, players may have long conversations or multiple sessions with an NPC. Research on episodic memory for LLMs suggests doing heavy lifting between sessions. PREMem (Kim et al., 2025) is a method that performs “pre-storage reasoning” on conversation logs to build an enriched memory store
arxiv.org
arxiv.org
. Instead of saving raw transcripts, PREMem extracts structured memory fragments (facts, player preferences, narrative events) and computes relations offline (e.g. linking how the player’s choice in Chapter 1 affected Chapter 3)
arxiv.org
arxiv.org
. This way, when the game needs to generate a response later, the LLM isn’t doing all the logic from scratch – it can retrieve from a prepared episodic memory that already encodes cross-session reasoning (causal links, temporal progressions, etc.). The result: smaller models perform as well as much larger ones because the “intelligence” has been baked into the memory representations
arxiv.org
arxiv.org
. Game devs can mimic this by processing playthrough logs or dialogue trees ahead of time into structured formats (for example, a knowledge base of what the player has done, which NPCs they’ve met, etc.), rather than feeding raw history into the model each time.
Key Takeaways: By investing compute upfront, you can slim down the runtime system. Train small retrievers with help from big models (distillation, synthetic data) so that on-device search is fast but still accurate
arxiv.org
. Precompute knowledge structures – whether vector indexes, graph relationships, or consolidated memories – to offload work from the live model. These optimizations ensure that by the time the game is running, the RAG pipeline can be nearly “lookup-only,” having done all heavy reasoning and learning offline.
Graph-Enhanced Retrieval for Contextual Dialogue and Story Generation
When a game’s narrative is complex and interconnected, standard chunk retrieval may falter at providing the needed context. Graph-enhanced RAG integrates knowledge graphs or relational reasoning into retrieval, which 2025 research shows to be especially powerful for keeping dialogues and plot generation coherent:
Graph-Based RAG: Instead of treating lore as an unstructured text pool, graph-based approaches build a knowledge graph of the world – nodes could be characters, locations, items, etc., with edges denoting relationships (alliances, events, hierarchies). Queries can then be answered by traversing this graph. GraphRAG (Edge et al., 2024) and LightRAG (Guo et al., 2024) were early methods using graphs: GraphRAG applied community detection on the graph and summarized each community, while LightRAG fetched the immediate neighbors of entities mentioned in the query
arxiv.org
arxiv.org
. These ensured that the context included globally relevant info (not just one document’s view). However, they sometimes included too much extraneous detail
arxiv.org
. The newer PathRAG we discussed above addressed this by focusing on minimal connecting paths
arxiv.org
arxiv.org
. Overall, the trend is that for “global” questions or narrative consistency (e.g. “What has NPC_X done since the player last met them?”), Graph-RAG techniques far outperform flat retrieval. Studies show for multi-hop reasoning and multi-document synthesis, graph-based RAG yields substantially higher answer quality and faithfulness
emergentmind.com
. In contrast, for simple fact lookups, a vanilla RAG sometimes suffices with lower overhead
emergentmind.com
. This suggests a hybrid strategy: use lightweight retrieval for straightforward queries, but invoke graph-enhanced retrieval for complex or story-spanning questions.
Narrative Knowledge Graphs: In game contexts, a narrative knowledge graph can be used to maintain continuity. For example, an RPG could encode plot points as a graph, so that if the player’s action triggers a new story branch, the RAG system can retrieve context along that branch (previous related events, involved characters) instead of unrelated lore. Techniques like event graph extraction (linking cause-effect of events) and character relationship graphs have been explored in story generation research (e.g. for automated story understanding). The PathRAG approach from QA is directly applicable – it would retrieve the “path” of story events connecting a past event to the current situation, giving the LLM a coherent narrative thread to follow in dialogue. By converting such a path to a textual prompt (e.g. “After <EventA>, <Character> traveled to <Location>, then <EventB> occurred…”), the NPC’s response can stay on-script with the game’s narrative logic.
Hybrid Graph-Text Retrieval: Some recent works combine vector search with graph constraints. For instance, CG-RAG (Hu et al., 2025) used a citation graph for scientific QA
emergentmind.com
 – analogous to using a quest dependency graph in a game – and reranked retrieved passages based on graph connectivity. Another approach is LeaR (as mentioned in emergent surveys) which incorporates learned structural embeddings so that the retriever scores favor chunks that are graph-central or connected
emergentmind.com
. In a game, one could imagine scoring lore chunks higher if they contain the player’s current quest ID or connect to the player’s location node in the world graph. This ensures retrieval results aren’t just semantically relevant but also contextually appropriate to the game state.
Multi-Hop and Reasoning Ability: Graph-enhanced retrieval shines for multi-hop queries (where answering requires chaining facts). In games, a player’s question may implicitly require multi-hop reasoning (“Who is ruling the kingdom now that I defeated the tyrant?” involves knowing the tyrant was defeated and the succession law). Graph-based RAG can retrieve the chain of evidence needed, whereas pure vector search might miss one hop. Empirical results confirm that for questions needing multi-step reasoning or synthesis across documents, graph-based methods significantly outperform, often with higher faithfulness and better coverage of relevant facts
emergentmind.com
emergentmind.com
. This suggests using graph retrieval for plot-related queries, historical questions, or any time an NPC needs to draw on multiple events/facts from the lore.
Key Takeaways: Graphs provide memory and structure to RAG, which is crucial for narrative consistency. Building a knowledge graph of your game world and using it to guide retrieval can prevent the LLM from making up inconsistent lore. Techniques like PathRAG show how to integrate graphs efficiently: by retrieving a succinct relational path, you supply just the necessary backstory to the LLM
arxiv.org
arxiv.org
. The latest research indicates graph-augmented retrieval should be used selectively – it adds overhead, so reserve it for complex queries or important continuity checks
emergentmind.com
emergentmind.com
. Done right, it can greatly enhance the coherence and correctness of generated dialogues and narratives.
Semantic Caching, Episodic Memory, and Learned Retrieval Policies
Beyond static optimizations, RAG systems are becoming adaptive: learning what to fetch, what to reuse, and when to retrieve at all, based on context. These innovations help trim unnecessary latency in interactive settings like games:
Semantic Caching of Retrievals: Much like web browsers cache recent pages, RAG systems can cache recent retrieval results or partial generation states. The RAGCache system already discussed not only caches data but smartly overlaps retrieval with generation to hide latency
arxiv.org
arxiv.org
. Another paradigm emerging in 2025 is Cache-Augmented Generation (CAG). Chan et al. (WWW 2025) argue that if the knowledge corpus is relatively fixed and small, one can preload all relevant documents into the LLM’s context or memory and skip retrieval entirely
arxiv.org
arxiv.org
. Their “Don’t Do RAG” experiments showed that using a long-context model to absorb a knowledge base (e.g. a game’s lore codex) can eliminate retrieval latency and avoid retrieval errors
arxiv.org
arxiv.org
. Essentially, the model is given the knowledge upfront (cached in its context window or a prefix) and queries are answered directly from this cache. This works best when the knowledge size is constrained (a feasible approach for some indie games or specific game regions). While not always practical at large scale, it highlights a spectrum of caching: from fine-grained caches (storing just past query results) to coarse caching (storing the entire KB in context).
Episodic Memory Systems: We touched on PREMem, which builds an episodic memory offline. More generally, episodic memory modules in LLM agents allow retaining and retrieving events from previous sessions. For game dialogue, a well-designed memory can answer questions like “What did I tell this NPC last time?” without scanning full transcripts. Approaches like EMDR (Fountas et al., 2025) and EpMAN (Wu et al., 2025) use dedicated memory retrieval networks that fetch old conversation snippets relevant to the current turn
arxiv.org
aclanthology.org
. These are often learned retrieval policies: a small model or heuristic decides which past interactions to surface to the LLM. By learning what kinds of past information are useful (e.g. player’s stated goal, an item they showed the NPC), the system can avoid flooding the prompt with the entire chat history. This is analogous to human-like recall – only the pertinent memories “pop up” when needed. Empirical results show such memory retrieval can extend effective context length without linear cost, enabling long-term consistency in dialogues.
Learned Retrieval Policies (RL & Meta-control): A nascent area is using reinforcement learning or LLM-based controllers to decide how and when to retrieve. For example, GraphRAG-RL (Yu et al., 2025) trains a policy that chooses which tool (text search, graph search, or none) to invoke at each step, maximizing answer quality
emergentmind.com
emergentmind.com
. Others have explored letting the LLM reformulate queries in an iterative manner (an LLM “advisor” supervises the retriever – Zou et al., 2025
emergentmind.com
). In a game scenario, a learned policy might dynamically adjust retrieval: e.g. if the last user query was answered confidently from cache, skip retrieval this turn to save time; or use a different retrieval method for different query types (quick keyword search for simple questions, versus semantic search for open-ended ones). By optimizing the retrieval strategy via simulation (self-play or player modeling), the system can minimize latency while maintaining answer quality. An RL-tuned NPC dialogue system might learn to retrieve extra backstory only if the question is complex, otherwise respond from its local memory – this kind of adaptive retrieval keeps interactions snappy.
On-the-Fly Index Updates: In games where the knowledge state changes (say the player’s actions alter the world), learned policies can determine when to update or invalidate caches. For instance, if a major plot event occurred, the system might refresh the relevant part of the index or memory (perhaps guided by the graph structure to only update connected nodes). Semantic cache replacement policies are being studied – RAGCache introduced a replacement that accounts for LLM usage patterns
arxiv.org
. This means the cache prefers to keep knowledge that tends to be reused in multiple answers. Tailoring such policies to game analytics (e.g. which lore entries players ask about most) could further improve performance by keeping “hot” lore in faster storage (GPU memory or context window) and allowing “cold” lore to be paged out until needed.
Key Takeaways: The state-of-the-art is moving toward adaptive retrieval management. By caching recent results and even pre-loading entire knowledge chunks into the model, one can eliminate redundant work and latency
arxiv.org
arxiv.org
. A smart RAG system for games will incorporate a form of episodic memory, so that continuity is preserved across play sessions with minimal re-reading of history. Furthermore, using RL or learned heuristics to control retrieval (how many documents to retrieve, which modality to use, when to skip retrieval) can squeeze out extra efficiency and ensure the retrieval pipeline always matches the query’s needs
emergentmind.com
emergentmind.com
. The result is a more context-aware and efficient system that feels responsive even as conversations or knowledge grow over time.
Model-Agnostic Optimizations (KV Caching and Structured Prompts)
Finally, there are several general strategies that apply to virtually any RAG setup, regardless of model architecture:
Efficient Context Management and KV Cache: Modern LLM inference engines (like vLLM, FasterTransformer) use continuous batching and key–value caching to speed up responses. In practice, ensure your RAG system reuses the model’s KV cache across turns – this avoids re-processing the unchanged prefix of a conversation. Moreover, sharding long prompts into prefix and query can help: you might fix the lore context as a prefix and only feed the new player query each time (attaching the cached prefix KV from previous inference)
arxiv.org
. This technique, sometimes called prefix caching, can significantly cut latency for iterative dialogue. It requires the model or inference library to support providing a cache of past attention keys/values. Many on-device frameworks do now support this, effectively letting an LLM handle a 4K-token context as, say, a 3K cached prefix + 1K new tokens, instead of recomputing 4K tokens worth of attention every turn.
Structured Outputs and Few-Shot Prompts: Guiding the LLM with structured prompts can reduce token waste and improve relevancy. For example, instead of a free-form prompt, use a system message template: “You are an NPC armed with the following knowledge: [ lore snippets ]. When asked a question, use only this knowledge to answer.” Providing explicit instructions and even an example QA pair (few-shot prompt) can focus the generation and reduce irrelevant rambling, which in turn means you can include fewer raw lore tokens. This is a model-agnostic prompt engineering step that often yields more on-point answers. Just as importantly, instructing the model to be concise or take on a role can limit the length of its output, indirectly controlling token usage.
Memory Footprint Optimization: On device, every megabyte counts. Choose model-agnostic tweaks like using 16-bit or 8-bit weights for the LLM, and use integer quantization for embedding models. These do not change the RAG logic but greatly affect deployability. Research into structured pruning of LLMs (removing redundant neurons) and efficient attention (like flash attention, sliding window attention for long texts) also falls here – these methods let you run models faster or with fewer GPU resources. For instance, long context compression techniques (Yuan et al., 2025) train the model to compress long input texts into shorter vectors which the model attends to
preprints.org
. A similar idea could let an NPC condense the ongoing dialogue or the lore context internally, reducing the burden on attention computation.
Evaluation and Alignment: Although not a pure optimization, ensuring the model is well-aligned with the retrieval is crucial for efficient use of context. If the LLM is not tuned to follow retrieved evidence (a known issue where it may ignore context or “imagine” its own answers), even the best retrieval pipeline will be wasted. Rationale distillation methods (press et al., 2025) are exploring training LLMs with retrieved evidence plus human feedback to make them better at using the facts
aclanthology.org
. A practical tip is to do iterative testing with your RAG system: see if the NPC actually uses the lore you feed it. If not, you might need to adjust prompt structure or fine-tune the model on example dialogues that require evidence usage. An aligned model makes structured prompts and packed contexts far more effective, avoiding the need to redundantly stuff the prompt.
Key Takeaways: Model-agnostic optimizations ensure you’re getting the most out of whatever LLM you use. By smart caching of keys/values and careful prompt design, you minimize unnecessary computation each turn and make every token count. Techniques like quantization, pruning, and efficient attention reduce resource load without altering outputs – critical for fitting RAG on consoles or lower-end PCs. Finally, an aligned model that knows how to use retrieved info is key to the success of all other optimizations: if your NPC’s model reliably integrates the provided lore, you can safely trim down prompts and trust the system to still answer correctly.
Conclusion: The frontier of RAG research in 2025 is all about doing more with less – less latency, less memory, fewer tokens – while preserving the richness of knowledge that makes game interactions compelling. From advanced vector indexes and graph-guided retrieval to caching strategies and distilled models, we now have a toolbox to build RAG systems that run in real-time on local devices. The common theme is optimization at every stage: preprocess and compress your knowledge, carefully select and format context, and streamline the model’s workload. By integrating these techniques, game developers can deploy NPCs and lore Q&A systems that feel both intelligent and responsive, grounding their dialogue in extensive world knowledge without sacrificing the player’s immersion with slow or inconsistent replies. The gap between large-server AI and on-device game AI is rapidly closing
amd.com
 – with these research-driven optimizations, Retrieval-Augmented Generation can become a practical reality in next-gen console and PC games. Sources:
Chen et al. 2025 – PathRAG: Pruning Graph-based RAG with Relational Paths
arxiv.org
arxiv.org
Jin et al. 2024 – RAGCache: Efficient Knowledge Caching for RAG
arxiv.org
arxiv.org
Chan et al. 2025 – “Don’t Do RAG”: Cache-Augmented Generation for Knowledge Tasks
arxiv.org
arxiv.org
Kim et al. 2025 – PREMem: Pre-Storage Reasoning for Episodic Memory in Dialogue
arxiv.org
arxiv.org
Tamber et al. 2025 – Listwise Distillation for Domain Retrievers
arxiv.org
Lu et al. 2023 – KD-Index: Knowledge Distillation for Compressed ANN Indexes
neurips.cc
neurips.cc
Chen et al. 2024 – Graph-ANN Hybrid Retrieval for Dense & Sparse
arxiv.org
Emergent Mind (2025) – Graph-Based RAG Survey
emergentmind.com
emergentmind.com
AMD Technical Article (2025) – On-Device RAG on Ryzen AI
amd.com
amd.com
Citations
RAG with Hybrid LLM on AMD Ryzen AI Processors

https://www.amd.com/en/developer/resources/technical-articles/2025/rag-with-hybrid-llm-on-amd-ryzen-ai-processors.html

NeurIPS Poster Knowledge Distillation for High Dimensional Search Index

https://neurips.cc/virtual/2023/poster/70801

NeurIPS Poster Knowledge Distillation for High Dimensional Search Index

https://neurips.cc/virtual/2023/poster/70801

NeurIPS Poster Knowledge Distillation for High Dimensional Search Index

https://neurips.cc/virtual/2023/poster/70801

Efficient and Effective Retrieval of Dense-Sparse Hybrid Vectors using Graph-based Approximate Nearest Neighbor Search

https://arxiv.org/html/2410.20381v1

Efficient and Effective Retrieval of Dense-Sparse Hybrid Vectors using Graph-based Approximate Nearest Neighbor Search

https://arxiv.org/html/2410.20381v1

Efficient and Effective Retrieval of Dense-Sparse Hybrid Vectors using Graph-based Approximate Nearest Neighbor Search

https://arxiv.org/html/2410.20381v1

Vector Index Methods for Document Digitization in LLM Applications

https://www.rohan-paul.com/p/vector-index-methods-for-document

Vector Index Methods for Document Digitization in LLM Applications

https://www.rohan-paul.com/p/vector-index-methods-for-document

Vector Index Methods for Document Digitization in LLM Applications

https://www.rohan-paul.com/p/vector-index-methods-for-document

RAG with Hybrid LLM on AMD Ryzen AI Processors

https://www.amd.com/en/developer/resources/technical-articles/2025/rag-with-hybrid-llm-on-amd-ryzen-ai-processors.html

RAG with Hybrid LLM on AMD Ryzen AI Processors

https://www.amd.com/en/developer/resources/technical-articles/2025/rag-with-hybrid-llm-on-amd-ryzen-ai-processors.html

RAG with Hybrid LLM on AMD Ryzen AI Processors

https://www.amd.com/en/developer/resources/technical-articles/2025/rag-with-hybrid-llm-on-amd-ryzen-ai-processors.html

The Best Lightweight LLMs of 2025: Efficiency Meets Performance

https://odsc.medium.com/the-best-lightweight-llms-of-2025-efficiency-meets-performance-78534ce45ccc

Introducing Liquid Nanos — frontier‑grade performance on everyday ...

https://www.liquid.ai/blog/introducing-liquid-nanos-frontier-grade-performance-on-everyday-devices

PathRAG: Pruning Graph-based Retrieval Augmented Generation with Relational Paths

https://arxiv.org/html/2502.14902v1

PathRAG: Pruning Graph-based Retrieval Augmented Generation with Relational Paths

https://arxiv.org/html/2502.14902v1

PathRAG: Pruning Graph-based Retrieval Augmented Generation with Relational Paths

https://arxiv.org/html/2502.14902v1

PathRAG: Pruning Graph-based Retrieval Augmented Generation with Relational Paths

https://arxiv.org/html/2502.14902v1

PathRAG: Pruning Graph-based Retrieval Augmented Generation with Relational Paths

https://arxiv.org/html/2502.14902v1

PathRAG: Pruning Graph-based Retrieval Augmented Generation with Relational Paths

https://arxiv.org/html/2502.14902v1

[2502.09891] ArchRAG: Attributed Community-based Hierarchical Retrieval-Augmented Generation

https://arxiv.org/abs/2502.09891

[2502.09891] ArchRAG: Attributed Community-based Hierarchical Retrieval-Augmented Generation

https://arxiv.org/abs/2502.09891

[2502.09891] ArchRAG: Attributed Community-based Hierarchical Retrieval-Augmented Generation

https://arxiv.org/abs/2502.09891

Graph-based Retrieval-Augmented Generation

https://www.emergentmind.com/topics/graph-based-retrieval-augmented-generation-rag

Graph-based Retrieval-Augmented Generation

https://www.emergentmind.com/topics/graph-based-retrieval-augmented-generation-rag

[PDF] Rationale Distillation in Retrieval-Augmented Generation

https://aclanthology.org/2025.findings-acl.220.pdf

[2502.19712] Teaching Dense Retrieval Models to Specialize with Listwise Distillation and LLM Data Augmentation

https://arxiv.org/abs/2502.19712

[2502.19712] Teaching Dense Retrieval Models to Specialize with Listwise Distillation and LLM Data Augmentation

https://arxiv.org/abs/2502.19712

Syntriever: How to Train Your Retriever with Synthetic Data from LLMs

https://aclanthology.org/2025.findings-naacl.136/

Syntriever: How to Train Your Retriever with Synthetic Data from LLMs

https://arxiv.org/abs/2502.03824

[2404.12457] RAGCache: Efficient Knowledge Caching for RAG

https://arxiv.org/abs/2404.12457

[2404.12457] RAGCache: Efficient Knowledge Caching for RAG

https://arxiv.org/abs/2404.12457

[2404.12457] RAGCache: Efficient Knowledge Caching for RAG

https://arxiv.org/abs/2404.12457

Pre-Storage Reasoning for Episodic Memory: Shifting Inference Burden to Memory for Personalized Dialogue

https://arxiv.org/html/2509.10852v1

Pre-Storage Reasoning for Episodic Memory: Shifting Inference Burden to Memory for Personalized Dialogue

https://arxiv.org/html/2509.10852v1

Pre-Storage Reasoning for Episodic Memory: Shifting Inference Burden to Memory for Personalized Dialogue

https://arxiv.org/html/2509.10852v1

Pre-Storage Reasoning for Episodic Memory: Shifting Inference Burden to Memory for Personalized Dialogue

https://arxiv.org/html/2509.10852v1

Pre-Storage Reasoning for Episodic Memory: Shifting Inference Burden to Memory for Personalized Dialogue

https://arxiv.org/html/2509.10852v1

Pre-Storage Reasoning for Episodic Memory: Shifting Inference Burden to Memory for Personalized Dialogue

https://arxiv.org/html/2509.10852v1

PathRAG: Pruning Graph-based Retrieval Augmented Generation with Relational Paths

https://arxiv.org/html/2502.14902v1

PathRAG: Pruning Graph-based Retrieval Augmented Generation with Relational Paths

https://arxiv.org/html/2502.14902v1

PathRAG: Pruning Graph-based Retrieval Augmented Generation with Relational Paths

https://arxiv.org/html/2502.14902v1

PathRAG: Pruning Graph-based Retrieval Augmented Generation with Relational Paths

https://arxiv.org/html/2502.14902v1

PathRAG: Pruning Graph-based Retrieval Augmented Generation with Relational Paths

https://arxiv.org/html/2502.14902v1

Graph-based Retrieval-Augmented Generation

https://www.emergentmind.com/topics/graph-based-retrieval-augmented-generation-rag

Graph-based Retrieval-Augmented Generation

https://www.emergentmind.com/topics/graph-based-retrieval-augmented-generation-rag

Graph-based Retrieval-Augmented Generation

https://www.emergentmind.com/topics/graph-based-retrieval-augmented-generation-rag

Graph-based Retrieval-Augmented Generation

https://www.emergentmind.com/topics/graph-based-retrieval-augmented-generation-rag

Graph-based Retrieval-Augmented Generation

https://www.emergentmind.com/topics/graph-based-retrieval-augmented-generation-rag

Graph-based Retrieval-Augmented Generation

https://www.emergentmind.com/topics/graph-based-retrieval-augmented-generation-rag

Graph-based Retrieval-Augmented Generation

https://www.emergentmind.com/topics/graph-based-retrieval-augmented-generation-rag

Graph-based Retrieval-Augmented Generation

https://www.emergentmind.com/topics/graph-based-retrieval-augmented-generation-rag

[2404.12457] RAGCache: Efficient Knowledge Caching for RAG

https://arxiv.org/abs/2404.12457

[2412.15605] Don't Do RAG: When Cache-Augmented Generation is All You Need for Knowledge Tasks

https://arxiv.org/abs/2412.15605

[2412.15605] Don't Do RAG: When Cache-Augmented Generation is All You Need for Knowledge Tasks

https://arxiv.org/abs/2412.15605

[2412.15605] Don't Do RAG: When Cache-Augmented Generation is All You Need for Knowledge Tasks

https://arxiv.org/abs/2412.15605

[2412.15605] Don't Do RAG: When Cache-Augmented Generation is All You Need for Knowledge Tasks

https://arxiv.org/abs/2412.15605

[PDF] Episodic Memory is the Missing Piece for Long-Term LLM Agents

https://arxiv.org/pdf/2502.06975?

Episodic Memory AttentioN for Generalizing to Longer Contexts

https://aclanthology.org/2025.acl-long.574/

Graph-based Retrieval-Augmented Generation

https://www.emergentmind.com/topics/graph-based-retrieval-augmented-generation-rag

Graph-based Retrieval-Augmented Generation

https://www.emergentmind.com/topics/graph-based-retrieval-augmented-generation-rag

[PDF] Learning to Retrieve, Generate, and Compress: A Unified View of ...

https://www.preprints.org/frontend/manuscript/24a9428f393538af86867ab146c005e1/download_pub

[PDF] Rationale Distillation in Retrieval-Augmented Generation

https://aclanthology.org/2025.findings-acl.220.pdf

[2404.12457] RAGCache: Efficient Knowledge Caching for RAG

https://arxiv.org/abs/2404.12457

Here’s a pragmatic KPI set for a runtime-first, on-device RAG in games. I grouped them by layer, gave formulas/collection tips, and (where useful) target
Here's a pragmatic KPI set for a runtime-first, on-device RAG in games. I grouped them by layer, gave formulas/collection tips, and (where useful) target bands for PC/console.

1) Player-facing performance & stability

End-to-end latency (ms): p50/p90/p95/p99 from request → final text available.
• Targets: cache hit ≤0.2 ms; entity-first ≤0.5 ms; ANN ≤2.0 ms p95.

Frame impact (ms): max spike during retrieval/generation, and % frames >16.7 ms (60 FPS).
• Target: retrieval path adds <0.5 ms on game thread (do work off thread).

Stall rate (%): interactions exceeding a timeout (e.g., >150 ms) / total.

Cold start time (ms): first call after shard swap.

Perceived responsiveness: time-to-first-token (TTFT) for dialogue. Target: <120 ms if streaming UI is used.

2) Retrieval quality (offline eval + online shadow)

Recall@k = (# of ground-truth passages in top-k) / (# relevant).

MRR@k / MAP@k / nDCG@k on gold query set (dialogue, lore, plot).
• Targets: ≥ your cross-encoder baseline × 95% after distillation.

Blended score lift: delta in MAP when BM25-lite is enabled vs disabled.

Entity coverage (%): fraction of top-k that mention at least one active entity.

Path correctness (%): for path-based RAG, % of retrieved paths that are valid in the narrative graph.

3) Evidence use & grounding (did the LLM use what you fed it?)

Evidence utilization rate (%): outputs containing ≥1 cited evidence ID / total.

Unsupported claim rate (%): lines that assert facts without mapped IDs (post-gen checker).

Canon violation rate (ppm): violations detected by rules/DFAs per million tokens.

Redundancy in prompt (%): duplicate or semantically equivalent strips / total strips.

Context waste (%): tokens sent that were never attended to above a threshold (estimate via attention probes or ablation).

Quote vs abstract effectiveness: win rate when swapping strip variant in A/B (dialogue quality score).

4) Retrieval system efficiency

Cache hit rate (%) by key = (norm_query_or_sig, state_hash).
• Slice by scene, quest phase, character.

Fast-path usage (%): requests served via entity→topN cache (no ANN).

Prefilter effectiveness: average candidate set size before vs after entity/type filters.

ANN efficiency: candidates/ms at efSearch=X; recall vs speed curve.

BM25-lite cost (µs) and blend gain (MAP lift per µs).

Shard routing accuracy (%): % queries that did not require fallback to global.

Shard swap time (ms) and IO throughput (MB/s) for memory-mapped loads.

Index health: codebook drift (quantization error), HNSW connectivity (avg degree), posting list balance.

5) Generation efficiency (LLM runtime)

Tokens in / out per turn and prompt-packing budget adherence.

KV-cache reuse ratio (%): reused tokens / total prefix tokens.

Speculative decoding acceptance rate (%) (if used).

Grammar-constrained decoding hit (%) (outputs that validate on first pass).

Latency breakdown (ms): prefill, decode, post-process.

Energy/power (W) on target SKU during dialogue bursts (optional but useful for thermals).

6) Memory & footprint

Resident set size (MB): current shard + global + caches. Target: ≤150 MB typical.

Index density (B/vector): PQ/OPQ codes + graph overhead.

Cache footprint (MB) and eviction rate (%).

Artifact size (MB) per shard and total on disk.

7) Content & ops KPIs

Build time (min) for shards; artifact validation pass rate (%).

Distilled scorer parity: Pearson/Spearman vs cross-encoder scores; MAP delta ≤5%.

Motif/path policy accuracy (%) vs human labels (for narrative controller).

Locale coverage: strips per locale; missing-strip rate.

8) Safety & tone (narrative guardrails)

Taboo/ethics violation rate (ppm) (DFA + lexical filters).

Style adherence (%): matches voice card constraints (classifier-based).

Toxicity/offense flags (ppm) (only for open player text interactions).

9) Business/experience impact (optional but powerful)

Dialogue satisfaction score (playtest rubric 1–5) and helpfulness@1 (did the line advance the scene?).

Branch coherence score (QA rubric): beats realized without contradictions.

Engagement: average conversation length, % optional dialogues triggered, side-quest pickup rate after plot hooks.

How to instrument (quick and cheap)

Per-module timers: route, load, entity-fast, ANN, BM25, scorer, pack, LLM prefill/decode.

the game engine integration: emit telemetry events to a ring buffer; flush JSONL each minute in dev builds.

Shadow eval: 1% of live queries mirrored through an offline scorer for Recall/MAP (no player impact).

A/B toggles: feature flags for BM25-lite, distilled scorer, fast-path, strip variants.

Dashboards: p95 latency by scene; cache hit by character; grounding metrics (utilization/unsupported claims) by quest.

Suggested target bands (first pass)

Latency p95 (ANN path): ≤2.0 ms; TTFT (streaming): ≤120 ms.

Cache hit: ≥35% overall; fast-path usage: ≥50% in dialogue.

Recall@6: ≥ baseline × 0.95; MAP@6: ≥ baseline × 0.95.

Evidence utilization: ≥85%; unsupported claims: ≤1% of lines.

Canon violations: <50 ppm; style adherence: ≥90%.

Resident memory (current+global): ≤150 MB typical, ≤220 MB worst-case hubs.

If you want, I can drop a metrics schema (JSON/CSV) and a tiny the game engine telemetry helper (C++) so your team can wire these counters in a day and start graphing them.