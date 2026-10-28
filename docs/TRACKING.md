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
- [ ] **[BUG-01] Fix Default Profile Shell IDs (`src/shared/profile.ts`)**
  - [`createDefaultProfile`](../src/shared/profile.ts) initializes starter `installedItems` for legacy shell IDs `['striker-v1', 'bastion-v1', 'signal-v1']`. Update to match actual shell templates `['vanguard-v1', 'bastion-v1', 'ghost-v1']`.
- [ ] **[BUG-02] Resolve Weapon/Armor vs. Software Slot Collision (`src/game/systems/software.ts`, `equipment.ts`, `combat.ts`)**
  - In-run `BurnSoftwareIntent` in [`software.ts`](../src/game/systems/software.ts) overwrites `EquipmentSlots.weapon` or `EquipmentSlots.armor` with `softwareEntityId` (and marks the old entity `Dying`), colliding with physical Weapons (`rifle-v1..v3`) and Armor (`armor-v1..v3`) equipped via [`equipment.ts`](../src/game/systems/equipment.ts).
  - Align `BurnSoftwareIntent` and `software-effects.ts` to attach Software as child entities (`Children` / `SoftwareSlots`) on equipped gear or Shell `SoftwareSlots` consistent with `combat.ts` (`collectDamageModifiers`).
- [ ] **[BUG-03] Propagate `isLegacy` Flag to Spawned Entities (`src/game/engine-factory.ts`)**
  - When [`createEngineInstance`](../src/game/engine-factory.ts) spawns `profile.installedItems`, it does not copy `item.isLegacy` onto the spawned entity's `AbilityDef` or `AugmentData` component, causing [`legacy-code.ts`](../src/game/systems/legacy-code.ts) penalties (2× Heat cost / 0.5× Augment magnitude) to never trigger in-run.
- [ ] **[BUG-04] Apply Purchased Shell Upgrades at Run Launch (`src/app/api/run-mode/launch/route.ts`, `src/game/engine-factory.ts`)**
  - Upgrades purchased via [`POST /api/economy/upgrade`](../src/app/api/economy/upgrade/route.ts) are stored in `profile.shellUpgrades[shellId]`, but `launch/route.ts` and `engine-factory.ts` use unmodified base stats from `shellRegistry`. Apply `profile.shellUpgrades` when constructing `shellRecord` for a run.
- [ ] **[BUG-05] Enforce Profile Death Penalties by Run Mode (`src/app/api/action/route.ts`)**
  - [`run-mode-config.ts`](../src/game/systems/run-mode-config.ts) defines `deathPenalty` (`loseInstalledItems: true`, and `resetShellUpgrades: true` in `WEEKLY`), but [`src/app/api/action/route.ts`](../src/app/api/action/route.ts) does not clear `profile.installedItems` or downgrade `profile.shellUpgrades` when `RUN_ENDED` has `reason !== 'extraction'`.
- [ ] **[BUG-06] Persist Extracted Blueprints & Equipment (`src/game/systems/run-ender.ts`, `src/app/api/action/route.ts`)**
  - Blueprints collected in-run (`blueprint-locked`) are never added to `profile.blueprintLibrary` on extraction, and `RunInventory.equipment` (looted weapons/armor) is omitted from `itemsExtracted` in [`run-ender.ts`](../src/game/systems/run-ender.ts).
- [x] **[BUG-07] Align Vault Capacity Constant (`src/app/api/action/route.ts`)**
  - Updated `src/app/api/action/route.ts` to import `VAULT_MAX_SLOTS` from `@shared/vault` instead of hardcoding `20`.
- [ ] **[BUG-08] Immediate Same-Turn Resolution for On-Kill `HealIntent` (`src/game/systems/software.ts`, `augment.ts`)**
  - `SoftwareSystem` (`Vampire.exe`) and `AugmentSystem` run in `Phase.REACTION` *after* `CombatSystem`, so `HealIntent`s they attach on kill are not processed until the next actor's action sequence.

