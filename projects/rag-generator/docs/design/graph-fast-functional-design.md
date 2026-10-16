
# Graph Fast Path — Functional Design & Implementation Plan (Roo Code Ready)

**Goal:** Deliver concise, factual graph-derived evidence (paths, facts, rules, quotes) to the LLM in **microseconds–milliseconds**, keeping end-to-end RAG **≪ 1s**. Heavy work (authoring, validation, path mining) happens **offline** in Neo4j; the game ships compact, memory-mapped artifacts only.

---

## 1) Objectives
- **Runtime-light:** All heavy computation offline; runtime is read-only lookups and bounded searches.
- **Under-budget:** Graph ops typically ≤ **2 ms**; worst case (bounded search) ≤ **1.5 ms p95** on target PC/console.
- **Consumer-ready:** Output structured slots `{ paths[], facts[], rules[], quotes[] }` with short abstracts and IDs.

---

## 2) Scope (Features 1–5)
1. **Path Catalog** — pre-baked connections between hot entity pairs and metapaths.  
2. **Hub / 2-Hop Labels** — tiny “cheat sheets” to connect pairs without searching.  
3. **Bidirectional Bounded Search (BIBS) + Metapath Automaton** — meet-in-the-middle with strict limits.  
4. **PPR Top-K Tables** — precomputed salience around anchors (speaker, location, quest).  
5. **Reachability Index** — microsecond yes/no gate to avoid wasteful searches.

All runtime components are **read-only** and memory-mapped.

---

## 3) Runtime Data Model (Compiled Artifacts)

```
graph/
  nodes.bin             # SoA: node_type[u32], flags[u32], payload_offsets[u32]
  offsets.bin           # CSR offsets (N+1)
  neighbors.bin         # CSR neighbors (M) (u32 node ids, renumbered contiguous)
  edge_types.bin        # u16 per edge
  labels/
    <label>.idx         # sorted node ids per label/type (u32[])
  bitsets/
    <entity>.roar       # optional Roaring bitmap for fast membership/intersection
  reachability/
    intervals.bin       # interval labels (e.g., GRAIL-style) for O(1)/O(logN) reachability
  twohop/
    hubs.bin            # per hot node: (hub_id[u32], d[u8])*
    index.bin           # node->offset
  ppr/
    anchors.bin         # top-k neighbor table per anchor (node_id[u32], score[f32])*
    index.bin
  paths/
    catalog.jsonl       # {"pid","u","v","etype":[...],"nodes":[...],"abs":"...","motifs":[...]}
  payloads.bin          # short abstracts for facts/rules/quotes; indexed via payload_offsets
routing/
  routing_manifest.json # shard id -> file set; boundary nodes
```

**Sharding:** one folder per scene/level + `global`. Node IDs renumbered per shard (translation table used only offline).

---

## 4) Runtime API (C++)

```cpp
struct GraphQuery {
  std::string level_id;
  uint32_t u, v;                       // optional: source/target node ids
  std::vector<uint16_t> metapath;      // allowed edge types sequence (wildcards optional)
  std::vector<uint32_t> anchors;       // speaker, location, quest, etc.
  int max_paths = 2;
  int max_facts = 4;
};

struct GraphEvidence {
  struct Path { std::string pid; std::vector<uint32_t> nodes; std::vector<uint16_t> etypes; std::string abstract; };
  std::vector<Path> paths;
  std::vector<std::pair<uint32_t,std::string>> facts;
  std::vector<std::pair<uint32_t,std::string>> rules;
  std::vector<std::pair<uint32_t,std::string>> quotes;
  std::string source_shard;
  std::unordered_map<std::string,double> timings_ms;  // gate,lookup,search,format,total
  std::string path_used; // "catalog"|"twohop"|"bibs"|"ppr_only"|"none"
};

class IGraphFast {
public:
  virtual ~IGraphFast() = default;
  virtual bool Initialize(const std::string& artifacts_root) = 0;
  virtual GraphEvidence Retrieve(const GraphQuery& q) = 0;
};
```

**Consumer handoff:** Convert `GraphEvidence` into the Consumer’s evidence slots `{ paths[], facts[], rules[], quotes[] }` (IDs + short abstracts).

---

## 5) Behavior (Decision Flow)

