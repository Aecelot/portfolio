# NPC Memory System — Architecture & Implementation Plan

## 0) Goals & Constraints
- **Latency:** ≤1 ms per active NPC tick; no blocking I/O on game thread.
- **RAM budget:** ≤100 MB total for memory system (incl. caches/indexes); ≈2.7 KB hot state per NPC.
- **Storage:** up to **20 MB/NPC** on SSD for cold LTM archive.
- **No embeddings/ANN.** Symbolic IDs, tags, and compact numeric features only.
- **Deterministic & debuggable.** Fixed caps, predictable eviction, explicit traces.

---

## 1) High-Level Architecture

**Three Tiers**
1) **Hot (RAM, per-NPC):** STM + tiny LTM slices used in the current scene (≈2.5–3.0 KB/NPC).
2) **Warm (RAM cache, shared):** Recently fetched SSD “pages” (compressed blocks). Global cap: 50–100 MB.
3) **Cold (SSD, per-NPC):** Full episodic archive, extended social history, rumor chains, raw transcripts.

**Pipelines**
- **Ingest:** Game events → MemoryCard → STM (+ optional promotion to LTM).
- **Retrieve:** Dialogue/AI/Planner requests → fast scans over Hot → (optional) Warm → async prefetch from Cold.
- **Maintain:** Decay, summarize (episodes→gists), compact, prune rumors, write-back.

---

## 2) Data Model (IDs, Tags, Tables)

### 2.1 Global Canon (read-only, RAM)
- **StringTable:** interned strings (lazy resolve for UI).
- **EntityTable:** `EntityID:uint32` for all actors (NPCs, Player, factions, places, items).
- **EventTypeTable:** compact event taxonomy (e.g., `EVT_ATTACK`, `EVT_BRIBE`).
- **TopicTable:** 0..255 topic IDs (combat, debt, faction_X, location_Y, quest_Z, etc.).
- **RelationTable:** structured facts the game asserts as canon (e.g., “curfew at dusk”).
- Size target: **5–20 MB** depending on title scale.

### 2.2 Per-NPC Hot Structures (RAM)
All numeric/ID; **no strings**.

```cpp
// 2 bytes emotion: valence/arousal (0..255), 1 byte importance, 1 byte flags.
struct Emotion { uint8 valence, arousal; };

struct STMCard { // ~64–96 B packed
  uint32 actorId;      // who caused it
  uint16 eventTypeId;  // taxonomy
  uint16 placeId;
  uint32 tick;         // game ticks
  uint8  importance;   // 0..255
  Emotion emotion;
  uint32 topicMask;    // bitmask subset (32 local topics)
  uint32 targetId;     // optional
  uint16 auxA, auxB;   // small params (e.g., amount)
  uint8  flags;        // Pinned, Seen, etc.
};

struct EpisodicLTM {  // ~48 B
  uint32 actorId; uint16 eventTypeId; uint16 placeId; uint32 tick;
  uint8 importance; Emotion emotion; uint32 topicMask; uint32 targetId;
  uint16 repeatCount; uint8 confidence; uint8 flags;
};

struct SemanticGist { // ~28–32 B
  uint32 subjectId; uint16 predicateId; uint32 objectId;
  uint8 confidence; uint8 strength; uint8 source; uint8 flags;
  uint32 lastReinforcedTick;
};

struct SocialRow { // ~16–20 B
  uint32 otherId; uint8 trust; uint8 fear; uint8 affinity; uint8 respect;
  uint32 lastSeenTick; uint8 flags; uint8 pad[3];
};

struct Prospective { // ~32–40 B
  uint16 triggerId; uint16 actionId; uint32 targetId;
  uint32 windowStartTick; uint32 windowEndTick;
  uint8  importance; uint8 status; uint8 scope; uint8 flags;
};

struct Rumor { // ~24 B
  uint32 claimHash; uint32 sourceId; uint32 topicMask;
  uint16 hops; uint8 confidence; uint8 flags; uint32 expiryTick;
};

struct NPCMemoryHot { // ~2.7 KB total target
  STMCard   stm[5];
  EpisodicLTM episodic[16];
  SemanticGist gist[12];
  SocialRow social[32];
  Prospective pros[6];
  Rumor rumors[4];
  // Index shims (bitmasks/counters):
  uint32 topicPresenceMask;  // quick filter for hot
  uint16 counts[6];          // per-type fill lvls
  uint8  dirtyFlags;         // needs write-back, etc.
};
```

