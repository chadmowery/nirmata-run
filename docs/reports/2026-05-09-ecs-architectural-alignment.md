# ECS Refactoring & Protocol Compliance Plan
**Date**: 2026-05-10  
**Status**: Pending Implementation  
**Target**: Full Architectural Alignment with [ENGINE_GUIDELINES.md](file:///Users/chadmowery/personal/dev/dungeon-runner/nimrata-run/docs/ENGINE_GUIDELINES.md) and [DEATH_PROTOCOL.md](file:///Users/chadmowery/personal/dev/dungeon-runner/nimrata-run/docs/DEATH_PROTOCOL.md)

## Overview
This document provides a step-by-step technical guide for refactoring the game engine to eliminate RPC-style orchestration, direct state mutations, and "Death Protocol" violations. The goal is to move the codebase to a 100% deterministic, phase-driven ECS model.

---

## Task 1: Death Protocol Alignment (The "Gravedigger" Rule)

**Goal**: Ensure only `GravediggerSystem` calls `world.destroyEntity()`.

### Instructions:
1.  **Modify `src/game/systems/item-pickup.ts`**:
    *   Locate the `update` function.
    *   Find all calls to `w.destroyEntity(itemId)`.
    *   Replace them with:
        ```typescript
        w.addComponent(itemId, Dying, { reason: 'pickup' });
        ```
    *   **Rationale**: This allows the renderer to see the pickup event and perform any "disappearing" animations before the entity is purged from memory in `Phase.CLEANUP`.

2.  **Verify `src/game/systems/gravedigger.ts`**:
    *   Ensure it is registered to `Phase.CLEANUP` and is the **last** system to run in that phase.
    *   Confirm it cleans up the spatial index (`grid.removeEntity`) before calling `destroyEntity`.

---

## Task 2: Intent-Based AI (The "Middleman" Rule)

**Goal**: AI should only "think" (add Intents), never "act" (mutate state).

### Instructions:
1.  **Define `TeleportIntent`**:
    *   Add `TeleportIntent` to `src/shared/components/intents.ts`:
        ```typescript
        export const TeleportIntent = defineComponent('teleport_intent', z.object({
          x: z.number(),
          y: z.number()
        }));
        ```
    *   Register it in `src/shared/components/index.ts`.

2.  **Refactor `src/game/systems/ai.ts`**:
    *   Locate `processNullPointerTurn`.
    *   **REMOVE** direct calls to `world.patchComponent(entityId, Position, ...)` and `grid.moveEntity(...)`.
    *   **REPLACE** with:
        ```typescript
        world.addComponent(entityId, TeleportIntent, { x: targetX, y: targetY });
        ```

3.  **Create `src/game/systems/teleport.ts`**:
    *   Implement a system that queries for `TeleportIntent`.
    *   Perform the actual move (update `Position` and `Grid`) in `Phase.ACTION`.
    *   Remove the `TeleportIntent` after processing.

---

## Task 3: Firmware & Dash Refactoring

**Goal**: Dash logic should be handled by the Movement/Teleport system.

### Instructions:
1.  **Refactor `src/game/systems/firmware.ts`**:
    *   In `activateAbility`, locate the `dash` and `dash_attack` logic.
    *   **REMOVE** the direct state updates (lines 97-100).
    *   **REPLACE** with adding a `TeleportIntent` (or `MoveIntent` if collision is required) to the entity.

2.  **Centralize Grid Updates**:
    *   Ensure that only **two** places in the entire codebase update the `Grid` and `Position` for movement: `MovementSystem` and the new `TeleportSystem`.

---

## Task 4: Autonomous System Orchestration

**Goal**: Systems should be self-triggering via Phases, not called by a "Manager".

### Instructions:
1.  **Refactor `src/game/systems/upkeep.ts`**:
    *   Remove the orchestration logic that calls `.update()` on other systems.
    *   Instead, ensure `StatusEffectSystem`, `AugmentSystem`, and `PackCoordinatorSystem` each have an `init()` method that calls `world.registerSystem(Phase.PRE_TURN, update)`.

2.  **Update `src/engine/turn/turn-manager.ts`**:
    *   Remove the following lines from `advanceUntilPlayerReady`:
        ```typescript
        // REMOVE THESE:
        this.aiSystem.processEnemyTurn(entityId);
        this.firmwareSystem.activateAbility(...);
        ```
    *   Instead, ensure `TurnManager` simply moves through the `Phase` sequence. The `AISystem` will automatically pick up its turn in `Phase.GATHER_INTENT` if it's the actor's turn.

---

## Task 5: Logic De-duplication (The "Single Source" Rule)

**Goal**: Eliminate duplicate pickup logic.

### Instructions:
1.  **Refactor `src/shared/pipeline.ts`**:
    *   **DELETE** the `handlePickup` function (lines 235-302).
    *   In `processAction`, for `case 'PICKUP'`, only add a component or let the `MoveIntent` handle it. 
    *   **Note**: In this engine, walking onto an item **IS** the pickup trigger. `pipeline.ts` should not perform the pickup immediately; it should wait for `ItemPickupSystem` to run in `Phase.REACTION`.

2.  **Consolidate "On Damage" Logic**:
    *   Ensure `AugmentSystem` and `SoftwareSystem` hook into `Phase.REACTION` to observe `DamageIntent` or `MovedThisTurn` rather than being called directly by `CombatSystem`.

---

## Task 6: Event Purge & UI Boundary Check

**Goal**: Ensure `EventBus` is only used for UI/Rendering signals.

### Instructions:
1.  **Remove Internal Listeners**:
    *   Grep for `eventBus.on` in all files under `src/game/systems/`.
    *   Any listener that triggers game logic (e.g., `eventBus.on('DAMAGE_DEALT', ...)` updating a component) must be converted to an ECS Query in the appropriate phase.

2.  **Cleanup `GameplayEvents`**:
    *   In `src/shared/events/types.ts`, remove any events that are no longer emitted (e.g., legacy `BUMP_ATTACK` if still present).

---

## Verification Checklist
- [ ] `npx tsc --noEmit` passes with no errors.
- [ ] `npm test` passes (specifically `combat.test.ts` and `item-pickup.test.ts`).
- [ ] Player can dash/teleport and the Grid state remains in sync.
- [ ] Entities disappear correctly on death (verified by `GravediggerSystem` logs).
- [ ] No `world.destroyEntity` calls outside of `gravedigger.ts`.