1. **Route** to shard (`level_id`); keep `global` sidecar loaded.
2. **Reachability gate** (`u,v` present?): instant yes/no; stop early if no path.
3. **Path Catalog**: `(u,v,metapath)` → return 1–2 paths if found.
4. **Two-Hop (hub) labels**: intersect small hub sets to produce short path.
5. **BIBS + Metapath DFA**: bounded depth/frontier; stop at first valid 1–2 paths.
6. **PPR Salience**: mix `anchors` to fetch salient nearby facts/rules/quotes.
7. **Format** to short abstracts; **cache** by `(u,v,metapath,level_id)`.

Typical graph time **≤ 2 ms**; formatting **≤ 0.3 ms**.

---

## 6) Implementation Plan (Roo TODOs)

### 6.1 Module Skeleton
```
/Plugins/GraphFast/Source/GraphFast/
  graph/            # loaders, csr, iterators
  index/            # reachability, twohop, ppr, labels
  path/             # path catalog lookup
  search/           # bidi bounded search + metapath automaton
  format/           # abstracts & slot builder
  api/              # IGraphFast + UE wrappers
  cache/            # LRU by (u,v,metapath,level)
  tools/bench/      # microbench + fixtures
  tests/            # unit + golden
  GraphFast.Build.cs
```

### 6.2 Loaders & Memory Maps
- `graph/MMapFile.{h,cpp}` — cross-platform read-only mmap.
- `graph/CSR.{h,cpp}` — load `offsets.bin`, `neighbors.bin`, `edge_types.bin`; expose `Neighbors(node)`.
- `graph/Nodes.{h,cpp}` — SoA attributes; `payloads.bin` accessor.
- `index/LabelIndex.{h,cpp}` — open `labels/*.idx`, return const spans.
- `index/RoaringBitmap.{h,cpp}` — optional fast membership/intersection.
- `index/Reachability.{h,cpp}` — load `intervals.bin`; `bool Reachable(u,v)`.
- `index/TwoHop.{h,cpp}` — load `twohop`; `bool TryMeet(u,v,Path&)`.
- `index/PPR.{h,cpp}` — load `anchors`; `TopK MergeAnchors(anchors,k)`.
- `path/PathCatalog.{h,cpp}` — mmap `catalog.jsonl` with line index; `bool Find(u,v,metapath, Path&)`.

**Acceptance:** Open/close via mmap; iterate neighbors; read payloads (unit tests).

### 6.3 Metapath Automaton
- `search/MetaPath.{h,cpp}` — compile metapath to tiny DFA; support wildcards.
- Validate sequences during traversal.

**Acceptance:** DFA accepts/rejects sequences correctly (tests for wildcards/loops).

### 6.4 Bidirectional Bounded Search (BIBS)
- `search/Bidirectional.{h,cpp}` — meet-in-the-middle with limits:
  - `depth_max`, `frontier_cap`, `branch_cap`.
  - Parent arrays; path reconstruction.
- SIMD-friendly neighbor scans; zero heap in loop.

**Acceptance:** Finds valid path on fixtures; **p95 ≤ 1.5 ms** @ depth≤4, frontier≤2k.

### 6.5 Orchestrator
- `api/GraphFast.{h,cpp}` — implements `IGraphFast::Retrieve`:
  1) Route + ensure shard loaded.
  2) Reachability → Catalog → TwoHop → BIBS → PPR.
  3) Format + cache + timings.

**Acceptance:** Meets latency; `path_used` set; timings populated.

### 6.6 Evidence Formatting & Slots
- `format/Abstracts.{h,cpp}` — get short abstracts by node id; clip; escape.
- `format/Slots.{h,cpp}` — assemble `{ paths[], facts[], rules[], quotes[] }`; dedupe; enforce caps.

**Acceptance:** No duplicates; caps respected; stable ordering.

### 6.7 Cache
- `cache/LRU.{h,cpp}` — lock-free reads, single writer; key = `(level,u,v,metapath_hash)`; TTL 5–10 s.

**Acceptance:** High hit rate under repetition; no churn at steady state.

### 6.8 the game engine Integration
- `api/UGraphFastSubsystem` — UGameInstanceSubsystem host.
- Blueprint async node `GetGraphEvidence(level_id,u,v,metapath,anchors)`.

**Acceptance:** Non-blocking; no game-thread hitch; TTFT small with streaming UI.

