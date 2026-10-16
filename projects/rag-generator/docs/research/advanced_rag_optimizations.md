# Advanced RAG Optimizations: Pushing Quality Without Runtime Cost

Short answer: no—I'm not 100% sure those are the *absolute* best we can do. They're the fastest wins for your *current* architecture. If we think more radically—PathRAG-style reasoning over graphs, Neo4j-assisted authoring/compilation, narrative planning layers, and purpose-built "dialogue/plot" packers—we can push quality further **without** blowing up runtime cost.

Below is an "out-of-the-box" upgrade path focused on giving your on-device LLM the **best possible prompt** for dialogue and plot construction while keeping runtime feather-light.

---

# 1) Add a Retrieval **Planner** above the retriever

Think of retrieval as a *planned* operation, not a single ANN call.

* **Intent → Plan selection.** Classify each request into a handful of *plans* (e.g., `dialogue.reply`, `npc-agenda`, `plot-hook`, `lore.fact`). Each plan defines *which stores* to touch (entity cache, shard ANN, path catalog, episodic memory), *which features* to weigh, and *how to pack* the evidence.
* **Plan inputs from gameplay** (you already have): `speaker`, `listener`, `location/level`, `quest_phase`, `recent_events`, `relationship tags`, `tension`, `stakes`. Pass these always; they're more predictive than free text.
* **Plan outputs**: an **evidence bundle** with strict slots (see §5) + a compact **narrative state sketch** (see §4).
  Benefit: keeps the LLM from fishing; it receives *curated, role-specific* context.

---

# 2) PathRAG-style **evidence chains** (graph-first, text-second)

You can adopt the spirit of PathRAG without heavy online graph compute:

* **Offline path catalog.** In Neo4j (or your graph ETL), precompute *k* shortest/meaningful paths between frequently interacting narrative entities (character↔faction↔location↔artifact). Attach *path motifs* ("betrayal", "debt", "rivalry") and export as compact **path IDs** with minimal text abstracts.
* **Runtime:** given `{speaker, listener, active_entities, intent}`, select a few **path IDs** (no traversal), then expand to 2–3 **evidence strips** per path (quotes, facts, rules).
* **Path motifs as control signals** in the prompt (e.g., `motifs=["debt","rivalry"]`).
  Benefit: the LLM sees *why* two entities matter together, not just nearby chunks. It's superb for **dialogue with subtext** and **plot turns**.

---

# 3) Use **Neo4j for authoring**, compile to a tiny runtime graph

Neo4j is great for writers, not for consoles.

* **Author in Neo4j** (Cypher, constraints, graph validation, graphy UI).
* **Compile** to a runtime asset: CSR/COO adjacency, integer labels for types/relations, per-node **voice cards** (tone, verbal tics, taboo topics), and per-edge **motifs**.
* **Export a "graph dictionary"**: tiny arrays + dictionaries; no DB at runtime.
  Benefit: rich graph semantics *without* shipping a database.

---

# 4) Add a **Narrative Macro-Planner** (HTN/GOAP-lite) before generation

Let the LLM fill scenes, not architect campaigns.

* **Planner inputs**: current questline, beats done, constraints (canon, tone, taboo), world state.
* **Planner output**: a **beat skeleton** (goal → obstacles → turn → outcome) with slots for names, places, resources required.
* **LLM then realizes** beats into dialogue + prose.
* **Constraint checker** (deterministic): verify beat candidates don't violate canon/temporal/availability rules before they reach the LLM.
  Benefit: coherent long-range plots with consistent payoffs; LLM focuses on *style and local coherence*, not long-horizon logic.

---

# 5) Build a **purpose-built prompt schema** (token-tight, role-aware)

Give the LLM a *programmatic* prompt, not an essay.