### 2.3 Per-NPC Warm Indexes (RAM, tiny per NPC)
- **TopicBitmap:** 256 bits → topics that exist in SSD archive.
- **TimeWheel:** 32 coarse buckets → segment IDs per recent time windows.
- **Mini Bloom Filters:** 2×256 bits for (topic, otherEntity) pair presence.
- Stored as part of **NPCMemoryIndex** (~1.5 KB/NPC).

---

## 3) SSD File Layout (Cold Tier)

**One directory per NPC** (by NPC ID). Files use large, contiguous blocks to minimize random I/O.

- `META.bin`  
  - Offsets to segments, current caps, index snapshot (TopicBitmap, TimeWheel, Blooms).
- `EPI-YYYYWK-N.bin`  
  - Append-only episodic segment (64–128 KB pre-compression), **LZ4** compressed.
  - Segment header: time range, min/max importance, min/max valence/arousal, topicMask summary.
- `SOC-HIST.bin`  
  - Older social deltas (compact rows).
- `RUMOR.bin`  
  - Claim chains with sources/hops/confidence.
- `TXT-RAW.bin` (optional)  
  - Raw transcripts/notes (never needed at runtime unless designer inspects).

**Binary Record Format (aligned, little-endian)**  
All records are fixed-width structs matching `EpisodicLTM`/`SocialRow` etc., to allow direct read into arrays, then LZ4 compress segments.

---

## 4) Core Services (Modules & Files)

**Module Namespaces (C++)**
```
/Source/NPCMemory/
  Core/
    MemoryTypes.h
    MemoryConfig.h
    MemoryBitOps.h
    MemoryRing.h
  Runtime/
    MemoryService.h/.cpp
    MemoryStoreRAM.h/.cpp     // Hot tier owner
    MemoryStoreSSD.h/.cpp     // Cold tier IO + LZ4
    MemoryCacheWarm.h/.cpp    // Shared LRU cache
    Prefetcher.h/.cpp         // Heuristics + async jobs
    Prioritizer.h/.cpp        // Importance scoring
    DecaySummarizer.h/.cpp
  Integration/
    MemoryEvents.h/.cpp       // Subscribe to UE delegates
    MemoryAPI_Blueprints.uclass.h/.cpp
    MemoryInspectorUI.(Slate/UMG)
  ThirdParty/
    lz4/
```
---

## 5) Public API (for Gameplay, Dialogue, AI)

All **non-blocking** on the game thread. Async ops have futures/callbacks.

```cpp
// Ingest
void PushEvent(uint32 npcId, const GameEvent& evt); // fire-and-forget

// Retrieval (fast scans over Hot; may schedule prefetch)
bool GetRelevantMemories(uint32 npcId, const Query& q, OutResults& out, QueryHint hint);
// e.g., q.topicMask, q.actorId (player), q.timeWindowTicks

// Social & Prospective
const SocialRow* FindSocial(uint32 npcId, uint32 otherId);
void AddProspective(uint32 npcId, const Prospective& p);
void ResolveProspective(uint32 npcId, uint16 actionId, Result r);

// Maintenance triggers (called from a manager tick, not every frame)
void TickMemory(float dt);             // budgeted; dispatches work slices
void ScheduleNightlyMaintenance();     // decay, summarize, writeback
```

**Blueprint-friendly wrappers** expose safe enums/structs and simple arrays of “PreviewLines” (strings resolved lazily).

---

## 6) Event → Memory Flow (Perceive/Encode/Prioritize/Store)

### 6.1 Prioritizer (importance 0–255)
`importance = clamp( W_eventClass + W_personal + W_faction + W_goal + W_emotion + W_rarity + W_designer, 0, 255 )`

- **EventClass:** table (Combat 120, Crime 110, Gift 80, Chat 40…).
- **Personal stake:** if target=self (+40), family/faction (+25).
- **Goal relevance:** if event aligns/conflicts with current goal (+10..+30).
- **Emotion:** `(abs(valence-128)+arousal)/2 * k` (0..30 typical).
- **Rarity:** low frequency in recent time window (+0..20).
- **Designer override:** ±0..50 (safety-capped).

**Promotion Rules**
- Always write to **STM** (ring of 5).
- Promote to **Episodic LTM** if:
  - `importance >= T_PROMOTE` (e.g., 160), or
  - duplicates within window K: `repeatCount >= 3`.
- Merge duplicates (same actor/event/place within Δt): increment `repeatCount`, bump `confidence`.

### 6.2 Storage Caps & Eviction
- Fixed caps (16 episodic, 12 gists, 32 social, 6 prospective, 4 rumors).
- Evict by **importance-weighted LRU**; never evict `flags&PINNED`.
- On eviction of episodic: if many low-importance episodes with same topic → queue **summarize** into one `SemanticGist`.

