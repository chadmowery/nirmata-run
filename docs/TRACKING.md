# Nirmata Runner — Project Tracking & Future Work

> **Last Updated:** 2026-11-05  
> **Baseline State:** v2.7 (Interactive Environments Arc Complete: ENV-01–ENV-05 + C1–C8 + M1–M14 + U1–U12 + R1–R4 + A1 Verification)

---

## Completed Foundation Summary
- [x] **Client, Server & Dev Tool Application Decoupling**: Complete architectural separation of `@client` (9 prediction systems, 0 procgen, 0 templates, dynamic dev tools), `@server` (23-phase loop, authoritative procgen, session locks, client state redaction), and `@dev-tool` (Gamedata Studio, AST editors, DevTerminal, Next.js 16 route proxy 404 in production). Enforced by `eslint-plugin-import-x` boundary zones and documented via progressive disclosure `AGENTS.md` hierarchy. See [`APPLICATION_SEPARATION_SPEC.md`](./architecture/APPLICATION_SEPARATION_SPEC.md).
- [x] **Core ECS & Turn Engine (`@engine`)**: Zero-dependency ECS `World`, spatial `Grid`, queued `EventBus`, `StateMachine`, BSP/FloodFill generation, and adapter-driven `TurnManager` (`GameTurnAdapter`).
- [x] **Phase-Driven Intent & Death Protocols**: Systems communicate via Intent/Tag components across 6 deterministic phases (`PRE_TURN`, `GATHER_INTENT`, `ACTION`, `REACTION`, `CLEANUP`, `POST_TURN`); `GravediggerSystem` exclusively handles `world.destroyEntity()`.
- [x] **Client Prediction & Delta Replication**: Client runs prediction-only systems (`isClient: true`) with a 2-slot FIFO input buffer; server executes full turn cycles and returns component-level deltas (`createECSWorldDelta`) with `EventOriginContext` deduplication and `EntitySpriteMap` reconciliation.
- [x] **Core Extraction Loop & Hub UI**: 3 Shells (`VANGUARD-v1`, `BASTION-v1`, `GHOST-v1`), Neural Heat & Kernel Panic, 6 enemies across 3 tiers, 15-floor progression with Staircases and Stability Anchors (Floors 5/10/15), Neural Deck Hub (Shell, Loadout, Workshop, Vault, Initialize), in-run drag-and-drop inventory & tooltips, and `/dev/gamedata` authoring studio.
- [x] **Interactive Environments & Hybrid ProcGen**: Bespoke prefab stamping (`server-core`, `freight-bay`, `decon-airlock`, `zero-day-vault`) alongside BSP procedural rooms; 13 interactive prop fixtures (containers, cover, hazards, terminals); directional cover system; volatile destruction cascades (cryo-vats, capacitor banks); two-tier bump safeguards; anti-cheat server-side loot redaction; dynamic corporate forensics audio lore; tactical zoom & hover inspector. All milestones and adversarial remediation items (ENV-01–ENV-05, C1–C8, M1–M14, U1–U12, R1–R4, A1) are complete and fully verified.

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
- [x] **[ARCH-07] Resolve Adversarial Review C6 Architecture Violations (`docs/reports/2026-11-02-adversarial-review-interactive-environments.md`)**
  - **StabilitySystem**: Replaced `eventBus.on('ENTITY_DIED')` with `Phase.REACTION` query on `(Dying, Hostile)`, eliminating out-of-phase execution, unsafe casts, and the destructible prop stability farm.
  - **Damage Pipeline**: Routed volatile prop destruction and cascade damage through `DamageIntent` (`damageType: 'environmental'`) in a bounded fixed-point loop (`MAX_CASCADE_DEPTH = 10`) inside `CombatSystem`, assigning canonical death condemnation (`reason: 'environmental_destruction'`).
  - **Engine Purity**: Removed `'ABORT_RUN'` string from `TurnManager` via `TurnSchedulerAdapter.allowsInactiveActorAction` hook; extracted React duplicate-key console interceptor out of `@engine/utils/logger.ts` into `src/game/diagnostics/react-key-interceptor.ts`.
  - **Acoustic Alerts**: Replaced direct hostile `AIState`/`FovAwareness` patching in `triggerAcousticAlert` with `AlertIntent` consumed by `AISystem` in `Phase.GATHER_INTENT`.
  - **Prediction Boundary & System Decoupling**: Decoupled `access-key-util.ts` from `prop-interaction.ts`; parameterized `MovementSystem` with `isClient` to halt prediction on props without attaching server-only `InteractPropIntent` or emitting duplicate warnings.
  - **API Route Consolidation**: Consolidated player action handling into canonical `processAction` in `src/game/pipeline/action-pipeline.ts`, deleting 300+ lines of duplicate inline business logic from `src/app/api/action/route.ts`.
  - **Architecture Documentation**: Updated `DEATH_PROTOCOL.md`, `ENGINE_GUIDELINES.md`, and `SYSTEM_OVERVIEW.md`.
- [x] **[ARCH-08] Resolve Adversarial Review C1–C3 Critical Findings (`docs/reports/2026-11-02-adversarial-review-interactive-environments.md`)**
  - **C1: Bespoke Prefab Generation & Connectivity Invariant**: Authored perimeter portals in all sealed prefabs, preserved entrance portals and doors in `dungeon-generator.ts`, implemented attempt-local room rollback, and added pure BSP fallback on attempt exhaustion. Verified with a 750-floor sweep test (15 depths × 50 seeds, 0 throws, 100% connected).
  - **C2: Gated Content & Key Reachability**: Lowered `CONTAINER_RARE` room area threshold to 48, spawned `prop-safe-locked` on floors ≥ 6, spawned `prop-vault-door` in `zero-day-vault`, strictly scoped Faraday bounds to their own vault boundaries, and enforced multi-key reachability guarantee outside vaults. Verified with an F6–F15 integration sweep test.
  - **C3: Client Payload Anti-Cheat Loot Redaction**: Implemented `redactWorldForClient` and `redactDeltaForClient` in `serialization.ts` and `ecs-delta.ts`, stripping `storedLoot`, `scrapYield`, `fluxYield`, `grantsAccessKey`, and `blueprintId` from containers, and unrevealed `trapType` from corrupted nodes across all client `FULL` and `DELTA` sync responses while preserving server-side world state. Verified with unit and integration tests.
- [x] **[ARCH-09] Resolve Adversarial Review C4–C5 Critical Findings (`docs/reports/2026-11-02-adversarial-review-interactive-environments.md`)**
  - **C4: Server-Side Range & Target Validation for Pickup, Drop, and Consumables**: Defined `DropItemIntent`, moved drop state mutations out of the route/pipeline into `ItemPickupSystem` (`Phase.REACTION`), enforced server-side adjacency (Manhattan $\le 1$), bounds, walkability, inventory ownership, item existence, item-like validation, non-condemnation checks, and player-only consumable targeting. Eliminated silent desync fallback in item pickup. Verified with 14 unit tests in `tests/game/c4-validation.test.ts`.
  - **C5: Two-Tier Bump Safeguard with 0-Turn Cost & Input Queue Flush**: Added decoupled `wasActionAborted`, `refundActionCost`, and `clearActionAborted` hooks to `TurnSchedulerAdapter` and `GameTurnAdapter`; updated `TurnManager` to refund deducted action cost, flush events, reset to `TurnPhase.AWAIT_INPUT`, and skip enemy turns/turn increments when an action is aborted; tagged aborted moves on armed corrupted nodes or locked props with `ActionAbortedTag`; wired `INPUT_BUFFER_CLEARED` event to `inputManager.clearQueue()`. Verified with engine and game integration tests in `src/engine/turn/turn-manager.test.ts` and `tests/game/c5-bump-safeguard.test.ts`.
- [x] **[ARCH-10] Resolve Adversarial Review C7–C8 Critical Findings (`docs/reports/2026-11-02-adversarial-review-interactive-environments.md`)**
  - **C7: Stability Threat Purge Exploit, Regeneration Math & HealIntent Stacking**: Filtered threat purge in `Phase.REACTION` strictly to entities with `(Dying, Hostile)` where `killerId` is the player, preventing crates, vats, and traps from restoring stability; aligned health potion regeneration math with specification (`magnitude: 2`, +2 HP per turn); implemented `addHealIntent` helper across all systems and pipeline handlers, additively stacking multiple heals in the same turn; registered `HealSystem` in both `Phase.PRE_TURN` and `Phase.REACTION` so regeneration and on-kill/reaction heals resolve independently; updated `STABILITY-ANCHOR-SYSTEM.md` with official stability drain formulas and threat purge specification. Verified with 5 unit tests in `tests/game/c7-stability-heal.test.ts`.
  - **C8: Shell Port Capacity Enforcement & Invariant Burning Pipeline**: Relaxed Zod schema bounds in `src/shared/types.ts` (`slotIndex: z.number().int().min(0).max(10)`) to support upgraded shells; dynamically validated port capacity against `PortConfig` (`maxFirmware`, `maxAugment`) in `action-pipeline.ts`; enforced inventory item ownership and component definitions (`AbilityDef`, `AugmentData`) before removing items from inventory, preserving inventory when capacity or validation fails; eliminated pushing `0` placeholder entity IDs so slots append contiguously or overwrite existing slots; condemned overwritten abilities/modules with `Dying` (`reason: 'overwritten'`); updated `BackpackGrid.tsx` to dynamically query shell `PortConfig` and `AugmentSlots` when offering burn and overwrite actions. Verified with 10 unit tests in `tests/game/c8-port-capacity.test.ts`.
- [x] **[ARCH-11] C1–C8 Follow-Up Adversarial Audit & Production Hardening (`docs/reports/2026-11-03-adversarial-review-c1-c8-remediation.md`)**
  - **C1/C2 Hardening**: Preserved `#` walls inside prefab footprints, carved a 1-tile perimeter moat around prefabs, sealed isolated target-room floor pockets, attached `faradayBounds` and `SecurityLock` strictly to `prop-vault-door` (1-key vault unlock), excluded `CorruptedNode` containers from `Access_Key` placement, placed staircases/anchors on verified safe room tiles, and enforced `wouldPinchWalkability` on procedural props (750/750 floors pass all invariants).
  - **C3/C4/C8 Hardening**: Redacted `FloorState.runSeed` on client worlds, rejected `PICKUP` of already-owned/equipped items, required grid verification when `Position` is absent, preserved consumable stack quantities on `DROP_ITEM`, and reconciled server `DELTA` payloads on consumable use in `BackpackGrid.tsx`.
  - **C5/C6/C7 Production Lifecycle Fixes**: Removed premature `ActionAbortedTag` and `AlertIntent` deletion from `TagCleanupSystem`, rolled back `Phase.PRE_TURN` state snapshots when an action is aborted at 0 turn cost, restricted 0-cost `CorruptedNode` bump safeguards to `revealed === true`, added `CHASING` fallback movement to specialist AI routines, gated `/api/action` `processAction()` behind `turnManager.canAcceptInput()`, wired `[E]` (`KeyE`) to adjacent prop interactions, and moved `HealSystem` registration after `ItemPickupSystem` and `StatusEffectSystem` with a `Dying` entity guard.