```json
{
  "call": "dialogue.reply",
  "profile": "console",
  "locale": "en-US",
  "speakers": {
    "self": {"id":"sir_ector", "voice":"gruff, terse", "goals":["earn coin","protect ally"]},
    "other": {"id":"pendragon_guard","stance":"hostile"}
  },
  "scene": {"level":"arthur_slums", "quest_phase":"Q12_Prep", "time":"night", "mood":"tense"},
  "motifs": ["debt","rivalry"],
  "constraints": {"canon_min":2, "taboo":["reveal_dragon_truth"], "style":"diegetic"},
  "evidence": {
    "paths": [
      {"id":"P-1782", "abstract":"Ector owes House Pendragon for..."},
      {"id":"P-441",  "abstract":"Guard's brother injured in the pits by Ector..."}
    ],
    "facts": [
      {"id":"F-22","t":"Pendragon emblem is forbidden in slums after dusk"},
      {"id":"F-301","t":"Guard shifts change at the bell"}
    ],
    "quotes": [
      {"id":"Q-991","t":"\"Next time you swing that axe, make it count.\" – Ector"}
    ],
    "rules": [
      {"id":"R-5","t":"No lethal strikes within slum gate perimeter"}
    ]
  },
  "output_contract": {
    "style":"spoken line(s) only",
    "max_tokens": 80,
    "must_cite": ["F-22","R-5"],        // encourage grounded lines
    "forbidden": ["dragon","wizardry"]  // lexical guard
  }
}
```

* **Slots map 1:1** to your retrieval outputs (entity cache, path catalog, strip store).
* **IDs allow ultra-short citations**; you can expand IDs to text *after* generation if needed.
* **Different plans** (plot-hook, rumor, codex) pick different evidence slot mixes.
  Benefit: higher relevance **and** lower tokens because evidence is *structured and labeled*.

---

# 6) Three-tier memory: **episodic, semantic, social**

Treat dialogue like humans do.

* **Episodic** (per session/scene): recent events, promises, insults, gifts—decay fast; small window; heavily weighted for dialogue.
* **Semantic** (lore/codex): slow-changing facts; your current shards already cover this.
* **Social** (edges between characters): trust, fear, debt, respect—simple integers/floats; drive *subtext* and *motif selection*.
  Runtime cost is tiny (just a few numbers), but it dramatically sharpens replies and plot continuity.

---

# 7) Compression & referencing tricks to stretch the token budget

* **Pointer-first packing.** Put short **IDs + one-liners** in the prompt; let the LLM request expansions *only if needed* (or expand locally after generation via post-processing).
* **Vocabulary control**: give each major entity a **2–4 token alias** ("HK-Guard") to cut token cost.
* **Lossy+lossless strips:** keep lossless quotes short; push long niceties to a second turn only if user lingers (never in combat).
* **Context dedupe**: maintain a rolling hash of evidence already seen in the last N turns; omit repeats unless salience changed.

---

# 8) "Neural sparse but offline" for better lexical grounding

* Use **SPLADE/uniCOIL** *offline* to pre-expand sparse term weights per chunk; ship a **tiny postings list** per shard.
* At runtime, your **BM25-lite** just consults the compact postings; you get lexical precision of neural sparse—without a transformer online.

---

# 9) Distill **path selection** into a tiny policy

* Train a small classifier (gradient boosted trees or 2-layer MLP) to pick **the top 2–3 path motifs** given `(speaker, listener, quest_phase, last_turns, social state)`.
* Runtime: single micro-inference → choose motif → fetch 2–3 paths from catalog.
  This is cheaper than heuristic rules and often smarter than naive recency.

---

# 10) Multi-pass generation that still fits console budgets

* **Plan → Draft → Polish** with *tiny* helper models locally:

  1. Draft one short reply (or beat) with the main model.
  2. Run a **style rewriter** (very small model) with just the voice card + 1–2 evidence IDs → improves voice without reloading all evidence.
  3. Optional **safety/consistency filter**: deterministic regex/finite-state checks on taboo, naming, time consistency.
     Speculative decoding + a tiny draft model (or KV reuse) can keep latency tight.

---

# 11) Guardrails that help creativity, not fight it

