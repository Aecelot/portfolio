# Prompting, Memory, and Generation Deep Dive for Lore RAG Runtime RAG

This document expands the prompt, memory, and generation-side improvements from the unified dossier into concrete designs, schemas, algorithms, and runtime behaviors specific to Lore RAG. It covers slot-based prompt packing, dialogue-act recipes, pointer-first evidence with lazy expansion, episodic/social memory, macro-planning for beats, KV/prefix caching, decoding strategies, multilingual handling, safety guardrails, telemetry, and acceptance criteria.

Repository touchpoints
- [generation/prompts.py](generation/prompts.py)
- [generation/generator.py](generation/generator.py)
- [generation/llm_client.py](generation/llm_client.py)
- [generation/personas.py](generation/personas.py)
- [npc_server.py](npc_server.py)
- [npc_generator.py](npc_generator.py)
- [api/retriever.py](api/retriever.py)
- [src/retrieval/router.py](src/retrieval/router.py)
- [ingestion/build_jsonl.py](ingestion/build_jsonl.py)
- [ingestion/link_entities.py](ingestion/link_entities.py)
- [data/entities.xml](data/entities.xml)
- [data/alias_map.json](data/alias_map.json)
- [config/rag.xml](config/rag.xml)
- [src/rag/config/rag.xml](src/rag/config/rag.xml)

Overview and design goals
- Deliver a token-tight, role-aware prompt that maximizes evidence density and minimizes redundancy.
- Preserve continuity via episodic and social memories with low runtime overhead.
- Offload long-horizon planning to a macro-planner; let the LLM realize style and local coherence.
- Enforce safety/tone via deterministic constraints and post-generation validation.
- Leverage KV/prefix caching and compact output schemas to cut latency and reduce tokens.

1) Slot-based prompt schema (Schema v1.0)

Shape (JSON)
- All fields are short, bounded, and primarily ID/one-liner based. Evidence IDs are stable and resolvable post-generation.

Example (illustrative)
{
  "call": "dialogue.reply",             // plan id; affects slot recipe
  "profile": "console",                 // device profile
  "locale": "en-US",
  "speakers": {
    "self":   {"id":"sir_ector", "voice":"gruff, terse"},
    "other":  {"id":"pendragon_guard","stance":"hostile"}
  },
  "scene": {
    "level":"arthur_slums", "quest_phase":"Q12_Prep",
    "time":"night","mood":"tense","cue_id":"SC-041"  // scene cue cached separately
  },
  "motifs": ["debt","rivalry"],        // from path policy or heuristics
  "constraints": {
    "canon_min":2, "style":"diegetic", "taboo":["reveal_dragon_truth"]
  },
  "memory": {
    "episodic": ["CK-123","CK-118"],   // continuity keys (one-liners in store)
    "social": {"trust":0.32,"debt":0.70,"fear":0.10}
  },
  "evidence": {
    "paths":   [{"id":"P-1782","abstract":"Ector owes House Pendragon ..."},
                {"id":"P-441","abstract":"Guard's brother injured ..."}],
    "facts":   [{"id":"F-22","t":"Emblem forbidden after dusk"},
                {"id":"F-301","t":"Shifts change at the bell"}],
    "quotes":  [{"id":"Q-991","t":"Next time you swing that axe..."}],
    "rules":   [{"id":"R-5","t":"No lethal strikes within gate perimeter"}]
  },
  "output_contract": {
    "style":"spoken", "max_tokens":80,
    "must_cite":["F-22","R-5"],        // cite by ID in output
    "forbidden":["dragon","wizardry"]
  }
}

Token budgets (console profile defaults)
- Header (call/profile/locale): 8–16
- Speakers + scene: 40–70
- Motifs: 8–16
- Constraints: 16–40
- Memory: 24–60 (episodic IDs only, no long texts)
- Evidence:
  - Paths: 2–3 items, abstracts 20–30 tokens each
  - Facts/quotes/rules: 3–6 items total, one-liners 8–18 tokens each
- Output contract: 10–20
- Total: 450–900 tokens bounded by max_prompt_tokens in [config/rag.xml](config/rag.xml)

ID strategy
- Evidence, rules, quotes, facts, paths, continuity keys are short stable IDs.
- Post-generation expansion: map IDs to full strings only for UI/tooltip, not to the model.

2) Dialogue-act slot recipes

Acts and recipes
- threaten → {leverage_fact, taboo_rule, past_quote, path_motif}
- bargain → {debt_metric, rule_boundary, leverage_fact, scene_stakes}
- rebut → {canon_fact, past_quote, continuity_key}
- ask → {open_hook, rule_safe_zone, path_abstract}