### 1.2 Unimplemented Design Mechanics (Medium Priority)
- [ ] **[DESIGN-01] Implement `GHOST_PULSE.exe` and `LOGIC_JAM.exe` Effects (`src/game/systems/firmware.ts`)**
  - Add effect handlers in `FirmwareSystem` for `effectType: "vision_pulse"` (`ghost-pulse.json`, temporary area reveal) and `effectType: "stun"` (`logic-jam.json`, applying `STUN` / `DISRUPT` to target enemy).
- [ ] **[DESIGN-02] Wire `DISRUPT` Status to Stun `System_Admin` (`src/game/systems/ai.ts`, `firmware.ts`)**
  - [`ai.ts`](../src/game/systems/ai.ts) checks for `DISRUPT` on `System_Admin` to skip its turn, but no player Firmware or Software currently applies `DISRUPT`. Connect `LOGIC_JAM.exe` (or `Neural_Spike.exe`) to apply `DISRUPT`.
- [ ] **[DESIGN-03] Wire `MOVEMENT_SLOW` into Turn/Movement Cost (`src/game/turn/game-turn-adapter.ts` or `movement.ts`)**
  - `PackCoordinatorSystem` applies `MOVEMENT_SLOW` on `Buffer-Overflow` detonation, but neither `GameTurnAdapter` nor `MovementSystem` reads `MOVEMENT_SLOW`.
- [ ] **[DESIGN-04] Apply `HUD_GLITCH` on `Null-Pointer` Hit (`src/game/systems/combat.ts` or `ai.ts`)**
  - Per `ENEMY-HIERARCHY.md`, `Null-Pointer` attacks should apply `HUD_GLITCH` for 2 turns on hit.
- [ ] **[DESIGN-05] Stability Anchor Descend Cost & Stability Refill (`src/game/systems/anchor-interaction.ts`, `floor-manager.ts`)**
  - Implement configurable Scrap/Flux cost and 40% Stability repair when choosing `STABILIZE & DESCEND` at a Stability Anchor, differentiating Anchor descent from normal Staircase descent.
- [ ] **[DESIGN-06] Fix `seed-eater.json` Loot Table Tier (`src/game/entities/templates/seed-eater.json`)**
  - Update `lootTable.tier` on `seed-eater.json` from `2` to `3` to match its Tier 3 boss classification.
- [ ] **[DESIGN-07] Author Entity Templates for Weekly Winner's Items (`src/game/entities/templates/economy.json`)**
  - Create JSON entity templates for `PHASED_OVERDRIVE`, `NEURAL_RECURSION`, `STATIC_COLLAPSE`, and `VOID_ECHO` referenced in `economy.json`.

---

## Workstream 2: Architecture, Fault Tolerance & Security

### 2.1 Server Runtime Resilience & Memory Management
- [ ] **[ARCH-01] Pre-Turn Transactional Checkpoint & System Fault Isolation (`src/app/api/action/route.ts`, `src/engine/ecs/world.ts`)**
  - Wrap non-critical system executions in fault boundaries and restore pre-turn `oldWorldState`/`oldGridState` if an uncaught exception occurs during `turnManager.submitAction()`, returning a clean rollback sync payload instead of an unhandled HTTP 500.
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
- [ ] **[ARCH-06] Remove Auxiliary Scratch Directories (`tmp/`, `scratch/`, `debug/`, empty `config.json`)**
  - Clean up untracked/legacy one-off scripts in `tmp/`, empty `scratch/`, root `config.json` (0 bytes), and add `debug/` to `.gitignore`.

### 2.3 API Security & Persistence Synchronization
- [x] **[SEC-01] Sanitize `sessionId` Against Path Traversal (`src/app/persistence/fs-profile-repository.ts`)**
  - Added strict regex sanitization (`/^[a-zA-Z0-9_-]+$/`) preventing directory traversal (`..`) attacks on profile files.
- [ ] **[SEC-02] Add Zod Request Validation to Remaining API Routes (`src/app/api/`)**
  - Add strict Zod schemas to vault routes (`sell`, `discard`, `move-to-vault`, `equip-from-vault`, `overflow`), `run-mode` routes, and `admin` routes.
- [ ] **[SEC-03] Gate `/api/admin/*` and `/api/debug/*` Routes by Environment**
  - Restrict `/api/admin/*` and `/api/debug/log` when `process.env.NODE_ENV === 'production'`.
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