---

## 7) Retrieval (Dialogue/Planner/Gossip)

### 7.1 Dialogue Query Path (non-blocking)
1) **Hot scan:** filter by `topicMask`, `actorId`, `timeWindow`. O(16–32).
2) If insufficient hits:
   - Check **NPCMemoryIndex** (TopicBitmap/Bloom/TimeWheel) for likely presence.  
   - Enqueue **Prefetcher** request (context topics: player, location, quest factions; time window last 7 days).
   - Return hot results now; a subsequent line can use warmed data if it arrives.

**Output**: compact `MemSlice` (IDs + small fields). Dialogue system fills templates; only then resolve strings for display.

### 7.2 Planner
- Reads social rows & gists, plus **highest-importance recent episodic** (≤3).  
- Simple rules: ex. “Avoid Zone if last mugging < 3 days AND fear>180” → set blackboard flags.

### 7.3 Gossip Tick (rare cadence)
- Each social tick, sample 1 Rumor; if `confidence >= Cmin` and `hops <= Hmax`, broadcast to 1–2 allies; decay `confidence`, increment `hops`.

---

## 8) Prefetcher (Heuristics & IO)

**Triggers to prefetch (off-thread):**
- NPC enters **active bubble** near player → fetch last 7 days for (player, current location, quest topics).
- Player aims/approaches NPC → fetch pair‐specific pages `(NPC, Player)`.
- Quest node/act flips → fetch relevant topics flagged by designer.
- Planner requests evidence and Bloom says “present”.

**Throughput caps**
- Max **2 segments/NPC/second**.
- Global bandwidth soft cap: **8–12 MB/s**.
- Concurrency cap: **N disks ops** (platform-dependent; start at 4–8).

**Segment selection**
- Choose segments by **TimeWheel** buckets intersecting the window; prefer those whose headers show higher min/max importance or emotion.

**Warm Cache**
- LRU of decompressed pages. Page descriptor includes:
  - Topic summary mask, time range, min/max emotion/importance.
- Evict by LRU; **Pin** pages during active conversations.

---

## 9) Decay, Summarize, Write-Back

**Nightly/off-camera Job**
- **Decay:** episodic importance half-life (configurable, e.g., 14 in-game days); rumors conf decay; drop expired prospective.
- **Summarize:** cluster similar low-importance episodes → one `SemanticGist` with `strength` proportional to count.
- **Prune:** rumors with `hops>Hmax` or `confidence<Cmin`.
- **Compact & Write-back:** flush hot changes to a new `EPI-YYYYWK-N` segment; update `META.bin`.

Jobs run in **slices** (time-budgeted) to avoid hitches.

---

## 10) Configuration & Balancing

**Config file (INI/JSON) keys**
- Caps: counts per LTM type.
- Thresholds: `T_PROMOTE`, decay half-lives, rumor conf min/max.
- Weights: prioritizer components.
- Prefetch: active radius, bandwidth caps, concurrency.
- Maintenance cadence: daily at time T, or N minutes real-time.

---

## 11) Threading & Performance

- **Game thread:** enqueues events; reads hot memory; never blocks.
- **Worker threads:** prefetch I/O, LZ4 decode, nightly maintenance, summarization.
- **Locking:** per-NPC spin-free using sequence counters (double-buffer read); warm cache uses lock-free queues + coarse mutex around LRU update.
- **Budgets:**  
  - Per-frame memory work: **≤0.2 ms** total at 200 active NPCs.  
  - Prefetch worker: throttled; yields if budget exceeded.

---

## 12) Tooling (Design & QA)

**Memory Inspector (Slate/UMG)**
- Tabs: STM / Episodic / Gists / Social / Prospective / Rumors / Indexes.
- Filters: topic, actor, time, importance, confidence, flags.
- Actions: Pin/Unpin, Force Trigger Prospective, Inject Memory, Export NPC archive, Show Why (trace last decision).
- “Why did X happen?” pane: show top 3 memory cards + rule that fired.

**Console Commands**
- `mem.npc <id>`: open inspector.
- `mem.prefetch <id> <topic> <days>`: force prefetch.
- `mem.maint.run`: run maintenance slice.
- `mem.trace on|off`: enable decision traces.

---

## 13) Acceptance Criteria & KPIs

**Perf**
- P50/P95 per-NPC retrieval (hot only): **<0.1 ms / <0.2 ms**.
- Zero game-thread stalls from disk I/O across 30-min soak.
- Warm cache hit-rate during dialogue: **≥80%** after first line.