Priority and packing order
- Contract → constraints → speakers+scene → motifs → memory → evidence (paths then facts/quotes/rules) → footer (IDs reminder for citation).
- Within evidence, ensure no duplicates vs. last turn; prefer unseen IDs unless salience increased.

Redundancy control
- Rolling hash of last-N IDs kept per conversation; omit repeats unless score improved (recency or increased social tension).
- Motif budget capped (≤2); rotate per scene to avoid theme bloat.

3) Pointer-first evidence and lazy expansion

Pointer-first pipeline
- Prompt carries IDs + one-liners only.
- Model outputs citations by ID (e.g., “[F-22]”).
- Post-process:
  - Expand cited IDs into player-facing text (tooltips or log lines).
  - Validate IDs exist; reject unknown IDs (hallucination firebreak).
  - If no required IDs are cited, invoke short repair policy (second pass limited to 30–40 tokens, or deterministic fallback line).

Evidence ID resolution
- store/rowmap.json → maps global IDs to shard rows and strip storage.
- store/meta.jsonl / store/index_report.json → evidence provenance and drift checks.

Continuity keys (CK)
- Minted when a new claim appears in a reply that should persist (e.g., “CK-214: Guard saw Ector hide the emblem at dusk”).
- Stored in a compact episodic store with time/scene stamps.
- Pruned/decayed by a score schedule; keys with repeated references are pinned.

4) Scene cue sheets and voice cards

Scene cue sheets (SC-###)
- Precompiled short block for a scene:
  - mood, stakes, time pressure, available levers, off-limits topics, location quirks.
- Loaded once per scene; referenced by cue_id in prompt; details cached as a KV prefix.

Voice cards
- Per-character 20–40 token primer for verbal tics, register, cadence.
- Composed once, stored as a prefix cache; reused across that character’s turns.

5) Episodic and social memory

Episodic memory structure
- Items: {id: CK-###, ts, scene, summary_1line, entities: [ids], salience, decay}
- Decay: salience *= λ per turn (λ≈0.85); pin if referenced in last M turns or linked by selected path.
- Retrieval: top-K episodic keys based on salience and entity overlap with current seeds.

Social memory (scalars per pair)
- Scalars: trust, fear, debt, respect, obligation, prestige (floats 0..1).
- Update rules:
  - Event-based increments (e.g., “gift” +trust 0.1, “threat” +fear 0.2; clamp 0..1).
  - Smoothing to prevent oscillation: new = old*(1−μ) + delta; μ≈0.2.
- Usage:
  - Features into path policy/motif selection.
  - Optional explicit numbers in prompt (“trust(self→other)=0.32”).

Store and persistence
- Implementation in [npc_server.py](npc_server.py) or [npc_generator.py](npc_generator.py).
- Serialized to JSONL or SQLite; capped memory footprint (a few hundred KB per session).

6) Macro-planner: HTN/GOAP-lite beats

Purpose
- Offload long-horizon plot logic into a deterministic beat planner.
- LLM realizes beats locally (dialogue lines), obeying constraints.

Beat skeleton
- goal → obstacles → turn → outcome
- Constraints: canon, timeline, availability, taboo, resource limits.

Planner inputs
- questline id, beats done, world state, constraints, social scalars, motifs.

Planner outputs
- beat candidates with slots (names, places, resources).
- Verified by a deterministic checker (no canon/time violations) before reaching the LLM.

Caching
- Precompute beat templates per locale/quest archetype (rescue, sabotage, debt).
- Store compactly; select and fill names/IDs at runtime for near-zero cost.

7) KV and prefix caching, streaming, and TTFT

Prefix caching
- Stable segments (cue sheet, voice card, constraints) are prefixed once; KV reused across turns.
- In [generation/llm_client.py](generation/llm_client.py), maintain a prefix cache keyed by (character_id, scene_id, locale, constraints_hash).

Turn structure
- Prefix (cached KV) + turn-delta (query and small memory updates).
- TTFT target ≤ 120 ms with streaming UI.

Speculative decoding (optional)
- Tiny draft head proposes 50–80 tokens; main model verifies/accepts to reduce latency spikes.
- Guard with time budget and scene profile (combat vs. narrative).

8) Decoding policies and output contracts

Grammar-constrained decoding (structured outputs)
- For contracts like {offer(price), reason}, decode under JSON/BNF grammar to avoid retries and rambling.

Conciseness and safety
- Output contract enforces max_tokens and required citations.
- Forbidden strings enforced by lexical filter; DFA guards for taboo.

Repair on violation
- If output fails validation (missing must_cite or taboo present), do a micro repair pass or return deterministic fallback lines (pre-baked per act).

9) Multilingual and accessibility

Locale-first packing
- Evidence stored language-neutral by IDs; last-mile expand to locale at render time.
- Retrieval language-agnostic via multilingual embeddings; prompt uses locale-specific one-liners.

