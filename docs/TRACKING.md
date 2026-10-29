# Nirmata Runner — Project Tracking & Future Work

> **Last Updated:** 2026-10-28  
> **Baseline State:** v2.1 (Post-Phase 22 + Engine Decoupling `abc80f73` + Server Authority Remediation `3266693a`)

---

## Completed Foundation Summary
- [x] **Core ECS & Turn Engine (`@engine`)**: Zero-dependency ECS `World`, spatial `Grid`, queued `EventBus`, `StateMachine`, BSP/FloodFill generation, and adapter-driven `TurnManager` (`GameTurnAdapter`).
- [x] **Phase-Driven Intent & Death Protocols**: Systems communicate via Intent/Tag components across 6 deterministic phases (`PRE_TURN`, `GATHER_INTENT`, `ACTION`, `REACTION`, `CLEANUP`, `POST_TURN`); `GravediggerSystem` exclusively handles `world.destroyEntity()`.
- [x] **Client Prediction & Delta Replication**: Client runs prediction-only systems (`isClient: true`) with a 2-slot FIFO input buffer; server executes full turn cycles and returns component-level deltas (`createECSWorldDelta`) with `EventOriginContext` deduplication and `EntitySpriteMap` reconciliation.
- [x] **Core Extraction Loop & Hub UI**: 3 Shells (`VANGUARD-v1`, `BASTION-v1`, `GHOST-v1`), Neural Heat & Kernel Panic, 6 enemies across 3 tiers, 15-floor progression with Staircases and Stability Anchors (Floors 5/10/15), Neural Deck Hub (Shell, Loadout, Workshop, Vault, Initialize), in-run drag-and-drop inventory & tooltips, and `/dev/gamedata` authoring studio.

---

## Workstream 1: Gameplay Bugs & Design Spec Alignment

### 1.1 Critical Gameplay Bugs (High Priority)
- [x] **[BUG-01] Fix Default Profile Shell IDs (`src/shared/profile.ts`)**
  - [`createDefaultProfile`](../src/shared/profile.ts) initializes starter `installedItems` for shell templates `['vanguard-v1', 'bastion-v1', 'ghost-v1']`.
- [x] **[BUG-02] Resolve Weapon/Armor vs. Software Slot Collision (`src/game/systems/software.ts`, `equipment.ts`, `combat.ts`)**
  - In-run `BurnSoftwareIntent` attaches Software as permanent child entities (`Children`) on equipped physical gear, retaining burned software even if gear is unequipped, while falling back to player `SoftwareSlots` when burning without gear.
- [x] **[BUG-03] Propagate `isLegacy` Flag to Spawned Entities (`src/game/engine-factory.ts`)**
  - Patches `item.isLegacy` onto spawned entities (`AbilityDef` / `AugmentData`) so `legacy-code.ts` penalties trigger accurately in-run.
- [x] **[BUG-04] Apply Purchased Shell Upgrades at Run Launch (`src/app/api/run-mode/launch/route.ts`, `src/game/engine-factory.ts`)**
  - Applies `profile.shellUpgrades` to base stats and additional ports via `applyShellUpgradesToRecord` at run launch.
- [x] **[BUG-05] Enforce Profile Death Penalties by Run Mode (`src/app/api/action/route.ts`)**
  - Clears `profile.installedItems` for the active shell on run failure/death, and resets `profile.shellUpgrades` in `WEEKLY` mode.
- [x] **[BUG-06] Persist Extracted Blueprints & Equipment (`src/game/systems/run-ender.ts`, `src/app/api/action/route.ts`)**
  - Persists extracted blueprints to `profile.blueprintLibrary` (converting duplicates to 20 Flux), and extracts both software and physical weapons/armor into the vault.
- [x] **[BUG-07] Align Vault Capacity Constant (`src/app/api/action/route.ts`)**
  - Updated `src/app/api/action/route.ts` to import `VAULT_MAX_SLOTS` from `@shared/vault` instead of hardcoding `20`.
- [x] **[BUG-08] Immediate Same-Turn Resolution for On-Kill `HealIntent` (`src/game/systems/software.ts`, `combat.ts`, `registration.ts`)**
  - Registered dedicated `HealSystem` at tail of `Phase.REACTION` after `SoftwareEffectSystem` so `Vampire.exe` on-kill heals resolve immediately in the same turn.

### 1.2 Unimplemented Design Mechanics (Medium Priority)
- [x] **[DESIGN-01] Implement `GHOST_PULSE.exe` and `LOGIC_JAM.exe` Effects (`src/game/systems/firmware.ts`)**
  - Handled `effectType: "vision_pulse"` (revealing area in radius 10 via `FOV_UPDATED`) and `effectType: "stun"` (applying `DISRUPT` for 2 turns via `ApplyStatusEffectIntent`).
