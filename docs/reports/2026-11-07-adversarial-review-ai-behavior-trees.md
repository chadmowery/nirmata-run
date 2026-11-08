# Adversarial Architectural & Implementation Review: AI Behavior Trees & Dijkstra Spatial Maps (`BT-M1` – `BT-M4`)

**Date:** 2026-11-07  
**Branch Reviewed:** `feature/ai-behavior-trees-dijkstra` (`2d4fd452..eb3e5794`, 57 files changed)  
**Target Specs:**
- [`docs/design/AI-BEHAVIOR-TREES-DIJKSTRA.md`](../design/AI-BEHAVIOR-TREES-DIJKSTRA.md)
- [`docs/design/ENEMY-HIERARCHY.md`](../design/ENEMY-HIERARCHY.md)
- [`AGENTS.md`](../../AGENTS.md), [`src/engine/AGENTS.md`](../../src/engine/AGENTS.md), [`src/shared/AGENTS.md`](../../src/shared/AGENTS.md), [`src/server/AGENTS.md`](../../src/server/AGENTS.md), [`src/dev-tool/AGENTS.md`](../../src/dev-tool/AGENTS.md)

---

## 1. Executive Summary

An adversarial audit was conducted across the 7 commits on `feature/ai-behavior-trees-dijkstra` implementing Milestones `BT-M1` through `BT-M4` (Pure Engine AI Primitives, Shared Zod AST & Intents, Authoritative `AISystem` & Archetype Templates, and Gamedata Studio Visual AST Editor + Debug Overlays).

### What Went Right
- **Strict Layer Isolation (`@engine/ai`)**: [`src/engine/ai/dijkstra-map.ts`](../../src/engine/ai/dijkstra-map.ts) and [`src/engine/ai/behavior-tree.ts`](../../src/engine/ai/behavior-tree.ts) have zero external imports, use flat `Float32Array` buffers and a zero-allocation binary min-heap, and enforce deterministic `MAX_TREE_DEPTH = 16` / `MAX_VISITED_NODES = 64` circuit breakers.
- **Phase-Driven Intent Discipline**: [`SpawnEntitySystem`](../../src/game/systems/spawn-entity.ts) and [`TileCorruptionSystem`](../../src/game/systems/tile-corruption.ts) properly route entity creation and destruction through ECS intents and [`GravediggerSystem`](../../src/game/systems/gravedigger.ts) (`Dying`), respecting the Death Protocol.
- **Complete Legacy Replacement**: All legacy hardcoded `switch (ai.behavior)` branches in [`AISystem`](../../src/game/systems/ai.ts) were cleanly retired in favor of JSON-authored behavior tree templates in [`src/game/entities/templates/ai/*.json`](../../src/game/entities/templates/ai/).

### Adversarial Findings Scorecard

| ID | Severity | Layer | Finding Summary | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`BT-REV-01`** | **P0 (Critical)** | `@game` | **`System_Admin` Prop Crushing (`canCrushProps`), Adjacency Termination, and Disruption Log Are Broken**: `system-admin.json` lacks an `Attack` component so `CombatSystem` silently drops its `AttackIntent` against crates (stalling it forever); `MELEE_BUMP_TARGET` when already adjacent converts `MoveIntent` to `AttackIntent` without `MovedThisTurn` so `RunEnderSystem` never triggers `ADMIN_CONTACT`; disruption combat log message was lost. | **RESOLVED** |
| **`BT-REV-02`** | **P0 (Critical)** | `@game` | **Dijkstra Passability & Dynamic Entity Penalty (`+0.5`) Route Enemies Straight Into Impassable Props, Locked Vault Doors, and Allies**: `AISpatialSystem.getStepCostFn` ignores blocking entities (`BlocksMovement`, `Prop`, locked `SecurityLock` doors), and `AISystem`'s `+0.5` dynamic occupant penalty is smaller than the `-1.0` step-closer gain (`-1.0 + 0.5 = -0.5`), causing enemies with `canCrushProps: false` to repeatedly bump props/allies and waste turns. |
| **`BT-REV-03`** | **P0 (High)** | `@game` / `@engine` | **Sequential Per-Enemy Turn Execution Wipes `AlertIntent` and `packAlerted` Across Enemies**: `TurnManager.processEnemyTurns` runs `AISystem.update` sequentially once per ready enemy. Enemy 1's pass deletes all `AlertIntent` components from the world and clears `alertedThisTurn`/`packAlerted` before Enemy 2's pass runs. |
| **`BT-REV-04`** | **P1 (High)** | `@game` / `@shared` | **`Logic-Leaker` Never Uses `kite_to_cover` at Range 3–5 & Unwired Schema Parameters**: In `logic-leaker.json`, `RANGED_ATTACK_TARGET` at range `3..5` always succeeds before `kite-to-optimal-cover` can ever run. Furthermore, `optimalRangeMin`/`optimalRangeMax`, `scavenge_nearest_loot`, `patrol_anchors`, `SPAWN_ENTITIES_AROUND_SELF.count`, and `nearby_loot_value` are defined in `ai-tree.ts` but unwired in `ai.ts`. |
| **`BT-REV-05`** | **P1 (Medium)** | `@rendering` | **`/debug-ai` PixiJS Overlay Renders Fake Hardcoded Manhattan Distance Instead of `DijkstraMap` Values**: `RenderSystem` (`render-system.ts:886-900`) ignores `DijkstraMap` and `aiDebugMapType`, computing raw `\|dx\| + \|dy\|` through walls. |
| **`BT-REV-06`** | **P1 (Medium)** | `@engine` / `@shared` | **BT Telemetry Trace (`lastEvaluatedPath`) Records Failed Branches & Leaks Unredacted Through Fog of War**: `SELECTOR`/`SEQUENCE` push trace entries before child evaluation and never roll back failed branches; `UTILITY_SELECTOR` omits the winning branch name; `lastEvaluatedPath` is not stripped in `redactWorldForClient`/`redactDeltaForClient`. |
| **`BT-REV-07`** | **P1 (Medium)** | `@game` | **`TileCorruptionSystem` & `SPAWN_ENTITIES_AROUND_SELF` State/Grid Bugs**: `spreadCorruption` overwrites the 1st corrupted tile key with the 2nd on every turn due to a stale `state` reference in a loop, displaces entities without checking occupant collision or emitting `ENTITY_MOVED`, and `SPAWN_ENTITIES_AROUND_SELF` stacks duplicate `DeadZone` entities on the same tile. |
| **`BT-REV-08`** | **P2 (Low/Med)** | `@dev-tool` | **Gamedata Studio `BehaviorTreeEditor` Emits Schema-Invalid ASTs & Omits Schema Fields**: Switching node types or adding utility branches creates empty `children: []` / `branches: []` / `considerations: []` arrays that fail Zod `.min(1)` validation; action switching drops `combatMessage`; several condition/action/curve parameters lack UI inputs; `ecs-rules.ts` is missing new runtime intents. |

