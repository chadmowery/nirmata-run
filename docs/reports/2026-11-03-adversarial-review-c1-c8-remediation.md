# Adversarial Architecture & Implementation Review: C1–C8 Remediation Audit

**Date:** 2026-11-03  
**Branch:** `feat/interactive-environments` (`45fd5e49..d00920a4`, 17 commits, 54 files changed)  
**Status:** ✅ **ALL FINDINGS REMEDIATED & VERIFIED (2026-11-03)**  
**Prior Report Audited:** [`docs/reports/2026-11-02-adversarial-review-interactive-environments.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/reports/2026-11-02-adversarial-review-interactive-environments.md)  
**Architecture References:** [`AGENTS.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/AGENTS.md), [`docs/architecture/SYSTEM_OVERVIEW.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/architecture/SYSTEM_OVERVIEW.md), [`docs/architecture/ENGINE_GUIDELINES.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/architecture/ENGINE_GUIDELINES.md), [`docs/architecture/DEATH_PROTOCOL.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/architecture/DEATH_PROTOCOL.md)

---

## 1. Executive Summary & Verdict

An adversarial audit and empirical runtime verification (750-floor procedural generation sweep + full-engine turn execution probes using [`createEngineInstance`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/engine-factory.ts#L345-L429) and [`registerCoreSystems`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/registration.ts#L59-L143)) were conducted against all 17 commits implementing fixes for critical findings **C1–C8**.

> [!IMPORTANT]
> **Post-Remediation Update (2026-11-03):** All findings identified in this audit have been remediated and verified against the 750-floor procedural invariant sweep, full-engine turn cycle probes, `npm run typecheck`, `npm run lint`, and the full Vitest suite (`150 test files / 971 tests passed`). See [Section 5: Remediation & Verification Summary](#5-remediation--verification-summary-2026-11-03) for full details.

### Overall Verdict: **3 of 8 Fixes Fail Completely in Production (`C5`, `C6`, `C7`), and 3 Have Severe Regressions or Bypass Vectors (`C1/C2`, `C3`, `C4`)**

A systemic anti-pattern—**the Hand-Wired Test Harness Fallacy**—caused `C5`, `C6`, and `C7` to pass their newly added unit tests while failing **100% of the time** in the real game engine:
- Each test manually instantiated only 2–3 systems in a custom order and invoked individual phases out of sequence, omitting [`registerCoreSystems`](file:///Users/chadmowery/personal/dev/dungeon-runner/src/game/systems/registration.ts#L59-L143) and [`TagCleanupSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/tag-cleanup.ts#L22-L67).
- When executed through the production [`TurnManager`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/turn/turn-manager.ts#L70-L162) and [`registerCoreSystems`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/registration.ts#L59-L143), [`TagCleanupSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/tag-cleanup.ts#L46-L62) wipes both `ActionAbortedTag` (C5) and `AlertIntent` (C6) during the player's `Phase.CLEANUP` before [`TurnManager`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/turn/turn-manager.ts#L96) or enemy `Phase.GATHER_INTENT` ever inspects them, and [`registerCoreSystems`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/registration.ts#L116-L119) registers `HealSystem` *before* `ItemPickupSystem` and `StatusEffectSystem` (the exact opposite of the test harness in [`c7-stability-heal.test.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/tests/game/c7-stability-heal.test.ts#L72-L77)).

### Scorecard Summary

| ID | Original Finding | Commits | Claimed Status | Actual Runtime Verdict | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C1** | Prefabs disconnected from BSP corridors (`95%` soft-lock rate) | `30ff0a4c` | Resolved | **PARTIALLY BROKEN / REGRESSED** — Post-prefab path carving & `corridorSet` wall skipping breach **91.9% (148/161)** of `zero-day-vault` walls; post-prop connectivity is unverified (**14.9%** of floors have prop-disconnected tiles; **13.1%** place staircase on wall/blocking prop; **1.7%** have unreachable staircase). | **P0 Critical** |
| **C2** | `zero-day-vault` unopenable (missing `access-key`, dual lock, Faraday mismatch) | `c4d2d761` | Resolved | **BROKEN** — **91.9%** of vaults can be walked into without unlocking the door; **100% (161/161)** attach `faradayBounds` to *both* the vault door and the inner safe (keeping Faraday active after unlocking the door); **14.1%** of floors spawn keys inside `CorruptedNode` containers that `MovementSystem` refuses to bump-open. | **P0 Critical** |
| **C3** | Full server ECS world leaked to client (loot/trap maphack) | `b1a7999a`, `1d7ed2f9` | Resolved | **BYPASSED** — Client still runs `createEngineInstance` (`placeEntities`) locally with the server's `seed` on Floor 1 (populating unredacted loot/traps in `window.gameContext.world`), receives `runSeed` on every floor, and receives the `corruptedNode` component on unrevealed traps (leaking which containers are trapped). | **P1 High** |
| **C4** | Unvalidated `PICKUP`, `DROP_ITEM`, and `INTERACT_PROP` payloads | `2f6f3aa6` | Resolved | **PARTIALLY BROKEN** — `PICKUP` falls back to client-supplied `targetX/targetY` when an item entity lacks `Position` (allowing players to duplicate already-carried/equipped items into `RunInventory`); `DROP_ITEM` destroys consumable stacks (`quantity > 1`). | **P1 High** |
| **C5** | Bumping locked/corrupted props wastes a full turn & energy | `32a8a320`, `635686d0` | Resolved | **100% BROKEN IN PRODUCTION** — `TagCleanupSystem` deletes `ActionAbortedTag` in `Phase.CLEANUP` before `TurnManager.executeTurnCycle` checks `wasActionAborted(playerId)`. Also, `Phase.PRE_TURN` executes before `Phase.ACTION` (allowing free `PRE_TURN` ticks if abort were fixed), and unrevealed `CorruptedNode` traps are blocked at 0 cost. | **P0 Critical** |
| **C6** | ECS Mandate #1 & #2 violations across `route.ts`, `PropInteraction`, `Teleport`, `ItemPickup`, `Stability` | `73842d7f`..`a61ab566` | Resolved | **PARTIALLY BROKEN** — `AlertIntent` is wiped by `TagCleanupSystem` in the player's `Phase.CLEANUP` before enemy `Phase.GATHER_INTENT` (**100% broken**); `AISystem` overwrites `canSeePlayer` and ignores `CHASING` when out of LoS; `route.ts` mutations were moved to procedural `processAction()` instead of ECS `Phase` systems and run *before* `turnManager.canAcceptInput()`. | **P0 Critical** |
| **C7** | Stability bleed bypasses `DamageIntent` & `HealIntent` has no consumer | `0d33d784` | Resolved | **BROKEN IN PRODUCTION** — `registerCoreSystems` initializes `heal.init()` *before* `itemPickup.init()` and `statusEffect.init()`. Neither `PRE_TURN` regen nor `REACTION` walk-over potion pickup heals during its phase. `resolveHealIntents` also resurrects `Dying` entities (`Health.current > 0` while `isAlive: false`). | **P0 Critical** |
| **C8** | `BURN_FIRMWARE` / `BURN_AUGMENT` bypasses Shell port limits | `91fccc2d`, `d00920a4` | Resolved | **MOSTLY RESOLVED (Minor Edge Cases)** — Capacity limits (`maxFirmware`, `maxAugment`) and index bounds are enforced, though `slotIndex >= equipped.length` silently appends to index `0`, and [`BackpackGrid.tsx`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/components/ui/inventory/BackpackGrid.tsx#L107) still fires raw `fetch('/api/action')` discarding server deltas. | **P2 Medium** |

---

## 2. Deep-Dive Findings by Critical Item (C1–C8)

### C1 & C2: Prefab Connectivity, `zero-day-vault` Integrity, and Key Reachability

#### What Was Changed
- **C1 (`30ff0a4c`)**: Added `portals` arrays to all 4 prefab JSONs ([`zero-day-vault.json`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/prefabs/zero-day-vault.json#L21-L26), [`decon-airlock.json`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/prefabs/decon-airlock.json#L20-L27), [`server-core.json`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/prefabs/server-core.json#L21-L28), [`freight-bay.json`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/prefabs/freight-bay.json#L21-L28)). Modified [`applyPrefabToRoom`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/dungeon-generator.ts#L221-L327) to center prefabs inside rooms, skip placing `#` walls on tiles in `corridorSet`, carve L-paths from portals to room doors, and retry floor generation up to 5 times if flood-fill connectivity fails ([`dungeon-generator.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/dungeon-generator.ts#L100-L157)).
- **C2 (`c4d2d761`)**: Replaced the second `prop-vault-door` in [`zero-day-vault.json`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/prefabs/zero-day-vault.json#L27-L38) with a walkable portal at `(4, 7)`, added `item-access-key` to [`entity-placement.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/entity-placement.ts#L497-L561), and dynamically computed `faradayBounds` via [`findMatchingFaradayBounds`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/entity-placement.ts#L679-L690).

#### Adversarial Findings & Empirical Proof (750-Floor Sweep)
Running [`generateDungeon`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/dungeon-generator.ts#L100-L157) + [`placeEntities`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/entity-placement.ts#L120-L605) across 750 floors (50 seeds × 15 depths) revealed five critical defects:

1. **91.9% of Zero-Day Vaults (148 / 161) Have Breached Walls — Bypassing `prop-vault-door` Entirely**:
   - **Root Cause A (`corridorSet` wall skipping)**: In [`bsp.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/generation/bsp.ts#L254-L282), BSP L-corridors are carved from **room center to room center**, meaning `corridor.points` runs straight through the interior of rooms before stopping. In [`dungeon-generator.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/dungeon-generator.ts#L260-L274), `corridorSet` includes every point of every corridor and refuses to place a prefab `#` wall if `corridorSet.has(`${gx},${gy}`)`. This punches holes straight through `zero-day-vault`'s perimeter `#` walls!
   - **Root Cause B (`carveWalkablePath` from room doors to south portal)**: In [`dungeon-generator.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/dungeon-generator.ts#L315-L325), for every room entrance door `rd`, the generator calls `carveWalkablePath(grid, rd.x, rd.y, startX + nearestPortal.x, startY + nearestPortal.y)`. Because `zero-day-vault` only has a single portal at the south `(4, 7)` and often fills the entire room (`9×8`), when a room door `rd` is on the north, east, or west wall of the room, the L-shaped path (`x` first, then `y`) carves floor tiles straight through the vault's outer walls and interior room. Players can simply walk through the carved breach directly to `prop-safe-locked` without ever unlocking `prop-vault-door`.

2. **100% of Zero-Day Vaults (161 / 161) Attach `faradayBounds` to Both `prop-vault-door` AND `prop-safe-locked`**:
   - In [`entity-placement.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/entity-placement.ts#L679-L690), `findMatchingFaradayBounds(x, y, faradayZones)` checks whether a `SecurityLock` entity's `(x, y)` lies inside `zone.bounds`.
   - Both `prop-vault-door` at `(4, 6)` and `prop-safe-locked` at `(4, 2)` have `SecurityLock` components and both lie inside the vault's `faradayBounds`!
   - In [`TeleportSystem.isInsideFaradayCage`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/teleport.ts#L43-L61), the system queries *all* entities with `SecurityLock` where `lock.isLocked && lock.faradayBounds`. Consequently, unlocking `prop-vault-door` **never disables the Faraday cage** as long as `prop-safe-locked` inside the vault remains locked—and unlocking `prop-safe-locked` consumes a second `access-key` (or `BREACH.exe`), even though the floor only guarantees spawning keys for the vault itself (`vaultCount`).

3. **14.1% of Floors (106 / 750) Hide the Floor's `access-key` Inside a `CorruptedNode` Container**:
   - In [`entity-placement.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/entity-placement.ts#L473-L492), procedural containers have up to a 30% chance to receive a `CorruptedNode` component.
   - Immediately afterward ([`entity-placement.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/entity-placement.ts#L521-L528)), `accessibleContainers` filters out containers with `SecurityLock` or inside `faradayZones`, but **does not filter out containers with `CorruptedNode`**.
   - Because C5 modified [`MovementSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/movement.ts#L106-L120) to block bump-interaction on *any* armed `CorruptedNode` (`!corrupted.disarmed`) and there is no UI control to send an explicit `INTERACT_PROP` action, a player without `LOGIC_JAM.exe` cannot open the container to retrieve the `access-key`!

4. **14.9% of Floors (112 / 750) Have Walkable Tiles Disconnected by `BlocksMovement` Props, and 13.1% (98 / 750) Spawn the Extraction Staircase on a Wall or Blocking Prop**:
   - [`generateDungeon`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/dungeon-generator.ts#L118-L132) runs `validateWalkableConnectivity(grid)` **before** [`placeEntities`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/entity-placement.ts#L120-L605) spawns immovable `BlocksMovement` props (`prop-workstation`, `prop-biocabinet`, `prop-cryo-vat`, `prop-capacitor-bank`, `prop-crate-cover`, etc.).
   - Furthermore, [`placeEntities`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/entity-placement.ts#L156-L194) spawns `staircase` and `anchor` at `room.centerX, room.centerY` without checking whether a prefab (such as `server-core`, which puts `#` walls at `(4..5, 3..4)`, or `zero-day-vault`) placed a wall or blocking prop at the room center. Across 750 floors, **98 floors** placed the staircase on a wall or blocking prop, and **13 floors (1.7%)** rendered the extraction staircase completely unreachable from the player spawn.

---

### C3: Server State Leakage & Incomplete Client Redaction

#### What Was Changed
- Commits `b1a7999a` and `1d7ed2f9` added [`redactWorldForClient`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/shared/serialization.ts#L221-L241) and [`serializeECSWorldForClient`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/shared/serialization.ts#L247-L253), and updated [`createECSWorldDelta`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/shared/ecs-delta.ts#L67-L133) to strip `Container.storedLoot`, `scrapYield`, `fluxYield`, `grantsAccessKey` (when `isOpened === false`) and strip `CorruptedNode.trapType` (when `revealed === false && disarmed === false`).

#### Adversarial Findings
1. **Client Still Runs Full Unredacted `placeEntities` Locally on Floor 1 Initialization**:
   - In [`src/game/setup.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/setup.ts#L61-L85), the browser initializes the game by fetching `/api/session`, calling [`createEngineInstance({ seed: currentSeed, isClient: true })`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/engine-factory.ts#L345-L429) **before** calling `reconcileClientState`, and assigning `window.gameContext = engine`.
   - Inside [`createEngineInstance`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/engine-factory.ts#L394-L407), `generateDungeon` and `placeEntities` run unconditionally even when `isClient: true`.
   - Furthermore, [`FloorState.runSeed`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/engine-factory.ts#L424) and [`DUNGEON_GENERATED { seed }`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/floor-manager.ts#L156-L162) are synced unredacted to the client on every floor transition. Because the PRNG and [`placeEntities`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/entity-placement.ts) are deterministic and bundled in the client, anyone with `runSeed` can compute every floor's exact loot and traps locally.
2. **Presence of `corruptedNode` Component Leaks Which Containers Are Trapped**:
   - [`redactCorruptedNode`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/shared/serialization.ts#L204-L216) only removes the `trapType` property (`{ ...data, trapType: undefined }`) while keeping the `corruptedNode` component attached to the entity in the serialized client snapshot and delta!
   - Simply checking `entity.components.corruptedNode !== undefined` in DevTools (or observing the client's [`MovementSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/movement.ts#L106-L120) bump-block) reveals 100% of hidden traps even when `revealed: false`.
3. **Unexplored Rooms, Hostiles, and Items Outside FOV Are Still Sent in Full**:
   - Every enemy, ground item, and prop across the entire dungeon floor is still serialized with exact `Position` coordinates on Turn 0 regardless of the player's Field of View (`FOV`).

---

### C4: Action Pipeline Input Validation & Item Duplication / Stack Destruction Bugs

#### What Was Changed
- Commit `2f6f3aa6` added server-side validation for `PICKUP`, `DROP_ITEM`, and `INTERACT_PROP` in [`src/game/pipeline/action-pipeline.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/pipeline/action-pipeline.ts#L161-L283) and re-validation in [`ItemPickupSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/item-pickup.ts#L406-L448) and [`PropInteractionSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/prop-interaction.ts#L101-L115).

#### Adversarial Findings
1. **Inventory / Equipment Item Duplication via Spoofed `PICKUP` Coordinates**:
   - When an item is picked up into `RunInventory` or equipped in `EquipmentSlots` / `FirmwareSlots` / `AugmentSlots`, its `Position` component is removed, while the item entity itself remains in `world` with its `Item` component intact ([`item-pickup.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/item-pickup.ts#L254)).
   - Look at how [`action-pipeline.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/pipeline/action-pipeline.ts#L162-L185) validates `PICKUP`:
     ```ts
     const itemComp = world.getComponent(action.itemId, Item);
     if (!itemComp) return false;
     const itemPos = world.getComponent(action.itemId, Position);
     const targetX = itemPos ? itemPos.x : action.targetX;
     const targetY = itemPos ? itemPos.y : action.targetY;
     ```
   - And look at [`item-pickup.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/item-pickup.ts#L420-L433):
     ```ts
     const itemPos = world.getComponent(targetItemId, Position);
     const targetX = itemPos ? itemPos.x : intent.targetX;
     const targetY = itemPos ? itemPos.y : intent.targetY;
     ```
   - Neither [`action-pipeline.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/pipeline/action-pipeline.ts#L173-L185) nor [`item-pickup.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/item-pickup.ts#L420-L433) requires `itemPos` to exist or checks `grid.getItemsAt(targetX, targetY).has(targetItemId)`!
   - **Exploit**: A client sends `{ type: 'PICKUP', itemId: <alreadyOwnedOrEquippedEntityId>, targetX: playerPos.x, targetY: playerPos.y }`. Because `itemPos` is `undefined`, both validators fall back to `action.targetX/targetY`, confirm `chebyshevDistance === 0`, and call `attemptPickupItem`, which inserts a duplicate entry into `RunInventory` (or increments stack quantity / triggers walk-over effect a second time)!
2. **Stand-Still `PICKUP` (`itemId: undefined`) Falsely Attaches `MovedThisTurn`**:
   - In [`action-pipeline.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/pipeline/action-pipeline.ts#L217-L227), a `PICKUP` action without `itemId` attaches `MovedThisTurn` to the player even though the player did not move, triggering on-move augments/status effects (`MovedThisTurn` listeners) while standing still.
3. **`DROP_ITEM` Destroys Consumable Stacks (`quantity > 1`) & Corrupts Ground Sprite**:
   - In [`action-pipeline.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/pipeline/action-pipeline.ts#L244-L257), `DROP_ITEM` calls `removeItemByEntityId(world, actorId, action.itemId)`, which deletes the entire stack (`quantity: N`) from `RunInventory`, and places the single `action.itemId` entity on the ground with a hardcoded `SpriteComponent { key: 'item' }`. When picked back up, `attemptPickupItem` adds `quantity: 1`, permanently destroying `N - 1` stacked items.

---

### C5: Blocked Bump Safeguard (`ActionAbortedTag`) — 100% Broken in Production

#### What Was Changed
- Commits `32a8a320` and `635686d0` added `ActionAbortedTag` ([`intents.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/shared/components/intents.ts#L101-L108)), updated [`MovementSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/movement.ts#L106-L148) to attach `ActionAbortedTag` when bumping a locked `SecurityLock` without a key or an armed `CorruptedNode`, added [`GameTurnAdapter.wasActionAborted`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/turn/game-turn-adapter.ts#L86-L93), and updated [`TurnManager.executeTurnCycle`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/turn/turn-manager.ts#L96-L105) to refund energy and abort the turn if `wasActionAborted(playerId)` returns `true`.

#### Adversarial Findings & Empirical Proof
1. **`TagCleanupSystem` Wipes `ActionAbortedTag` Before `TurnManager` Reads It (100% Failure in Production)**:
   - Look at the execution order in [`TurnManager.executeTurnCycle`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/turn/turn-manager.ts#L86-L105):
     ```ts
     // 3. Execute Player Action Sequence
     this.executeActionSequence(); // Runs GATHER_INTENT -> ACTION -> REACTION -> CLEANUP
     ...
     if (this.adapter.wasActionAborted?.(playerId)) {
       this.adapter.refundEntityEnergy?.(playerId, cost);
       this.adapter.clearActionAborted?.(playerId);
       return false;
     }
     ```
   - Inside `this.executeActionSequence()` ([`turn-manager.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/turn/turn-manager.ts#L147-L161)), `Phase.CLEANUP` runs at line 160.
   - In [`TagCleanupSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/tag-cleanup.ts#L46-L50) (which is registered in `Phase.CLEANUP` by [`registerCoreSystems`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/registration.ts#L121)):
     ```ts
     // Cleanup ActionAbortedTag
     const abortedEntities = world.query(ActionAbortedTag);
     for (const entityId of abortedEntities) {
       world.removeComponent(entityId, ActionAbortedTag);
     }
     ```
   - By the time `this.executeActionSequence()` returns at line 87 of [`turn-manager.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/turn/turn-manager.ts#L87), `ActionAbortedTag` has **already been deleted** by `TagCleanupSystem`!
   - Therefore, `this.adapter.wasActionAborted(playerId)` at line 96 is **always `false`** in production. Our empirical probe confirmed: `abortedAtZeroCost: false`, `turnAfter: 1`, `enemyMovedDuringBlockedBump: true`.
   - **Why the unit test missed it**: [`tests/game/c5-bump-safeguard.test.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/tests/game/c5-bump-safeguard.test.ts#L59-L61) manually initialized *only* `MovementSystem` and never registered `TagCleanupSystem`!

2. **Secondary Exploit: `Phase.PRE_TURN` Runs *Before* `Phase.ACTION` on Aborted Turns**:
   - In [`TurnManager.executeTurnCycle`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/turn/turn-manager.ts#L77), `this.world.executeSystems(Phase.PRE_TURN)` runs at step 1—**before** `executeActionSequence()` at step 3.
   - Once `ActionAbortedTag` cleanup is fixed so `executeTurnCycle` returns `false` at step 3, any aborted bump will have already executed `Phase.PRE_TURN` (`HeatSystem` passive heat dissipation, `StatusEffectTickSystem` regeneration ticks & debuff countdowns, `AugmentPreTurnSystem`) for **0 energy and 0 enemy turns**! A player can repeatedly bump a locked door or wall/trap to farm infinite free regeneration ticks and cooldown/heat reductions while enemies remain frozen.

3. **Unrevealed Traps (`CorruptedNode.revealed === false`) Are Blocked by `MovementSystem` Safeguard**:
   - In [`MovementSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/movement.ts#L106-L120), the safeguard blocks bumping *any* entity with `CorruptedNode` where `!corrupted.disarmed`, without checking `corrupted.revealed`.
   - This makes unrevealed traps impossible to trigger by bumping and turns every bump into a risk-free trap detector.

---

### C6: ECS Mandate #1 & #2 Compliance — Broken `AlertIntent` Lifecycle & Procedural `action-pipeline.ts`

#### What Was Changed
- Commits `73842d7f` through `a61ab566` refactored `StabilitySystem`, `PropInteractionSystem`, `TeleportSystem`, `ItemPickupSystem`, and `route.ts` to remove direct cross-system calls and `world.destroyEntity()` violations.
- Specifically, commit `644f632b` refactored [`triggerAcousticAlert`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/prop-interaction.ts#L57-L76) to attach `AlertIntent` to hostiles instead of mutating `AIState` directly, and added `processAlertIntents` to [`AISystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/ai.ts#L199-L214) in `Phase.GATHER_INTENT`.

#### Adversarial Findings & Empirical Proof
1. **`AlertIntent` Is Wiped by `TagCleanupSystem` Before Enemy `Phase.GATHER_INTENT` (100% Broken in Production)**:
   - Understand how [`TurnManager`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/turn/turn-manager.ts#L86-L161) executes a turn:
     1. **Player Action Sequence**: `GATHER_INTENT` → `ACTION` (where [`PropInteractionSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/prop-interaction.ts#L57-L76) unlocks a door/triggers a trap and attaches `AlertIntent` to nearby enemies) → `REACTION` → `CLEANUP`.
     2. In the player's `Phase.CLEANUP`, [`TagCleanupSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/tag-cleanup.ts#L59-L62) executes:
        ```ts
        const alertIntents = world.query(AlertIntent);
        for (const entityId of alertIntents) {
          world.removeComponent(entityId, AlertIntent);
        }
        ```
     3. **Enemy Turn Sequence** (`processEnemyTurns`, [`turn-manager.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/turn/turn-manager.ts#L108-L141)): Runs `GATHER_INTENT` (where [`AISystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/ai.ts#L98) runs) → `ACTION` → `REACTION` → `CLEANUP`.
   - Because `TagCleanupSystem` deletes all `AlertIntent` components at the end of the **player's** 4-phase sequence, `AlertIntent` **never survives** to the enemies' `Phase.GATHER_INTENT`!
   - Even if an enemy happened to be inspected during the *next* player's `Phase.GATHER_INTENT`, [`AISystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/ai.ts#L98-L108) only calls `processEntityTurn(entityId)` for the currently acting entity (`turnManager.getActingEntity()`), which during the player's sequence is the **player** (who does not have `AIState`)!
   - Our empirical probe confirmed: `doorUnlocked: true`, `enemyBehaviorAfterTurn: 'idle'`, `enemyLastKnownPlayerX: undefined`, `enemyAlertWorked: false`.
   - **Why the unit test missed it**: [`prop-interaction.test.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/__tests__/prop-interaction.test.ts#L273-L274) called `world.executeSystems(Phase.ACTION)` followed directly by `world.executeSystems(Phase.GATHER_INTENT)` without `Phase.CLEANUP` or `TurnManager`.

2. **Even If `AlertIntent` Reached `AISystem`, Out-of-LoS Enemies Ignore It**:
   - In [`AISystem.processBasicTurn`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/ai.ts#L130-L152):
     - Line 130 calls `processAlertIntents(world, entityId, aiState)`, which sets `aiState.canSeePlayer = true`, `behavior = CHASING`, and `lastKnownPlayerX/Y`.
     - **Five lines later** (line 135), `processBasicTurn` executes `const canSeePlayer = visibleTiles.has(playerKey)` and overwrites `canSeePlayer` in `world.patchComponent(entityId, AIState, { canSeePlayer })`!
     - Even worse, the specialist AI loops—[`processSeedEaterTurn`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/ai.ts#L225-L290), [`processFragmenterTurn`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/ai.ts#L292-L347), and [`processLogicLeakerTurn`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/ai.ts#L349-L398)—only check `if (canSeePlayer)` and have **zero fallback logic** for `aiState.behavior === AIStateBehavior.CHASING` or `lastKnownPlayerX/Y` when `!canSeePlayer`! Only `null-pointer` and `buffer-overflow` (`processBasicTurn`) have a `lastKnownPlayerX` branch.

3. **`route.ts` Mutations Were Moved to Procedural `processAction()` Instead of ECS Phase Systems**:
   - Commit `f15f26ac` moved `BURN_FIRMWARE`, `BURN_AUGMENT`, `PURGE_SOFTWARE`, `USE_CONSUMABLE`, `INVENTORY_SWAP`, and `ABORT_RUN` out of [`src/app/api/action/route.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/app/api/action/route.ts#L70-L89) into [`processAction()`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/pipeline/action-pipeline.ts#L285-L607).
   - However, `processAction()` still mutates components (`RunInventory`, `FirmwareSlots`, `AugmentSlots`, `SoftwareSlots`, `StatModifier`, `Dying`) and attaches `HealIntent` / `StabilityIntent` **procedurally outside any ECS Phase**, and in [`route.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/app/api/action/route.ts#L70-L86) `processAction()` is called **before** `turnManager.canAcceptInput()` is even checked!

---

### C7: Stability Bleed & `HealIntent` Resolution — Broken Registration Order in Production

#### What Was Changed
- Commit `0d33d784` refactored [`StabilitySystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/stability.ts#L92-L120) to attach `DamageIntent` (`damageSource: 'stability_bleed', bypassesArmor: true`) in `Phase.PRE_TURN`, added `HealIntent` ([`intents.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/shared/components/intents.ts#L50-L57)), and added [`createHealSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/combat.ts#L569-L619) to consume `HealIntent` in `Phase.PRE_TURN` and `Phase.REACTION`.

#### Adversarial Findings & Empirical Proof
1. **`registerCoreSystems` Registers `HealSystem` *Before* `ItemPickupSystem` and `StatusEffectSystem` (100% Broken Phase Ordering)**:
   - Look at [`tests/game/c7-stability-heal.test.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/tests/game/c7-stability-heal.test.ts#L72-L77):
     ```ts
     // Register statusEffectSystem before healSystem so tickDown runs before HealSystem_PreTurn
     statusEffectSystem.init();
     stabilitySystem.init();
     combatSystem.init();
     healSystem.init();
     ```
   - Now look at actual production system registration in [`src/game/systems/registration.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/registration.ts#L116-L119):
     ```ts
     heal.init();
     itemPickup.init();
     floorManager.init();
     statusEffect.init();
     ```
   - In production [`registration.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/registration.ts#L116-L119), `heal.init()` is called **before** both `itemPickup.init()` and `statusEffect.init()`!
   - **Impact 1 (`Phase.PRE_TURN` Regeneration vs. Stability Bleed)**:
     - In `Phase.PRE_TURN`, `StabilitySystem_PreTurn` attaches `DamageIntent`, then `HealSystem` runs (finding no `HealIntent`), and *then* `StatusEffectTickSystem` runs and attaches `HealIntent` for regeneration.
     - That `HealIntent` sits unconsumed until `Phase.REACTION`.
     - In `Phase.REACTION`, `CombatSystem` runs *before* `HealSystem_Reaction`! If the player is at 1 HP with 0% Stability and active Regeneration, `CombatSystem` resolves `DamageIntent` first, drops the player to 0 HP, and attaches `Dying` **before** `HealSystem_Reaction` ever resolves the `PRE_TURN` regeneration!
   - **Impact 2 (`Phase.REACTION` Walk-Over Health Potion Pickup)**:
     - When a damaged player walks over a `health-potion` on the ground (`MovedThisTurn`), `ItemPickupSystem` runs in `Phase.REACTION` **after** `HealSystem_Reaction` has already executed!
     - `ItemPickupSystem` destroys the potion entity, emits `+ REPAIR ACTIVATED (5 HP)`, and attaches `HealIntent`—which is **never resolved during the player's turn** because `HealSystem_Reaction` already finished! Our empirical probe confirmed: `hpBefore: 5`, `hpAfterWalkoverReaction: 5`, `lingeringHealIntentAfterReaction: { targetId: 1, amount: 5 }`.

2. **`resolveHealIntents` Resurrects `Dying` Entities into a Zombie State**:
   - In [`src/game/systems/combat.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/combat.ts#L587-L618), `resolveHealIntents` checks `if (targetHealth)` and patches `Health.current = Math.min(targetHealth.max, targetHealth.current + healIntent.amount)`, **without checking `if (world.hasComponent(targetId, Dying) || !targetHealth.isAlive)`**!
   - If an entity is killed in `CombatSystem` (`Health.current = 0, isAlive = false`, `Dying` attached, `ENTITY_DIED` emitted) and had a pending `HealIntent` (e.g., from unconsumed `PRE_TURN` regen), `HealSystem_Reaction` runs right after `CombatSystem` and patches `Health.current > 0` while `isAlive` remains `false` and `Dying` remains attached (before `GravediggerSystem` destroys it in `Phase.CLEANUP`).

3. **Duplicate System Name in `createHealSystem`**:
   - In [`src/game/systems/combat.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/combat.ts#L571-L583), both the `Phase.PRE_TURN` system and the `Phase.REACTION` system are registered with `name: 'HealSystem_Reaction'`, making phase logs misleading.

---

### C8: Firmware & Augment Slot Capacity Validation & UI Sync

#### What Was Changed
- Commits `91fccc2d` and `d00920a4` updated [`action-pipeline.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/pipeline/action-pipeline.ts#L455-L553) to validate `slotIndex` against `ShellRecord.maxFirmware` and `ShellRecord.maxAugment` (and `0..2` for `PURGE_SOFTWARE`), rejecting out-of-bounds indices before consuming the item or spending energy.

#### Adversarial Findings
1. **Non-Sequential `slotIndex` Silently Remaps to Next Append Index**:
   - In [`action-pipeline.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/pipeline/action-pipeline.ts#L481-L486) (and L529–L534 for augments):
     ```ts
     if (action.slotIndex < currentEquipped.length) {
       ...
       newEquipped[action.slotIndex] = action.itemId;
     } else {
       newEquipped.push(action.itemId);
     }
     ```
   - If `currentEquipped` is `[]` and `maxFirmware` is `3`, sending `slotIndex: 2` passes validation (`2 < 3`), does not replace slot 2, and instead pushes the item into index `0`. Either `slotIndex > currentEquipped.length` should be rejected or slots should be sparse/indexed consistently.
2. **Client `BackpackGrid.tsx` Still Fires Raw `fetch('/api/action')` and Discards Server `DELTA`**:
   - In [`src/components/ui/inventory/BackpackGrid.tsx`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/components/ui/inventory/BackpackGrid.tsx#L107-L115) and [`BackpackGrid.tsx`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/components/ui/inventory/BackpackGrid.tsx#L333-L341), clicking `USE` on a consumable calls `fetch('/api/action', ...)` directly and ignores the response body (`DELTA` payload and enemy turn results), instead of routing through the game's `ActionSubmissionService` / `reconcileClientState` pipeline.

---

## 3. Architecture Guidelines Audit (`docs/architecture/`)

Cross-referencing the current codebase against [`AGENTS.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/AGENTS.md), [`SYSTEM_OVERVIEW.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/architecture/SYSTEM_OVERVIEW.md), [`ENGINE_GUIDELINES.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/architecture/ENGINE_GUIDELINES.md), and [`DEATH_PROTOCOL.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/architecture/DEATH_PROTOCOL.md):

| Architectural Mandate | Status After C1–C8 | Remaining Violations / Risks |
| :--- | :--- | :--- |
| **Layer Boundaries (`@engine/*` zero imports)** | **PASS** | `npm run lint` and `npm run typecheck` pass with 0 errors. [`TurnManager`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/turn/turn-manager.ts) cleanly delegates abort checks via [`TurnSystemAdapter`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/turn/types.ts). |
| **Death Protocol (`GravediggerSystem` sole destroyer)** | **PASS** | All `world.destroyEntity()` calls in `route.ts`, `ItemPickupSystem`, and `PropInteractionSystem` were replaced with `Dying` component attachments. Only `GravediggerSystem` (and floor wipe in `FloorManagerSystem`) calls `destroyEntity`. |
| **Phase-Driven Intents (Mandate #1)** | **PARTIAL FAIL** | 1. [`processAction()`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/pipeline/action-pipeline.ts#L285-L607) still performs direct component mutations (`RunInventory`, `FirmwareSlots`, `AugmentSlots`, `SoftwareSlots`, `StatModifier`, `Dying`) outside any ECS `Phase` and before `turnManager.canAcceptInput()`.<br>2. Cross-actor intents (`AlertIntent`) and turn-control tags (`ActionAbortedTag`) violate the 4-phase actor sequence lifecycle because [`TagCleanupSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/tag-cleanup.ts) runs at the end of *each actor's* sequence (`Phase.CLEANUP`). |
| **System Registration Order (`SYSTEM_OVERVIEW.md`)** | **FAIL** | Intra-phase execution order in [`registration.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/registration.ts#L116-L119) registers consumer `HealSystem` *before* producers `ItemPickupSystem` and `StatusEffectSystem`. |
| **Client Prediction vs. Server Authority (Mandate #4)** | **PARTIAL FAIL** | 1. Client `createEngineInstance` still executes server-only `placeEntities` with the authoritative seed on Floor 1.<br>2. [`BackpackGrid.tsx`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/components/ui/inventory/BackpackGrid.tsx#L107) bypasses the client prediction/reconciliation bridge via raw `fetch('/api/action')`. |

---

## 4. Required Changes & Remediation Plan

### Priority 0 (Blockers — Must Fix Immediately)

1. **Fix `ActionAbortedTag` Lifecycle & `PRE_TURN` Free-Tick Exploit (C5)**:
   - **File**: [`src/game/systems/tag-cleanup.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/tag-cleanup.ts#L46-L50) & [`src/engine/turn/turn-manager.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/turn/turn-manager.ts#L70-L105)
   - **Fix**:
     1. Remove `ActionAbortedTag` cleanup from [`TagCleanupSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/tag-cleanup.ts#L46-L50) (since [`TurnManager.executeTurnCycle`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/engine/turn/turn-manager.ts#L98) already calls `this.adapter.clearActionAborted(playerId)` after inspecting it, and also clear any lingering `ActionAbortedTag` at the start of `executeTurnCycle`).
     2. To prevent the infinite free `Phase.PRE_TURN` tick exploit on aborted actions, either validate/abort blocked bumps before running `Phase.PRE_TURN`, or run `Phase.GATHER_INTENT` + `Phase.ACTION` for the player *before* committing `Phase.PRE_TURN`, or only run `Phase.PRE_TURN` once the player's action is not aborted.
     3. In [`MovementSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/movement.ts#L106-L120), only trigger the 0-cost `CorruptedNode` bump safeguard if `corrupted.revealed === true`! If `corrupted.revealed === false`, allow the bump to proceed into `PropInteractionSystem` so unrevealed traps actually trigger when the player blindly bumps them.

2. **Fix `AlertIntent` Cross-Actor Lifecycle & Specialist AI Chasing Logic (C6)**:
   - **File**: [`src/game/systems/tag-cleanup.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/tag-cleanup.ts#L59-L62) & [`src/game/systems/ai.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/ai.ts#L130-L398)
   - **Fix**:
     1. Remove `AlertIntent` from [`TagCleanupSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/tag-cleanup.ts#L59-L62) (or only clean up `AlertIntent` in `Phase.POST_TURN` after all enemies have acted). `AISystem.processAlertIntents` ([`ai.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/ai.ts#L212)) already removes `AlertIntent` from each enemy when that enemy's `Phase.GATHER_INTENT` executes!
     2. In [`AISystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/ai.ts#L107-L115), call `processAlertIntents(world, entityId, aiState)` at the top of `processEntityTurn` *before* dispatching to `processBasicTurn`, `processSeedEaterTurn`, `processFragmenterTurn`, or `processLogicLeakerTurn`.
     3. Ensure that when an enemy is in `AIStateBehavior.CHASING` with a valid `lastKnownPlayerX/Y` (such as from an acoustic alert) and `!canSeePlayer`, all enemy AI routines pathfind toward `(lastKnownPlayerX, lastKnownPlayerY)` rather than standing idle.

3. **Fix `HealSystem` Registration Order & Zombie Resurrection (C7)**:
   - **File**: [`src/game/systems/registration.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/registration.ts#L116-L120) & [`src/game/systems/combat.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/combat.ts#L569-L619)
   - **Fix**:
     1. In [`registration.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/registration.ts#L116-L120), move `heal.init()` **after** `itemPickup.init()` and `statusEffect.init()` (and before `runEnder.init()`). This ensures `StatusEffectTickSystem` attaches regen `HealIntent` before `HealSystem_PreTurn` runs in `Phase.PRE_TURN`, and `ItemPickupSystem` attaches walk-over potion `HealIntent` before `HealSystem_Reaction` runs in `Phase.REACTION`.
     2. In [`resolveHealIntents`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/combat.ts#L587-L618), guard with `if (!targetHealth || !targetHealth.isAlive || world.hasComponent(targetId, Dying))` before applying healing so dead/dying entities cannot have their HP raised above 0.
     3. Name the `Phase.PRE_TURN` registration `'HealSystem_PreTurn'` instead of `'HealSystem_Reaction'` ([`combat.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/combat.ts#L572)).

4. **Fix Zero-Day Vault Wall Breaching, Dual Faraday Lock, Key-in-Trap Soft-Lock, and Post-Prop Connectivity (C1 & C2)**:
   - **Files**: [`src/game/generation/dungeon-generator.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/dungeon-generator.ts#L221-L327), [`src/game/generation/entity-placement.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/entity-placement.ts#L156-L690)
   - **Fix**:
     1. **Never breach vault walls**: In [`applyPrefabToRoom`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/dungeon-generator.ts#L270-L280), do **not** skip `#` walls on `corridorSet` inside a prefab's footprint! Instead, stamp the prefab inside a 1-tile walkable moat inside the room (requiring `room.width >= prefab.width + 2` and `room.height >= prefab.height + 2`), or route external corridors/room doors around the prefab perimeter to `nearestPortal` without carving through tiles inside `[startX..startX+prefab.width-1, startY..startY+prefab.height-1]`.
     2. **Attach `faradayBounds` only to `prop-vault-door`**: In [`entity-placement.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/entity-placement.ts#L319-L333), only attach `faradayBounds` when `placement.template === 'prop-vault-door'` (not `prop-safe-locked`), and either make `prop-safe-locked` inside the vault unlocked or spawn a dedicated `access-key` for every locked entity that requires one.
     3. **Exclude `CorruptedNode` containers from `accessibleContainers`**: In [`entity-placement.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/entity-placement.ts#L521-L528), add `if (world.hasComponent(cid, CorruptedNode)) return false;` so critical `access-key` items are never hidden inside trapped containers.
     4. **Validate staircase/anchor & post-prop walkability**: In [`entity-placement.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/generation/entity-placement.ts#L156-L194), place `staircase` and `anchor` on verified walkable, non-prop tiles, and before placing any `BlocksMovement` prop, verify that placing it does not disconnect walkable neighbors or block a portal/doorway.

---

### Priority 1 (High — Security & Exploitation Fixes)

5. **Fix `PICKUP` Missing-Position Fallback & `DROP_ITEM` Stack Destruction (C4)**:
   - **Files**: [`src/game/pipeline/action-pipeline.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/pipeline/action-pipeline.ts#L161-L263), [`src/game/systems/item-pickup.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/item-pickup.ts#L406-L448)
   - **Fix**:
     1. In both [`action-pipeline.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/pipeline/action-pipeline.ts#L172-L185) and [`item-pickup.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/item-pickup.ts#L420-L433), **require** `const itemPos = world.getComponent(targetItemId, Position)` to be defined and verify `grid.getItemsAt(itemPos.x, itemPos.y).has(targetItemId)`. Never fall back to client-supplied `action.targetX/targetY` when `itemPos` is missing!
     2. Do not attach `MovedThisTurn` on a stand-still `PICKUP` (`itemId === undefined`); instead attach a `PickupIntent` for the item at `(playerPos.x, playerPos.y)` or a dedicated `StandStillPickupTag`.
     3. In `DROP_ITEM` ([`action-pipeline.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/pipeline/action-pipeline.ts#L230-L263)), either preserve stack `quantity` on the dropped item or decrement the stack by 1 and restore the original `TemplateComponent` sprite key instead of hardcoding `{ key: 'item' }`.

6. **Eliminate Client-Side Seed & `CorruptedNode` Component Leakage (C3)**:
   - **Files**: [`src/game/engine-factory.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/engine-factory.ts#L394-L429), [`src/shared/serialization.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/shared/serialization.ts#L204-L241)
   - **Fix**:
     1. When `isClient: true` in [`createEngineInstance`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/engine-factory.ts#L394-L407), do **not** run `placeEntities` with the server seed; hydrate the client world strictly from the redacted `/api/session` snapshot (`serializeECSWorldForClient`), and redact `FloorState.runSeed` in [`redactWorldForClient`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/shared/serialization.ts#L221-L241).
     2. In [`redactWorldForClient`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/shared/serialization.ts#L229-L234) and [`createECSWorldDelta`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/shared/ecs-delta.ts#L101-L106), completely omit the `corruptedNode` component from the serialized entity when `!corrupted.revealed && !corrupted.disarmed` instead of sending `{ revealed: false, disarmed: false }`.

---

### Priority 2 (Medium — Architectural Polish & Test Harness Hardening)

7. **Check `turnManager.canAcceptInput()` Before `processAction()` in `/api/action` (C6/C8)**:
   - In [`src/app/api/action/route.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/app/api/action/route.ts#L70-L88), check `if (!turnManager.canAcceptInput())` *before* calling `processAction(...)` so rejected requests cannot mutate components prematurely.
8. **Route `BackpackGrid.tsx` Consumable Use Through Action Submission Pipeline (C8)**:
   - Replace raw `fetch('/api/action')` in [`src/components/ui/inventory/BackpackGrid.tsx`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/components/ui/inventory/BackpackGrid.tsx#L107) and [`L333`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/components/ui/inventory/BackpackGrid.tsx#L333) with the standard action submission / delta reconciliation flow.
9. **Mandate `registerCoreSystems` + `TurnManager.submitAction` in Integration Tests**:
   - Update [`c5-bump-safeguard.test.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/tests/game/c5-bump-safeguard.test.ts), [`c7-stability-heal.test.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/tests/game/c7-stability-heal.test.ts), and [`prop-interaction.test.ts`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/__tests__/prop-interaction.test.ts) to initialize systems via [`registerCoreSystems`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/registration.ts#L59-L143) and step turns via `turnManager.submitAction()` rather than hand-wiring subset systems in custom orders.

---

## 5. Remediation & Verification Summary (2026-11-03)

All findings above were resolved and verified:

### Implemented Code Changes
1. **C1 & C2 (`src/game/generation/dungeon-generator.ts`, `src/game/generation/entity-placement.ts`)**:
   - Stopped skipping `#` walls inside prefab footprints so `zero-day-vault` walls are never breached by BSP corridors.
   - Sealed unused target-room floor pockets outside the prefab+moat box, carved a 1-tile perimeter walkway moat around prefabs, routed BSP room entrance doors to the moat via `carveWalkablePathOutsideBox`, and validated connectivity both with and without authored blocking props/vault doors before committing a bespoke room.
   - Attached `faradayBounds` and `SecurityLock` only to `prop-vault-door` inside Zero-Day Vaults (stripping `SecurityLock` from the inner high-tier vault container so 1 `Access_Key` unlocks the vault and disables Faraday shielding).
   - Excluded `CorruptedNode` containers from `accessibleContainers` when seeding `Access_Key` drops.
   - Placed `staircase` and `anchor` entities on verified safe walkable tiles (`findSafeRoomTile`) and added `wouldPinchWalkability` checks before placing procedural props.
2. **C3, C4, & C8 (`src/shared/serialization.ts`, `src/game/engine-factory.ts`, `src/game/pipeline/action-pipeline.ts`, `src/game/systems/item-pickup.ts`, `src/components/ui/inventory/BackpackGrid.tsx`)**:
   - Redacted `FloorState.runSeed = 'REDACTED'` in `redactWorldForClient` and applied redaction immediately on client engine initialization (`isClient: true`).
   - Rejected `PICKUP` of already-owned/equipped items even if `targetX/targetY` are spoofed, required grid verification (`grid.getItemsAt(targetX, targetY).has(itemId)`) when `Position` is absent, and replaced the stand-still `MovedThisTurn` attachment on `PICKUP` with `PickupIntent`.
   - Updated `DROP_ITEM` on consumable stacks (`quantity > 1`) to decrement the stack by 1 and materialize a single floor item with `Item` and `TemplateId` components.
   - Reconciled server `DELTA` payloads via `applyStateDelta` in `BackpackGrid.tsx` when `USE_CONSUMABLE` completes.
3. **C5 (`src/engine/turn/turn-manager.ts`, `src/game/turn/game-turn-adapter.ts`, `src/game/systems/tag-cleanup.ts`, `src/game/systems/movement.ts`, `src/game/systems/prop-interaction.ts`)**:
   - Removed premature `ActionAbortedTag` deletion from `TagCleanupSystem` (`Phase.CLEANUP`), snapshotted world state prior to `Phase.PRE_TURN` in `TurnManager.executeTurnCycle`, and rolled back `PRE_TURN` mutations when `wasActionAborted(playerId)` is true.
   - Updated `MovementSystem` so only revealed (`corrupted.revealed === true`) armed `CorruptedNode` props halt bump movement at 0 turn cost, while unrevealed traps convert the bump into `InteractPropIntent`, trigger the trap, and set `revealed: true`.
4. **C6 (`src/game/systems/tag-cleanup.ts`, `src/game/systems/ai.ts`, `src/app/api/action/route.ts`, `src/game/setup.ts`)**:
   - Removed `AlertIntent` deletion from `TagCleanupSystem` so enemy `AlertIntent` components survive the player's `Phase.CLEANUP` and reach enemy `Phase.GATHER_INTENT`.
   - Preserved `canSeePlayer: true` on the turn `AlertIntent` is consumed in `AISystem`, and added `AIStateBehavior.CHASING` (`lastKnownPlayerX/Y`) fallback movement to `Seed_Eater`, `Fragmenter`, and `Logic_Leaker`.
   - Gated `processAction()` behind `turnManager.canAcceptInput()` in `/api/action` and wired `GameAction.INTERACT_ANCHOR` (`KeyE`) to send `{ type: 'INTERACT_PROP', targetPropId, forceOverride: true }` when adjacent to an interactive/locked/armed prop.
5. **C7 (`src/game/systems/registration.ts`, `src/game/systems/combat.ts`)**:
   - Moved `heal.init()` after `itemPickup.init()` and `statusEffect.init()` in `registerCoreSystems`, separated `updatePreTurn` and `updateReaction` callbacks (`HealSystem_PreTurn` and `HealSystem_Reaction`), and guarded `resolveHealIntents` against healing entities marked with `Dying`.

### Post-Remediation Empirical Verification Metrics
- **750-Floor Procedural Sweep (15 depths × 50 seeds)**:
  - `vaultsBypassableWithoutUnlockingDoor`: **0 / 250** (down from 148 / 161)
  - `vaultsWhereSafeAlsoHasFaraday`: **0 / 250** (down from 161 / 161)
  - `floorsWithPropsDisconnectingWalkable`: **0 / 750** (down from 112 / 750)
  - `floorsWithStaircaseOnWallOrBlockingProp`: **0 / 750** (down from 98 / 750)
  - `floorsWithUnreachableStaircase`: **0 / 750** (down from 13 / 750)
  - `floorsWithKeyInCorruptedContainer`: **0 / 750** (down from 106 / 750)
- **Full-Engine Runtime Probes (`registerCoreSystems` + `TurnManager`)**:
  - **C5**: `abortedAtZeroCost: true` (`turnBefore: 0`, `turnAfter: 0`, `enemyMovedDuringBlockedBump: false`)
  - **C6**: `enemyAlertWorked: true` (`enemyBehaviorAfterTurn: 'chasing'`, `enemyLastKnownPlayerX: 5`)
  - **C7**: `hpBefore: 5` → `hpAfterPreTurn: 7` → `hpAfterWalkoverReaction: 12`, `lingeringHealIntent: undefined`
- **Automated Quality Gates**:
  - `npm run typecheck`: **0 errors**
  - `npm run lint`: **0 errors, 0 warnings**
  - `npm test`: **150 / 150 test files passed (971 / 971 tests passed)**