Readability regulator
- Enforce sentence and clause length by device, keeping subtitles legible (handheld vs. desktop profiles).

10) Safety, integrity, and adversarial inputs

Taboo and ethics rails
- Compile taboo lists and ethical constraints into DFAs; check post-gen.
- Pack a rule summary line as an ID to bias outputs.

Evidence watermarking
- All shipped strips carry embedded short IDs; post-gen mapping ensures every factual claim maps to a known ID or a minted CK.

Adversarial prompt shield
- Fence player input into a dedicated slot (e.g., "player_utterance") that never merges with system constraints; sanitize via lightweight rules.

11) Telemetry and KPIs (prompt/gen layer)

Counters and traces
- Tokens in/out per turn; budget adherence.
- KV reuse ratio.
- Evidence utilization rate; unsupported claim rate.
- Grammar-constrained hit rate.
- Latency breakdown: pack, prefill, decode, post-process.
- Cache hit rates for scene cue, voice card, prefix KV.

UE/game engine integration
- Emit telemetry events to ring buffer; flush JSONL periodically in dev builds.
- Feature flags to A/B: packer variant (path-first vs. flat), must_cite strictness, grammar decoding on/off.

Target bands (first pass)
- Evidence utilization ≥ 85%
- Unsupported claims ≤ 1%
- Style adherence ≥ 90%
- TTFT ≤ 120 ms (streaming)
- KV reuse ≥ 70% of prefix tokens on multi-turn scenes

12) Acceptance criteria and tests

Prompt packer acceptance
- Packs required slots for each plan; enforces budgets and dedupe.
- Includes path evidence and scene memory when present.

Memory acceptance
- Episodic CKs are minted, decayed, and retrieved; social scalars update within bounds.

Decoding acceptance
- Contracts honored (max_tokens, must_cite); grammar validation success p95 ≥ 95%.

KV caching acceptance
- Prefix cache reused across turns; prefill time reduced proportionally to prefix length.

Safety acceptance
- No taboo violations in test suites; post-gen validator catches malformed outputs; unknown ID references rejected.

13) Risks and mitigations

Token creep
- Strict budgets; hard caps per slot; drop least salient last.

Citation brittleness
- Provide clear ID reminders in prompt; deterministic post-process fallbacks.

Over-conditioning by motifs
- Cap motif count; rotate by scene; incorporate uncertainty margin to sometimes include a second candidate.

Memory bloat
- Cap episodic CK count and size; decay aggressively; pin only when referenced.

14) Implementation plan (prompt/memory/gen scope)

Week 1–2
- Implement prompt schema v1; slot recipes; dedupe; pointer-first with ID validation.
- KV/prefix cache wiring; scene cue sheets and voice card caches; basic counters.

Week 3–4
- Episodic/social memory stores with decay and update rules; continuity keys flow.
- Output contracts and grammar-constrained decoding; basic taboo DFA.

Week 5–6
- Macro-planner beats; deterministic checker; cached beat templates by locale.
- Speculative decoding (optional); multilingual expansions; readability regulator.
- A/B experiments; guardrails polish; acceptance tests.

File and config mapping
- Prompt packer and schema: [generation/prompts.py](generation/prompts.py)
- Generator and contracts: [generation/generator.py](generation/generator.py)
- LLM client and KV/prefix caches: [generation/llm_client.py](generation/llm_client.py)
- Personas/voice cards: [generation/personas.py](generation/personas.py)
- Memory stores: [npc_server.py](npc_server.py), [npc_generator.py](npc_generator.py)
- Retrieval interfaces: [api/retriever.py](api/retriever.py), [src/retrieval/router.py](src/retrieval/router.py)
- Ingestion (IDs/strips): [ingestion/build_jsonl.py](ingestion/build_jsonl.py), [ingestion/link_entities.py](ingestion/link_entities.py)
- Config toggles: [config/rag.xml](config/rag.xml), [src/rag/config/rag.xml](src/rag/config/rag.xml)

Appendix A: Output grammar example (dialogue.reply)
- JSON form with fixed fields:
  - type: "dialogue"
  - lines: array of 1–3 strings
  - cites: array of IDs (must include those in output_contract.must_cite)
  - meta: {act, tone?, safety_passed?}

Appendix B: Continuity key (CK) lifecycle
- Create → store → decay → pin on reference → retire when stale/out-of-scope.
- Keys link to entities and scenes; merged when semantically equivalent.

Appendix C: Device profile parameters (console defaults)
- max_prompt_tokens: 900
- evidence.paths.max: 3; facts/quotes/rules.total.max: 6
- motifs.max: 2
- memory.episodic.max: 3 CKs; social present as floats only
- output_contract.max_tokens: 80
- repair_pass.max_tokens: 40
- KV prefix target: 250–400 tokens per character+scene