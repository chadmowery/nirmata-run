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
- [ ] **[BUG-07] Align Vault Capacity Constant (`src/app/api/action/route.ts`)**
  - [`src/app/api/action/route.ts`](../src/app/api/action/route.ts) hardcodes `VAULT_CAPACITY = 20` instead of importing `VAULT_MAX_SLOTS` (`30`) from [`src/shared/vault.ts`](../src/shared/vault.ts).
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
- [ ] **[ARCH-02] SessionManager TTL Eviction & Cleanup (`src/server/session/session-manager.ts`)**
  - Add sliding-window inactivity TTL (e.g., 60 minutes) and max session bounds to `SessionManager` so inactive sessions do not accumulate indefinitely in memory.
  - Delete the redundant re-export file [`src/server/session/SessionManager.ts`](../src/server/session/SessionManager.ts).
- [ ] **[ARCH-03] Guard `World.destroyEntity` Against Cyclic Child Hierarchies (`src/engine/ecs/world.ts`)**
  - Delete `id` from `this.entities` *before* recursing into `childrenData.entityIds` (or track a `visited` set) to prevent stack overflow on cyclic child graphs.

### 2.2 Layering & Code Hygiene
- [ ] **[ARCH-04] Eliminate `@shared` → `@game` Upward Imports (`src/shared/pipeline.ts`, `src/shared/utils/economy-util.ts`)**
  - Move `runActionPipeline` into `@game/pipeline/` (or inject systems) and decouple `economy-util.ts` from `@game/entities/templates/economy.json`.
  - Add an ESLint `import-x/no-restricted-paths` zone in `eslint.config.js` forbidding `./src/shared/**` from importing `./src/game/**`.
- [ ] **[ARCH-05] Realign Client-Only Events & Deduplicate Component Registry**
  - Move client-only filter/targeting events (`APPLY_WORLD_FILTER`, `REMOVE_WORLD_FILTER`, `TARGETING_*`) from `GameplayEvents` (`src/shared/events/types.ts`) to `GameEvents` (`src/game/events/types.ts`).
  - Remove duplicate `SoftwareSlots` entry in [`src/shared/components/index.ts`](../src/shared/components/index.ts).
  - Register `heatSystem` and `kernelPanicSystem` inside `registerCoreSystems` so `pipeline.ts` and `engine-factory.ts` share identical system registration.
- [ ] **[ARCH-06] Remove Auxiliary Scratch Directories (`tmp/`, `scratch/`, `debug/`, empty `config.json`)**
  - Clean up untracked/legacy one-off scripts in `tmp/`, empty `scratch/`, root `config.json` (0 bytes), and add `debug/` to `.gitignore`.

### 2.3 API Security & Persistence Synchronization
- [ ] **[SEC-01] Sanitize `sessionId` Against Path Traversal (`src/app/persistence/fs-profile-repository.ts`)**
  - Enforce UUID/alphanumeric regex validation on `sessionId` before constructing `path.join(PROFILES_DIR, `${sessionId}.json`)`.
- [ ] **[SEC-02] Add Zod Request Validation to Remaining API Routes (`src/app/api/`)**
  - Add strict Zod schemas to vault routes (`sell`, `discard`, `move-to-vault`, `equip-from-vault`, `overflow`), `run-mode` routes, and `admin` routes.
- [ ] **[SEC-03] Gate `/api/admin/*` and `/api/debug/*` Routes by Environment**
  - Restrict `/api/admin/*` and `/api/debug/log` when `process.env.NODE_ENV === 'production'`.
- [ ] **[SEC-04] Align Seed Rotation with UTC Leaderboard Period IDs (`src/app/persistence/seed-rotation.ts`)**
  - Switch `seed-rotation.ts` from elapsed-time (`now - lastDailyUpdate >= ONE_DAY`) to UTC calendar day/week boundaries matching `leaderboard-service.ts`.

---

## Workstream 3: Test Coverage & Quality Gates

- [ ] **[TEST-01] Authoritative Game Systems Unit Tests (`src/game/systems/__tests__/`)**
  - Add dedicated unit tests for currently untested authoritative systems:
    - `floor-manager.test.ts` (floor descent, entity purging, player/equipment preservation)
    - `gravedigger.test.ts` (grid removal + `world.destroyEntity` lifecycle)
    - `stability.test.ts` (floor chunk drain, per-turn bleed, collapse trigger)
    - `dead-zone.test.ts` (hazard DoT `DamageIntent`, turn countdown, expiration)
    - `tile-corruption.test.ts` (BFS ring corruption, entity displacement, sub-process spawns)
    - `pack-coordinator.test.ts` (surround targeting, 3+ member detonation)
    - `anchor-interaction.test.ts` (`ExtractionIntent` and `DescentIntent` processing)
- [ ] **[TEST-02] API Route & Persistence Test Suite (`tests/api/`, `src/app/persistence/__tests__/`)**
  - Add tests for `/api/economy/purchase`, `/api/economy/uninstall`, `/api/vault/sell`, `/api/vault/discard`, `/api/vault/overflow`, `/api/profile`, `/api/shells`, and `seed-rotation.ts`.
  - Expand `src/app/api/action/__tests__/action.test.ts` to cover `USE_FIRMWARE`, `VENT`, `STAIRCASE_DESCEND`, `ANCHOR_DESCEND`, `ANCHOR_EXTRACT`, `EQUIP`, `UNEQUIP`, and `BURN_SOFTWARE`.
- [ ] **[TEST-03] Shared Utilities & Pipeline Consolidation (`src/shared/__tests__/`)**
  - Consolidate duplicate `src/shared/pipeline.test.ts` and `src/shared/__tests__/pipeline.test.ts`.
  - Add unit tests for `src/shared/utils/economy-util.ts`, `src/shared/utils/inventory-util.ts`, and `src/server/session/session-manager.ts`.
- [ ] **[TEST-04] Configure Vitest Coverage Gate (`vitest.config.ts`)**
  - Add `@vitest/coverage-v8` and configure coverage reporting/thresholds for `@engine`, `@shared`, and `@server`.