**Memory**
- Hot RAM per active NPC: **≤3.0 KB** avg.
- Warm cache bounded at configured cap; no leaks across level loads.

**Behavior**
- Prospective triggers fire within **1 sec** of condition satisfaction.
- Rumor propagation stabilizes (no ping-pong) with configured hops.

**QA**
- Memory Inspector accurately mirrors hot state; trace matches choices.

---

## 14) Milestones (Roo Code TODO)

**Sprint 1 — Hot Tier & Ingest (1–1.5 weeks)**
- [ ] Implement data structs (packed) & unit tests for size/layout.
- [ ] Ring buffer STM; episodic/social/gist/prospective arrays with caps + weighted-LRU eviction.
- [ ] Prioritizer with config weights; promotion/merge rules.
- [ ] Minimal Retrieval API: topic/actor/time filters over hot.
- [ ] Blueprint wrapper for `GetRelevantMemories` (returns preview IDs).
- [ ] Bench harness: synthetic events @ 5k/sec; verify latency & caps.

**Sprint 2 — Prefetcher, Warm Cache, SSD IO (1.5–2 weeks)**
- [ ] LZ4 segment format + reader/writer; META.bin authoring.
- [ ] NPCMemoryIndex: TopicBitmap, TimeWheel, Mini Blooms; load/save.
- [ ] Warm cache (LRU) + page descriptor; cap & eviction.
- [ ] Prefetcher heuristics + global bandwidth/concurrency limits.
- [ ] Async pipelines with futures; no game-thread blocking.
- [ ] Integration tests: cold→warm→hot promotion; dialogue continues smoothly.

**Sprint 3 — Maintenance & Tooling (1–1.5 weeks)**
- [ ] Decay & summarize jobs (time-sliced); write-back segments.
- [ ] Rumor handling, propagation tick.
- [ ] Memory Inspector UI (read-only); console commands.
- [ ] Deterministic traces: “Why did X happen?”
- [ ] Soak tests (30–60 min); verify no hitches/leaks.

**Sprint 4 — Authoring Controls & Polish (1 week)**
- [ ] Pins/Gates (act/quest locks), safety guards.
- [ ] Full Inspector actions (pin/unpin, inject, force trigger).
- [ ] Config tuning; default weight/threshold presets.
- [ ] Docs + engineering handoff (README + diagrams).

---

## 15) Pseudocode Snippets

**Event ingest**
```cpp
void MemoryService::PushEvent(uint32 npcId, const GameEvent& e) {
  auto& mem = HotStore.Get(npcId);
  STMCard card = EncodeSTM(e); // all IDs, topicMask, emotion
  mem.stmRing.Push(card);

  uint8 imp = Prioritizer::Score(e, mem, Config);
  if (imp >= Config.TPromote || IsRepeat(mem, e)) {
    PromoteToEpisodic(mem, e, imp);
  }
  UpdateQuickIndexes(mem, card);
}
```

**Hot retrieval**
```cpp
bool MemoryService::GetRelevantMemories(uint32 npcId, const Query& q, OutResults& out, QueryHint hint) {
  const auto& mem = HotStore.Get(npcId);
  ScanSTM(mem.stm, q, out);
  ScanEpisodic(mem.episodic, q, out);
  ScanGists(mem.gist, q, out);
  ScanSocial(mem.social, q, out);
  if (out.Count() < q.minCount && IndexSuggestsPresence(npcId, q)) {
    Prefetcher.Request(npcId, q, hint);
  }
  return out.Count()>0;
}
```

**Prefetch pick**
```cpp
PrefetchJob Prefetcher::Plan(uint32 npcId, const Query& q) {
  const auto& idx = IndexStore.Get(npcId);
  auto buckets = idx.SelectTimeBuckets(q.window);
  auto cand = PickTopSegmentsByHeader(npcId, buckets, q.topicMask);
  return MakeJob(npcId, cand.Take(Config.MaxSegmentsPerNPCPerSec));
}
```

**Nightly maintenance (slice)**
```cpp
void DecaySummarizer::RunSlice(uint32 budgetMicros) {
  Timer t; while (t.elapsed() < budgetMicros) {
    auto npcId = RoundRobinPick();
    auto& mem = HotStore.Get(npcId);
    DecayEpisodic(mem.episodic, Config);
    SummarizeLowImportance(mem);
    PruneRumors(mem, Config);
    if (mem.dirtyFlags & DIRTY_ARCHIVE) SSDWriter.AppendSegments(npcId, mem.flushBuffer);
  }
}
```