- [x] **[ARCH-12] Phase 2 Rendering & UI Remediation — U1–U4 (`docs/reports/2026-11-02-adversarial-review-interactive-environments.md`)**
  - **U1: Trap Reveal Gating & Remembered Fog-of-War State (`src/rendering/render-system.ts`, `src/rendering/tile-inspector.ts`)**: Gated `'corrupted'` prop outlines and `CORRUPTED NODE` inspector badges on `corrupted.revealed && !corrupted.isDisarmed && !corrupted.triggered`; snapshotted client-remembered prop and ground item state (`rememberedProps`, `rememberedTileItems`) on active FOV tiles so explored-but-unseen tiles never leak out-of-sight state changes; kept `/show-map` (`isMapRevealed`) scoped to `isExplored` so unseen enemy HP/statuses are not leaked. Verified in `src/rendering/__tests__/tile-inspector.test.ts`.
  - **U2: Overclock Bypass, Forced Interaction & Dead-Drop Uplink UI + Persistence (`src/game/setup.ts`, `src/components/ui/inventory/DeadDropModal.tsx`, `src/game/systems/prop-interaction.ts`, `src/app/api/action/route.ts`)**: Prioritized active Stability Anchors on `[E]` (`GameAction.INTERACT_ANCHOR`) and Staircases on `[Shift + .]`; wired `[E]` on adjacent props to send `INTERACT_PROP` (`forceOverride: true`) or open `DeadDropModal` for `dead_drop_uplink`; wired `PROP_INTERACTED` (`outcome: 'ready'`) in `sync-bridge.ts` to open `DeadDropModal` on bump; included `vaultItem` and `blueprintType` in `DEAD_DROP_TRANSMITTED` and persisted transmitted items/blueprints to `profile.vault`/`profile.overflow`/`profile.blueprintLibrary` in `/api/action`. Verified in `tests/game/u2-prop-interact-dead-drop.test.ts`.
  - **U3: Unified Client Action Pipeline & Per-Session Server Serialization (`src/game/setup.ts`, `src/components/ui/inventory/BackpackGrid.tsx`, `src/components/ui/inventory/GroundTransferModal.tsx`, `src/server/session/session-manager.ts`, `src/app/api/action/route.ts`)**: Exposed canonical `submitAction` and `resolveActiveSessionId` on `GameContext`, routing all UI/modal actions (`USE_CONSUMABLE`, `PICKUP`, `DROP_ITEM`, `DEAD_DROP_ITEM`) through `inputManager.setRequestPending`, `applyStateDelta`, and `MESSAGE_EMITTED` error reporting; removed direct `ctx.grid.removeItem` mutations from React handlers; added per-session lock (`tryAcquireSessionLock`/`releaseSessionLock`) in `SessionManager` and `/api/action` rejecting overlapping requests with HTTP 409. Verified in `tests/game/u3-action-serialization.test.ts`.
  - **U4: Consumable Drop / Re-Pickup Fidelity (`src/game/systems/item-pickup.ts`)**: Dropped consumable units (split from a stack or last unit) are re-materialised with `Item`, `PickupEffect`, `TemplateId`, `Position` and the `item_potion` atlas sprite, so re-picking them restores the stack instead of condemning the item with `Dying`; inventory-storing pickups no longer strip `SpriteComponent`. Verified in `tests/game/u4-consumable-drop-pickup.test.ts`.
- [x] **[ARCH-13] Phase 2 Rendering, UI & Design System Remediation — U5, R1–R4, U6–U12 (`docs/reports/2026-11-02-adversarial-review-interactive-environments.md`)**
  - **U5: Stable Vault Item ID Minting & Collision Elimination (`src/shared/profile.ts`, `src/game/systems/vault-manager.ts`, `src/app/api/vault/`)**: Minted unique UUID v4 `vaultItemId` at extraction and route levels; updated schemas with transparent fallback generation for legacy records; migrated vault endpoints (`equip-from-vault`, `sell`, `discard`, `socket-software`) and UI components (`VaultGrid`, `VaultTab`, `LoadoutTab`, `VaultOverflowBanner`, `StashItemList`) to key strictly by `vaultItemId`; deprecated React duplicate key console interceptor. Verified in `tests/game/u5-vault-collision.test.ts`.
  - **R1: Tile Hover Inspection Throttling & Spatial Lookups (`src/rendering/tile-inspector.ts`, `src/rendering/render-system.ts`, `src/game/ui/store.ts`, `src/components/ui/TacticalInspectTooltip.tsx`)**: Replaced full ECS scans with O(1) spatial lookups (`grid.getEntitiesAt`, `grid.getItemsAt`); added deep equality checking to Zustand `setHoveredEntity` store setter; throttled ticker hover recomputations; dropped hostile `aria-live="polite"` from hover tooltip; suppressed tooltip rendering when hovering HUD elements over the canvas. Verified in `tests/rendering/r1-r4-render-controls.test.ts`.
  - **R2: Persistent Prop Dimming, Dynamic Outline Sync & Filter Composition (`src/rendering/render-system.ts`)**: Fixed searched dimming (`alpha * 0.6`) to persist across both FOV and fog passes; recomputed active prop outline states every frame against live component state (`resolvePropOutlineState`); preserved non-prop shaders and tracked filters via `WeakMap<Sprite, Filter[]>` with explicit `.destroy()` to prevent WebGL leaks. Verified in `tests/rendering/r1-r4-render-controls.test.ts`.
  - **R3: Camera Pan Gating & Mouse Wheel Optical Zoom (`src/rendering/render-system.ts`)**: Restricted pointer drag panning strictly to middle-click (`button === 1`) and right-click (`button === 2`), freeing left-click for canvas interactions; implemented tactical optical zoom in `handleWheel` clamped strictly between 0.75x and 1.5x with accurate hover coordinate transformations; wired camera pan and zoom reset to 'C' (`RECENTER_CAMERA`) and floor transitions. Verified in `tests/rendering/r1-r4-render-controls.test.ts`.
  - **R4: Global Context Leak Elimination & UI Decoupling (`src/app/page.tsx`, `src/game/active-context.ts`)**: Eliminated unconditional `window.gameContext` assignment in production builds; implemented `setActiveGameContext`/`getActiveGameContext` singleton; migrated all client modals, sidebars, panels, and tooltips to access context through the safe accessor. Verified in `tests/rendering/r1-r4-render-controls.test.ts`.
  - **U6: GroundTransferModal Dynamic Metadata, Stacking & Focus Trap (`src/components/ui/inventory/GroundTransferModal.tsx`)**: Replaced hardcoded `"Nanite Canister"` labels with dynamic item metadata resolution (`Item`, `resolveItemMetadata`); allowed picking up ground consumables into a full backpack if stackable into an existing slot (`quantity < 10`); added focus trap and initial focus; routed actions through `submitAction()`. Verified in `src/components/ui/inventory/__tests__/GroundTransferModal.test.tsx`.
  - **U7: Dynamic Backpack Slots, Capacity Unification & Port-Aware Burning (`src/components/ui/inventory/BackpackGrid.tsx`, `src/shared/components/run-inventory.ts`, `src/shared/utils/inventory-util.ts`)**: Replaced hardcoded 15-slot array with dynamic `Array(inv?.maxSlots ?? 30)`, rendering all 30 slots; unified default backpack capacity to 30; dynamically resolved shell `FirmwareSlots` and `AugmentSlots` for overwrite buttons and explicit port-aware slot indices. Verified in `src/components/ui/inventory/__tests__/BackpackGrid.test.tsx`.
  - **U8: Hotkey Manual Alignment & Destructive Confirmation Safety (`src/components/ui/HotkeysModal.tsx`, `src/components/ui/inventory/BackpackGrid.tsx`)**: Aligned hotkey manual descriptions with engine behavior (bump halting on armed traps with warnings, dev build terminal gating, `[E]` multi-target interactions, `v1.0.0` version); increased destructive firmware/augment burn confirmation hold duration to 1500 ms (1.5s). Verified in `src/components/ui/__tests__/HotkeysModal.test.tsx`.
  - **U9: Authoritative Abort Mission Execution (`src/components/ui/AbortMissionDialog.tsx`)**: Removed client-side fabricated `runResultsData` calculations and fake BSOD overrides; routed mission abort directly through authoritative pipeline `submitAction({ type: 'ABORT_RUN' })`. Verified in `src/components/ui/__tests__/AbortMissionDialog.test.tsx`.
  - **U10: Shared Shell Upgrade Math & Level Heuristic Elimination (`src/shared/utils/shell-upgrade-util.ts`, `src/game/shells/server/shell-registry.ts`, `src/components/ui/hub/`)**: Created `@shared/utils/shell-upgrade-util.ts` exporting canonical shell stat and port calculation formulas; refactored server `applyShellUpgradesToRecord` to remove the `> 5` heuristic; updated `ShellStatCard.tsx` and `LoadoutTab.tsx` to display expanded software port counts. Verified in `tests/shared/shell-upgrade-util.test.ts`.
  - **U11: Design System Token Restorations, Nanites & Canonical Z-Index (`src/app/globals.css`, UI CSS modules, UI components)**: Swapped inverted `--c-accent` (Acid Chartreuse `#d8ff00`) and `--c-accent-secondary` (Solaris Cyan `#00f0ff`) tokens across HUD, inventory, tooltips, and hub; defined `--c-nanites: #10b981;` and canonical z-index scale (`--z-hud` to `--z-bsod`) in `globals.css`; added `@media (prefers-reduced-motion: reduce)` rules and `:focus-visible` button outlines.
  - **U12: Tactical Tooltip Hints & Dynamic Corporate Faction Lore (`src/rendering/tile-inspector.ts`)**: Corrected interaction hints to reflect bump safeguards halting on armed traps (`[E]` forces bypass) and locked props (`[E]` overclocks); implemented dynamic corporate faction attribution via `resolvePropLore` across all fixtures; removed unspawned Faraday claims for standard vault doors. Verified in `tests/rendering/u12-tooltip-lore.test.ts`.
  - **A1: Tileset, Sprites, Preview Artifacts & Scripts (`public/assets/`, `scripts/`, `src/game/systems/prop-interaction.ts`, `src/rendering/render-system.ts`, `docs/TILEMAP_GUIDE.md`)**: Fixed `item-access-key.json` sprite key to `"item_access_key"`; reconciled prop state transitions in `prop-interaction.ts` (locked vs unlocked for vault doors, safes, lockers; ready vs searched for cooling vents, reality stabilizers, dead-drop uplinks, biocabinets, workstations) and wired live texture updates in `render-system.ts`; removed 44 dev inspection sheets (~750 KB) from `public/assets/tiles/previews/` into `docs/visual-design/previews/`; protected tileset tests against missing native canvas dependencies; added `"build:tiles"` script to `package.json` and documented the two-step build process in `docs/TILEMAP_GUIDE.md`; clarified canonical 32×32 px specification. Verified in `tests/game/a1-assets-prop-states.test.ts`.

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

---