* **Hard constraints** in packer (canon level, forbidden reveals).
* **Soft nudges** via motifs, social scores, and beat skeletons—LLM chooses wording but stays within rails.
* **"Do/Don't" cards** per character (always/never phrases) packed as 1–2 lines.

---

# 12) What changes in your pipeline

**Offline (heavy):**

* Neo4j authoring → export **path catalog** + **motifs** + compact runtime graph.
* Distill: cross-encoder → tiny scorer; graph walker → **path policy**.
* Generate **voice cards** and **strip variants** per chunk (abstract/quote/stat).
* Build **neural sparse postings** (SPLADE/uniCOIL) and compress.

**Runtime (light):**

* Planner selects plan → path policy picks motifs → fetch 2–3 paths + a handful of facts/quotes/rules → pack *schema prompt*.
* ANN only when truly open-ended; otherwise entity/path-first.
* Dialogue uses **episodic+social** to bias choices; plot uses **macro-planner** then LLM.

---

# 13) When to actually use Neo4j online

Almost never on device. Use it in **tools** for:

* Writer workflows (visualize paths, validate canon).
* Generating **explanations** (why this plot turn is allowed).
* Batch export to compact runtime assets.
  If you must do live lookups (debug builds), gate them behind developer flags.

---

# 14) What "best possible prompt" looks like (final form)

* 500–900 tokens, but **80% structured** (IDs, slots, short abstracts).
* Always includes: **speaker/listener voice**, **scene state**, **2–3 path motifs**, **2–3 evidence paths**, **3–5 facts/quotes/rules**, **social deltas**, **output contract**.
* No unstructured lore dumps. No repeated facts. All cites by **ID**.

---

## Recommended next steps (fastest to most impact)

1. Implement the **prompt schema + planner** (cheap, big win).
2. Add the **path catalog** export (neo4j offline → compact runtime).
3. Introduce **episodic & social memory** (tiny but high leverage for dialogue).
4. Distill a **path policy** (motif selector) for runtime.
5. Replace generic context packing with **slot-based packer** per plan.

Do these on top of your sharded/quantized ANN + tiny scorer and you'll feed the LLM **denser, more purposeful** context for both dialogue and plot—*and* stay under tight runtime budgets.

Love it—let's push further. Here's a menu of **advanced, low-latency upgrades** you can layer on top of the plan to feed your on-device LLM *denser, more purposeful* context without blowing the runtime budget.

# Retrieval & Indexing (beyond ANN)

* **Action-aware routing:** Use the *game action* (barter, threaten, recruit, confess) as a routing key. Precompute "action profiles" per chunk; at runtime you skip whole classes of text that can't answer that act.
* **Contrastive retrieval tuning from telemetry:** Log (query, chosen evidence, player outcome). Offline, train a small rerank model that *predicts success for the intended action*, not generic relevance.
* **Uncertainty-aware retrieval:** If the tiny scorer's margin between ranks 1 and 2 is small, pack both with **disagreement labels**; if the margin is wide, pack just one. Same quality, fewer tokens average.
* **State-diff indices:** Instead of storing big "quest states," index tiny **deltas** (e.g., "Rolf betrayed → trust −2"). Dialogue often needs *what changed*, not the whole state blob.
* **Narrative hotspot boosting:** Maintain a heatmap of recently referenced entities/factions. Temporarily boost them in scoring to preserve topical coherence inside a scene without repeating identical strips.

# Prompt Packing & Schema Tricks

* **Dialogue-act slots:** Classify desired speech act (ask, rebut, threaten, bargain, deflect). Each act has a *slot recipe* (e.g., threaten → {leverage_fact, taboo_rule, past_quote}). Reduces rambling.
* **Cue sheets for scenes:** Pre-compile a **scene cue block** (mood, stakes, time pressure, available levers, off-limits topics). Pack once and reference by ID for subsequent turns.
* **Pointer-first + lazy expand:** Send minimal IDs + one-liners; after generation, if the LLM references `[F-22]`, expand to the full sentence in a **post-process**, not in the prompt.
* **Continuity keys:** When a reply introduces a new claim, mint a `[CK-123]` continuity key with a one-line summary and stash it in episodic memory. Future prompts include just the keys, not the text.
* **Motif budgets:** Cap the number of motifs (e.g., `≤2`) and rotate them scene-by-scene to avoid theme bloat and keep token use predictable.