- [x] **[DESIGN-02] Wire `DISRUPT` Status to Stun `System_Admin` (`src/game/systems/ai.ts`, `firmware.ts`)**
  - Wired `DISRUPT` and `STUN` checks into `AISystem.processEnemyTurn` and `processSystemAdminTurn` to skip enemy turns when stunned.
- [x] **[DESIGN-03] Wire `MOVEMENT_SLOW` into Turn/Movement Cost (`src/game/turn/game-turn-adapter.ts`)**
  - Scaled movement action costs by `(1 + magnitude / 100)` when afflicted by `MOVEMENT_SLOW` in `GameTurnAdapter.getActionCost`.
- [x] **[DESIGN-04] Apply `HUD_GLITCH` on `Null-Pointer` Hit (`src/game/systems/combat.ts`)**
  - Applied `HUD_GLITCH` (2 turns) via `ApplyStatusEffectIntent` on player hit by `Null-Pointer` in `CombatSystem`.
- [x] **[DESIGN-05] Stability Anchor Descend Cost & Stability Refill (`src/game/systems/anchor-interaction.ts`, `floor-manager.ts`)**
  - Configured `20 + currentFloor * 5` Scrap cost and +40% Reality Stability repair when descending at a Stability Anchor.
- [x] **[DESIGN-06] Fix `seed-eater.json` Loot Table Tier (`src/game/entities/templates/seed-eater.json`)**
  - Updated `lootTable.tier` on `seed-eater.json` to `3` with Tier 3 drops (`bleed-v3`, `vampire-v3`, `auto-loader-v3`, `rifle-v3`, `armor-v3`).
- [x] **[DESIGN-07] Author Entity Templates for Weekly Winner's Items (`src/game/entities/templates/economy.json`)**
  - Authored entity templates for `PHASED_OVERDRIVE`, `NEURAL_RECURSION`, `STATIC_COLLAPSE`, and `VOID_ECHO` and registered them in `EntityRegistry`.

---

## Workstream 2: Architecture, Fault Tolerance & Security

### 2.1 Server Runtime Resilience & Memory Management
- [x] **[ARCH-01] Pre-Turn Transactional Checkpoint & System Fault Isolation (`src/app/api/action/route.ts`, `src/engine/ecs/world.ts`)**
  - Wrapped non-critical system executions in fault boundaries emitting `SYSTEM_FAULT` and restored pre-turn `oldWorldState`/`oldGridState` if an uncaught exception occurs during `turnManager.submitAction()`, returning a clean rollback `FULL` sync payload instead of an unhandled HTTP 500. Unit tested in `src/engine/ecs/world.test.ts` and `src/app/api/action/__tests__/action.test.ts`.
- [x] **[ARCH-02] SessionManager TTL Eviction & Cleanup (`src/server/session/session-manager.ts`)**
  - Added sliding-window inactivity TTL (default 60 minutes), max capacity bounds (1000 sessions) with LRU eviction, and `pruneStaleSessions()`.
  - Removed insecure public `/api/leaderboard/submit` route and deleted legacy redundant re-export `src/server/session/SessionManager.ts`.
- [x] **[ARCH-03] Guard `World.destroyEntity` Against Cyclic Child Hierarchies (`src/engine/ecs/world.ts`)**
  - Added cycle detection with a `visited` set to safely break cyclic child component graphs.
  - Added cycle traversal unit tests and `unregisterSystem`/`loadSerializableState` verification in `src/engine/ecs/world.test.ts`.

### 2.2 Layering & Code Hygiene
- [x] **[ARCH-04] Eliminate `@shared` → `@game` Upward Imports (`src/shared/pipeline.ts`, `src/shared/utils/economy-util.ts`)**
  - Moved `runActionPipeline` into `@game/pipeline/action-pipeline.ts` and decoupled `economy-util.ts` using `DEFAULT_ECONOMY_CONFIG`.
  - Zero imports from `@game` remain in `src/shared/`. Consolidated pipeline tests into `tests/game/action-pipeline.test.ts` and `tests/game/intent-resolution.test.ts`.
- [x] **[ARCH-05] Realign Client-Only Events & Deduplicate Component Registry**
  - Deduplicated `SoftwareSlots` entry in [`src/shared/components/index.ts`](../src/shared/components/index.ts).
- [x] **[ARCH-06] Remove Auxiliary Scratch Directories (`tmp/`, `scratch/`, `debug/`, empty `config.json`)**
  - Cleaned up untracked/legacy one-off scripts in `tmp/`, empty `scratch/`, root `config.json` (0 bytes), and added `debug/`, `scratch/`, `tmp/` to `.gitignore`.