## Workstream 4: UI/UX Modernization & Taikoku Vector Manifest Overhaul

- [x] **[UI-01] Design Tokens, Typography & Atomic Component Foundation**
  - Integrated Google Fonts (`Space Grotesk`, `Noto Sans JP`, `JetBrains Mono`, `Share Tech Mono`) in [`src/app/layout.tsx`](../src/app/layout.tsx).
  - Replaced legacy matrix-green tokens in [`src/app/globals.css`](../src/app/globals.css) with canonical `--c-*` tokens and 7 atomic primitives (`.taikoku-placard`, `.taikoku-stamp`, `.panel-card`, `.btn-lever`, `.dotted-spec-row`, `.socket-row`, `.corner-mark`).
  - Created reusable atomic components in [`src/components/ui/atomic/`](../src/components/ui/atomic/).
- [x] **[UI-02] Gateway, Transitions & End-of-Run Screens (Paradigm A)**
  - Refactored [`MainMenu.tsx`](../src/components/ui/MainMenu.tsx) with 3-column construct, rotating wireframe diamond/hexagon canvas, and barcode ladder.
  - Modernized [`BootSequence.tsx`](../src/components/ui/hub/BootSequence.tsx) into centered terminal construct with skip lever.
  - Implemented high-contrast cyan crash construct in [`BSODScreen.tsx`](../src/components/ui/BSODScreen.tsx).
  - Overhauled [`RunResultsScreen.tsx`](../src/components/ui/RunResultsScreen.tsx) with Swiss-Japanese constructivist Bill of Lading layout.
- [x] **[UI-03] Neural Deck Hub Suite Overhaul (Paradigm B)**
  - Added 6th tab `LEADERBOARDS [順位]` to [`HubTab`](../src/game/ui/store.ts) and upgraded [`TabBar.tsx`](../src/components/ui/hub/TabBar.tsx) and [`HubLayout.tsx`](../src/components/ui/hub/HubLayout.tsx) with dynamic placards and wallet chips.
  - Converted [`ShellTab.tsx`](../src/components/ui/hub/ShellTab.tsx) to 3-column workstation with 3D rotating polyhedral vector wireframe canvas and integrated `ShellUpgradePanel`.
  - Rebuilt [`LoadoutTab.tsx`](../src/components/ui/hub/LoadoutTab.tsx), [`WorkshopTab.tsx`](../src/components/ui/hub/WorkshopTab.tsx), [`VaultTab.tsx`](../src/components/ui/hub/VaultTab.tsx), [`InitializeTab.tsx`](../src/components/ui/hub/InitializeTab.tsx), and [`LeaderboardPanel.tsx`](../src/components/ui/hub/LeaderboardPanel.tsx).
- [x] **[UI-04] In-Game Tactical HUD Workstation (Paradigm B)**
  - Redesigned [`HUDOverlay.tsx`](../src/components/ui/HUDOverlay.tsx) as a 3-row × 3-column `.hud-construct` framing the PixiJS canvas bay.
  - Aligned [`PlayerHUD.tsx`](../src/components/ui/PlayerHUD.tsx), [`NearbyEntities.tsx`](../src/components/ui/NearbyEntities.tsx), [`MessageLog.tsx`](../src/components/ui/MessageLog.tsx), and [`AbilityBar.tsx`](../src/components/ui/AbilityBar.tsx) with Taikoku Vector styling while maintaining 100% test compatibility.
- [x] **[UI-05] Tactical & Ritual Modals (Paradigm C)**
  - Upgraded [`RitualOverlay.tsx`](../src/components/ui/hub/RitualOverlay.tsx), [`InventoryOverlay.tsx`](../src/components/ui/inventory/InventoryOverlay.tsx), [`AnchorOverlay.tsx`](../src/components/ui/AnchorOverlay.tsx), and [`StaircaseOverlay.tsx`](../src/components/ui/StaircaseOverlay.tsx) with centered backdrop framing and mechanical levers.
- [x] **[UI-06] Interactive Levers, Hologram Viewer & Hold-To-Confirm Progression**
  - Implemented 2-second hold-to-confirm progress bar fill with dynamic linear gradient in [`BtnLever.tsx`](../src/components/ui/atomic/BtnLever.tsx) and `.btn-lever.holding` for consequence-heavy operations (install, purchase, currency conversion, software burn).
  - Added double-click fast equip/inventory placement in [`LoadoutTab.tsx`](../src/components/ui/hub/LoadoutTab.tsx).
  - Built interactive 1px vector wireframe hologram shell card dock with azimuth/elevation rotation in [`ShellTab.tsx`](../src/components/ui/hub/ShellTab.tsx).
  - Implemented Scrap-to-Flux compression button wired to `/api/economy/compress`.
  - Added dynamic overflow scrollbars across all lists (`StashItemList`, `SoftwareShop`, `BlueprintPanel`).
  - Added multi-criteria item sorting (rarity, type, value) and colorized item icons with 2-letter abbreviation badges ([`ItemIcon.tsx`](../src/components/ui/atomic/ItemIcon.tsx)).
- [x] **[UI-07] Mission Abort Dialog, Tactical Inventory Telemetry Sidebar & Viewport Bounds Tooltip Clamping**
  - Added ESC key mission abort modal dialog ([`AbortMissionDialog.tsx`](../src/components/ui/AbortMissionDialog.tsx)) handling `ABORT_RUN` action, triggering BSOD and autopsy sequence.
  - Implemented in-run tactical inventory telemetry sidebar ([`ChassisTelemetrySidebar.tsx`](../src/components/ui/inventory/ChassisTelemetrySidebar.tsx)) displaying current shell archetype, subsystem metrics (Speed, Armor, Health, Stability, Heat), active firmware abilities, and operational states with interactive tooltips.
  - Implemented screen bounds collision detection and dynamic clamping for all tooltips ([`ItemTooltip.tsx`](../src/components/ui/hub/ItemTooltip.tsx), [`InRunItemTooltip.tsx`](../src/components/ui/inventory/InRunItemTooltip.tsx)), preventing viewport cutoffs across all screen dimensions.

---

## Workstream 5: Interactive Environments & Hybrid ProcGen System

- [x] **[ENV-01] ECS Zod Components, Augment Triggers & Scoring Schemas (Milestone 1)**
  - Defined canonical environment components in [`src/shared/components/environment.ts`](../src/shared/components/environment.ts): `Prop`, `SecurityLock`, `Container` (with `highestRarity` client masking), `InteractiveSurface`, `CorruptedNode`, `InteractPropIntent`, and `PropInteractedThisTurn`.
  - Registered all new components in [`COMPONENTS_REGISTRY`](../src/shared/components/index.ts).
  - Extended [`FloorState`](../src/shared/components/floor-state.ts) with `sectorCondition`, `accessKeysHeld`, `vaultsBreached`, and `trapsDisarmed`.
  - Extended [`ConditionNodeSchema`](../src/shared/components/augment-data.ts) with `ON_HACK` and `ON_COVER_BROKEN` trigger types.
  - Added environmental scoring factors (`vaultsBreached: 150`, `trapsDisarmed: 50`) to [`economy.json`](../src/game/entities/templates/economy.json), [`economy-types.ts`](../src/shared/economy-types.ts), and [`scoring.ts`](../src/game/scoring.ts).
  - Added `InteractPropActionSchema` to [`src/shared/types.ts`](../src/shared/types.ts) and environmental gameplay events to [`src/shared/events/types.ts`](../src/shared/events/types.ts).
  - Unit tested schemas and serialization in `src/shared/components/__tests__/environment.test.ts` and `src/game/scoring.test.ts`.
- [x] **[ENV-02] Hybrid ProcGen, Sector Conditions, Faraday Vaults & Dynamic Anchor Tagging (Milestone 2)**
  - Authored room prefabs in [`src/game/generation/prefabs/`](../src/game/generation/prefabs/): `server-core.json`, `freight-bay.json`, `decon-airlock.json`, and `zero-day-vault.json`.
  - Created and registered 13 entity templates in [`src/game/entities/`](../src/game/entities/): workstations, lockers, biocabinets, safes, vault doors, cooling vents, dead drops, reality stabilizers, subnet consoles, crates, cryo-vats, capacitor banks, and access keys.
  - Updated [`dungeon-generator.ts`](../src/game/generation/dungeon-generator.ts) to stamp bespoke prefabs, assign faction themes, roll sector conditions (guaranteed on floors 6, 10, 15; 25% on other F6-15), and classify procedural anchors (`PROP_DESK_CORNER`, `PROP_LOCKER_WALL`, `SURFACE_TABLE_TOP`, `CONTAINER_RARE`).
  - Updated [`entity-placement.ts`](../src/game/generation/entity-placement.ts) with depth-scaled prop budgets (~40% scavenge, ~40% tactical/cover, ~20% hazards), deterministic container loot with client masking (`highestRarity` exposed; contents materialized on search), and guaranteed access key drops when locks exist.
  - Verified with 10 unit tests in `src/game/generation/__tests__/hybrid-procgen.test.ts`.
- [x] **[ENV-03] Bump-to-Loot Safeguards, `PropInteractionSystem`, Dead-Drop & Forensics Logs (Milestone 3)**
  - Implemented [`src/game/systems/prop-interaction.ts`](../src/game/systems/prop-interaction.ts) handling container searches, currency/loot materialization, key consumption, +35 Heat Overclock bypass, 12-tile acoustic alerts waking enemies into chasing state, corporate forensics audio logs per faction, dead-drop profile transmission, reality stabilizers (+10% stability), cooling vents (-40 heat), and subnet consoles.
  - Implemented Two-Tier Bump Safeguard in [`MovementSystem`](../src/game/systems/movement.ts): clean props auto-interact seamlessly; armed Corrupted Nodes or Overclock risks halt movement with 0 turn cost, emit warning, and flush input buffer.
  - Implemented Faraday shield teleport blocking in [`TeleportSystem`](../src/game/systems/teleport.ts).
  - Wired cleanup for `InteractPropIntent` and `PropInteractedThisTurn` into [`tag-cleanup.ts`](../src/game/systems/tag-cleanup.ts).
  - Verified with 12 unit tests in `src/game/systems/__tests__/prop-interaction.test.ts`.
- [x] **[ENV-04] Directional Cover, Volatile Cascade Reactions, Environmental Augments & Traps (Milestone 4)**
  - Implemented directional cover checks in [`CombatSystem`](../src/game/systems/combat.ts): orthogonal cover intervening between ranged attacker and defender reduces damage by 25% (35% for `BASTION-v1` Shell).
  - Implemented volatile destruction and cascade reactions in `CombatSystem`: Cryo-Vats spawn 3×3 chemical spills (4 damage + `MOVEMENT_SLOW`); Capacitor Banks discharge 2-tile Manhattan EMP shockwaves (10 damage + `DISRUPT`); volatile destruction cascades 15 structural damage within distance 2 without recursion.
  - Wired `ON_HACK` and `ON_COVER_BROKEN` trigger evaluation into [`augment-util.ts`](../src/game/systems/augment-util.ts).
  - Authored environmental augment templates: `scavenger-siphon.json`, `kinetic-breacher.json`, and `thermal-bypass.json`.
  - Implemented firmware counterplay in [`firmware.ts`](../src/game/systems/firmware.ts): `LOGIC_JAM.exe` disarms Corrupted Nodes (+50 score, triggers `ON_HACK`); `Extended_Sight.sys` / `GHOST_PULSE.exe` reveals hidden Corrupted Nodes.
  - Verified with 12 unit tests in `src/game/systems/__tests__/cover-and-hazards.test.ts`.