---

## 7) Offline Build Tools (Neo4j → Artifacts)

**CLI (Python):**
- `build_graph export_neo4j --db bolt://... --out artifacts/<level>/`  
  - Renumber nodes → write CSR files.
  - **Path Catalog:** compute top-K per hot (u,v,metapath); write `catalog.jsonl` (+ abstract, motifs).
  - **TwoHop Labels:** hubs for hot nodes (size budget).
  - **Reachability:** interval labeling (GRAIL-style).
  - **PPR:** top-k per anchor (speaker/faction/location).
  - **Payloads:** 1-liners for facts/rules/quotes → `payloads.bin`.
- `build_graph validate` — sizes, consistency, stats.
- `build_graph shard` — per-level + `global`; boundary nodes.
- `build_graph manifest` — write `routing_manifest.json`.

**Acceptance:** Deterministic outputs; validation passes; within size budgets.

---

## 8) Tests, Benchmarks, Soak

**Fixtures:** `/tools/bench/fixtures/mini_graph/` (~5k nodes, ~30k edges, 3 metapaths, 2 levels + global).

**Unit:** CSR iteration, payload reads, DFA, reachability, twohop.

**Golden:** ~200 queries compare `GraphEvidence` to golden JSON (IDs & abstracts).

**Bench:** Mixed workload: 40% catalog, 20% twohop, 30% BIBS, 10% salience-only. Report p50/p90/p95 by stage, RSS, cache hit %.

**Soak:** 4h random queries + shard swaps; assert no leaks; latency stable.

---

## 9) Performance Targets & CI Gates

- **Gate A:** Catalog ≤ **0.10 ms** p95; TwoHop ≤ **0.10 ms**; Gate ≤ **0.05 ms**.
- **Gate B:** BIBS ≤ **1.5 ms** p95 (depth≤4, frontier≤2k), success ≥ **95%** when path exists.
- **Gate C:** Formatting ≤ **0.3 ms**; total graph evidence typical ≤ **2 ms**.
- **Memory:** ≤ **60 MB** per shard (graph artifacts); ≤ **120 MB** with global loaded.

**CI must fail if:**
- p95 worsens > 20% vs baseline,
- memory grows > 20%,
- golden mismatch occurs.

---

## 10) Phased Rollout (2 Sprints)

**Sprint 1 (infra + instant paths):**  
Loaders/mmap → CSR → PathCatalog → Reachability → UE node → Bench v1.  
**Gate:** catalog & gate timings; basic slot formatting.

**Sprint 2 (search + salience + hardening):**  
TwoHop → BIBS + DFA → PPR → Cache → tests/golden/soak → CI gates.  
**Gate:** BIBS latency/success; full evidence bundle wired to Consumer.

---

## 11) Roo Command Hints (pasteable)

- Create UE plugin `GraphFast` with folders above; add `GraphFast.Build.cs`.
- Implement `MMapFile`, `CSR`, `Nodes` loaders; add unit tests.
- Implement `PathCatalog` (mmap + line index); lookup by `(u,v,metapath)`.
- Implement `Reachability` loader + `Reachable(u,v)`; unit tests.
- Implement `TwoHop` loader + `TryMeet(u,v,Path&)`; unit tests.
- Implement `MetaPath` DFA; tests incl. wildcards.
- Implement `Bidirectional` bounded search; reconstruct path; microbench.
- Implement `Abstracts` + `Slots` for evidence JSON; tests for dedupe & caps.
- Wire `IGraphFast::Retrieve` orchestrator with timings + LRU cache.
- Add `UGraphFastSubsystem` + Blueprint async node; sample caller stub.
- Add bench harness printing p50/p90/p95 by stage; add CI gates.

---

## 12) Risks & Mitigations

- **Catalog/label bloat:** enforce budgets (top-K per pair; hubs for hot nodes only); shard aggressively.  
- **Search blow-up:** metapath DFA + branch/frontier caps; prefer catalog/twohop first.  
- **Authoring drift:** nightly export + `validate` CLI; versioned manifests.  
- **Locale size:** store 1-liners; separate payloads per locale.

---

**Outcome:** A compact, memory-mapped graph retriever delivering **crisp factual evidence** to the LLM in **µs–ms**, comfortably under runtime budgets and fully compatible with your sharded RAG architecture.
