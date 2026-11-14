# Nirmata Runner — Project Tracking & System Index

> **Current Baseline:** v3.2 (`feature/tk-rpt-100-issue-reporting`)  
> **Last Updated:** 2026-11-11  
> **Architecture Overview:** [`docs/architecture/SYSTEM_OVERVIEW.md`](./architecture/SYSTEM_OVERVIEW.md) | Layer Rulebooks: [`AGENTS.md`](../AGENTS.md)

---

## 1. System Status & Milestone Index

All prior development arcs and adversarial audits are complete and passing (clean typecheck, lint, build, and test suite). Detailed design specs and remediation audit records are preserved in `docs/design/` and `docs/reports/`.

| Workstream / Subsystem | Baseline / Spec | Status | Key Artifacts & References |
| :--- | :--- | :--- | :--- |
| **Core Architecture & ECS** | [`APPLICATION_SEPARATION_SPEC.md`](./architecture/APPLICATION_SEPARATION_SPEC.md) | Complete (v1.0) | Layer decoupling (`@client`, `@server`, `@dev-tool`, `@engine`, `@shared`), 23-phase authoritative loop, `GravediggerSystem` death protocol, client prediction & delta compression. |
| **Gameplay Foundations & Specs** | [`DESIGN-BRIEF.md`](./design/DESIGN-BRIEF.md) | Complete (v1.5) | Shell progression (`vanguard-v1`, `bastion-v1`, `ghost-v1`), Neural Heat & Kernel Panic, Stability Anchors, vault persistence, slot collisions resolved. |
| **UI Modernization & Style Guide** | [`UI-DESIGN-SYSTEM.md`](./design/UI-DESIGN-SYSTEM.md) | Complete (v2.0) | Taikoku Vector design tokens, HUD overlay, 6-tab Neural Deck Hub, modals, hold-to-confirm levers, tactical tooltips. |
| **Interactive Environments & ProcGen** | [`INTERACTIVE-ENVIRONMENTS.md`](./design/INTERACTIVE-ENVIRONMENTS.md) | Complete (v2.5) | Prefab stamping (`server-core`, `freight-bay`, `decon-airlock`, `zero-day-vault`), 13 interactive prop fixtures, bump safeguards, anti-cheat client redaction, directional cover & cascades. Audits: [`2026-11-02`](./reports/2026-11-02-adversarial-review-interactive-environments.md), [`2026-11-03`](./reports/2026-11-03-adversarial-review-c1-c8-remediation.md). |
| **Directional Tilemaps & Walls** | [`DIRECTIONAL-TILEMAPS.md`](./design/DIRECTIONAL-TILEMAPS.md) | Complete (v2.6) | 4-bit cardinal autotile & bitmask solver, wall caps & inner corners, 512×512 themed master atlas, front-facing prop interaction. Handoff: [`2026-11-05`](./reports/2026-11-05-branch-handoff-directional-tilemaps.md). |
| **Gamedata Authoring Studio** | [`GAMEDATA-DESIGN-TOOL.md`](./design/GAMEDATA-DESIGN-TOOL.md) | Complete (v2.7) | `/dev/gamedata` suite: entity templates, mixin inheritance & diffs, 6-archetype procedural room synthesis, Augment AST editor, tileset validator. Handoff: [`2026-11-06`](./reports/2026-11-06-branch-handoff-gamedata-studio-overhaul.md). |
| **Audio Subsystem & DSP Synth** | [`AUDIO-SYSTEM.md`](./design/AUDIO-SYSTEM.md) | Complete (v2.7) | Pure Web Audio synth voice core (`@engine/audio`), procedural sound cues (`sound-cues.json`), 2D spatial mixer & occlusion, reactive ambiance DSP. Audit: [`2026-11-07`](./reports/2026-11-07-adversarial-review-audio-system.md). |
| **AI Behavior Trees & Spatial Maps** | [`AI-BEHAVIOR-TREES-DIJKSTRA.md`](./design/AI-BEHAVIOR-TREES-DIJKSTRA.md) | Complete (v3.0) | Pure stateless behavior tree evaluator (`@engine/ai`), shared Dijkstra distance maps (approach, flee, kite-to-cover, pack surround), utility curves, bestiary migration. Audit: [`2026-11-07`](./reports/2026-11-07-adversarial-review-ai-behavior-trees.md). |
| **Sprite Animation System** | [`SPRITE-ANIMATIONS.md`](./design/SPRITE-ANIMATIONS.md) | Complete (v2.8) | Single-atlas ping-pong delta frames (Rows 12–14), ambient states & one-shot clips, `SpriteAnimator` runtime, Studio scrubber preview. Audit: [`2026-11-08`](./reports/2026-11-08-adversarial-review-sprite-animations.md). |
| **Performance & Telemetry Monitor** | [`PERFORMANCE-MONITOR-SPEC.md`](./design/PERFORMANCE-MONITOR-SPEC.md) | Complete (v2.9) | `TK-PERF-900` widget: WebGL2 probe, zero-alloc ring buffer telemetry, 4 display modes (`MINI`, `STANDARD`, `EXPANDED`, `GHOST`), sub-stage breakdown, dev hotkeys (`F3`, `Shift+F3`, `Alt+F3`). |
| **In-Game Issue Reporting & Crash Ticketing** | [`IN-GAME-ISSUE-REPORTING.md`](./design/IN-GAME-ISSUE-REPORTING.md) | Complete (v3.2) | `TK-RPT-100`: Manual report modal (`F8`), post-crash approval dialog, GitHub issue creator (`ai-ready`), sealed turn diagnostics, client/server ring buffers, deterministic fingerprint dedupe, disk outbox with backoff retries. Audit & remediation: [`2026-11-11`](./reports/2026-11-11-adversarial-review-issue-reporting.md). |

