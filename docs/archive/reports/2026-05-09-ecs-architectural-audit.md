# Architectural Audit & Refactor Guide (May 2026)

## Overview
This document outlines critical architectural violations discovered during an audit of the Nirmata Runner ECS engine. The goal is to enforce strict adherence to the **Phase-Driven Intent Pattern** and the **Death Protocol**.

## Core Principles
1. **No RPCs:** Systems do not call methods on other systems. They attach **Intent Components**.
2. **Phase Registry:** Every system must be registered to a specific `Phase` via `world.registerSystem()`.
3. **EventBus Boundaries:** The `EventBus` is only for Engine -> UI/Renderer/Audio. Internal logic must not use `eventBus.on()`.
4. **Death Authority:** Only `GravediggerSystem` calls `world.destroyEntity()`.

---

## 🚩 Identified Issues & Required Fixes

### 1. The "Double Vampire" Bug
**Problem:** Both `SoftwareSystem` (Phase.REACTION) and `RewardDropSystem` (Phase.CLEANUP) contain logic to heal the player when an enemy dies while the player has Vampire.exe equipped.
**Explicit Instruction:**
- Open `src/game/systems/reward-drop.ts`.
- Delete lines 37-40 (the call to `applyVampireOnKill`).
- Keep the logic in `src/game/systems/software.ts`. This ensures healing happens in the `REACTION` phase immediately after combat, not in `CLEANUP`.

### 2. Broken Floor Transitions
**Problem:** `src/app/api/action/route.ts` and `server-debug-handler.ts` emit `STAIRCASE_DESCEND_TRIGGERED`. No one listens to this. It is a dead event.
**Explicit Instruction:**
- In `src/app/api/action/route.ts`, replace the `eventBus.emit('STAIRCASE_DESCEND_TRIGGERED', ...)` calls with adding a `DescentIntent` to the player entity.
- Do the same in `src/game/debug/server-debug-handler.ts`.
- Check `src/shared/components/intents.ts` to ensure `DescentIntent` exists and has `targetFloor` and `cost` fields.
- Remove `STAIRCASE_DESCEND_TRIGGERED` from `src/shared/events/types.ts`.

### 3. Manual AI Invocation (The AI Callback)
**Problem:** `TurnManager` manually calls `aiSystem.processEnemyTurn`. This is not ECS-compliant.
**Explicit Instruction:**
- Open `src/game/systems/ai.ts`.
- Add an `init()` method that calls `world.registerSystem(Phase.GATHER_INTENT, (w) => this.update(w))`.
- Create the `update(w: World)` function. It should query for all entities with `AIState` and `Energy`.
- If an entity is an enemy and has energy >= 1000 (threshold), call the appropriate `processXTurn` method.
- Open `src/game/engine-factory.ts`. Remove the `turnManager.setEnemyActionHandler` callback.
- Open `src/engine/turn/turn-manager.ts`. Remove the `enemyActionHandler` field and its usage in `processEnemyTurns`. The `TurnManager` should simply advance to `Phase.GATHER_INTENT`, and the `AISystem` (now registered) will act automatically.

### 4. Firmware RPC Anti-pattern
**Problem:** `TurnManager` (via `engine-factory.ts`) calls `firmwareSystem.activateAbility` directly.
**Explicit Instruction:**
- Define a `FirmwareIntent` in `src/shared/components/intents.ts`. It needs `slotIndex`, `targetX`, and `targetY`.
- Update `src/game/engine-factory.ts` and `src/game/setup.ts` to add this component to the player instead of calling the system method.
- Update `src/game/systems/firmware.ts` to register an `update` function in `Phase.ACTION` or `Phase.REACTION` that processes `FirmwareIntent`.

### 5. Debug Handler Refactor
**Problem:** `server-debug-handler.ts` is an RPC mess.
**Explicit Instruction:**
- For `SET_HEAT`, add a `HeatIntent` or `VentIntent`.
- For `SET_HP`, use `DamageIntent` (with negative values for healing, or create a `HealIntent`).
- For `STATUS`, use an `ApplyStatusEffectIntent`.
- The debug handler should only be responsible for attaching these components and letting the systems resolve them in the next tick.

### 6. Logic Leak in Pipeline.ts
**Problem:** `BURN_SOFTWARE` logic is sitting in `pipeline.ts`.
**Explicit Instruction:**
- Create a `BurnSoftwareIntent` component.
- Move the logic from `pipeline.ts` (switch case `BURN_SOFTWARE`) into a new system or into `SoftwareSystem`.
- `pipeline.ts` should only be a thin wrapper that adds the intent.

---

## 🧪 Verification Protocol
1. **Type Check:** Run `npx tsc --noEmit`. Fix any component or event type mismatches.
2. **Unit Tests:** Run `npm test`. Pay special attention to `combat.test.ts`, `item-pickup.test.ts`, and `ai.test.ts`.
3. **Build:** Run `npm run build`. This ensures the Next.js API routes and client bundles are compatible with the changes.
4. **Visual Audit:** Verify that `Vampire.exe` heals once, and debug commands still work (via intents).
