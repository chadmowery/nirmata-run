---
phase: 12-multi-floor-generation-stability-extraction
plan: GAP-FIX
type: execute
wave: 3
depends_on: ["12-04"]
files_modified:
  - src/rendering/render-system.ts
  - src/game/systems/floor-manager.ts
  - src/shared/reconciliation.ts
autonomous: true
requirements:
  - FLOOR-01
  - STAB-05
---

<objective>
Fix identified gaps from Phase 12 UAT: Fog of War persistence and Floor 5 synchronization crash.

Purpose: Ensure stable floor transitions and accurate visual state resets during multi-floor runs.
Output: Fixed RenderSystem, FloorManagerSystem (client/server branch), and applyStateDelta with grid reconciliation.
</objective>

## Tasks

### Task 1: Fix Fog of War Persistence
expected: |
  1. Modify `src/rendering/render-system.ts`.
  2. Call `clearExplored(exploredSet)` at the beginning of `onDungeonGenerated()`.
  3. Verify that transitioning to a new floor clears the explored tile state in the UI.

### Task 2: Disable Local Floor Transition Prediction
expected: |
  1. Modify `src/game/systems/floor-manager.ts`.
  2. Add an `isClient` flag or similar check to `createFloorManagerSystem`.
  3. Prevent `descendToFloor` from executing its local logic if `isClient` is true (it should only respond to server-authoritative deltas via `applyStateDelta`).
  4. Ensure the server still executes the transition logic correctly.

### Task 3: Implement Grid & Terrain Reconciliation
expected: |
  1. Modify `src/shared/reconciliation.ts`.
  2. Update `applyStateDelta` to accept and patch `delta.grid` using `json-diff-ts`.
  3. After patching the grid, detect significant terrain changes (e.g., floor number change or layout diff).
  4. Emit `DUNGEON_GENERATED` from `applyStateDelta` to trigger renderer/UI refreshes on the client when a new floor is received.

### Task 4: Verify Fixes in UAT
expected: |
  1. Restart the dev server.
  2. Reach Floor 5 and verify no crash occurs.
  3. Verify Fog of War is reset on Floor 2+.
  4. Complete the remaining UAT tests (4, 5, 7).