- [x] **[ENV-05] Atlas Sprites, PixiJS Shader States & Container Modal Overlay (Milestone 5)**
  - Updated [`public/assets/tileset.json`](../public/assets/tileset.json) with 16 prop and augment frame mappings.
  - Implemented `applyPropOutline` in [`src/rendering/filters/glitch-effects.ts`](../src/rendering/filters/glitch-effects.ts) with Cyan (#00F0FF) for safe props, Orange (#FF9500) for locked barriers, Pink (#FF0055) with glitch jitter for corrupted nodes, and dimmed alpha for searched props.
  - Wired prop outline updates into [`src/rendering/render-system.ts`](../src/rendering/render-system.ts) on entity creation and `PROP_INTERACTED` / `LOCK_UNLOCKED` events.
  - Built [`src/components/ui/inventory/ContainerOverlay.tsx`](../src/components/ui/inventory/ContainerOverlay.tsx) and [`ContainerOverlay.module.css`](../src/components/ui/inventory/ContainerOverlay.module.css) for 2-column container vs. backpack item swapping with ESC keyboard navigation.
  - Verified with 8 unit tests in `tests/rendering/glitch-effects.test.ts` and 6 unit tests in `src/components/ui/inventory/__tests__/ContainerOverlay.test.tsx`.

### 5.1 Adversarial Review Remediation (Phase 2)
- [x] **[P2-U5] Vault Item ID Collision Remediation (`src/shared/profile.ts`, `src/app/api/vault/`)**
  - Minted stable unique `vaultItemId` UUIDs at extraction time (`run-ender.ts`, `action/route.ts`, `prop-interaction.ts`), populated default IDs on legacy profile parse, updated all vault routes (`equip-from-vault`, `sell`, `discard`, `socket-software`) and `vault-manager.ts` to locate and manipulate items by `vaultItemId` instead of run-local `entityId`.
  - Re-keyed Hub UI components (`VaultGrid`, `VaultTab`, `LoadoutTab`, `VaultOverflowBanner`, `StashItemList`) by `item.vaultItemId`, eliminating `idx` key reconciliations.
  - Deprecated React duplicate-key console interceptor in `src/game/diagnostics/react-key-interceptor.ts`. Verified in `tests/game/u5-vault-collision.test.ts`.
- [x] **[P2-R1] Hover Inspection Optimization & UI Isolation (`src/rendering/tile-inspector.ts`, `src/rendering/render-system.ts`, `src/game/ui/store.ts`)**
  - Replaced O(N) full ECS scan in `tile-inspector.ts` with O(1) spatial lookups `grid.getEntitiesAt` and `grid.getItemsAt`.
  - Added deep equality check to `gameStore.setHoveredEntity` to eliminate 60 Hz React re-render thrashing when hovered tile data remains unchanged.
  - Throttled per-frame hover inspection in `renderSystem()` ticker loop to only run when pointer, camera position, zoom, player position, or map revealed states change.
  - Dropped `aria-live="polite"` from `TacticalInspectTooltip.tsx` root to protect screen-reader users, and added `document.elementFromPoint` check against `#ui-root` to suppress tooltips over HUD elements. Verified in `tests/rendering/r1-r4-render-controls.test.ts`.
- [x] **[P2-R2] Prop Outline Freshness & Persistent Searched Dimming (`src/rendering/render-system.ts`, `src/rendering/filters/glitch-effects.ts`)**
  - Fixed visibility loop in `renderSystem()` to persist `alpha * 0.6` for searched props across FOV and fog passes without being overwritten back to 1.0.
  - Updated `applyPropOutline` to track `activePropFilters` via WeakMap, preserve non-prop filters (e.g. temporary damage glitches), and call `destroy()` on replaced filters to eliminate WebGL shader leaks.
  - Added dynamic outline synchronization in `renderSystem()` to immediately update prop outlines when `CorruptedNode` is revealed or disarmed or unlocked without requiring sprite recreation. Verified in `tests/rendering/r1-r4-render-controls.test.ts`.
- [x] **[P2-R3] Camera Input Alignment & Tactical Optical Zoom (`src/rendering/render-system.ts`, `src/rendering/camera.ts`)**
  - Restricted drag panning in `handlePointerDown` strictly to middle-click (`e.button === 1`) and right-click (`e.button === 2`), ignoring left-click (`e.button === 0`).
  - Implemented mouse wheel optical zoom in `handleWheel` clamped strictly between 0.75x and 1.5x with container scaling, updating visible tile ranges and screen-to-world hover coordinate conversion.
  - Recenter camera ('C' key) and `onDungeonGenerated` reset both camera pan offset and optical zoom to 1.0. Verified in `tests/rendering/r1-r4-render-controls.test.ts`.
- [x] **[P2-R4] Game Context Scoping & Non-Development Protection (`src/game/active-context.ts`, `src/app/page.tsx`)**
  - Eliminated unconditional assignment to `window.gameContext` in `src/app/page.tsx`.
  - Implemented decoupled context singleton manager `setActiveGameContext` and `getActiveGameContext` in `src/game/active-context.ts`, scrubbing `window.gameContext` in non-development environments.
  - Migrated UI components to `getActiveGameContext()`. Verified in `tests/rendering/r1-r4-render-controls.test.ts`.
- [x] **[REGRESSION-FIX] In-Game Tactical Tooltip Restoration & HUD Pointer-Events Specificity (`src/rendering/render-system.ts`, `src/app/globals.css`, `src/components/ui/styles.module.css`, `TacticalInspectTooltip.tsx`)**
  - Diagnosed regression where `#ui-root > * { pointer-events: auto }` had higher CSS specificity than `.hudConstruct { pointer-events: none }`, causing the 100vw × 100vh HUD layout container to intercept hit tests across the entire screen and causing `elementFromPoint` in `render-system.ts` to clear `hoveredEntity(null)` on every mouse move.
  - Excluded `.hudConstruct` from `#ui-root > *` in `globals.css` via `:not([class*="hudConstruct"])` and reinforced `.hudConstruct`, `.hudMainGrid`, and `.tacticalViewportBay` with `pointer-events: none !important`.
  - Refined `updateHoverInspection` in `render-system.ts` to distinguish transparent viewport bays framing the canvas from solid interactive HUD controls, sidebars, ribbons, and modals.
  - Initialized `TacticalInspectTooltip` coords to prevent initial (0,0) placement.
  - Added unit test in `tests/rendering/r1-r4-render-controls.test.ts` verifying hover inspection functions over canvas and viewport bays while suppressing over interactive HUD elements. Verified full test suite passes (169/169 files, 1045/1045 tests).

---

## Workstream 4: Directional Tilemaps, Wall Caps & Themed Tileset Architecture

> **Specification**: [`docs/design/DIRECTIONAL-TILEMAPS.md`](./design/DIRECTIONAL-TILEMAPS.md)  
> **Status**: Completed (Branch: `directional-tilemaps`)

- [x] **[DIR-01] Milestone 1: Core Schemas & Orientation Types (`src/shared/components/environment.ts`, `src/shared/tileset-types.ts`)**
  - Implemented `TileOrientation`, `AutotileState`, and `DirectionalProp` Zod components registered in `COMPONENTS_REGISTRY`.
  - Added orientation vector and angle maps (`ORIENTATION_ANGLES`, `ORIENTATION_VECTORS`, `vectorToOrientation`, `orientationToVector`).
  - Defined `ThemedTilesetManifestSchema`, `FrameDefSchema`, and `RectSchema`. Verified with 8 unit tests in `src/shared/components/__tests__/directional-environment.test.ts` and `src/shared/__tests__/tileset-types.test.ts`.
- [x] **[DIR-02] Milestone 2: Autotile & Wall Cap Bitmask Engine (`src/game/generation/autotile-solver.ts`, `src/game/generation/dungeon-generator.ts`)**
  - Implemented 4-bit cardinal bitmask solver (`CARDINAL_AUTOTILE_TABLE`) mapping 16 neighborhood connectivity topologies to directional frames (`wall_straight_h`, `wall_straight_v`, `wall_corner_*`, `wall_t_*`, `wall_cap_*`, `wall_cross`, `wall_single`).
  - Implemented Pass 2 outward-facing wall cap inversion and Pass 3 8-bit diagonal floor corner refinement (`wall_corner_*_inner`).
  - Added door orientation resolver (`resolveDoorTile`) evaluating neighbor wall connectivity (`door_h_closed`, `door_v_closed`, `door_h_open`, `door_v_open`).
  - Stamped `autotiledWalls` map and prop anchor orientations (`PROP_LOCKER_WALL`, `PROP_DESK_CORNER`) during dungeon generation, attaching `TileOrientation` and `DirectionalProp` on all spawned fixtures. Verified with 15 unit tests in `src/game/generation/__tests__/autotile-solver.test.ts` and 750-floor sweep.
- [x] **[DIR-03] Milestone 3: Directional Props, Front-Facing Interaction & Cover Calculus (`src/game/systems/movement.ts`, `src/game/systems/prop-interaction.ts`, `src/game/systems/combat.ts`)**
  - Enforced front-facing interaction requirement for props (`requiresFrontAccess: true`), halting movement at 0 turn cost when bumping orthogonal/rear sides with notice `[NOTICE] <PROP> FRONT INTERFACE IS TO THE <DIRECTION>.`
  - Updated `CombatSystem.checkDirectionalCover` to evaluate threat vector against cover normal: $(P_{\text{attacker}} - P_{\text{target}}) \cdot N_{\text{cover}} > 0$.
  - Authored and registered 18 directional entity templates (`prop-workstation-{n,e,s,w}`, `prop-locker-{n,e,s,w}`, `prop-biocabinet-{n,e,s,w}`, `prop-vault-door-{n,e,s,w}`, `prop-crate-cover-{h,v}`). Verified with 5 unit tests in `src/game/systems/__tests__/directional-prop-cover.test.ts`.
- [x] **[DIR-04] Milestone 4: PixiJS 8 Rendering Layer & Themed Atlas Support (`src/rendering/tilemap.ts`, `src/rendering/sprite-map.ts`, `src/rendering/assets.ts`, `src/rendering/render-system.ts`)**
  - Integrated `resolveTerrainTile` and `AutotileSolver` into `buildTilemap`, setting center pivot `(16, 16)` and rotation angle when falling back to base frames.
  - Implemented `resolveFallbackSpriteKey` and `getTextureForSpriteKey` resolving textures from active themed atlas and falling back to isotropic base frames.
  - Extended `loadThemedAssets` to dynamically register and load theme manifests (`THEME_MANIFEST_MAP`), tracking `activeThemeId`.
  - Updated entity sprite transformations in `render-system.ts` (`applySpriteTransform`) on initial creation, reconciliation, and animation ticks. Verified with 10 unit tests in `tests/rendering/directional-render.test.ts`.
- [x] **[DIR-05] Milestone 5: Gamedata Studio Prefab Editor & Manifest Validation (`src/app/dev/gamedata/editors/PrefabEditor.tsx`, `src/app/api/dev/gamedata/tileset-validator.ts`)**
  - Built interactive `PrefabEditor` in `/dev/gamedata` supporting directional brush tools, 'R' key clockwise rotation cycling (`NORTH -> EAST -> SOUTH -> WEST`), directional arrow overlays (`↑`, `→`, `↓`, `←`), and real-time autotile preview rendering.
  - Implemented `validateTilesetManifest` and `/api/dev/gamedata/tileset-validator.ts` checking manifest dimensions, required wall autotiles, doors, and directional prop coverage against `ThemedTilesetManifestSchema`.
- [x] **[DIR-06] Directional Tileset Master Atlas Compositing & Themed Manifest Integration (`public/assets/`, `scripts/add-directional-tiles.cjs`, `scripts/generate-themed-tilesets.cjs`)**
  - Expanded master atlas from 256×256 to 512×512 (supporting up to 256 32×32 tiles) preserving legacy [0..224, 0..224] coordinates.
  - Composited 42 directional tiles (16 cardinal wall autotiles, 4 inner diagonal corners, 4 directional doors, 18 directional props/crates/vault doors) into `public/assets/tileset.png` and registered in `public/assets/tileset.json`.
  - Updated `scripts/generate-themed-tilesets.cjs` with dynamic dimensions, regenerating all 3 corporate faction atlases (`traxus_foundry`, `sekiguchi_biolabs`, `dark_subnet`) to 512×512.
  - Updated `package.json` `"build:tiles"` script and adjusted atlas dimension assertions in `shell-tileset.test.ts`, `environment-tileset.test.ts`, and `themed-tilesets.test.ts`.
  - Verified full test suite passes (182/182 files, 1115/1115 tests), 0 type errors (`tsc --noEmit`), 0 lint warnings (`eslint src/`), and clean Next.js build (`next build`).

---

## Workstream 5: Gamedata Authoring Studio Overhaul & Deterministic Prefab Generation

> **Specification**: [`docs/design/GAMEDATA-DESIGN-TOOL.md`](./design/GAMEDATA-DESIGN-TOOL.md)  
> **Status**: Completed (Branch: `gamedata-studio-overhaul`)

- [x] **[GD-01] Phase 1: P0 Bug Fixes & Data Integrity**
  - **`BUG-GD-01`**: Filtered `economy.json` out of `ENTITY_DIR` in `page.tsx` and `entities/route.ts`; guarded `Object.entries(templateData.components ?? {})` across editors.
  - **`BUG-GD-02`**: Upgraded `item-requires-pickup-effect` in `ecs-rules.ts` to `item-requires-handler-component`, supporting `pickupEffect`, `currencyItem`, `equipmentDef`, `softwareDef`, `abilityDef`, `augmentData`, and `item.type === 'key'`. Added `prop-lock-requires-prop`, `no-runtime-intents-in-templates`, and `valid-sprite-key`.
  - **`BUG-GD-03` & `BUG-GD-04`**: Refactored `FormField.tsx` with draft string state for JSON textareas; added empty option handling on enums; implemented `buildDefaultComponentData` in `default-values.ts` for pre-seeded defaults on `+ Add Component`.
  - **`BUG-GD-05`, `BUG-GD-06`, `BUG-GD-07`**: Wired `CLONE`, `DELETE` (with confirmation modal), and `onRefresh` post-mutation transitions across `EntityTemplateEditor`, `MixinEditor`, `SpawnTableEditor`, `ShellEditor`, `PrefabEditor`, `Sidebar.tsx`, and `GamedataTool.tsx`.
- [x] **[GD-02] Phase 2: Schema Introspection, Server Validation & Security Hardening**
  - **`RISK-GD-01` & `RISK-GD-02`**: Upgraded `schema-introspect.ts` with recursive unwrapping of Zod 4 types (`z.nativeEnum`, `z.nullable`, `z.record`, `z.union`, `z.lazy`, and numeric constraints `minValue`/`maxValue`/`isInt`); filtered 27 runtime Intent/Tag components out of authorable component dropdown.
  - **`RISK-GD-03`, `RISK-GD-04`, `RISK-GD-07`**: Enforced Zod schemas (`RawTemplateSchema`, `ShellTemplateSchema`, `SpawnTableSchema`, `RoomPrefabTemplateSchema`) and ECS rules on `POST`/`PUT` routes; added `body.name === params.name` / `body.id === params.name` validation.
  - **`RISK-GD-05`**: Added `checkNonProductionOnly()` across all `/api/dev/gamedata/**/route.ts` handlers and `notFound()` in production on `src/app/dev/gamedata/page.tsx`.
  - **`RISK-GD-06`**: Implemented `regenerateTemplateIndex()` syncing `src/game/entities/index.ts`, `src/game/shells/client/index.ts`, and `src/game/generation/prefabs/index.ts` automatically on template `POST`/`DELETE`.
  - **`VAL-PRF-01`–`VAL-PRF-06`**: Created `prefab-validator.ts` enforcing grid uniformity, perimeter portal alignment, 100% flood-fill reachability, prop anchor front-access grounding, vault door invariants, and ergonomics.
- [x] **[GD-03] Phase 3: Taikoku Vector Layout & Mixin Overrides Engine**
  - **`DRIFT-GD-01` & `DRIFT-GD-02`**: Migrated `gamedata.module.css` and `editors.module.css` to canonical Taikoku Vector `--c-*` and `--font-*` tokens; added `.headerPlacard` with active item and dirty status; added `Cmd+S` global listener and unsaved changes warning.
  - **3-Column Workstation Layout**: Mounted `Sidebar` (280px), active editor in `mainPanel` (flex 1), and collapsible 340px right column `ResolvedPreviewPanel.tsx` showing real-time validation pass/fail badges and effective merged JSON.
  - **Mixin Selector & Overrides Diffing**: Upgraded `EntityTemplateEditor.tsx` with mixin multi-select bar, inherited component viewer (`FROM: <mixin>`), field override editing writing to `templateData.overrides[compKey][fieldKey]`, `[OVERRIDDEN]` amber badges, and `[RESET OVERRIDE]` actions.
  - **Top-Level Metadata & SpritePicker**: Added inputs for `displayName`, `tier`, `software` (CSV); built `SpritePicker.tsx` with canvas preview and frame selection; updated `ShellEditor.tsx` and `ComponentFieldGroup.tsx` to use `SpritePicker`.
- [x] **[GD-04] Phase 4: Deterministic Room Generator & Multi-Layer Prefab Canvas**
  - **Deterministic Procedural Room Synthesis (`room-generator.ts`)**: Built 6-stage deterministic `mulberry32` procedural room generator across all 6 archetypes (`SERVER_CORE`, `FREIGHT_BAY`, `DECON_AIRLOCK`, `ZERO_DAY_VAULT`, `SUBNET_HUB`, `CORRUPTED_SECTOR`) with symmetry, complexity, prop density, hazard density, flood-fill connectivity repair, perimeter portal synthesis, and automatic wall-normal prop orientation inference. Verified with 100% pass rate over 60 random seeds.
  - **API Route `POST /api/dev/gamedata/prefabs/generate`**: Added validated generation endpoint returning synthesized prefabs with live structural audits.
  - **Multi-Layer HTML5 Prefab Canvas (`PrefabEditor.tsx`)**: Upgraded `PrefabEditor` with 3 synchronized view modes (`SPRITE VIEW` 32×32 pixel-art, `AUTOTILE GLYPHS`, `RAW ASCII`), rendering autotiled walls (`AutotileSolver.resolveWallTile`), directional doors (`resolveDoorTile`), directional prop sprites (`prop_workstation_n..w`, `prop_locker_n..w`, `prop_biocabinet_n..w`, `prop_crate_cover_h/v`), perimeter portal arrows, and Faraday scanlines.
  - **Interactive Editing & Mutation Levers**: Built direct canvas brushes (Pencil, Box, Flood, Portal) with 50-step Undo/Redo (`Cmd+Z` / `Cmd+Shift+Z`), one-click mutation operators (`[🎲 REROLL SEED]`, `[🔄 MUTATE INTERIOR]`, `[↔ APPLY SYMMETRY]`), and live `VAL-PRF-01`–`VAL-PRF-06` audit badges.
- [x] **[GD-05] Phase 5: System Configs, Augment AST Builder & Themed Tileset Inspector**
  - **System Configuration Editors (`configs`)**: Added `/api/dev/gamedata/configs` and `/api/dev/gamedata/configs/[name]` routes (gated by `checkNonProductionOnly`), `ConfigEditor.tsx` with structured and raw JSON modes for **Economy (`economy.json`)**, **Depth Config (`depth-config.json`)**, and **Loot Distribution (`loot-distribution.json`)**.
  - **Augment Condition Tree Builder (`AugmentASTBuilder.tsx`)**: Built structured recursive tree editor for `augmentData.trigger` (`AND`, `OR`, `NOT` branches with leaf triggers `ON_ACTIVATION`, `ON_TARGET_HIT`, `ON_OVERCLOCK`, `ON_KILL`, `HEAT_ABOVE`, `HP_BELOW_PERCENT`, etc.) and action payloads (`HEAL`, `SHIELD`, `APPLY_STATUS`, `VENT_HEAT`, `DAMAGE_BONUS`).
  - **Themed Tileset Dictionary Inspector (`ComponentSchemaViewer.tsx`)**: Added theme switcher (`default`, `traxus`, `cyberacme`, `sekiguchi`, `nucaloric`), manifest validation status, required directional frame counts, and a 32×32 live sprite sheet preview grid.
  - **Verification Sweep**: Verified full test suite passes (186/186 files, 1149/1149 tests), 0 type errors (`tsc --noEmit`), 0 lint warnings (`eslint src/`), and clean Next.js production build (`next build`).

---

## Workstream 6: Audio Subsystem Implementation & Procedural Synthesis Engine

> **Specification**: [`docs/design/AUDIO-SYSTEM.md`](./design/AUDIO-SYSTEM.md)  
> **Status**: Completed (Branch: `main`)

- [x] **[AUD-01] Milestone 1: Zero-Dependency `@engine/audio` Core Architecture**
  - Built pure TypeScript audio core (`src/engine/audio/`): `types.ts`, `spatial-mixer.ts`, `prediction-dedup.ts`, `synth-voice.ts`, `audio-engine.ts`, `index.ts`.
  - Implemented master anti-clipping limiter (`DynamicsCompressorNode`) and 4 channel buses (`master`, `ambiance` with `BiquadFilterNode`, `sfx`, `ui`).
  - Implemented procedural oscilloscope synth voice engine: sine, square, sawtooth, triangle, white/pink/brown noise generator, frequency pitch sweeps, sub/detune oscillator, FM modulation, resonant biquad filtering, waveshaper distortion, and ADSR envelopes.
  - Implemented 2D grid spatial stereo panning (`StereoPannerNode`) and distance attenuation (`GainNode`) with wall occlusion lowpass filtering.
  - Implemented client prediction deduplicator (`PredictionDeduplicator`) ignoring duplicate server events.
  - Implemented headless `NoopAudioEngine` ensuring clean SSR and server execution.
  - Verified with 17 unit tests in `src/engine/audio/__tests__/`.
- [x] **[AUD-02] Milestone 2: Audio ECS Components & Procedural Sound Cue Registry**
  - Created [`src/shared/components/audio.ts`](../src/shared/components/audio.ts) defining `AudioProfile` and `AmbientEmitter` Zod components; registered in `COMPONENTS_REGISTRY`.
  - Authored [`src/game/audio/sound-cues.json`](../src/game/audio/sound-cues.json) with 35+ procedural synth patches across locomotion, combat, firmware, heat, kernel panic, props, anchors, UI levers, and multi-layer ambiance with zero external asset dependencies.
  - Attached audio profiles and ambient emitters to entity templates: `player.json`, `null-pointer.json`, `system-admin.json`, `seed-eater.json`, `prop-cooling-vent.json`, `prop-stabilizer.json`, `prop-safe-locked.json`.
  - Verified with 3 unit tests in `src/shared/components/__tests__/audio.test.ts`.
- [x] **[AUD-03] Milestone 3: `@game/audio` EventBus Bridge, UI Levers & Reactive Ambiance**
  - Created [`cue-registry.ts`](../src/game/audio/cue-registry.ts) and [`ui-audio.ts`](../src/game/audio/ui-audio.ts).
  - Built [`game-audio-system.ts`](../src/game/audio/game-audio-system.ts) subscribing to `EventBus<GameEvents>`, resolving spatial SFX, client-prediction deduplication, and continuous ambiance modulation (DepthBand, SectorCondition, HeatTier, Stability Anchor grayscale ducking).
  - Wired `uiAudio` into [`BtnLever.tsx`](../src/components/ui/atomic/BtnLever.tsx) (tactile clicks and 2-second hold-to-confirm pitch ramp), [`TabBar.tsx`](../src/components/ui/hub/TabBar.tsx), and [`BootSequence.tsx`](../src/components/ui/hub/BootSequence.tsx).
  - Mounted `GameAudioSystem` and continuous background ambiance in [`src/app/page.tsx`](../src/app/page.tsx).
  - Verified with 10 unit tests in `src/game/audio/__tests__/`.
- [x] **[AUD-04] Milestone 4: ESC Settings Dialog, Audio Mixer Panel & Persistence**
  - Extended [`gameStore`](../src/game/ui/store.ts) with `audioSettings` state and actions synced to `localStorage` under `'nirmata_audio_settings'`.
  - Built [`AudioSettingsPanel.tsx`](../src/components/ui/AudioSettingsPanel.tsx) with Master, Ambiance, SFX, and UI bus volume sliders plus Mute toggle.
  - Built [`SystemSettingsModal.tsx`](../src/components/ui/SystemSettingsModal.tsx) opened via ESC key in `MainMenu.tsx` & `HubLayout.tsx` or `[04] AUDIO & SETTINGS` lever.
  - Embedded `AudioSettingsPanel` inside in-run pause dialog [`AbortMissionDialog.tsx`](../src/components/ui/AbortMissionDialog.tsx).
  - Verified with 7 unit tests in `src/components/ui/__tests__/AudioSettingsPanel.test.tsx` and `SystemSettingsModal.test.tsx`.
- [x] **[AUD-05] Milestone 5: Gamedata Studio Audio Cues & Synth Studio**
  - Added routes [`/api/dev/gamedata/audio-cues`](../src/app/api/dev/gamedata/audio-cues/route.ts) and [`/api/dev/gamedata/audio-cues/[name]`](../src/app/api/dev/gamedata/audio-cues/[name]/route.ts) (gated by `checkNonProductionOnly()`).
  - Added `SynthPatchConfigSchema`, `SoundCueDefSchema`, and `SoundCuesFileSchema` to [`schemas.ts`](../src/app/api/dev/gamedata/schemas.ts).
  - Built [`AudioCueStudio.tsx`](../src/dev-tool/studio/editors/AudioCueStudio.tsx) in `/dev/gamedata` with real-time waveform, ADSR, filter, distortion controls, live `[ ▶ PLAY CUE ]` auditioning via `AudioEngine`, 2D Spatial Preview Pad, tactile hold-to-confirm ramp tester, and reactive ambiance simulator.
  - Wired `audioCues` section into `GamedataTool.tsx`, `Sidebar.tsx`, and `store.ts`.
  - Verified with 11 API unit tests in `src/app/api/dev/gamedata/__tests__/audio-cues.test.ts` and 6 editor unit tests in `src/dev-tool/studio/editors/__tests__/AudioCueStudio.test.tsx`.
- [x] **[AUD-06] AudioProfile Dropdown Selection & In-Studio Auditioning**
  - Built [`AudioCuePicker.tsx`](../src/dev-tool/studio/shared/AudioCuePicker.tsx) supporting categorized `<optgroup>` selection (Recommended for field, SFX, UI, Ambiance, Custom), inline text fallback mode (`LIST` / `MANUAL`), quick clear, and immediate auditioning.
  - Integrated `AudioCuePicker` into [`FormField.tsx`](../src/dev-tool/studio/editors/shared/FormField.tsx) and [`ComponentFieldGroup.tsx`](../src/dev-tool/studio/editors/shared/ComponentFieldGroup.tsx), automatically routing all `audioProfile` and `ambientEmitter` cue string fields to the dedicated picker with parent `pitchMultiplier` and `volumeMultiplier` passthrough.
  - Added live slider constraints for volume (0–100%) and pitch (0.2×–2.5×) with contextual reset buttons.
  - Verified with 8 unit tests in `src/dev-tool/studio/shared/__tests__/AudioCuePicker.test.tsx`.
- [x] **[AUD-07] Audio Stop Controls & Dev Tool Audio Kill-Switch**
  - Added `stopCue(cueId, fadeDurationSec)` and `stopAllAudio(fadeDurationSec)` to `IAudioEngine`, `AudioEngine`, and `NoopAudioEngine`, tracking active synthesis voices and sample source nodes for both non-looping and continuous looping sounds.
  - Updated [`AudioCueStudio.tsx`](../src/dev-tool/studio/editors/AudioCueStudio.tsx) with toggleable `[■ STOP CUE]` / `[▶ PLAY CUE]`, `[■ STOP ALL]`, 2D spatial `[■ STOP]`, and ambiance simulator `[■ STOP AMBIANCE DRONE]` buttons, with automatic audio termination on component unmount.
  - Updated [`AudioCuePicker.tsx`](../src/dev-tool/studio/shared/AudioCuePicker.tsx) with toggleable `[■]` / `[▶]` audition button and unmount audio cleanup.
  - Added global `[■ STOP AUDIO]` panic kill-switch to [`GamedataTool.tsx`](../src/dev-tool/studio/GamedataTool.tsx) header placard next to `CMD+S SAVE`.
- [x] **[AUD-08] Reactive Ambiance Simulation Drone Playback & Real-Time DSP Telemetry**
  - Fixed Ambiance Simulator button in [`AudioCueStudio.tsx`](../src/dev-tool/studio/editors/AudioCueStudio.tsx) to automatically resolve and play the appropriate continuous ambiance drone (`amb_band_1_corrupted`, `amb_band_2_static`, `amb_band_3_logic`, `amb_main_menu`, or the currently edited ambiance cue) via `engine.playAmbianceCue()`.
  - Added `playAmbianceCue()` and `getAmbianceState()` directly to [`IAudioEngine`](../src/engine/audio/types.ts).
  - Enhanced `AudioEngine.setAmbianceState()` to lazily initialize/resume the Web Audio context and compute dynamic biquad filter frequency and resonance Q based on sector conditions (`IONIC_STORM`, `DARK_SUBNET`, `THERMAL_FLARE`, `CORRUPTED`), heat tier escalation (`0–5`), and stability anchor ducking (`380 Hz`).
  - Wired real-time slider callbacks so tweaking Depth Band, Sector Condition, Heat Tier, or Anchor Ducking immediately updates the live audio and DSP telemetry readout.
  - **Verification Sweep**: Verified full test suite passes (201/201 files, 1,236/1,236 tests), 0 type errors (`tsc --noEmit`), 0 lint warnings (`eslint src/`), and clean Next.js production build (`next build`).
- [x] **[AUD-09] Fix Sound-Cues File Schema for Noise Sub-Waveforms & Sample Cue Payloads**
  - Expanded `SynthPatchConfigSchema.subWaveform` in [`schemas.ts`](../src/app/api/dev/gamedata/schemas.ts) and [`types.ts`](../src/engine/audio/types.ts) to accept all `SynthWaveform` types including noise (`noise_white`, `noise_pink`, `noise_brown`), resolving the whole-file validation failure on cues 24 (`sfx_melee_hit`), 26 (`sfx_player_damaged`), and 44 (`sfx_prop_search`).
  - Added Web Audio noise buffer source synthesis for sub-oscillators in [`synth-voice.ts`](../src/engine/audio/synth-voice.ts) so procedural noise sub-layers play without `OscillatorType` errors.
  - Sanitized sample cue saves in [`AudioCueStudio.tsx`](../src/dev-tool/studio/editors/AudioCueStudio.tsx) to require `samplePath` and cleanly omit irrelevant synth parameters when in `SAMPLE` mode.
  - Added noise options (`WHITE NOISE`, `PINK NOISE`, `BROWN NOISE`) to the Sub Oscillator Wave dropdown.
  - **Verification Sweep**: Verified full test suite passes (201/201 files, 1,238/1,238 tests), 0 type errors (`tsc --noEmit`), 0 lint warnings (`eslint src/`), and clean Next.js production build (`next build`).
- [x] **[AUD-10] Dynamic In-Game AudioProfile Cues & AmbientEmitter World Loops**
  - Fixed [`game-audio-system.ts`](../src/game/audio/game-audio-system.ts) to read the player entity's `AudioProfile` component (`deathCue`, `hitCue`) during `ENTITY_DIED` and `DAMAGE_DEALT` events instead of playing hardcoded fallback cue strings (`sfx_bsod_fatal`, `sfx_player_damaged`), allowing custom sample and synth cues assigned in templates to play in-game.
  - Implemented real-time spatial loop tracking for [`AmbientEmitter`](../src/shared/components/audio.ts) entities (`updateAmbientEmitters`), updating distance attenuation and FOV occlusion across player movement, FOV updates, prop interactions, and floor transitions, with automatic cleanup on entity removal or system destruction.
  - Normalized `samplePath` resolution in [`audio-engine.ts`](../src/engine/audio/audio-engine.ts) to strip redundant `public/` prefixes and ensure relative paths resolve cleanly, with automatic `await ctx.resume()` unlocking prior to audio decoding and buffer playback.
  - Added dynamic cue registration (`registerSoundCue`) in [`cue-registry.ts`](../src/game/audio/cue-registry.ts).
  - **Verification Sweep**: Verified full test suite passes (201/201 files, 1,240/1,240 tests), 0 type errors (`tsc --noEmit`), 0 lint warnings (`eslint src/`), and clean Next.js production build (`next build`).
- [x] **[AUD-11] Ambiance System Configuration & DevTool Visual Ambiance Studio**
  - Eliminated magic hardcoded ambiance IDs across the entire project (`amb_main_menu`, `amb_hub_deck`, `amb_band_1_corrupted`, `amb_band_2_static`, `amb_band_3_logic`).
  - Created declarative system config schema in [`schemas.ts`](../src/app/api/dev/gamedata/schemas.ts) (`AmbianceConfigSchema`, `AmbianceDepthBandSchema`, `AmbianceSectorConditionSchema`, `AmbianceSceneTrackSchema`, `AmbianceDuckingConfigSchema`) and authored [`src/game/config/ambiance.json`](../src/game/config/ambiance.json).
  - Built typed config loader and runtime floor resolver in [`src/game/config/ambiance.ts`](../src/game/config/ambiance.ts) (`getAmbianceConfig`, `setAmbianceConfig`, `resolveAmbianceForFloor`) providing procedural depth band matching, sector condition DSP filter multipliers (`cutoffMultiplier`, `resonanceQ`), and condition track overrides.
  - Exposed `/api/dev/gamedata/configs/ambiance` with automatic `sound-cues.json` synchronization: whenever a user assigns or edits `samplePath` or `cueId`, the server automatically provisions/updates the sound cue registry and keeps runtime audio in sync.
  - Built a dedicated visual editor for `name === 'ambiance'` inside [`ConfigEditor.tsx`](../src/dev-tool/studio/editors/ConfigEditor.tsx) with Scene Ambiance Tracks, Progression Depth Bands with `AudioCuePicker` + `samplePath` + volume sliders, dynamic Sector Conditions with frequency cutoff and resonance Q sliders, and Ducking parameters.
  - Refactored [`game-audio-system.ts`](../src/game/audio/game-audio-system.ts), [`src/app/page.tsx`](../src/app/page.tsx), and [`AudioCueStudio.tsx`](../src/dev-tool/studio/editors/AudioCueStudio.tsx) to consume `getAmbianceConfig()` and `resolveAmbianceForFloor()`.
  - **Verification Sweep**: Verified full test suite passes (203/203 files, 1,254/1,254 tests), 0 type errors (`tsc --noEmit`), 0 lint warnings (`eslint src/`), and clean Next.js production build (`next build`).
- [x] **[AUD-12] Adversarial Architecture & Implementation Remediation (`AUD-REV-01` – `AUD-REV-12`)**
  - **`AUD-REV-01`**: Fixed post-mortem `DAMAGE_DEALT` cache lookup for defender and attacker; wired `AudioProfile.attackCue` playback (spatial for enemies, global for player); updated `positionCache` on `ENTITY_MOVED` and `ENEMY_TELEPORTED`; cleared caches on `FLOOR_TRANSITION` and `destroy()`.
  - **`AUD-REV-02`**: Fixed shell footstep shadowing in `game-audio-system.ts` when `profile?.stepCue` defaults to `'sfx_step_player'`, properly resolving `bastion-v1` -> `sfx_step_bastion` and `ghost-v1` -> `sfx_step_ghost` while preserving custom non-default overrides.
  - **`AUD-REV-03`**: Added `initialSettings` to `AudioEngine` constructor, applied in `init()`, and synced persisted settings in `store.ts` and `page.tsx` mount effect.
  - **`AUD-REV-04`**: Gated `/api/dev/gamedata/*` dev hot-reloads behind `process.env.NODE_ENV === 'development'` and guarded against non-menu/hub fetches.
  - **`AUD-REV-05`**: Added `stopVoice` and `updateVoiceSpatial` to `IAudioEngine` and `AudioEngine`; dynamic spatial panning/attenuation/occlusion updates while moving inside emitter radius; isolated per-voice stops; disarmed `CorruptedNode` checks; redacted `AmbientEmitter` and `AudioProfile` outside FOV in serialization.
  - **`AUD-REV-06`**: Extended `AmbianceState` with declarative DSP config overrides (`cutoffMultiplier`, `resonanceQ`, `baseVolume`, ducking parameters); updated `AudioEngine.setAmbianceState()` to prioritize declarative parameters with `OVERCLOCKED_GRID` fallback; updated `GameAudioSystem.updateAmbianceForFloor()` to pass parameters from `ambiance.json`.
  - **`AUD-REV-07`**: Reset `ambianceState` to pristine defaults (`heatTier: 0, sectorCondition: null, isAnchorDucked: false, isPaused: false, cutoffMultiplier: 1.0, resonanceQ: 1.0`) when entering `GameState.MainMenu` or `GameState.Hub` and on `GameAudioSystem.destroy()`; wired `isPaused: true` ambiance ducking and `isPaused: false` restoration in `GameAudioSystem`, `page.tsx`, `AbortMissionDialog.tsx`, and `SystemSettingsModal.tsx`.
  - **`AUD-REV-08`**: Wired all 8 uncalled canonical sound cues (`ui_modal_open`, `ui_modal_close`, `sfx_cover_mitigated`, `sfx_ranged_hit`, `sfx_cover_broken`, `sfx_volatile_cryo`, `sfx_volatile_emp`, `sfx_bump_warning`).
  - **`AUD-REV-09`**: In `AudioEngine.playSampleVoice()`, inserted low-pass occlusion `BiquadFilterNode` and disconnected nodes in `source.onended`; in `playSynthVoice()`, tracked and stopped all secondary source nodes (`lfo`, `fmOsc`, `subOsc`, `subBufferSource`); in `BtnLever.tsx`, added unmount cleanup calling `uiAudio.stopHoldRamp()`.
  - **`AUD-REV-10`**: Fixed `handleClone` in `AudioCueStudio.tsx` to deep-copy active cue with `${baseId}_copy`; aligned Ambiance Simulator `<select>` options with exact `getDepthBandCueMap()` keys; added `OVERCLOCKED_GRID` and `DARK_SUBNET` to Sector Condition dropdown.
  - **`AUD-REV-11`**: Cleaned up `ambiance.json` (pointed `scenes.mainMenu.cueId` to `"amb_main_menu"` and `scenes.hub.cueId` to `"amb_hub_deck"`) and `sound-cues.json` (removed broken scratch entry `"amb_main_menu_2"` and sanitized `"amb_menu_2"`).
  - **`AUD-REV-12`**: Decoupled browser DOM listeners and injected sample loader in `AudioEngine`; added `SampleLoader` and `AudioEngineOptions` interfaces; decoupled `window.addEventListener` autoplay unlock listeners by default; exposed `resume()` on `IAudioEngine` and managed user gesture unlock in `page.tsx`.
  - **Verification Sweep**: Verified full test suite passes (203/203 files, 1,271/1,271 tests), 0 type errors (`tsc --noEmit`), 0 lint warnings (`eslint src/`), and clean Next.js production build (`next build`).

---

## Workstream 3: AI Architecture Specification — Stateless Behavior Trees & Shared Dijkstra Maps (v3.0 Upgrade)

> **Specification**: [`docs/design/AI-BEHAVIOR-TREES-DIJKSTRA.md`](./design/AI-BEHAVIOR-TREES-DIJKSTRA.md)  
> **Status**: Complete & Verified (M1–M4)

- [x] **[BT-M1] Engine Primitives (`@engine/ai`)**
  - **Stateless Tree Evaluation (`evaluateBehaviorTree`)**: Pure, tick-to-intent recursive evaluation of `SELECTOR`, `SEQUENCE`, `UTILITY_SELECTOR`, `DECORATOR_COOLDOWN`, `DECORATOR_INVERT`, `DECORATOR_CHANCE`, `SUBTREE`, `CONDITION`, and `ACTION` nodes without mutable state or internal blackboard clocks.
  - **Shared Dijkstra Maps (`DijkstraMap`)**: Optimized 80x45 Float32Array distance grids using a binary min-heap relaxation queue ($O(V \log V)$ for arbitrary positive step costs).
  - **Flee Map Generation (`createFleeMap`)**: Goal-inverted Dijkstra map with $v \times -1.2$ attraction sinks and impassable threat tiles, ensuring enemies run away into corridors and out of corners rather than stalling against walls.
  - **Linear Combination Algebra (`DijkstraMap.combine`)**: Multi-layer weighted map blending with unreachable tile propagation.
  - **Utility AI Response Curves (`evaluateCurve`, `evaluateUtilityBranchScore`)**: Response curve mathematics (`linear`, `quadratic`, `logistic`, `step`) with slope, inversion, and normalized clamping domain for utility motivation scoring.
  - **Verification**: Verified with 9 unit tests in `src/engine/ai/__tests__/dijkstra-map.test.ts` and 11 unit tests in `src/engine/ai/__tests__/behavior-tree.test.ts`.

- [x] **[BT-M2] Shared Schemas, Intents & Serialization Redaction (`@shared`)**
  - **Recursive Behavior Tree Schemas (`src/shared/components/ai-tree.ts`)**: Zod schemas for 12 conditions (`AIConditionSchema`), 6 atomic actions (`AIActionSchema`), utility considerations (`UtilityConsiderationSchema`), and recursive `BehaviorTreeNodeSchema` via `z.lazy`.
  - **Upgraded AIState Component (`src/shared/components/ai-state.ts`)**: Added `treeId`, `inlineTree`, `sightRadius`, `memoryTurns`, `cooldowns`, `remainingMemoryTurns`, and `lastEvaluatedPath`, while maintaining backward-compatible `behavior` and `behaviorType` fields.
  - **Decoupled Spawn Intent (`src/shared/components/intents.ts`)**: Added `SpawnEntityIntent` enabling systems (`Fragmenter`, `TileCorruptionSystem`) to request entity spawns across phases without direct factory RPCs.
  - **Anti-Cheat Client Delta Redaction (`src/shared/serialization.ts`)**: Automatic redaction of internal server-only `cooldowns`, `remainingMemoryTurns`, and `inlineTree` on `aiState` during wire compression in `redactWorldForClient` and `redactDeltaForClient`.
  - **Verification**: Verified with 6 unit tests in `src/shared/components/__tests__/ai-tree.test.ts` and 6 serialization tests in `src/shared/__tests__/serialization.test.ts`.

- [x] **[BT-M3] Spatial Subsystem & Enemy Bestiary Migration (`@game`)**
  - **Authoritative AISpatialSystem (`src/game/ai/spatial-maps.ts`)**: Precomputes and caches shared 80x45 Float32Array maps per turn: `approach_target` (avoiding or ignoring hazards), `flee_from_target` (corner escape), `kite_to_cover` (seeking directional cover relative to player vector), and `pack_surround_cardinal` (cardinal reservation system).
  - **AIBehaviorRegistry (`src/game/ai/tree-registry.ts`)**: Central registry for registered Behavior Tree ASTs and reusable subtrees (`skip-if-disrupted`, `investigate-last-known-pos`).
  - **Decoupled SpawnEntitySystem (`src/game/systems/spawn-entity.ts`)**: Phase.ACTION and Phase.POST_TURN system that resolves `SpawnEntityIntent` components and registers spawned entities onto the spatial `Grid`.
  - **Deterministic Tile Corruption (`src/game/systems/tile-corruption.ts`)**: Replaced non-deterministic `Math.random` with a seeded mulberry32/splitmix PRNG seeded from `FloorState.runSeed + turnNumber + entityId`, emitting `SpawnEntityIntent` for sub-processes.
  - **Bestiary Migration**: Authored bespoke JSON behavior trees in `src/game/entities/templates/ai/`:
    - `null-pointer`: Faraday-safe teleport directional ambush behind player vector.
    - `buffer-overflow`: Pack swarmer coordinating via shared pack alerts and reserving cardinal tiles.
    - `fragmenter`: Heavy area-denier emitting `SpawnEntityIntent` for cardinal Dead Zones dealing 2 tick damage.
    - `logic-leaker`: Ranged kiter using `flee_from_target` when player closes to $\le 2$ tiles and `kite_to_cover` at range 3..5.
    - `system-admin`: Disruption check and dynamic prop crushing (`canCrushProps: true`).
    - `seed-eater`: Deterministic sub-process spawner and melee corruption.
    - `basic`: Fallback approach-and-bump tree.
  - **Verification**: Verified with 8 comprehensive integration tests in `src/game/systems/__tests__/ai-upgraded-behaviors.test.ts` and 9 unit tests in `src/game/systems/ai.test.ts`.

- [x] **[BT-M4] Gamedata Studio AST Builder & Dev Terminal Telemetry (`@dev-tool`, `@rendering`)**
  - **BehaviorTreeEditor AST Builder (`src/dev-tool/studio/editors/subeditors/BehaviorTreeEditor.tsx`)**: Visual recursive AST builder supporting all composite nodes, decorators, subtrees, conditions, actions, and utility considerations with raw JSON view toggle.
  - **EntityTemplateEditor Integration (`src/dev-tool/studio/editors/shared/ComponentFieldGroup.tsx`)**: The `aiState` component card displays a `treeId` dropdown populated from `/api/dev/gamedata/ai-trees` and an `[EDIT INLINE TREE]` toggle.
  - **AI Tree API Endpoints (`src/app/api/dev/gamedata/ai-trees/route.ts`, `[treeId]/route.ts`)**: Development-only REST endpoints listing available behavior tree templates and subtrees.
  - **DevTerminal Telemetry (`src/dev-tool/terminal/DevTerminal.tsx`, `debug-api.ts`)**: Added `/debug-ai [mapType]` command to the backtick terminal and updated `/list`.
  - **Dijkstra Heatmap Overlay (`src/rendering/render-system.ts`)**: Rendered interactive Dijkstra distance heatmap overlay directly onto the PixiJS viewport on `DEBUG_TOGGLE_AI` signal.
  - **Tactical Hover Tooltip BT Path (`src/rendering/tile-inspector.ts`)**: Inspects and displays the enemy's last evaluated Behavior Tree execution path (`BT: root > ... [SUCCESS]`).
  - **Verification**: Verified with unit tests in `src/dev-tool/studio/editors/subeditors/__tests__/BehaviorTreeEditor.test.tsx` (5 tests), `src/dev-tool/terminal/__tests__/DevTerminal.test.tsx` (5 tests), and `src/rendering/__tests__/tile-inspector.test.ts` (16 tests). Full project test suite passes (208/208 test files, 1,319/1,319 tests), 0 type errors, 0 lint warnings, and clean Next.js production build (`next build`).

- [ ] **[BT-M5] Adversarial Architecture & Implementation Remediation (`BT-REV-01` – `BT-REV-08`)**
  - **`BT-REV-01`**: Fixed `System_Admin` prop crushing, adjacency termination, and disruption log. Added `Attack` component (`power: 999, range: 1, defense: 99`) to `system-admin.json` allowing `CombatSystem` to one-shot destructible props targeted via `canCrushProps: true`; wired `CombatSystem` and `RunEnderReactionSystem` to trigger `FATAL: ADMIN_CONTACT` when active `System_Admin` targets player with `AttackIntent` or is adjacent to player; restored `"System_Admin is disrupted and cannot move!"` combat message in `ai/system-admin.json`. Verified with integration tests in `ai-upgraded-behaviors.test.ts`.
  - **`BT-REV-02`**: Fixed Dijkstra passability and dynamic entity penalty routing. Updated `AISpatialSystem.getStepCostFn` to check for `BlocksMovement` entities (Props, locked `SecurityLock` doors), returning `DIJKSTRA_IMPASSABLE` for standard enemies (`canCrushProps: false`) and destructible cost `2.0` / locked door `DIJKSTRA_IMPASSABLE` for `System_Admin` (`canCrushProps: true`). Cached `approachMapCrushProps` in `AISpatialSystem`. Updated `AISystem.executeMoveDijkstra` `dynamicPenaltyFn` to return `Infinity` for any non-destructible/ally entity with `BlocksMovement`, preventing wasted bump turns and guiding enemies smoothly around props and allies. Verified with unit/integration tests in `ai-upgraded-behaviors.test.ts`.
  - **`BT-REV-03`**: Fixed multi-enemy sequential turn loop alert and pack state. Scoped `AlertIntent` consumption and `alertedThisTurn` / `packAlerted` evaluation strictly to the currently acting enemy in `processEnemyTurn()`, checking floor turn number rather than wiping state on every `update()` call. Implemented `isPackAlerted()` dynamically querying pack members for FOV detection, alert flags, and active `AlertIntent`s. Verified with multi-enemy sequential pass tests in `ai-upgraded-behaviors.test.ts`.
  - **`BT-REV-04`**: Fixed `Logic-Leaker` cover kiting and unwired schema parameters. Updated `logic-leaker.json` behavior tree to insert `reposition-to-cover-if-exposed` checking `IN_DIRECTIONAL_COVER_FROM_TARGET` with `DECORATOR_INVERT` before firing `corrupted-packet-volley`, falling back gracefully to firing if reposition fails or when already in cover; wired `optimalRangeMin`/`optimalRangeMax` into `AISpatialSystem.getKiteToCoverMap()`; wired `scavenge_nearest_loot` and `patrol_anchors` spatial maps and `action.mapType` handlers; returned `BTStatus.FAILURE` when `step.dx === 0 && step.dy === 0` to enable selector fallbacks; wired `action.count` into `executeSpawnEntitiesAroundSelf`; implemented `nearby_loot_value` in utility considerations querying nearby floor items and currency. Verified with tests in `ai-upgraded-behaviors.test.ts`.

---

## Workstream 6: Sprite Animation System & DevTool Preview Architecture (v2.8)

> **Specification**: [`docs/design/SPRITE-ANIMATIONS.md`](./design/SPRITE-ANIMATIONS.md)  
> **Status**: Specified & Planned (Ready for Implementation)

- [ ] **[ANIM-01] Shared Manifest & Component Schemas + Tileset Validator (`@shared`, `@dev-tool`)**
  - Extend [`src/shared/tileset-types.ts`](../src/shared/tileset-types.ts) with `AnimationLoopModeSchema` (`'loop' | 'pingpong' | 'once'`), `AnimationStateKeySchema`, `AnimationClipDefSchema`, `EntityAnimationSetSchema`, and `animations` on `ThemedTilesetManifestSchema`.
  - Extend [`src/shared/components/sprite.ts`](../src/shared/components/sprite.ts) (`SpriteComponent`) with backward-compatible optional `animationSet`, `initialState`, `speedMultiplier`, `paused`, and `desyncPhase` fields.
  - Extend [`src/app/api/dev/gamedata/tileset-validator.ts`](../src/app/api/dev/gamedata/tileset-validator.ts) with `VAL-ANIM-01`–`VAL-ANIM-03` frame reference, atlas bounds, and duration array validation.
- [ ] **[ANIM-02] Single-Atlas Animation Frame Generation & Themed Packing (`scripts/`, `public/assets/`)**
  - Author `scripts/build-animation-frames.cjs` and `scripts/add-animation-frames.cjs` to pack 44 animation delta cells into Rows 12–14 (`y = 384..480`) of the existing `512 × 512` `public/assets/tileset.png` using Frame-0 Base Reuse and Ping-Pong compression (zero extra GPU VRAM).
  - Update [`scripts/generate-themed-tilesets.cjs`](../scripts/generate-themed-tilesets.cjs) and `npm run build:tiles` so all corporate faction themes (`traxus_foundry`, `sekiguchi_biolabs`, `dark_subnet`) automatically palette-remap animation frames and inherit the `"animations"` manifest dictionary.
- [ ] **[ANIM-03] Client `SpriteAnimator` Runtime & `RenderSystem` Integration (`@rendering`)**
  - Implement `src/rendering/sprite-animator.ts` managing per-entity ambient states (`idle`, `locked`, `searched`, `corrupted`) and event-driven one-shot clips (`move`, `attack`, `hit`, `interact`, `death`) on existing `PIXI.Sprite` instances in [`src/rendering/sprite-map.ts`](../src/rendering/sprite-map.ts).
  - Wire [`src/rendering/render-system.ts`](../src/rendering/render-system.ts) events (`ENTITY_MOVED` with `EventOriginContext` deduplication, `DAMAGE_DEALT`, `FIRMWARE_ACTIVATED`, `PROP_INTERACTED`, `LOCK_UNLOCKED`), active FOV culling (`currentFovSet`), fog-of-war freeze (`U1`), `prefers-reduced-motion` (`U11`), and deterministic `EntityId` phase desynchronization.
  - Update [`src/rendering/assets.ts`](../src/rendering/assets.ts) (`loadThemedAssets`) to unload previous non-default theme atlases on floor theme transitions.
- [ ] **[ANIM-04] Gamedata Studio (`/dev/gamedata`) Live Preview, Filmstrip Scrubber & Prefab Toggle (`@dev-tool`)**
  - Extend [`src/dev-tool/studio/shared/tileset-atlas-cache.ts`](../src/dev-tool/studio/shared/tileset-atlas-cache.ts) with `getAnimationStates`, `getAnimationClip`, and `resolveAnimatedFrameAtTime`.
  - Upgrade [`src/dev-tool/studio/shared/SpritePicker.tsx`](../src/dev-tool/studio/shared/SpritePicker.tsx) with a live 64×64 animated canvas preview, `[▶/⏸]` transport controls, state selector pills, speed toggles, interactive frame filmstrip scrubber, and `[ALL | ANIMATED | STATIC]` dropdown filtering.
  - Add `[▶ ANIMATE PREVIEW]` toggle to [`src/dev-tool/studio/editors/PrefabEditor.tsx`](../src/dev-tool/studio/editors/PrefabEditor.tsx) and the **Animated Sprites & State Matrix** panel to [`src/dev-tool/studio/editors/ComponentSchemaViewer.tsx`](../src/dev-tool/studio/editors/ComponentSchemaViewer.tsx).








