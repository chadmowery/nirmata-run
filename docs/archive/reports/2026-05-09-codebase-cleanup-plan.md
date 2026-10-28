# Implementation Plan: ECS Architectural Cleanup & Standardized Intent Pattern

**Date**: 2026-05-09
**Author**: Antigravity (Architectural Audit)
**Status**: Draft / Pending Approval

---

## 1. Context & Objective
The current codebase has successfully transitioned to a Phase-Driven ECS model for core combat and movement. However, several "ghost systems" (Stability, Dead Zones, Floor Transitions) and "Internal RPCs" (EventBus listeners used for logic) still exist. This creates simulation drift between the Client and the Authoritative Pipeline.

**The Goal**: Eliminate ALL internal `eventBus.on()` logic listeners, ensure ALL systems run within the registered Phase loop, and enforce the `Dying` pipeline as the exclusive method for entity removal.

---

## 2. Architectural Mandates
The following rules are **NON-NEGOTIABLE**. Any code that violates these must be refactored:
1. **The Golden Rule**: No system may listen to an Internal Event to trigger logic. Use **Intents** or **Tags** instead.
2. **The Death Rule**: Only the `GravediggerSystem` may call `world.destroyEntity()`.
3. **The Damage Rule**: All damage (Melee, Ranged, DoT, Environmental) must be requested via `DamageIntent` or `AttackIntent`. No direct `Health` patching except for Heals.
4. **The Pipeline Rule**: Every gameplay system must be registered in `src/game/systems/registration.ts` to ensure it runs on the server.

---

## 3. Detailed Implementation Tasks

### Step 1: Consolidate Phased Systems (Pipeline Alignment)
Currently, `StabilitySystem` and `DeadZoneSystem` are registered manually in `engine-factory.ts` but are **missing** from the core registration used by the server pipeline.

1. **Modify `src/game/systems/registration.ts`**:
   - Import `createStabilitySystem` and `createDeadZoneSystem`.
   - Register them inside `registerCoreSystems`.
   - `StabilitySystem` should be registered to `Phase.PRE_TURN`.
   - `DeadZoneSystem` should be registered to `Phase.POST_TURN`.
2. **Refactor `src/game/systems/dead-zone.ts`**:
   - Add an `update` function to the system returned object.
   - Move the logic from `tickDeadZones` into this `update`.
   - **CRITICAL**: Change health subtraction to adding a `DamageIntent` component to the target.
3. **Refactor `src/game/systems/stability.ts`**:
   - Change `applyDegradedDamage` to add a `DamageIntent` instead of patching `Health` and adding `Dying`. Let the `CombatSystem` handle the condemnation.

### Step 2: Intent-Driven Interaction (Kill the RPCs)
The `EventBus` is being used as a shortcut to trigger logic. This must stop.

1. **Modify `src/shared/components/intents.ts`** (or create if missing):
   - Add `DescentIntent` (targetFloor, cost).
   - Add `ExtractionIntent` (reason).
   - Add `EquipIntent` (slotType, itemEntityId).
   - Add `UnequipIntent` (slotType, slotIndex).
   - Add `ShellUpdateTag` (marker for stat re-sync).
2. **Refactor `AnchorInteractionSystem` (`src/game/systems/anchor-interaction.ts`)**:
   - **Remove** `eventBus.on('ANCHOR_DECISION_MADE')`.
   - In its place, the system should look for `ExtractionIntent` or `DescentIntent` on the player entity during `Phase.REACTION`.
3. **Refactor `FloorManagerSystem` (`src/game/systems/floor-manager.ts`)**:
   - **Remove** `eventBus.on('STAIRCASE_DESCEND_TRIGGERED')`.
   - The system should now be a standard ECS system registered to `Phase.CLEANUP`.
   - It should query for entities with `DescentIntent`.
   - **Fix**: Replace the direct `world.destroyEntity()` loop with adding `Dying` to all non-protected entities.
4. **Refactor `ShellStatsSystem` (`src/game/systems/shell-stats.ts`)**:
   - **Remove** `eventBus.on('SHELL_STATS_CHANGED')`.
   - Create an `update` function registered to `Phase.PRE_TURN`.
   - It should query for entities with `ShellUpdateTag`, re-sync stats, and then remove the tag.

### Step 3: Enforce the Death Protocol in Pipeline
`src/shared/pipeline.ts` is currently "cheating" by destroying items and software immediately.

1. **Modify `src/shared/pipeline.ts`**:
   - **Delete** all calls to `world.destroyEntity`.
   - When an item is "destroyed" (e.g., burned software or consumed item), add the `Dying` component with `reason: 'consumed'` or `'overwritten'`.
   - Let the `GravediggerSystem` (which runs at the end of the pipeline) handle the actual deletion.
2. **Refactor `processAction`**:
   - Convert `EQUIP`, `UNEQUIP`, and `BURN_SOFTWARE` cases to simply attach the corresponding **Intent Components**.
   - The actual logic should move into a `src/game/systems/equipment-system.ts`.

### Step 4: TurnManager Decoupling
The `TurnManager` is too "chatty" with systems. It should only manage energy and phases.

1. **Modify `src/game/engine-factory.ts`**:
   - **Remove** manual calls to `statusEffectSystem.tickDown`, `augmentSystem.resetTurnState`, and `packCoordinatorSystem.resetTurnState` from the action handlers.
2. **Create/Update `TagCleanupSystem`**:
   - Ensure it clears `MovedThisTurn`, `DealtDamageThisTurn`, and resets `AugmentState` at the correct phase (`Phase.POST_TURN`).
3. **Update `StatusEffectSystem`**:
   - It should have an `update` function registered to `Phase.PRE_TURN` that decrements durations for all entities.

---

## 4. Expected Outcome
After these changes, the codebase will be:
- **100% Deterministic**: Every single gameplay change happens inside a `world.executeSystems(Phase)` call.
- **RPC-Free**: The `EventBus` will ONLY contain signals for the UI and Renderer.
- **Synchronized**: Environmental hazards like Stability and Dead Zones will finally work correctly in the server-side simulation.

---

## 5. Verification Checklist for the Developer
- [ ] `grep -r "eventBus.on" src/game` returns 0 results (excluding UI/Renderer bridges).
- [ ] `grep -r "world.destroyEntity" src` returns exactly 2 results (World definition and Gravedigger).
- [ ] `npm test` passes (specifically all integration tests in `src/shared/__tests__`).
- [ ] The game still loads and the player can move/attack/descend.