---

## 2. Architectural Boundaries & Non-Negotiable Invariants

When extending or refactoring systems, preserve these established constraints (see [`AGENTS.md`](../AGENTS.md)):

1. **ECS Intent Pipeline & Phase Invariants**:
   - Systems communicate strictly via Intent/Tag components (`MoveIntent`, `AttackIntent`, `DamageIntent`, `SpawnEntityIntent`, etc.) processed in the registered phase (`PRE_TURN` → `GATHER_INTENT` → `ACTION` → `REACTION` → `CLEANUP` → `POST_TURN`). No direct inter-system method invocation.
2. **Death Protocol**:
   - `GravediggerSystem` exclusively handles `world.destroyEntity()`. All other systems mark entities by attaching `Dying` (`world.addComponent(id, Dying, { killerId, reason })`).
3. **Client vs. Server Authority**:
   - Client (`isClient: true`) executes only prediction-safe movement/intent systems with a 2-slot FIFO input buffer; the server executes full turn cycles and synchronizes via `createECSWorldDelta` or `FULL` snapshots.
   - Client state is initialized strictly from `/api/run-mode/launch` or `/api/session` `initialState` via `applyStateDelta()`. Client never executes procgen.
4. **Anti-Cheat Loot & AI Wire Redaction**:
   - Server-only container contents (`storedLoot`, `scrapYield`, `fluxYield`, `blueprintId`), unrevealed trap types, and enemy internal AI state (`cooldowns`, `inlineTree`, `lastEvaluatedPath` outside player FOV) are stripped before sending deltas/snapshots to the client.
5. **Zero Mutation Component Updates**:
   - Never mutate objects returned by `world.getComponent()`. Always use `world.patchComponent(id, Def, partial)` or `world.addComponent(id, Def, data)`.
6. **Production Tooling Quarantine**:
   - `/dev/gamedata` and `/api/dev/*` routes are strictly gated behind `checkNonProductionOnly()` and 404 in production builds.

---

## 3. Active Backlog & Next Initiatives

### 3.1 Quality Gates & Test Coverage
- [ ] **[TEST-04] Vitest Coverage Gate (`vitest.config.ts`)**
  - Configure `@vitest/coverage-v8` with enforceability thresholds for `@engine`, `@shared`, and `@server`.

### 3.2 Planned Feature Specifications
- [ ] **Cloud Persistence, Accounts, Auth & Three-Tier Progression (`v3.3`)**:
  - Specifications: [`docs/architecture/PERSISTENCE-AND-HOSTING-SPEC.md`](./architecture/PERSISTENCE-AND-HOSTING-SPEC.md), [`docs/design/ACCOUNTS-AUTH-AND-PROGRESSION-SPEC.md`](./design/ACCOUNTS-AUTH-AND-PROGRESSION-SPEC.md) (approved, ready to implement).
  - Target: Firebase App Hosting (Cloud Run with sticky sessions), 100% server-only Cloud Firestore persistence (local Emulator Suite in dev, replacing `FSProfileRepository`), Firebase Auth (Anonymous-first + Google/Email binding for ranked modes), `CALLSIGN#1234` discriminator identity, in-memory `SessionManager` with milestone/debounced gzipped checkpoints & lazy hydration, and 3-tier progression (Permanent Account + Multi-Week Seasons + Weekly Reset) with data-driven Awards and Claimable Commendations.
- [ ] **Deferred Lighting & Volumetric Glow (`v3.2`)**:
  - Specification: [`docs/design/DEFERRED-LIGHTING-RENDERING.md`](./design/DEFERRED-LIGHTING-RENDERING.md).
  - Target: Custom PixiJS multi-pass lightmap render target, normal-mapped tile/prop illumination, flicker/pulse emission sources, and terminal glow effects.
- [x] **In-Game Issue Reporting & Crash Ticketing (`TK-RPT-100`)**:
  - Specification: [`docs/design/IN-GAME-ISSUE-REPORTING.md`](./design/IN-GAME-ISSUE-REPORTING.md) (Complete, v3.2).
  - Target: Manual bug/feature/feedback form and player-approved automatic crash reports posted as GitHub issues (auto-labelled `ai-ready`), with sealed server diagnostics, fingerprint dedupe, and a retrying outbox.
- [ ] **Art Direction & World-Building Content Pipeline**:
  - Specification: [`docs/wip/ART-DIRECTION-WORLD-BUILDING.md`](./wip/ART-DIRECTION-WORLD-BUILDING.md).
  - Target: Faction narrative styling, visual identity tokens, environmental decors, and audio ambiance expansion.
- [ ] **End-Game Extraction Events & Anchor Boss Encounters**:
  - Specification: [`docs/design/ENEMY-HIERARCHY.md`](./design/ENEMY-HIERARCHY.md), [`docs/design/STABILITY-ANCHOR-SYSTEM.md`](./design/STABILITY-ANCHOR-SYSTEM.md).
  - Target: Floor 15 extraction defense waves, timed terminal hacking sequences, and boss-phase behavior trees.