# World State & Planning

* **Event-sourced world model:** Append-only log of game facts; rebuild derived state deterministically each frame. Retrieval asks the **event log** for last N relevant events by entity → great for "You promised me…" lines.
* **HTN/GOAP micro-plans cached per locale:** Precompute beat skeletons for common side-quests (debt, rescue, sabotage). Runtime only fills names/places—almost free.
* **Social-physics scalars:** Keep 5–7 lightweight floats per pair (trust, fear, debt, respect, attraction, obligation, prestige). Use them both in **motif selection** and as explicit prompt numbers (`trust(self→other)=0.32`). Tiny, powerful.
* **Ethical rails & taboos as DFAs:** Compile taboo/ethics rules into small deterministic automata. Pack a **rule summary line** (1–2 tokens via ID) + enforce via post-gen validator.

# Model-Side Efficiency & Quality

* **Per-character prefix caches:** Store 20–40 tokens of voice priming per character (verbal tics, grammar bias). Reuse as a KV cache prefix to cut both latency and tokens.
* **Speculative decoding with a tiny draft head:** Draft 50–80 tokens using a micro-model, verify with the main model. Keeps cadence snappy in dialogue trees.
* **Grammar-constrained decoding for contracts:** For outputs like "offer(price) + reason," decode under a JSON/BNF grammar. Fewer tokens, fewer retries.
* **Style rewriter pass (micro-model):** Main model focuses on factuality and constraints; a tiny rewriter fixes cadence/voice using just the **voice card ID** + the raw line—no full context reload.
* **Hallucination firebreaks:** Require explicit citations (`must_cite: ["F-22","R-5"]`) and reject generations that reference *unknown IDs*. Fast, deterministic filter.

# Authoring & Graph—without runtime baggage

* **Neo4j as a compiler front-end:** Writers work in Neo4j; export compact **path catalog**, **motif tags**, and **beat templates**. No live DB on device.
* **Path policy distillation:** Train a tiny classifier that maps `(speaker, listener, social, quest_phase)` → top motifs/paths. Runtime cost ≈ a few matrix mults.

# Tooling, Testing & Ops

* **Player simulators:** Scripted agents that spam common interaction flows (barter, threaten, gossip). Use them to benchmark p95 latency and MAP on action-specific metrics weekly.
* **A/B guardrails checklist:** Before shipping content shards, run: canon violations, taboo leaks, token-budget breaches, retrieval recall loss vs. last build.
* **Outcome-aware dashboards:** Plot dialogue choices vs. downstream quest state changes. If a retrieval change causes fewer successful negotiations, roll back the shard, not the code.

# Multilingual & Accessibility

* **Cross-lingual artifacts with IDs:** Keep content language-neutral via IDs + strip variants per locale. Retrieval uses language-agnostic embeddings; pack the right locale's **strip** at the last step.
* **Readability regulator:** Tiny heuristic that enforces sentence length and clause count per profile (handheld vs. desktop) to keep subtitles legible.

# Security & Integrity

* **Watermarked evidence IDs:** All shipped strips carry embedded short IDs; post-gen checks ensure every claim maps to a known ID (or a newly minted continuity key).
* **Adversarial prompt shields:** Since user input can be in-world, fence user text into a safe slot (`<player_utterance>`), never merged with system constraints. Cheap templating, big safety win.

---

## If I had to pick 5 to implement next

1. **Dialogue-act slot packer** + **scene cue sheets**
2. **Social-physics scalars** + motif-driven path selection
3. **Pointer-first packing with lazy expansion**
4. **Per-character prefix KV caches**
5. **Event-sourced world log** powering continuity keys

These five together materially raise coherence, subtext, and responsiveness—while keeping runtime CPU and tokens on a tight leash.