### 2.3 API Security & Persistence Synchronization
- [x] **[SEC-01] Sanitize `sessionId` Against Path Traversal (`src/app/persistence/fs-profile-repository.ts`)**
  - Added strict regex sanitization (`/^[a-zA-Z0-9_-]+$/`) preventing directory traversal (`..`) attacks on profile files.
- [x] **[SEC-02] Add Zod Request Validation to Remaining API Routes (`src/app/api/`)**
  - Added strict Zod schemas to vault routes (`sell`, `discard`, `move-to-vault`, `equip-from-vault`, `overflow`), `run-mode` routes (`available`, `launch`), `admin` routes (`reset-attempts`, `seed-rotation`), `session`, and `profile`. Unit tested in `tests/api/security-and-validation.test.ts`.
- [x] **[SEC-03] Gate `/api/admin/*` and `/api/debug/*` Routes by Environment**
  - Restrict `/api/admin/*` and `/api/debug/log` when `process.env.NODE_ENV === 'production'`. Unit tested in `tests/api/security-and-validation.test.ts`.
- [x] **[SEC-04] Align Seed Rotation with UTC Leaderboard Period IDs (`src/app/persistence/seed-rotation.ts`)**
  - Synchronized `seed-rotation.ts` with UTC calendar midnight boundaries for daily and weekly rotation, consistent with `leaderboard-service.ts`. Unit tested in `src/app/persistence/__tests__/seed-rotation.test.ts`.

---

## Workstream 3: Test Coverage & Quality Gates

- [x] **[TEST-01] Authoritative Game Systems Unit Tests (`src/game/systems/__tests__/`)**
  - Added dedicated unit tests for authoritative systems:
    - `floor-manager.test.ts` (floor descent, entity purging, player/equipment preservation, client-mode gating)
    - `gravedigger.test.ts` (grid spatial index removal + recursive child entity destruction + `world.destroyEntity` protocol)
    - `stability.test.ts` (floor chunk drain, per-turn bleed, collapse damage trigger at 0 stability)
    - `dead-zone.test.ts` (hazard creation, tick damage DoT, duration countdown, entity cleanup)
    - `tile-corruption.test.ts` (corruption spread across floor tiles, state persistence)
    - `pack-coordinator.test.ts` (surround detection, detonation damage intent, slow status effect)
    - `anchor-interaction.test.ts` (Anchor and Staircase interaction trigger verification)
- [x] **[TEST-02] API Route & Persistence Test Suite (`tests/api/`, `src/app/persistence/__tests__/`)**
  - Added transaction integration tests in `tests/api/vault-economy-transactions.test.ts` for `/api/economy/purchase`, `/api/economy/uninstall`, `/api/vault/sell`, `/api/vault/discard`, `/api/vault/overflow`.
  - Expanded `src/app/api/action/__tests__/action.test.ts` to test `EQUIP`, `UNEQUIP`, `ANCHOR_DESCEND`, `ANCHOR_EXTRACT`, and `RUN_ENDED` persistence.
  - Added unit tests for seed rotation in `src/app/persistence/__tests__/seed-rotation.test.ts`.
  - Expanded `tests/api/leaderboard-persistence.test.ts` to cover daily and weekly leaderboard queries.
- [x] **[TEST-03] Shared Utilities & Pipeline Consolidation (`src/shared/__tests__/`, `tests/game/`)**
  - Consolidated action simulation tests into `tests/game/action-pipeline.test.ts` and core system phase tests into `tests/game/intent-resolution.test.ts`.
  - Added unit tests for `src/shared/utils/economy-util.ts` (`src/shared/utils/__tests__/economy-util.test.ts`), `src/shared/utils/inventory-util.ts` (`src/shared/utils/__tests__/inventory-util.test.ts`), and `SessionManager` (`src/server/session/__tests__/session-manager.test.ts`).
  - Added `src/game/ui/__tests__/sync-bridge.test.ts` and consolidated `store.test.ts`.
- [ ] **[TEST-04] Configure Vitest Coverage Gate (`vitest.config.ts`)**
  - Add `@vitest/coverage-v8` and configure coverage reporting/thresholds for `@engine`, `@shared`, and `@server`.
- [x] **[TEST-05] Rendering & Test Suite Cleanliness**
  - Pruned 8 dead stubs and obsolete tests (`BackpackGrid.test.tsx`, `EquipmentPanel.test.tsx`, `InRunItemTooltip.test.tsx`, `animations.test.ts`, `layer-ordering.test.ts`, `particle-emitters.test.ts`, `tech-demo.test.ts`, `death-equipment-clear.test.ts`).
  - Relocated `reconciliation.test.ts` to `tests/game/reconciliation.test.ts`.
  - Relocated `glitch-effects.test.ts` and `tilemap-build.test.ts` to `tests/rendering/`.
  - Consolidated redundant sprite tests into `tests/rendering/sprite-map.test.ts`.