---

## 2. Deep-Dive Root Cause Analysis

### `BT-REV-01` (P0 Critical): `System_Admin` Prop Crushing (`canCrushProps`), Adjacency Termination, and Disruption Log Are Broken

- **Locations**:
  - [`src/game/entities/templates/system-admin.json:1-31`](../../src/game/entities/templates/system-admin.json#L1-L31)
  - [`src/game/entities/templates/ai/system-admin.json:1-33`](../../src/game/entities/templates/ai/system-admin.json#L1-L33)
  - [`src/game/systems/ai.ts:555-572`](../../src/game/systems/ai.ts#L555-L572)
  - [`src/game/systems/combat.ts:590-596`](../../src/game/systems/combat.ts#L590-L596)
  - [`src/game/systems/run-ender.ts:264-281`](../../src/game/systems/run-ender.ts#L264-L281)
- **Root Cause**:
  1. **`canCrushProps` deals 0 damage and stalls `System_Admin` forever**:
     In [`src/game/systems/ai.ts:559-572`](../../src/game/systems/ai.ts#L559-L572), when `action.canCrushProps` is `true` and a destructible prop (`InteractiveSurface` + `Health`) occupies the best adjacent step, `AISystem` emits `w.addComponent(entityId, AttackIntent, { targetId: destructiblePropId })`.
     However, [`system-admin.json`](../../src/game/entities/templates/system-admin.json) only inherits `"mixins": ["physical"]` (`position`, `sprite`, `blocksMovement`) and **does not have an `Attack` component**. When [`CombatSystem`](../../src/game/systems/combat.ts#L590-L596) processes that `AttackIntent`:
     ```ts
     const attackerAttack = w.getComponent(entityId, Attack);
     const targetHealth = w.getComponent(intent.targetId, Health);

     if (!attackerAttack || !targetHealth) {
       w.removeComponent(entityId, AttackIntent);
       continue;
     }
     ```
     `CombatSystem` silently deletes `AttackIntent` without dealing damage! On the next turn, `System_Admin` targets the same intact crate again, looping forever. The unit test in [`src/game/systems/__tests__/ai-upgraded-behaviors.test.ts:318-348`](../../src/game/systems/__tests__/ai-upgraded-behaviors.test.ts#L318-L348) only asserted `world.hasComponent(adminId, AttackIntent)` after `AISystem.update()` and never ran `CombatSystem.update()`.
  2. **Adjacency termination (`ADMIN_CONTACT`) fails when `System_Admin` starts its turn adjacent to the player**:
     In [`src/game/entities/templates/ai/system-admin.json:14-21`](../../src/game/entities/templates/ai/system-admin.json#L14-L21), when `System_Admin` is at distance `<= 1` (e.g. after `DISRUPT` expires while the player is adjacent, or when the player steps/teleports adjacent), the `terminate-adjacent-target` branch runs `MELEE_BUMP_TARGET`. This emits a `MoveIntent` onto the player's tile. [`MovementSystem`](../../src/game/systems/movement.ts#L172-L185) intercepts moving onto an entity with `Health`, converts `MoveIntent` into `AttackIntent`, and **does not attach `MovedThisTurn`**. Next, `CombatSystem` drops `AttackIntent` because `System_Admin` has no `Attack` component. Finally, [`RunEnderSystem.checkAdminCollision`](../../src/game/systems/run-ender.ts#L266-L281) only iterates `w.query(MovedThisTurn)`! Because neither `System_Admin` nor the player moved onto each other that turn, `ADMIN_CONTACT` never fires.
  3. **Lost Disruption Combat Message**:
     Previously on `main`, when `System_Admin` had `DISRUPT`, `AISystem` emitted `"System_Admin is disrupted and cannot move!"` via `MESSAGE_EMITTED` (tested in [`src/game/systems/ai.test.ts:276`](../../src/game/systems/ai.test.ts#L276)). In [`ai/system-admin.json:6-12`](../../src/game/entities/templates/ai/system-admin.json#L6-L12), `skip-if-disrupted` uses `WAIT` with no `message` field, and `executeWait` in [`ai.ts:681`](../../src/game/systems/ai.ts#L681) ignores `action.message` anyway.

---

### `BT-REV-02` (P0 Critical): Dijkstra Passability & Dynamic Entity Penalty (`+0.5`) Route Enemies Into Impassable Props, Locked Vault Doors, and Allies

- **Locations**:
  - [`src/game/ai/spatial-maps.ts:130-152`](../../src/game/ai/spatial-maps.ts#L130-L152)
  - [`src/game/systems/ai.ts:526-573`](../../src/game/systems/ai.ts#L526-L573)
  - [`src/game/systems/movement.ts:169-192`](../../src/game/systems/movement.ts#L169-L192)
- **Root Cause**:
  1. **Static Blocking Props & Locked Vault Doors Ignored by `AISpatialSystem`**:
     In [`src/game/ai/spatial-maps.ts:130-152`](../../src/game/ai/spatial-maps.ts#L130-L152), `getStepCostFn` checks `if (!this.grid.isWalkable(x, y)) return Infinity;`. In Nirmata Runner, props (`Prop` + `BlocksMovement`, such as crates, workstations, lockers, safes, and locked `SecurityLock` vault doors) are placed on walkable floor tiles in `grid.getEntitiesAt(x, y)` rather than mutating `grid.setWalkable(false)`. Consequently, `approach_target`, `flee_from_target`, `kite_to_cover`, and `pack_surround_cardinal` compute paths straight through locked vault doors and indestructible props at cost `1.0`.
  2. **`+0.5` Dynamic Occupant Penalty Is Mathematically Too Small to Deter Stepping Into Blockers**:
     In [`src/game/systems/ai.ts:526-544`](../../src/game/systems/ai.ts#L526-L544):
     ```ts
     const dynamicPenaltyFn = (nx: number, ny: number): number => {
       const occupants = this.grid.getEntitiesAt(nx, ny);
       let penalty = 0;
       for (const occId of occupants) {
         if (occId === entityId || occId === playerEntity) continue;
         if (w.hasComponent(occId, BlocksMovement)) {
           penalty += 0.5;
         }
       }
       return penalty;
     };
     ```
     When a tile `(nx, ny)` is 1 step closer to the player than `(pos.x, pos.y)`, its Dijkstra score is `currentScore - 1.0`. Adding `+0.5` yields `currentScore - 0.5`, which is **still strictly less than `currentScore` (`bestScore`)**!
     Therefore, any enemy with `canCrushProps: false` (every normal enemy) selects the blocked tile `(nx, ny)` and emits `MoveIntent(nx, ny)`. When [`MovementSystem`](../../src/game/systems/movement.ts#L188-L191) runs, it sees a non-hostile entity with `BlocksMovement` (either a prop or another enemy ally) and aborts the move (`blocked = true`), wasting the enemy's entire turn instead of stepping around the obstacle.

---

### `BT-REV-03` (P0 High): Sequential Per-Enemy Turn Execution Wipes `AlertIntent` and `packAlerted` Across Enemies

- **Locations**:
  - [`src/engine/turn/turn-manager.ts:86-97`](../../src/engine/turn/turn-manager.ts#L86-L97)
  - [`src/engine/turn/turn-manager.ts:184-202`](../../src/engine/turn/turn-manager.ts#L184-L202)
  - [`src/game/systems/ai.ts:196-248`](../../src/game/systems/ai.ts#L196-L248)
- **Root Cause**:
  Look at how [`TurnManager`](../../src/engine/turn/turn-manager.ts) executes turns:
  1. During the player's action sequence (`executeTurnCycle` line 90), `executeActionSequence()` runs `Phase.GATHER_INTENT` (`AISystem.update`). No enemy has `Acting` yet, **or** if an enemy triggered an `AlertIntent` during the player's `ACTION`/`REACTION` phase (e.g., player attack noise in `CombatSystem` attaching `AlertIntent`), `processEnemyTurns()` then runs at line 94.
  2. Inside [`TurnManager.processEnemyTurns()`](../../src/engine/turn/turn-manager.ts#L184-L202), the engine loops over ready enemies **one at a time**, attaching `Acting` to a single `actorId` and calling `this.executeActionSequence()` for each enemy:
     ```ts
     this.world.addComponent(actorId, Acting, {});
     this.executeActionSequence();
     this.world.removeComponent(actorId, Acting);
     ```
  3. On **Enemy 1's** `executeActionSequence()`, `AISystem.update()` ([`ai.ts:196-221`](../../src/game/systems/ai.ts#L196-L221)) iterates **all** `w.query(AIState)` entities (`Enemy 1`, `Enemy 2`, `Enemy 3`...) and:
     - Resets `alertedThisTurn: false` and `packAlerted: false` on **all** enemies.
     - Consumes `AlertIntent` on **all** enemies and calls `w.removeComponent(entityId, AlertIntent)`.
     - Then at line 243 (`for (const entityId of w.query(Position, AIState, Acting))`), it only runs behavior tree evaluation for **Enemy 1**!
  4. Immediately afterward in the same turn, `processEnemyTurns()` attaches `Acting` to **Enemy 2** and calls `executeActionSequence()`. `AISystem.update()` runs a second time, resets `alertedThisTurn: false` on **Enemy 2**, and checks `w.getComponent(Enemy2, AlertIntent)`—which was already deleted during Enemy 1's pass! Enemy 2 completely loses its acoustic `AlertIntent`.
  5. Additionally, in [`ai.ts:224-240`](../../src/game/systems/ai.ts#L224-L240), `AISystem.update()` computes `packAlerted` by checking `fov?.canSeePlayer` **before** `processEnemyTurn` updates `FovAwareness.canSeePlayer` at lines 280–301. And because `AISystem.update()` runs during the player's `GATHER_INTENT` phase (when no enemy is `Acting`), any `AlertIntent` attached before `GATHER_INTENT` is consumed and wiped before `processEnemyTurns()` even begins!

---

### `BT-REV-04` (P1 High): `Logic-Leaker` Never Uses `kite_to_cover` at Firing Range (3–5) & Unwired Schema Parameters

- **Locations**:
  - [`src/game/entities/templates/ai/logic-leaker.json:19-50`](../../src/game/entities/templates/ai/logic-leaker.json#L19-L50)
  - [`src/shared/components/ai-tree.ts:52-135`](../../src/shared/components/ai-tree.ts#L52-L135)
  - [`src/game/systems/ai.ts:512-521`](../../src/game/systems/ai.ts#L512-L521)
  - [`src/game/systems/ai.ts:606-643`](../../src/game/systems/ai.ts#L606-L643)
  - [`src/game/systems/ai.ts:703-715`](../../src/game/systems/ai.ts#L703-L715)
- **Root Cause**:
  1. **`Logic-Leaker` (`ranged_kiter`) Dead Kiting Branch at Range 3–5**:
     In [`src/game/entities/templates/ai/logic-leaker.json`](../../src/game/entities/templates/ai/logic-leaker.json):
     - Branch 1 (`flee-when-cornered`): If `TARGET_DISTANCE_LTE 2`, flee via `flee_from_target`.
     - Branch 2 (`snipe-from-optimal-range`): If `TARGET_VISIBLE` and `TARGET_DISTANCE_BETWEEN 3..5`, execute `RANGED_ATTACK_TARGET`. Because `RANGED_ATTACK_TARGET` has no cooldown or cover prerequisite, it **always returns `SUCCESS`** whenever distance is `3..5`.
     - Branch 3 (`kite-to-optimal-cover`): If `TARGET_VISIBLE`, `MOVE_DIJKSTRA` with `mapType: "kite_to_cover", optimalRangeMin: 3, optimalRangeMax: 5`.
     Because Branch 2 always succeeds at range `3..5`, Branch 3 is **only ever reached when distance >= 6**! Once `Logic-Leaker` steps to distance 5, it stands still in the open firing every turn and never seeks cover tiles adjacent to walls (`kite_to_cover`), contradicting [`docs/design/AI-BEHAVIOR-TREES-DIJKSTRA.md:106`](../design/AI-BEHAVIOR-TREES-DIJKSTRA.md#L106) (*"Maintains range `[3, 5]`, preferring tiles adjacent to wall cover while keeping LOS to player"*).
  2. **Unwired Zod Schema Parameters in `ai-tree.ts` vs `ai.ts`**:
     - `MOVE_DIJKSTRA.optimalRangeMin` & `optimalRangeMax` ([`ai-tree.ts:95-96`](../../src/shared/components/ai-tree.ts#L95-L96)): Passed in `logic-leaker.json`, but [`AISystem.executeMoveDijkstra`](../../src/game/systems/ai.ts#L512-L521) and [`AISpatialSystem.getKiteToCoverMap`](../../src/game/ai/spatial-maps.ts#L198-L253) hardcode `dist >= 3 && dist <= 5` and ignore the action parameters.
     - `MOVE_DIJKSTRA.mapType` `'scavenge_nearest_loot'` and `'patrol_anchors'` ([`ai-tree.ts:56-57`](../../src/shared/components/ai-tree.ts#L56-L57)): In [`ai.ts:512-521`](../../src/game/systems/ai.ts#L512-L521), both fall through the `switch` `default:` branch to `getApproachPlayerMap(playerId)` instead of computing loot or anchor maps.
     - `SPAWN_ENTITIES_AROUND_SELF.count` ([`ai-tree.ts:116`](../../src/shared/components/ai-tree.ts#L116)): [`AISystem.executeSpawnEntitiesAroundSelf`](../../src/game/systems/ai.ts#L606-L643) ignores `action.count` and always spawns on all 4 cardinal tiles.
     - `UtilityConsideration.metric: 'nearby_loot_value'` ([`ai-tree.ts:144`](../../src/shared/components/ai-tree.ts#L144)): [`AISystem.readUtilityMetric`](../../src/game/systems/ai.ts#L711-L712) is hardcoded to `return 0.0;`.
     - `WAIT.message` ([`ai-tree.ts:132`](../../src/shared/components/ai-tree.ts#L132)): [`AISystem.executeWait`](../../src/game/systems/ai.ts#L681-L683) ignores `action.message` instead of emitting `MESSAGE_EMITTED` when present.

---

### `BT-REV-05` (P1 Medium): `/debug-ai` PixiJS Overlay Renders Fake Hardcoded Manhattan Distance Instead of `DijkstraMap` Values

- **Locations**:
  - [`src/rendering/render-system.ts:865-913`](../../src/rendering/render-system.ts#L865-L913)
  - [`src/dev-tool/terminal/DevTerminal.tsx:167-189`](../../src/dev-tool/terminal/DevTerminal.tsx#L167-L189)
- **Root Cause**:
  In [`src/rendering/render-system.ts:886-900`](../../src/rendering/render-system.ts#L886-L900):
  ```ts
  const isFlee = this.aiDebugMapType === 'flee_from_target';
  for (let y = 0; y < this.grid.height; y++) {
    for (let x = 0; x < this.grid.width; x++) {
      if (!this.grid.isWalkable(x, y)) continue;
      const dist = Math.abs(x - playerPos.x) + Math.abs(y - playerPos.y);
      if (dist > 16) continue;
      const normalized = Math.min(1, dist / 16);
      const alpha = (1 - normalized) * 0.35;
      const color = isFlee ? 0xff4444 : 0x00f0ff;
      this.aiHeatmapGraphics.rect(x * ts, y * ts, ts, ts).fill({ color, alpha });
    }
  }
  ```
  - It never instantiates or evaluates [`DijkstraMap`](../../src/engine/ai/dijkstra-map.ts) (which lives in `@engine/ai/dijkstra-map` and is 100% legal to import into `@rendering`).
  - It computes straight-line Manhattan distance through solid walls, ignores hazards, and treats `kite_to_cover`, `pack_surround_cardinal`, and `approach_target` identically.

---

### `BT-REV-06` (P1 Medium): BT Telemetry Trace (`lastEvaluatedPath`) Records Failed Branches & Leaks Unredacted Through Fog of War

- **Locations**:
  - [`src/engine/ai/behavior-tree.ts:105-169`](../../src/engine/ai/behavior-tree.ts#L105-L169)
  - [`src/shared/serialization.ts:52-135`](../../src/shared/serialization.ts#L52-L135)
- **Root Cause**:
  1. **Polluted `lastEvaluatedPath` Trace**:
     In [`src/engine/ai/behavior-tree.ts:111,122,135,147`](../../src/engine/ai/behavior-tree.ts#L111-L169), `evalNode` calls `ctx.recordTrace(node.name)` at the entry of every `SELECTOR`, `SEQUENCE`, `INVERTER`, and `UTILITY_SELECTOR` before knowing whether the branch succeeds. When an enemy executes its 4th selector branch (e.g. `pursue-last-known-pos`), `lastEvaluatedPath` contains `["null-pointer-root", "stun-or-disrupt-guard", "ambush-teleport-strike", "melee-strike", "pursue-last-known-pos"]`—making it look in the Tile Inspector like the enemy executed stun, teleport, and melee in the same turn! Conversely, `UTILITY_SELECTOR` (lines 147–168) never calls `ctx.recordTrace(bestBranch.name)` for the winning utility branch.
  2. **Unredacted `lastEvaluatedPath` Over the Wire**:
     In [`src/shared/serialization.ts:52-135`](../../src/shared/serialization.ts#L52-L135), `redactWorldForClient` and `redactDeltaForClient` strip unseen entities outside player FOV, **except** when an entity is in `explored` tiles or when `AIState` is serialized without stripping server-internal telemetry. Furthermore, even for visible or explored entities, `lastEvaluatedPath` mutates every turn, bloating `ECSWorldDelta` payloads unless normalized or only updated on change.

---

### `BT-REV-07` (P1 Medium): `TileCorruptionSystem` & `SPAWN_ENTITIES_AROUND_SELF` State/Grid Bugs

- **Locations**:
  - [`src/game/systems/tile-corruption.ts:154-237`](../../src/game/systems/tile-corruption.ts#L154-L237)
  - [`src/game/systems/ai.ts:606-643`](../../src/game/systems/ai.ts#L606-L643)
- **Root Cause**:
  1. **Stale `state.corruptedTileKeys` Overwrite in Loop**:
     In [`src/game/systems/tile-corruption.ts:161-213`](../../src/game/systems/tile-corruption.ts#L161-L213), `const state = w.getComponent(corrupterId, TileCorrupterState);` is read once before the `for (const tile of toCorrupt)` loop (`tilesPerTurn: 2`). Inside the loop at line 210:
     ```ts
     w.patchComponent(corrupterId, TileCorrupterState, {
       corruptedTileKeys: [...state.corruptedTileKeys, key],
     });
     ```
     On the 2nd iteration of the loop, `state.corruptedTileKeys` still holds the pre-loop array, **overwriting the 1st tile key corrupted on that turn**! When `Seed_Corrupter` dies, `revertCorruption` only reverts half of the walls it created, leaving permanent unbreakable walls on the floor.
  2. **Unsafe Entity Displacement on Wall Creation**:
     In [`tile-corruption.ts:215-232`](../../src/game/systems/tile-corruption.ts#L215-L232), when a tile turns into a wall while occupied, it moves the occupant to the first walkable neighbor without checking `this.grid.getEntitiesAt(nx, ny)` for `BlocksMovement` (stacking two blocking entities on the same tile) and without emitting `GameplayEvents.ENTITY_MOVED`.
  3. **Duplicate `DeadZone` Stacking in `SPAWN_ENTITIES_AROUND_SELF`**:
     In [`src/game/systems/ai.ts:629-642`](../../src/game/systems/ai.ts#L629-L642), `executeSpawnEntitiesAroundSelf` (`Fragmenter` on-hit reaction) spawns a `dead-zone` entity on all 4 cardinal tiles without checking if an active `DeadZone` already exists on `(nx, ny)`. Unlike [`combat.ts:361-377`](../../src/game/systems/combat.ts#L361-L377) (which refreshes the existing `DeadZone`'s `turnsRemaining`), hitting a stationary `Fragmenter` twice stacks multiple `DeadZone` entities on the same tiles, multiplying periodic hazard damage.

---

### `BT-REV-08` (P2 Low/Medium): Gamedata Studio `BehaviorTreeEditor` Emits Schema-Invalid ASTs & Omits Schema Fields

- **Locations**:
  - [`src/dev-tool/studio/editors/subeditors/BehaviorTreeEditor.tsx:180-210`](../../src/dev-tool/studio/editors/subeditors/BehaviorTreeEditor.tsx#L180-L210)
  - [`src/dev-tool/studio/editors/subeditors/BehaviorTreeEditor.tsx:644-656`](../../src/dev-tool/studio/editors/subeditors/BehaviorTreeEditor.tsx#L644-L656)
  - [`src/dev-tool/studio/editors/subeditors/BehaviorTreeEditor.tsx:835-954`](../../src/dev-tool/studio/editors/subeditors/BehaviorTreeEditor.tsx#L835-L954)
  - [`src/dev-tool/studio/editors/shared/ComponentFieldGroup.tsx:200-214`](../../src/dev-tool/studio/editors/shared/ComponentFieldGroup.tsx#L200-L214)
  - [`src/app/api/dev/gamedata/ecs-rules.ts:8-58`](../../src/app/api/dev/gamedata/ecs-rules.ts#L8-L58)
- **Root Cause**:
  1. **Empty Array Violations of `.min(1)` in `BehaviorTreeNodeSchema`**:
     - `handleTypeChange` ([`BehaviorTreeEditor.tsx:189,196`](../../src/dev-tool/studio/editors/subeditors/BehaviorTreeEditor.tsx#L189-L196)) initializes `SELECTOR`/`SEQUENCE` with `children: []` and `UTILITY_SELECTOR` with `branches: []`.
     - `+ Add Utility Branch` ([`BehaviorTreeEditor.tsx:648`](../../src/dev-tool/studio/editors/subeditors/BehaviorTreeEditor.tsx#L648)) initializes `considerations: []`.
     All three immediately fail `BehaviorTreeNodeSchema.safeParse()` (`children.min(1)`, `branches.min(1)`, `considerations.min(1)` in [`ai-tree.ts:187-206`](../../src/shared/components/ai-tree.ts#L187-L206)), blocking saves until the user manually adds sub-items.
  2. **`combatMessage` Field Disappears After Switching Action Type**:
     Line 940 checks `{'combatMessage' in task && (...)}`, while `handleActionChange` (lines 837–853) constructs new `AIAction` objects without `combatMessage: undefined`, causing the input to vanish permanently once an action's type is changed.
  3. **Missing Editor Controls for Schema Fields**:
     - `UtilityConsideration`: missing `slope`, `minInput`, `maxInput`.
     - `AICondition`: missing `metric` (`manhattan` | `chebyshev`) on distance conditions and `target` (`self` | `player`) on `HAS_STATUS_EFFECT`.
     - `AIAction`: missing `WAIT.message`, `RANGED_ATTACK_TARGET.statusEffect`, `SPAWN_ENTITIES_AROUND_SELF.count` & `deadZoneConfig`, `TELEPORT_AMBUSH_BEHIND_TARGET.minRange`/`maxRange`/`searchRadius`, and `MOVE_DIJKSTRA.optimalRangeMin`/`optimalRangeMax`.
  4. **`ComponentFieldGroup.tsx` Inline Tree Forking**:
     Clicking `[EDIT INLINE TREE]` ([`ComponentFieldGroup.tsx:205`](../../src/dev-tool/studio/editors/shared/ComponentFieldGroup.tsx#L205)) overwrites the enemy's behavior with a generic 1-node `WAIT` stub instead of cloning the currently selected `treeId` template from `/api/dev/gamedata/ai-trees/[treeId]`.
  5. **`ecs-rules.ts` Outdated Runtime Intents & Admin Rule**:
     [`src/app/api/dev/gamedata/ecs-rules.ts:8-36`](../../src/app/api/dev/gamedata/ecs-rules.ts#L8-L36) is missing `'spawnEntityIntent'` and `'alertIntent'` in `RUNTIME_INTENT_OR_TAG_KEYS`, and `enemy-requires-hostile-and-aistate` (line 46) falsely flags `system-admin.json` (`aiState` + `invulnerable`, no `hostile`) as an error.

---

## 3. Phased Remediation Plan

### Phase 1: P0 Core AI Turn Loop, Spatial Passability & `System_Admin` Fixes (`BT-REV-01`, `BT-REV-02`, `BT-REV-03`)
1. **[x] Fix `System_Admin` Prop Crushing, Adjacency Termination & Disruption Log (`BT-REV-01`)**:
   - Add an `attack` component (`{ power: 999, range: 1, defense: 99 }`) to [`src/game/entities/templates/system-admin.json`](../../src/game/entities/templates/system-admin.json) or allow `CombatSystem` / `RunEnderSystem` to handle `System_Admin` cleanly:
     - Adding `"attack": { "power": 999, "range": 1, "defense": 99 }` to `system-admin.json` ensures `CombatSystem` one-shots any destructible prop targeted by `canCrushProps: true`.
     - In [`RunEnderSystem.checkAdminCollision`](../../src/game/systems/run-ender.ts#L264-L281) (or [`CombatSystem`](../../src/game/systems/combat.ts)), also check if an entity with `AdminOverlayEffect` (not `Dying`) is adjacent (`manhattan <= 1`) and targeting the player via `AttackIntent` or occupying the player's tile, OR in [`AISystem.executeMeleeBumpTarget`](../../src/game/systems/ai.ts#L671-L679), allow `System_Admin` (`AdminOverlayEffect`) to step directly onto the player's tile (`MovedThisTurn`) or trigger `ADMIN_CONTACT` on melee bump.
   - Add `"message": "System_Admin is disrupted and cannot move!"` to `skip-if-disrupted` in [`src/game/entities/templates/ai/system-admin.json`](../../src/game/entities/templates/ai/system-admin.json) and wire `AISystem.executeWait` to emit `MESSAGE_EMITTED` when `action.message` is defined.
2. **Fix Dijkstra Passability & Dynamic Entity Penalty (`BT-REV-02`)**:
   - In [`AISpatialSystem.getStepCostFn`](../../src/game/ai/spatial-maps.ts#L130-L152):
     - Query `this.grid.getEntitiesAt(x, y)` for static blocking entities (`Prop` + `BlocksMovement`, such as locked vault doors, walls/pillars, safes, crates).
     - If `ignoreDestructibleProps` is `false`: return `Infinity` for any entity with `Prop` and `BlocksMovement` so standard enemies route around crates, workstations, and locked vault doors.
     - If `ignoreDestructibleProps` is `true` (`System_Admin`): return `Infinity` for **indestructible** blocking props (`Prop` + `BlocksMovement` without `Health` + `InteractiveSurface`, e.g., locked vault doors), and a finite crush cost (e.g., `2.0`) for destructible props (`InteractiveSurface` + `Health`).
   - In [`AISystem.executeMoveDijkstra`](../../src/game/systems/ai.ts#L526-L573):
     - For `canCrushProps: false`, treat any neighbor tile occupied by a non-player entity with `BlocksMovement` as impassable (`return Infinity` in `dynamicPenaltyFn` or skip in neighbor selection) so enemies step around allies and props instead of bumping into them and losing their turn.
     - For `canCrushProps: true`, treat destructible props as valid targets for `AttackIntent` and other `BlocksMovement` entities (e.g. non-destructible props or other enemies) as high/infinite penalty.
3. **Fix Multi-Enemy Sequential Turn Loop Alert & Pack State (`BT-REV-03`)**:
   - In [`AISystem`](../../src/game/systems/ai.ts):
     - Stop wiping `alertedThisTurn`, `packAlerted`, and `AlertIntent` across **all** `AIState` entities on every single `AISystem.update()` invocation.
     - Instead, only consume `AlertIntent` and reset/compute `alertedThisTurn` & `packAlerted` for the **currently `Acting` entity** (inside `processEnemyTurn`), after refreshing FOV awareness for active pack members!

### Phase 2: P1 Archetype Behavior Trees, Schema Wiring & `TileCorruptionSystem` Fixes (`BT-REV-04`, `BT-REV-07`)
1. **Fix `Logic-Leaker` Cover Kiting & Wire All Schema Parameters (`BT-REV-04`)**:
   - Update [`AISpatialSystem.getKiteToCoverMap`](../../src/game/ai/spatial-maps.ts#L198-L253) to accept `(playerId, minRange = 3, maxRange = 5)` and wire `action.optimalRangeMin` / `action.optimalRangeMax` in [`AISystem.executeMoveDijkstra`](../../src/game/systems/ai.ts#L512-L521).
   - Wire `'scavenge_nearest_loot'` (goals at floor `Item` entities) and `'patrol_anchors'` (goals at `StabilityAnchorInteraction` entities) in `AISpatialSystem` and `AISystem.executeMoveDijkstra`.
   - Wire `nearby_loot_value` in [`AISystem.readUtilityMetric`](../../src/game/systems/ai.ts#L703-L715) (sum of nearby floor item values within awareness radius).
   - Wire `action.count` in [`AISystem.executeSpawnEntitiesAroundSelf`](../../src/game/systems/ai.ts#L606-L643) to cap the number of spawned entities.
   - Update [`src/game/entities/templates/ai/logic-leaker.json`](../../src/game/entities/templates/ai/logic-leaker.json) (or `kite_to_cover` evaluation) so `Logic-Leaker` repositions to an adjacent higher-cover tile when not already in cover, or fires when in optimal cover/range.
2. **Fix `TileCorruptionSystem` & Duplicate `DeadZone` Spawning (`BT-REV-07`)**:
   - In [`TileCorruptionSystem.spreadCorruption`](../../src/game/systems/tile-corruption.ts#L198-L236):
     - Accumulate `newCorruptedKeys` across the `for (const tile of toCorrupt)` loop and call `w.patchComponent(corrupterId, TileCorrupterState, { corruptedTileKeys: newCorruptedKeys })` once after the loop (and skip candidate tiles that are occupied by blocking entities, or verify `this.grid.getEntitiesAt(nx, ny)` has no `BlocksMovement` and emit `GameplayEvents.ENTITY_MOVED` when displacing).
   - In [`AISystem.executeSpawnEntitiesAroundSelf`](../../src/game/systems/ai.ts#L629-L642):
     - When `action.templateId === 'dead-zone'`, check `this.grid.getEntitiesAt(nx, ny)` for an existing `DeadZone` component; if present, refresh its `turnsRemaining` instead of queuing a duplicate `SpawnEntityIntent`.

### Phase 3: P1 Telemetry Trace, Fog-of-War Redaction & Real `/debug-ai` Dijkstra Heatmap (`BT-REV-05`, `BT-REV-06`)
1. **Fix `evaluateBehaviorTree` Trace Recording & Client Redaction (`BT-REV-06`)**:
   - In [`src/engine/ai/behavior-tree.ts`](../../src/engine/ai/behavior-tree.ts):
     - Snapshot `trace.length` before evaluating each child in `SELECTOR` / `SEQUENCE`; if a child returns `FAILURE`, restore `trace.length` so `lastEvaluatedPath` only contains the active/winning execution path!
     - In `UTILITY_SELECTOR`, record `bestBranch.name` onto the trace before evaluating `bestBranch.action`.
   - In [`src/shared/serialization.ts`](../../src/shared/serialization.ts):
     - Ensure `AIState` is stripped on non-visible entities or `lastEvaluatedPath` is redacted when outside player FOV.
2. **Render Real `DijkstraMap` Gradients in `/debug-ai` (`BT-REV-05`)**:
   - In [`src/rendering/render-system.ts:865-913`](../../src/rendering/render-system.ts#L865-L913):
     - Use a cached [`DijkstraMap`](../../src/engine/ai/dijkstra-map.ts) instance in `RenderSystem` (recomputed when `playerPos`, `aiDebugMapType`, or turn state changes) that respects wall/prop walkability, `flee_from_target` inversion (`-1.2`), `kite_to_cover` range/wall-cover goals, and `pack_surround_cardinal` cardinal goals.
     - Render both the true Dijkstra score gradient and optional numeric cost labels / downhill flow indicators.

### Phase 4: P2 Gamedata Studio `BehaviorTreeEditor` Schema Compliance & Verification Suite (`BT-REV-08`)
1. **Fix `BehaviorTreeEditor.tsx` & `ComponentFieldGroup.tsx` (`BT-REV-08`)**:
   - Seed non-empty default child/branch/consideration items when switching node types to `SELECTOR`, `SEQUENCE`, `UTILITY_SELECTOR`, or adding a utility branch so the AST is always Zod-valid.
   - Always render the optional `combatMessage` input on `ACTION` nodes regardless of whether `'combatMessage' in task` is currently set.
   - Add UI controls for `UtilityConsideration` (`slope`, `minInput`, `maxInput`), `AICondition` (`metric`, `target`), and `AIAction` (`WAIT.message`, `MOVE_DIJKSTRA.optimalRangeMin`/`optimalRangeMax`, `RANGED_ATTACK_TARGET.statusEffect`, `SPAWN_ENTITIES_AROUND_SELF.count`, `TELEPORT_AMBUSH_BEHIND_TARGET` range fields).
   - In [`ComponentFieldGroup.tsx`](../../src/dev-tool/studio/editors/shared/ComponentFieldGroup.tsx), seed `[EDIT INLINE TREE]` by fetching the active `treeId` JSON template when available.
   - Update [`src/app/api/dev/gamedata/ecs-rules.ts`](../../src/app/api/dev/gamedata/ecs-rules.ts) to include `'spawnEntityIntent'` and `'alertIntent'` in `RUNTIME_INTENT_OR_TAG_KEYS` and exempt `invulnerable` entities (`system-admin`) from `enemy-requires-hostile-and-aistate`.
2. **Regression & Integration Tests**:
   - Add end-to-end tests in [`src/game/systems/__tests__/ai-upgraded-behaviors.test.ts`](../../src/game/systems/__tests__/ai-upgraded-behaviors.test.ts) covering:
     - `System_Admin` crushing a crate through `AISystem` -> `CombatSystem` -> `GravediggerSystem` and advancing on the next turn.
     - `System_Admin` terminating the run when starting its turn already adjacent to the player.
     - Multi-enemy `TurnManager.processEnemyTurns` preserving `AlertIntent` and `packAlerted` across 2+ enemies in the same turn.
     - Standard enemies routing around blocking props / locked vault doors via `AISpatialSystem`.
     - `TileCorruptionSystem` preserving all `tilesPerTurn: 2` corrupted keys and reverting 100% of them on death.
   - Run `npm test`, `npm run typecheck`, and `npm run lint` to verify zero errors.
