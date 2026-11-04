# Adversarial Review: `feat/interactive-environments`

> **Subject:** [`2026-11-02-branch-handoff-interactive-environments.md`](./2026-11-02-branch-handoff-interactive-environments.md) and the 25 commits / 188 files / +12.8k lines it describes
> **Reviewed against:** `AGENTS.md`, [`docs/architecture/`](../architecture/) (`SYSTEM_OVERVIEW`, `ENGINE_GUIDELINES`, `DEATH_PROTOCOL`)
> **Review date:** 2026-11-02 (Updated 2026-11-03 after C1–C8 remediation & follow-up audit in [`2026-11-03-adversarial-review-c1-c8-remediation.md`](./2026-11-03-adversarial-review-c1-c8-remediation.md))
> **Verdict:** 🟢 **All C1–C8 Critical Findings Resolved & Verified (2026-11-03).** Initial review verdict on 2026-11-02 was Do Not Merge due to C1–C8 below; all 8 critical items and follow-up production lifecycle edge cases have now been remediated and verified across 750 generated floors and 150 test files (971 tests).

---

## 0. TL;DR

| # | Finding | Severity |
|---|---|---|
| C1 | **Floors 11–15 can never be generated.** Sealed prefabs make `generateDungeon` throw `Failed to generate connected dungeon` on about 100% of seeds. | ✅ **RESOLVED** (`30ff0a4c`) |
| C2 | **Locks, vaults, safes, keys, overclock bypass and Faraday shielding never spawn on floors 1–10.** The only paths that could create them are broken or unreachable. | ✅ **RESOLVED** (`c4d2d761`) |
| C3 | **"Masked loot" is not masked.** `storedLoot`, `scrapYield`, `fluxYield` and `grantsAccessKey` are serialized to the client in full. | ✅ **RESOLVED** (`b1a7999a`) |
| C4 | **`PICKUP` and `DROP_ITEM` have no server-side range or position validation.** The client can pick up any item on the map by entity ID and drop items on arbitrary tiles. | ✅ **RESOLVED** (`2f6f3aa6`) |
| C5 | **The "0-turn bump safeguard" does not exist.** The energy cost is deducted before the action runs and never refunded. `INPUT_BUFFER_CLEARED` has no listener. | ✅ **RESOLVED** (`32a8a320`) |
| C6 | **Direct `ECS` architecture violations.** There is an `eventBus.on()` that drives game logic, direct `Health` patching that bypasses `DamageIntent`, and a game-specific string in the engine layer. | ✅ **RESOLVED** (`73842d7f`..`519b3487`) |
| C7 | **Stability "threat purge" is exploitable.** It fires on any `ENTITY_DIED` the player causes, including crates and traps. The stability rebalance is also a 5–80% nerf shipped as a "bug fix". | ✅ **RESOLVED** (`0d33d784`) |
| C8 | **`BURN_FIRMWARE` / `BURN_AUGMENT` ignore shell port capacity.** They use hard-coded slot caps and can push `0` placeholder entity IDs. | ✅ **RESOLVED** (`91fccc2d`) |
| M1–M14 | All medium issues (M1–M14) resolved (access key accounting, vault scoring, dead-drop validation, deterministic lore RNG, sector conditions, schema cleanup, directional cover raycasting, persistent cryo dead zones, container backpack transfer, prop connectivity validation, error logger hardening, type safety, default shell & pathfinding parity, and test coverage). | ✅ **ALL RESOLVED** |

**The gates pass because the tests do not cover the broken paths.** I reproduced the green gates myself, and also found a 33% generation crash rate that the 915 tests do not catch.

---

## 1. Verification I performed

| Claim in handoff | Reproduced? | Evidence |
|---|---|---|
| 146 files / 915 tests pass | ✅ yes | `npm test`: 146 passed, 915 passed |
| `tsc --noEmit` clean | ✅ yes | `npm run typecheck`: exit 0 |
| ESLint clean | ✅ yes | `npm run lint`: exit 0 |
| `next build` | ✅ yes (Part 2) | `npm run build` compiled and generated all 36 pages. Build passing says nothing about the issues below |
| "187 files, +12,516 / -381" | ⚠️ approximate | Actual: 188 files, +12,809 / -381. The delta is the report itself and other docs |
| "Fully Implemented" | ❌ **no** | See C1 and C2 |

### Probes I ran (and removed)

I ran temporary Vitest probes against the real generator and placement code at production dimensions (`80×45`, `DEFAULT_GRID_WIDTH`). The probe files were copied into `tests/`, executed and deleted. `git status` is clean. Copies are kept in the review artifact scratch dir:
`brain/c10b3f4a-…/scratch/procgen-probe{,2,3}.test.ts`. To reproduce, copy one into `tests/` and run `npx vitest run tests/<file>`.

| Probe | Result |
|---|---|
| 15 depths × 60 seeds, prefabs on | **299 / 900 threw**. Depths 1–10: **0** throws. Depths 11–15: **299 of 300** threw |
| Same seeds, prefabs disabled | **0 / 900** threw |
| Each prefab alone (all valid depths × 30 seeds) | `freight-bay`: 0 throws. `server-core`: 27. `decon-airlock`: 25. `zero-day-vault`: 150 (100% of floors 11–15) |
| 404 successful floors: floors containing any `SecurityLock` | **0** |
| 500 floors (F1–F10): rooms with area ≥ 100 | **0** (max area is 99) |
| 404 successful floors: props with `BlocksMovement` that sever walkable connectivity | **6** (1.5%) |

---

## 2. Critical findings

### C1. Sealed prefabs crash floor generation on floors 11–15 (and silently shrink content elsewhere) — ✅ RESOLVED (`30ff0a4c`)

> [!NOTE]
> **Resolution Status (2026-11-03):** Completely resolved and verified with a 750-floor sweep test (Commit `30ff0a4c`).
> - **Portals**: Authored perimeter portals in `server-core.json`, `decon-airlock.json`, and `zero-day-vault.json`.
> - **Portal & Door Preservation**: `dungeon-generator.ts` now preserves entrance doors/corridors, carves perimeter portals as walkable doors, and connects entrance doors to nearest portals via `carveWalkablePath`.
> - **Local Rollback**: Stamping failure performs an attempt-local rollback of room tiles and drops the prefab instead of burning whole-floor attempts.
> - **BSP Fallback**: If all attempts are exhausted, the generator falls back to pure BSP generation rather than throwing.
> - **Automated Invariant Test**: Added 750-floor sweep test (`15 depths × 50 seeds`) in `src/game/generation/dungeon-generator.test.ts`. Runs in ~1.5s with 100% floor connectivity and 0 throws.

**Where:** [`dungeon-generator.ts` L210-L330](../../src/game/generation/dungeon-generator.ts), [`prefabs/*.json`](../../src/game/generation/prefabs/)

**What happens:**
1. The generator stamps the prefab over a BSP room. `#` overwrites the existing floor, doors and corridor endpoints.
2. `validateConnectivity` requires every walkable tile to be reachable from spawn.
3. Three of four prefabs are fully enclosed boxes:
   - [`zero-day-vault.json`](../../src/game/generation/prefabs/zero-day-vault.json): the `V` doors are in row 6, and row 7 is solid wall below them.
   - [`decon-airlock.json`](../../src/game/generation/prefabs/decon-airlock.json): the `+` doors are in rows 1 and 8, adjacent to the solid top and bottom wall rows. The perimeter is closed.
   - [`server-core.json`](../../src/game/generation/prefabs/server-core.json): same pattern.
   - Only `freight-bay` has perimeter openings (`+` at row 4, cols 0 and 9).
4. The prefab interior is therefore an unreachable region, so the attempt fails. After `MAX_ATTEMPTS = 10` the generator throws.

**Why it only crashes at depth 11+:** at depths 1–10 the BSP rooms are almost never large enough for a 10×10 prefab, so prefabs are mostly skipped. At depth 11+ rooms get big enough to host them. Prefab selection is seeded, so the failure is deterministic per seed.

**Impact in production:**
- `FloorManagerSystem` calls `generateDungeon` on descent. The throw is caught by the transactional rollback in [`route.ts`](../../src/app/api/action/route.ts) (`logTurnExecutionError`, then restore the pre-turn snapshot). The player **can never descend from floor 10 to 11**. The Daily/Weekly seeded runs are stuck at the same place.
- Floors 11–15 are the highest-value content: guaranteed sector conditions on F15, max prop budgets and 25% corruption.
- Even where generation succeeds, the 3 sealed prefabs essentially never appear (`prefabCounts` across 900 floors: `freight-bay: 1`). The "four bespoke room prefabs" deliverable is, in practice, **one prefab, almost never placed**.

**Why the tests miss it:** [`hybrid-procgen.test.ts`](../../src/game/generation/__tests__/hybrid-procgen.test.ts) generates a handful of hand-picked seeds at depths 6 and 10, which happen to work. There is no sweep over depth × seed.

**Fix:**
1. Give every prefab at least one perimeter portal. The JSON already has a `portals` array that the generator ignores. Carve the portal tile, then connect it to the room's existing door or corridor. Never overwrite a tile that a corridor or door entered through.
2. Add a generator invariant test: for depths 1–15 × ≥50 seeds, `generateDungeon` must not throw, and must be connected.
3. Treat a prefab as an attempt-local optimization. If stamping breaks connectivity, **drop the prefab and retry without it** rather than burning one of 10 whole-floor attempts.
4. A last-resort fallback is to generate without bespoke rooms. A generation throw should never be reachable from player input.

### C2. The lock/vault/key content is unreachable in generated floors — ✅ RESOLVED (`c4d2d761`)

> [!NOTE]
> **Resolution Status (2026-11-03):** Completely resolved and verified with integration tests across F6–F15 (Commit `c4d2d761`).
> - **Threshold Lowered**: Reduced `CONTAINER_RARE` room area threshold from 100 to 48 in `dungeon-generator.ts`.
> - **Template Selection**: `pickTemplateForAnchor` spawns `prop-safe-locked` on floors ≥ 6 for `CONTAINER_RARE`.
> - **Vault Door Spawn**: Added `prop-vault-door` to `zero-day-vault.json` authored `propSpawns` at `(4, 6)`.
> - **Spatial Faraday Matching**: `findMatchingFaradayBounds` matches locks strictly to their own vault boundaries; safes outside vaults do not receive erroneous Faraday bounds.
> - **Dead Code Purged**: Removed `void carrierPos;` and `void firstContainerWithLock;`.
> - **Multi-Key Guarantee**: Spawns accessible container keys and ground `item-access-key` pickups outside vaults such that reachable keys ≥ lock count.
> - **Integration Test**: Added F6–F15 sweep in `src/game/generation/__tests__/hybrid-procgen.test.ts` verifying lock presence, key reachability, key count ≥ lock count, and Faraday bounds matching.

Across 404 successfully generated floors, **zero** contained a `SecurityLock`. Contributing causes:

1. **`CONTAINER_RARE` is never anchored.** [`tagProceduralRoomAnchors`](../../src/game/generation/dungeon-generator.ts) emits it only for `room.width * room.height >= 100`. The largest room across 500 floors is area 99. So `prop-safe-locked` never spawns procedurally.
2. **The vault prefab never succeeds** (C1).
3. **`prop-vault-door` is never instantiated.** It is registered in [`entities/index.ts`](../../src/game/entities/index.ts) but no prefab or placement code references it. In the vault prefab, `V` just stamps a walkable, opaque `door` tile, so the vault is not actually gated.
4. **`item-access-key` is never spawned** either.
5. **The "guaranteed access key" logic is dead code.** See [`entity-placement.ts` L484-L503](../../src/game/generation/entity-placement.ts):
   ```ts
   const carrierPos = world.getComponent(carrierId, Actor) ? grid.getEntitiesAt : undefined;
   void carrierPos;
   const firstContainerWithLock = propIds.find(...);
   void firstContainerWithLock;
   ```
   The `void x;` statements exist only to silence lint. The only effective logic is "set `grantsAccessKey` on the first non-locked container". If the floor has no such container, no key is guaranteed.
6. **One key is guaranteed for N locks.** Only one container is patched, but a vault floor can have a safe and a door.
7. **Faraday bounds are bound to the wrong locks.** [`entity-placement.ts` L361](../../src/game/generation/entity-placement.ts) assigns `cfg.vaultFaradayBounds[0]` to every guaranteed locked prop. With two vault rooms, the second room's lock would shield the first room.

**Consequence:** The code for key/overclock/acoustic alarm/Faraday teleport blocking is real and unit-tested in isolation, but a player will not meet it in normal play. The handoff lists all of this as delivered and verified.

**Fix:** After C1 is fixed, add an integration test that walks real generated floors (F6–F15) and asserts on lock presence, key reachability and key-count ≥ lock-count. Add a `prop-vault-door` entry to the vault prefab `propSpawns` (the `V` tile should host the entity, not just terrain). Lower the `CONTAINER_RARE` threshold or key it to something other than raw room area. Delete the dead placeholder block.

### C3. "Masked client loot" is not masked — ✅ RESOLVED (`b1a7999a`)

> [!NOTE]
> **Resolution Status (2026-11-03):** Completely resolved and verified with unit and integration tests (Commit `b1a7999a`).
> - **Schema Update**: Made `trapType` optional in `CorruptedNode.schema` so unrevealed nodes omitting `trapType` conform to schema parsing.
> - **Redaction Transformers**: Implemented `redactWorldForClient` and `redactDeltaForClient` in `src/shared/serialization.ts`, stripping `storedLoot`, `scrapYield`, `fluxYield`, `grantsAccessKey`, `blueprintId`, and `blueprintType` from `container`, and stripping `trapType` from `corruptedNode` when `!revealed`.
> - **Delta Options**: Added `options?: { redactForClient?: boolean }` to `createECSWorldDelta` and `serializeWorld`.
> - **API Route Payloads**: `src/app/api/action/route.ts` redacts both `FULL` (including transactional rollback payload) and `DELTA` payloads transmitted across the network, while preserving server-side in-memory `World` state.
> - **Tests**: Added tests in `src/shared/__tests__/serialization.test.ts`, `tests/shared/ecs-delta.test.ts`, and an integration test in `src/game/generation/__tests__/hybrid-procgen.test.ts` verifying no secret fields exist in client `FULL` or `DELTA` payloads.

The handoff (§3 M1, §3 M2) and the test titled *"masks container loot from network/client payload"* claim that only `highestRarity` is exposed until searched.

- No code strips `Container.storedLoot`, `scrapYield`, `fluxYield`, `grantsAccessKey` or `blueprintId` from `serializeWorld`, `createECSWorldDelta` or the `FULL` payload. A grep for those fields shows they appear only in `environment.ts`, `prop-interaction.ts`, `entity-placement.ts` and tests.
- The "masking" test asserts `itemEntityIds` is `[]` and `storedLoot` is **defined**. That proves the opposite of masking: the secret field is present in the component.
- `CorruptedNode.trapType` and `revealed` are likewise visible in every payload. The "hidden trap / reveal" mechanic is cosmetic. Anyone reading the network response sees all traps and the exact loot of each container.

**Fix:** Decide the intended model and make the server enforce it. Either:
- store the secret roll in a server-only component or side table that is excluded from sync (preferred), or
- add a per-component sync filter (redaction hook) to `serializeWorld` / `createECSWorldDelta`.

Then add a test that asserts the *serialized payload* contains no `storedLoot`.

### C4. `PICKUP` and `DROP_ITEM` trust the client for position and range — ✅ RESOLVED (`2f6f3aa6`)

> [!NOTE]
> **Resolution Status (2026-11-03):** Completely resolved and verified with 14 unit and negative validation tests (Commit `2f6f3aa6`).
> - **Intent-Driven Drop**: Defined `DropItemIntent` component in `src/shared/components/intents.ts` and registered in `COMPONENTS_REGISTRY`. Moved drop state mutation out of `processAction` into `ItemPickupSystem` (`Phase.REACTION`), keeping game logic inside phased systems.
> - **Drop Validation**: Server validates Manhattan distance $\le 1$ to actor, grid bounds, walkability, and verifies that the dropped item actually belongs to the player's inventory before attaching `DropItemIntent`.
> - **Pickup Validation**: Server validates Manhattan distance $\le 1$ between player and target item, confirms entity existence, confirms item-like nature (`ItemDef` or `Scrap` or `Flux`), and checks that the target is not condemned (`Dying`).
> - **Desync Fail-Loud**: Removed the silent desync resilience fallback in `src/game/systems/item-pickup.ts` that previously substituted unintended items on coordinate mismatch; pickup now logs an error, emits telemetry, and fails loudly.
> - **Consumable Target Validation**: Validates `USE_CONSUMABLE` target entity ID (enforces self-targeting on player) and ensures item has `consumable: true`.
> - **Tests**: Comprehensive negative and boundary unit tests added in `tests/game/c4-validation.test.ts`.

**Where:** [`item-pickup.ts`](../../src/game/systems/item-pickup.ts) (explicit pickup branch), [`route.ts` L371-L395](../../src/app/api/action/route.ts)

- `PICKUP { itemId }`: when the item has a `Position`, the code uses it directly with **no adjacency check** to the actor. Any item, including items in unexplored rooms, enemy drops and (if C2 is fixed) vault contents, can be taken by entity ID from anywhere on the map. Entity IDs are small sequential integers.
- The "desync resilience" fallback silently substitutes **a different item** if the requested one is not item-like. It picks whatever item is at the target coordinates, or any item within one tile of the actor. That hides client/server desync and can give the player something they did not ask for. Fail loudly instead.
- `DROP_ITEM { targetX, targetY }`: coordinates default to the player's position only when omitted. If supplied, there is no distance, bounds or walkability check. A client can place an item inside a wall or in the far corner of the map. `session.grid.addItem` is called directly in the API route.
- `USE_CONSUMABLE { targetEntityId }`: the client can pick any entity as the heal and stability target. Only the player's own stability and HP should be affected.
- `BURN_FIRMWARE` / `BURN_AUGMENT`: see C8.

**Fix:** Validate every client-supplied coordinate and entity ID server-side before attaching the intent: adjacency (Manhattan ≤ 1), bounds, walkability, ownership. Keep all state mutation inside systems that run in a Phase. The route should only validate and attach intents.

### C5. The Two-Tier Bump Safeguard does not do what the handoff says — ✅ RESOLVED (`32a8a320`)

> [!NOTE]
> **Resolution Status (2026-11-03):** Completely resolved and verified with TurnManager-level and engine-level unit tests (Commit `32a8a320`).
> - **Engine-Agnostic Abort Architecture**: Extended `TurnSchedulerAdapter` in `src/engine/turn/types.ts` with optional hooks: `wasActionAborted?(actorId)`, `refundActionCost?(actorId, cost)`, and `clearActionAborted?(actorId)`. `@engine` remains completely decoupled from gameplay ECS components.
> - **0-Turn Abort Outcome**: `TurnManager.submitAction` tracks deducted action cost and passes it to `executeTurnCycle(cost)`. When `adapter.wasActionAborted(playerId)` is detected, `TurnManager` refunds the deducted energy, clears the aborted tag, flushes the event bus, and resets phase to `TurnPhase.AWAIT_INPUT` without advancing `turnNumber` and without executing enemy turns or environmental spread.
> - **Component & System Tag**: Defined `ActionAbortedTag` in `src/shared/components/intents.ts`, registered in `COMPONENTS_REGISTRY`, and handled in `TagCleanupSystem` and `GameTurnAdapter`.
> - **Bump Safeguard Enforcement**: In `MovementSystem` (`src/game/systems/movement.ts`), when bumping into an armed `CorruptedNode` or locked `SecurityLock` without access key, emits `INPUT_BUFFER_CLEARED`, attaches `ActionAbortedTag`, and blocks movement on both client and server.
> - **Input Buffer Listener**: Wired subscriber in `src/game/setup.ts` (`eventBus.on('INPUT_BUFFER_CLEARED', () => inputManager.clearQueue())`), clearing buffered inputs.
> - **Tests**: Added engine unit tests in `src/engine/turn/turn-manager.test.ts` and TurnManager-level verification in `tests/game/c5-bump-safeguard.test.ts`.

The handoff claims risky bumps *"halt player movement with **0 turn cost**, flash an alert, and flush the input buffer."*

- [`TurnManager.submitAction`](../../src/engine/turn/turn-manager.ts) deducts the action cost (1000 energy) **before** invoking the player action handler. [`movement.ts`](../../src/game/systems/movement.ts) later sets `blocked = true` and never refunds energy. A blocked bump therefore **costs a full turn, and enemies act**.
- `INPUT_BUFFER_CLEARED` is emitted at [`movement.ts` L110 and L135](../../src/game/systems/movement.ts), but has **no subscriber anywhere** in `src/`. Nothing flushes the input queue. The `as keyof T` / `as T[keyof T]` casts exist to force the emit through the type system.
- The "0 turn cost" assertion exists only as a comment and a test title. The unit test calls the movement system directly and never goes through `TurnManager`.

**Net effect:** the safeguard turns a dangerous bump into a *warning that still burns your turn* while the buffered second key is still replayed. That is arguably worse than no safeguard.

**Fix:** Decide whether blocked bumps are free. If yes, resolve them client-side before submitting a turn (the client already predicts movement), or have the server short-circuit the cycle without energy cost. Wire up the input buffer clear or delete the event. Add a `TurnManager`-level test that verifies the energy value after a blocked bump.

### C6. Architecture-guideline violations — ✅ ALL RESOLVED

> [!NOTE]
> **Resolution Status (2026-11-03):** All items in Section C6 have been completely resolved and verified with unit tests (Commits `73842d7f`..`519b3487`). Zero `eventBus.on` remain in gameplay systems, prop damage routes through `DamageIntent`, `@engine` is game-agnostic, and route business logic has been consolidated into `processAction`.

| Rule (source) | Violation | Location | Status |
|---|---|---|---|
| **No `eventBus.on()` to trigger game logic** (`AGENTS.md` §3.1; `ENGINE_GUIDELINES` "Golden Rule") | `StabilitySystem` subscribes to `ENTITY_DIED` and mutates `Stability`. It also emits `STABILITY_CHANGED` and a message from the handler. It runs outside any `Phase`, after CLEANUP, whenever the bus flushes. Needs `as any` plus `eslint-disable`. | [`stability.ts` L140-L177](../../src/game/systems/stability.ts) | ✅ **Resolved (`73842d7f`)**: Moved to `Phase.REACTION` query on `(Dying, Hostile)`. |
| **All combat/hazard damage routes through `AttackIntent` / `DamageIntent`** (`AGENTS.md` §3.3) | `handlePropDestruction` patches `Health` directly for cryo spill (4 dmg), EMP (10 dmg) and cascades (15 dmg), emits `DAMAGE_DEALT` itself, and attaches `Dying` itself. This bypasses armor, `CombatSystem` death handling, `isAlive`, and on-kill augment/software reactions. | [`combat.ts` L218-L340](../../src/game/systems/combat.ts) | ✅ **Resolved (`54219230`)**: Routed via `DamageIntent` (`damageType: 'environmental'`) in `CombatSystem` cascade loop. |
| **Engine layer is game-agnostic** (`AGENTS.md` §2, `SYSTEM_OVERVIEW` layer table) | `TurnManager` now special-cases the string `'ABORT_RUN'`. [`engine/utils/logger.ts`](../../src/engine/utils/logger.ts) now installs a global `window.console.error` interceptor for **React duplicate-key warnings**. That is a React/DOM concern in `@engine`, and uses untyped `any` (`window as any`). | [`turn-manager.ts` L35, L43](../../src/engine/turn/turn-manager.ts) | ✅ **Resolved (`fbc273ba`)**: Handled via `allowsInactiveActorAction` hook on adapter; React interceptor moved to `src/game/diagnostics/`. |
| **Systems don't directly mutate other systems' domain state** (spirit of Phase-Driven Intent) | `triggerAcousticAlert` patches `AIState.behavior` and `FovAwareness` on every hostile in range. `AISystem` should consume an `AlertIntent` or `Alerted` tag in `GATHER_INTENT`. The subnet console and `FirmwareSystem` patch `CorruptedNode.revealed` on remote entities. | [`prop-interaction.ts` L105-L130](../../src/game/systems/prop-interaction.ts) | ✅ **Resolved (`644f632b`)**: Attaches `AlertIntent`, consumed by `AISystem` in `Phase.GATHER_INTENT`. |
| **Business logic in API routes** (`SYSTEM_OVERVIEW` §2: route "attaches the Intent component") | [`route.ts`](../../src/app/api/action/route.ts) now contains inline burn/purge/drop/consume logic: it patches `Stability`, swaps firmware slots, adds `Dying`, and calls `grid.addItem`. The same actions are duplicated in [`action-pipeline.ts`](../../src/game/pipeline/action-pipeline.ts). The two copies have already diverged (for example `INTERACT_PROP` exists in both with different flow). | `route.ts` L229-L395 | ✅ **Resolved (`f15f26ac`)**: Consolidated into `processAction` pipeline; route only validates and attaches intents. |
| **Death Protocol step 2: condemnation by the authoritative system** (`DEATH_PROTOCOL.md`) | `handlePropDestruction` and the cascade code attach `Dying` and emit `ENTITY_DIED` from a helper, and set neither `isAlive` nor a consistent `reason`. The protocol doc lists the authorised condemnation points; this one is not among them. | `combat.ts` | ✅ **Resolved (`54219230`, `519b3487`)**: Condemnation handled by `CombatSystem` with `reason: 'environmental_destruction'`; docs updated. |
| **Client prediction only registers prediction-safe systems** | `MovementSystem` (client-registered) now imports from `prop-interaction.ts` and attaches `InteractPropIntent`. The resolving `PropInteractionSystem` is server-only, so on the client the intent is attached and never consumed (removed only by `TagCleanup`). Bump warnings are also emitted on both sides, which risks duplicate messages. | [`movement.ts`](../../src/game/systems/movement.ts) | ✅ **Resolved (`f0e4790e`)**: Parameterized with `isClient`, blocking prediction without attaching `InteractPropIntent` or emitting duplicates; access keys decoupled. |
| **Ground-truth "Only `GravediggerSystem` may call `destroyEntity`"** | ✅ **Compliant.** `grep destroyEntity` shows only `gravedigger.ts` in non-test, non-engine code. | | ✅ **Compliant.** |

> [!NOTE]
> The handoff's §2 states that "all code strictly enforces the architectural boundaries" and that systems "never call each other directly". The two bullets above (direct `eventBus.on` game logic, direct `Health` patching) contradict that. ESLint passes only because the layer rules enforce *import* boundaries, not these behavioural mandates, and because of the `as any` / `as unknown as` / `eslint-disable` escapes.

**Fix:** Move the stability recovery into `StabilitySystem`'s `Phase` update and have it read `Dying` entities with `killerId` (as `SoftwareSystem` and `AugmentSystem` already do). Rewrite `handlePropDestruction` to attach `DamageIntent` (`damageType: 'environmental'`) to neighbours and let `CombatSystem` resolve them, with a bounded fixed-point loop to handle cascades. Replace `triggerAcousticAlert` with an intent/tag consumed by `AISystem`. Remove `ABORT_RUN` from `TurnManager` (use an adapter hook or a config flag). Move the React key interceptor out of `@engine` into a client bootstrap file. Collapse the route/pipeline duplication so the route only validates and attaches intents.

### C7. Stability changes: exploit and unreviewed rebalance — ✅ RESOLVED (`0d33d784`)

> [!NOTE]
> **Resolution Status (2026-11-03):** Completely resolved and verified with unit tests (Commit `0d33d784`).
> - **Threat Purge Filtered to Hostile**: In `StabilitySystem` (`src/game/systems/stability.ts`), stability recovery in `Phase.REACTION` checks `w.hasComponent(dyingId, Hostile)` and verifies the dying actor is not the player, eliminating the stability exploit from destroying crates, vats, and traps.
> - **Documented Stability Formulas**: Updated `docs/design/STABILITY-ANCHOR-SYSTEM.md` with explicit formulas and default parameters for per-turn bleed (`base = 0.005`, `scale = 0.02`), floor chunk drain (`base = 3`, `scale = 0.2`), and the +2% threat purge recovery.
> - **Regeneration Math Alignment**: Set regeneration magnitude to `2` (+2 HP per turn for 3 turns) in `action-pipeline.ts`, aligning with the design specification.
> - **Additive HealIntent Stacking**: Replaced raw `addComponent(HealIntent)` calls across all systems and pipeline handlers with `addHealIntent()`, additively stacking heals in the same turn without slot collision or overwrites.
> - **Two-Phase Heal Resolution**: Registered `HealSystem` in both `Phase.PRE_TURN` and `Phase.REACTION`, allowing regeneration and combat/reaction heals to resolve independently without loss.
> - **Tests**: Comprehensive unit tests added in `tests/game/c7-stability-heal.test.ts`.

- **Exploit:** [`handleEntityDied`](../../src/game/systems/stability.ts) grants `+2%` for every non-player `ENTITY_DIED` whose `killerId` is the player. There is no `Hostile` check, and `handlePropDestruction` emits `ENTITY_DIED` for crates, vats, capacitor banks and corrupted nodes. The handoff says "Eliminating a hostile enemy". In reality **smashing crates heals Reality Stability.** With cover props being cheap, destructible and numerous, this is a free stability farm. Cascades make it multiplicative.
- **Handoff inaccuracy:** it says `ENTITY_DIED` carries `reason: 'threat_purged'`. In code the reason is on `STABILITY_CHANGED`.
- **Unreviewed balance change:** the "fix" in commit `7d269b75` changes `perTurnBleedScale` from 0.1 to 0.02 (-80%), `perTurnBleedBase` from 0.01 to 0.005 (-50%), `perFloorChunkBase` from 5 to 3 (-40%) and `perFloorChunkScale` from 0.5 to 0.2 (-60%), with no design-doc update. `docs/design/STABILITY-ANCHOR-SYSTEM.md` and `RUN-ECONOMY.md` are untouched. It was bundled with unrelated fixes, so it will be hard to revert independently.
- **Regeneration math doesn't match the handoff.** It says "+2 HP per turn". [`route.ts`](../../src/app/api/action/route.ts) applies `magnitude: 1` (+1 per turn).
- **`HealIntent` collision.** `HealIntent` is single-slot per entity. The potion attaches one `HealIntent` (+5) from the route, and the regeneration status can attach another in `PRE_TURN` via `addComponent`, which **overwrites** it. Depending on ordering, the instant +5 can be lost, and a pickup-heal in the same turn can overwrite either one.

### C8. `BURN_FIRMWARE` / `BURN_AUGMENT` ignore port capacity — ✅ RESOLVED (`91fccc2d`)

> [!NOTE]
> **Resolution Status (2026-11-03):** Completely resolved and verified with unit tests (Commit `91fccc2d`).
> - **Schema Bounds Relaxed**: Relaxed `BurnFirmwareActionSchema`, `BurnAugmentActionSchema`, and `MoveAndUseFirmwareActionSchema` slot bounds from hardcoded 2/3 to `.min(0).max(10)` to accommodate upgraded shell capacities.
> - **Dynamic PortConfig Capacity Checks**: In `action-pipeline.ts`, queries player `PortConfig` (`maxFirmware`, `maxAugment`) containing shell base ports + upgrades, rejecting actions that exceed capacity before modifying any state.
> - **Inventory Validation Before Consumption**: Verifies item existence and ownership in `RunInventory` as well as component definitions (`AbilityDef`, `AugmentData`) before removing items. On validation or capacity failure, inventory remains completely untouched.
> - **Zero Placeholder Elimination**: Completely eliminated `while (equipped.length < slotIndex) equipped.push(0)`. Slots now append contiguously or overwrite existing slots; no entity ID `0` is ever pushed.
> - **Death Protocol Condemnation**: Overwritten abilities/modules are condemned via `Dying` (`reason: 'overwritten'`, `killerId: playerId`).
> - **UI Dynamic Port Reflection**: Updated `BackpackGrid.tsx` to read `PortConfig` and `AugmentSlots`, rendering slots matching actual shell capacity and offering slot overwrites when full.
> - **Tests**: Comprehensive unit tests added in `tests/game/c8-port-capacity.test.ts`.

[`route.ts` L229-L330](../../src/app/api/action/route.ts), [`shared/types.ts`](../../src/shared/types.ts)

- Slot bounds are hard-coded in the Zod schema (`slotIndex ≤ 2` for firmware, `≤ 3` for augments). The same branch ships shell port **upgrades** that expand capacity, yet burning never consults the shell's `portConfig` or applies upgrades. A shell with 1 firmware port can burn into slot 2, which bypasses the capacity limit.
- `while (equipped.length < slotIndex) equipped.push(0)` fills gaps with entity ID `0`, which is a valid ID shape and will be passed to `getComponent` / `world.query`.
- The old firmware or augment is condemned with `Dying` (`reason: 'overwritten'`) with no confirmation or refund.
- Inventory items are removed (`removeItemByEntityId`) before the capacity check. If the burn is later skipped, the item is already gone.

---

## 3. Medium and low findings

**M1. Inconsistent access-key accounting (latent infinite-key bug) — ✅ RESOLVED.**
- Robust matching: Defined `isAccessKeyTemplate` in [`access-key-util.ts`](../../src/shared/utils/access-key-util.ts) replacing substring checks.
- Symmetric consumption: `consumeAccessKey` consumes from `FloorState`, `RunInventory.software`, or `RunInventory.equipment`.
- Return-value enforcement: In [`prop-interaction.ts`](../../src/game/systems/prop-interaction.ts), `SecurityLock` only unlocks when `consumeAccessKey` successfully returns `true`.
- Floor transition cleanup: In [`floor-manager.ts`](../../src/game/systems/floor-manager.ts), resets `accessKeysHeld: 0` on descent and purges any temporary access-key items from `RunInventory` so keys never bleed across floors.
- Verified in [`tests/game/m1-access-key.test.ts`](../../tests/game/m1-access-key.test.ts).

**M2. `vaultsBreached` (+150 pts) is only counted on the overclock path — ✅ RESOLVED.**
- Clean unlock scoring: In [`prop-interaction.ts`](../../src/game/systems/prop-interaction.ts), unlocking with an Access Key increments `FloorState.vaultsBreached` symmetrically with the Overclock Bypass path.
- End-of-run event & UI propagation: `RunEnderSystem` (`src/game/systems/run-ender.ts`) passes `vaultsBreached` and `trapsDisarmed` into `RUN_ENDED` payload stats, which [`sync-bridge.ts`](../../src/game/ui/sync-bridge.ts) routes to `calculateScore` and [`route.ts`](../../src/app/api/action/route.ts) passes to `submitLeaderboardEntry`.
- Verified multiplier: Verified `scoring.ts` multiplies `vaultsBreached * 150` in accordance with `economy.json`.
- Verified in [`tests/game/m2-vaults-scoring.test.ts`](../../tests/game/m2-vaults-scoring.test.ts).

**M3. Dead-drop uplink charges Flux even when no item is removed — ✅ RESOLVED.**
- Pre-charge item validation: In [`prop-interaction.ts`](../../src/game/systems/prop-interaction.ts), dead-drop uplink locates and removes the target item from `RunInventory` (software/equipment) or blueprint stack from `RunCurrency` before deducting Flux.
- No wasted currency or phantom transmissions: If the selection ID is invalid or not in inventory, emits an error message, aborts transmission, leaves Flux untouched, and leaves the prop unsearched.
- Verified in [`tests/game/m3-dead-drop.test.ts`](../../tests/game/m3-dead-drop.test.ts).

**M4. `Math.random()` in server game logic — ✅ RESOLVED.**
- Deterministic lore selection: In [`prop-interaction.ts`](../../src/game/systems/prop-interaction.ts), atmospheric forensics lore selection accepts an optional seeded `rng?: { random(): number }` or falls back to ROT.js `RNG.getUniform()`, eliminating unseeded `Math.random()`.
- Deterministic simulation & replay parity: Preserves strict RNG replay fidelity across floor runs.
- Verified in [`tests/game/m4-lore-rng.test.ts`](../../tests/game/m4-lore-rng.test.ts).

**M5. Two of three sector conditions are no-ops — ✅ RESOLVED.**
- `THERMAL_SURGE` implemented: Passive shell heat dissipation in [`HeatSystem`](../../src/game/systems/heat.ts) is halved (`0.5x`); workstation access costs 0 Heat (in [`prop-interaction.ts`](../../src/game/systems/prop-interaction.ts)); and `+1` extra `prop-cooling-vent` spawns on the floor (in [`entity-placement.ts`](../../src/game/generation/entity-placement.ts)).
- `DARK_SUBNET` implemented: Base player FOV drops by 2 tiles (`6` instead of `8` in [`render-system.ts`](../../src/rendering/render-system.ts)); and `CorruptedNode` acoustic alert radius is halved to `6` tiles instead of `12` in [`prop-interaction.ts`](../../src/game/systems/prop-interaction.ts).
- `OVERCLOCKED_GRID` implemented: Per-turn stability bleed in [`StabilitySystem`](../../src/game/systems/stability.ts) runs `1.25x` faster; container scrap/flux loot is boosted by `+50%` and `2` Reality Stabilizers spawn.
- Clarified generator probability comments in [`dungeon-generator.ts`](../../src/game/generation/dungeon-generator.ts).
- Verified in [`tests/game/m5-sector-conditions.test.ts`](../../tests/game/m5-sector-conditions.test.ts).

**M6. Unused schema surface — ✅ RESOLVED.**
- `thermal_burst` implemented: In [`combat.ts`](../../src/game/systems/combat.ts) `handlePropDestruction`, detonating a prop with `hazardOnDestroy: 'thermal_burst'` applies 8 environmental damage via `DamageIntent` and injects +25 Neural Heat to actors within radius 2.
- `blueprintId` & `blueprintType` consumed: In [`prop-interaction.ts`](../../src/game/systems/prop-interaction.ts), searching containers holding blueprint metadata adds the blueprint to the player's `RunCurrency` stacks.
- `Container.capacity` enforced: In [`entity-placement.ts`](../../src/game/generation/entity-placement.ts) `seedContainerLoot`, respects `container.capacity` to bound stored items.
- Pruned dead schema surface: Removed unused `bulkhead_switch` from `PropClassSchema` and unused `loreSnippetId` from `PropSchema` in [`environment.ts`](../../src/shared/components/environment.ts).
- Verified in [`tests/game/m6-schema-surface.test.ts`](../../tests/game/m6-schema-surface.test.ts).

**M7. Cover is not "directional" and does not raycast — ✅ RESOLVED.**
- Bresenham raycasting: Implemented `bresenhamLine` in [`combat.ts`](../../src/game/systems/combat.ts) to trace line trajectories between attacker and defender.
- Intervening orthogonal cover evaluation: Directional cover requires an active `InteractiveSurface` on an intervening orthogonal tile along the attack trajectory (evaluated on the ray step immediately preceding the defender or intervening orthogonal projection tiles). Flanking or behind cover no longer mitigates attacks.
- Bastion shell scaling: Preserves high-tier barrier cover values by taking `Math.max(0.35, baseReduction)` instead of overwriting superior cover.
- Spatial index lookup: Uses `grid.getEntitiesAt` spatial lookup with fallback to `world.query(InteractiveSurface, Position)` to eliminate scanning all surfaces across the entire world.
- Verified in [`tests/game/m7-directional-cover.test.ts`](../../tests/game/m7-directional-cover.test.ts) and [`src/game/systems/__tests__/cover-and-hazards.test.ts`](../../src/game/systems/__tests__/cover-and-hazards.test.ts).

**M8. Cryo "spill" is a one-shot, not a hazard — ✅ RESOLVED.**
- Persistent `DeadZone` hazard: In [`combat.ts`](../../src/game/systems/combat.ts) `handlePropDestruction`, Cryo-Vat destruction creates persistent `DeadZone` entities across walkable tiles in the hazard footprint with 3 turns duration and 4 damage per tick (handled by `DeadZoneSystem`).
- Data-driven `hazardRadius`: Added `hazardRadius` to [`InteractiveSurface`](../../src/shared/components/environment.ts) schema (with default 2), data-driven in `prop-cryo-vat.json` (radius 1 = 3x3 footprint) and `prop-capacitor-bank.json` (radius 2).
- Player friendly-fire safety: Added `friendlyFire` to `InteractiveSurface` schema and `options.friendlyFire` support to `handlePropDestruction`, exempting player from self-harm and status effects when friendly-fire is disabled.
- Verified in [`tests/game/m8-cryo-hazard.test.ts`](../../tests/game/m8-cryo-hazard.test.ts) and [`src/game/systems/__tests__/cover-and-hazards.test.ts`](../../src/game/systems/__tests__/cover-and-hazards.test.ts).

**M9. Container search does not match the handoff — ✅ RESOLVED.**
- Backpack transfer & ground overflow: In [`prop-interaction.ts`](../../src/game/systems/prop-interaction.ts), container search transfers software, equipment, and consumables directly into the player's `RunInventory` via `InventoryUtil`. Items overflowing max inventory capacity drop to the ground deck at `propPos`.
- Gravedigger cascade immunity: Containers no longer attach `Children` to themselves upon opening; ground loot remains independent and is not destroyed if the container is subsequently destroyed.
- ContainerOverlay "Take All" & hotkey: Added `onTakeAll` callback and "TAKE ALL [SPACE]" button to [`ContainerOverlay.tsx`](../../src/components/ui/inventory/ContainerOverlay.tsx), with Space and Escape keyboard accessibility.
- Loud template failure logging: Replaced silent `catch {}` with `logger.error` during container loot materialization.
- Verified in [`tests/game/m9-container-loot.test.ts`](../../tests/game/m9-container-loot.test.ts) and [`src/components/ui/inventory/__tests__/ContainerOverlay.test.tsx`](../../src/components/ui/inventory/__tests__/ContainerOverlay.test.tsx).

**M10. Prop placement can disconnect the map — ✅ RESOLVED.**
- Full-map connectivity re-validation: Implemented `wouldDisconnectMap` in [`entity-placement.ts`](../../src/game/generation/entity-placement.ts) using `validateConnectivity` from `@engine/generation/flood-fill`. Every prop placement (guaranteed authored anchors, reality stabilizers, cooling vents, and procedural anchors) checks that all walkable non-vault tiles remain 100% reachable from the player spawn room.
- Vault interior preservation: Validates mutual reachability inside locked vault boundaries to guarantee vault props do not disconnect interior loot or terminals.
- Verified in [`tests/game/m10-prop-connectivity.test.ts`](../../tests/game/m10-prop-connectivity.test.ts) across depths 1–15 and varied seeds.

**M11. Error logger issues — ✅ RESOLVED.**
- ANSI escape sequence fix: Corrected `\x1b[31${separator}` to `\x1b[31m${separator}` in [`error-logger.ts`](../../src/server/utils/error-logger.ts).
- Size cap and log rotation: Implemented `MAX_LOG_SIZE_BYTES` (5 MB) cap with automatic file rotation via `rotateLogFileIfNeeded`, rotating up to `MAX_BACKUP_FILES` (2) backups (`game-errors.log.1`, `game-errors.log.2`).
- Latency & non-blocking disk I/O: In [`route.ts`](../../src/app/api/action/route.ts), executes `logTurnExecutionError` as a non-blocking background task (`void logTurnExecutionError(...).catch(...)`), preventing failing turns from blocking the HTTP response on disk I/O.
- PII / session sanitization: Truncates and sanitizes session IDs in persistent file logs.
- Verified in [`tests/server/m11-error-logger.test.ts`](../../tests/server/m11-error-logger.test.ts).

**M12. Type-safety erosion — ✅ RESOLVED.**
- Added missing event types: Added `STATE_RECONCILED` directly to authoritative `GameplayEvents` in [`src/shared/events/types.ts`](../../src/shared/events/types.ts), inheriting cleanly into client `GameEvents` and enabling zero-cast, type-safe emissions in [`reconciliation.ts`](../../src/shared/reconciliation.ts).
- Burned down unsafe casts across gameplay systems: Eliminated `as unknown as T['...']` and `(eventBus as unknown as EventBus<GameplayEvents>)` across [`stability.ts`](../../src/game/systems/stability.ts), [`firmware.ts`](../../src/game/systems/firmware.ts), [`item-pickup.ts`](../../src/game/systems/item-pickup.ts), [`run-ender.ts`](../../src/game/systems/run-ender.ts), [`equipment.ts`](../../src/game/systems/equipment.ts), and [`prop-interaction.ts`](../../src/game/systems/prop-interaction.ts).
- Cleaned rendering & inspector types: Replaced `World<any>` and `EventBus<any>` in [`tile-inspector.ts`](../../src/rendering/tile-inspector.ts) with `World<GameEvents>` and `EventBus<GameEvents>`, pruned pixi filter double casts in [`glitch-effects.ts`](../../src/rendering/filters/glitch-effects.ts), and removed `eslint-disable` workarounds in `sync-bridge.ts`, `tile-inspector.ts`, and `reconciliation.ts`.
- Verified in [`tests/game/m12-type-safety.test.ts`](../../tests/game/m12-type-safety.test.ts).

**M13. Unreviewed behaviour changes bundled in — ✅ RESOLVED.**
- Default shell archetype unified: Exported canonical `DEFAULT_SHELL_ID = 'vanguard-v1'` in [`src/shared/constants.ts`](../../src/shared/constants.ts). Replaced all lingering `'player-shell-default'` and hardcoded string fallbacks across [`setup.ts`](../../src/game/setup.ts), [`session/route.ts`](../../src/app/api/session/route.ts), [`page.tsx`](../../src/app/page.tsx), and [`sync-bridge.ts`](../../src/game/ui/sync-bridge.ts).
- Robust two-pass auto-pathfinding: In [`auto-pathfind.ts`](../../src/game/debug/auto-pathfind.ts), implemented a two-pass pathfinding strategy that prefers safe routing around hostiles and props, but automatically falls back to an engaging path when hostiles occupy narrow corridors rather than throwing `path.length === 0` and canceling. Only entities with `BlocksMovement` or impassable walls act as hard barriers.
- `GameTurnAdapter` Death Protocol alignment & documented invariants: In [`game-turn-adapter.ts`](../../src/game/turn/game-turn-adapter.ts), filtered out condemned `Dying` entities in `getCandidateActors()` alongside existing `isActorActive`, `canActorAct`, `accumulateEnergy`, and `onBeforeActorAct` guards. Documented turn scheduler adapter invariants in [`DEATH_PROTOCOL.md`](../architecture/DEATH_PROTOCOL.md) and [`ENGINE_GUIDELINES.md`](../architecture/ENGINE_GUIDELINES.md).
- Verified in [`tests/game/m13-unreviewed-behavior.test.ts`](../../tests/game/m13-unreviewed-behavior.test.ts).

**M14. Weak or misleading tests — ✅ RESOLVED.**
- Hardened loot-masking verification: In [`hybrid-procgen.test.ts`](../../src/game/generation/__tests__/hybrid-procgen.test.ts), updated the container loot test to serialize via `serializeWorld(world, { redactForClient: true })` and assert that secret fields (`storedLoot`, `scrapYield`, `fluxYield`, `grantsAccessKey`, `blueprintId`, and `blueprintType`) are completely stripped from client payloads, and that unrevealed `CorruptedNode.trapType` is stripped.
- Multi-seed procgen sweep test: Added multi-depth (1–15) × multi-seed sweep tests in `hybrid-procgen.test.ts` verifying floor connectivity, sector conditions, and room generation beyond lucky seeds.
- Loud template instantiation failure tests: In [`prop-interaction.test.ts`](../../src/game/systems/__tests__/prop-interaction.test.ts), added tests verifying that bad/unregistered container item templates log errors via `logger.error` rather than silently swallowing errors.
- ActionAbortedTag and InputBuffer assertions: In `prop-interaction.test.ts`, verified `ActionAbortedTag` attachment and `INPUT_BUFFER_CLEARED` event emissions across hazard and lock bumps.
- Client-side prediction parity test suite: Created comprehensive test suite in [`tests/game/m14-prediction-parity.test.ts`](../../tests/game/m14-prediction-parity.test.ts) comparing client (`isClient: true`) and authoritative server (`isClient: false`) state outcomes, testing movement prediction, bump-to-search parity, 0-turn-cost bump safeguard parity, and delta reconciliation without client desync.
- Verified in [`tests/game/m14-prediction-parity.test.ts`](../../tests/game/m14-prediction-parity.test.ts), [`src/game/generation/__tests__/hybrid-procgen.test.ts`](../../src/game/generation/__tests__/hybrid-procgen.test.ts), and [`src/game/systems/__tests__/prop-interaction.test.ts`](../../src/game/systems/__tests__/prop-interaction.test.ts).

**Low / polish**
- `getRarityFromTemplate` classifies rarity by substring (`-v3`, `augment`, `firmware`).
- Shuffle uses `[...].sort(() => rng.random() - 0.5)`, a non-transitive comparator whose output varies across JS engines, which is risky for cross-environment determinism.
- Dev-terminal `/show-map` replaces hotkeys but check that `DEBUG_COMMAND` is gated in production builds (not changed here, but this branch adds new reveal capability).
- `tag-cleanup.ts` removes *every* `InteractPropIntent` at cleanup, including intents attached for the next actor if phases are ever reordered.
- Magic numbers throughout (`12` alert radius duplicated, `35`, `25`, `+2%`, `15`/`10`/`4`). Move them to data/config.

---

## 4. Handoff accuracy audit

| Handoff statement | Reality |
|---|---|
| "Fully Implemented, Verified, and Ready for Merge" | ❌ C1, C2 |
| "Four bespoke room prefabs" | ❌ 3 of 4 are sealed and crash generation or are never placed |
| "Guaranteed access key placement whenever locked barriers are generated" | ❌ Dead placeholder code; one key for N locks; may not place at all |
| "Masked client loot … exposes only `highestRarity`" | ❌ Fully visible in sync payloads |
| "Two-Tier Bump Safeguard (0-turn pause) … flushes the input buffer" | ❌ Costs a full turn; no listener for flush |
| "Raycasts between attacker and defender" | ❌ No raycast |
| "3×3 chemical spill dealing 4 tick damage" | ⚠️ One-shot 4 damage + slow |
| "Cascade propagation … without recursion loops" | ⚠️ It *is* recursive (bounded by a `visited` set) |
| "Container loot transferring directly to backpack or ground on overflow" | ❌ Spawns ground entities only |
| "Container Modal … supports 'Take All'" | ❌ No Take All; component not mounted |
| "+2 HP per turn regeneration" | ❌ +1 |
| "Eliminating a hostile … emits `ENTITY_DIED` (`reason: 'threat_purged'`)" | ❌ Any player-caused death; reason is on `STABILITY_CHANGED` |
| "Systems never call each other directly … enforces boundaries strictly" | ❌ C6 |
| "`vaultsBreached` (+150)" | ⚠️ Only the overclock path increments it |
| "Faraday shielding blocks teleports into vaults" | ⚠️ Logic exists but can't occur (C2), and bounds are mis-assigned |
| `DEATH_PROTOCOL` / Gravedigger compliance | ✅ True for `destroyEntity` |
| Type/lint/tests green | ✅ True, and not sufficient |

---

## 5. Architecture-doc drift

None of [`SYSTEM_OVERVIEW.md`](../architecture/SYSTEM_OVERVIEW.md), [`ENGINE_GUIDELINES.md`](../architecture/ENGINE_GUIDELINES.md) or [`DEATH_PROTOCOL.md`](../architecture/DEATH_PROTOCOL.md) were touched by this branch, but each is now stale:

- **`ENGINE_GUIDELINES` phase table** does not list `PropInteractionSystem` (ACTION), the new `StabilitySystem` event handler, or the cascade/volatile logic in `CombatSystem`.
- **`SYSTEM_OVERVIEW` §2** lists server-only systems; `propInteraction` (server-only) is missing. The `ABORT_RUN` special case in the turn manager contradicts the "pure engine" description.
- **`DEATH_PROTOCOL`** lists the authorised condemnation points. `handlePropDestruction` (prop destruction with `reason: 'environmental_destruction'`) and `'purged'`/`'overwritten'` reasons from the API route are not documented.

Update these docs as part of the fix, not as a follow-up. The handoff also should not say the architecture is fully respected until C6 is resolved.

---

## 6. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Players reach floor 10 and can never advance (C1) | **Certain** (100% of seeds) | Run economy and balance for F11–15 are unplayable. Daily/weekly seeded runs stall | Fix prefab portals; sweep test; never throw from generation |
| Cheaters read loot, traps and keys from payloads; pick up anything from anywhere (C3, C4) | High | Leaderboard integrity, economy inflation | Redaction layer; server-side validation of every intent |
| Safeguard gives a false sense of safety (C5) | High | Players lose turns and HP to traps they were "protected" from | Make the behaviour real or remove the claim |
| Stability farm via crate smashing (C7) | High | Removes a core tension mechanic | Move into Phase; require `Hostile` |
| Balance regression from silent stability nerf (C7) | Medium | Early floors trivialised | Revert to a separate PR with design sign-off |
| Hidden slot-cap bypass (C8) | Medium | Power exploit, profile/vault corruption with `0` IDs | Validate against `portConfig` |
| Further `eventBus.on` precedent (C6) | High | Architecture erosion; the next contributor copies this pattern | Fix before merge; add a lint/test rule |
| Unbounded log growth / PII (M11) | Medium | Disk exhaustion on long-lived servers | Rotate, cap, redact |
| Merge conflicts and review difficulty (188 files, mixed concerns) | High | Hard to bisect and revert | Split (below) |

---

## 7. Recommended changes (prioritised)

### P0: must fix before merge
1. **Fix prefabs and generation (C1).** Add portals, never overwrite entrance tiles, fall back to "no prefab" on connectivity failure, never throw. Add a depth × seed sweep test.
2. **Make the lock content reachable (C2).** Spawn `prop-vault-door` from the vault prefab, replace the `CONTAINER_RARE` area rule, implement a real key guarantee (at least one reachable key per lock), fix the Faraday-bounds assignment, and delete the placeholder block. Add an integration test over real floors.
3. [x] **Server-side validation of every new client intent (C4, C8).** (✅ **RESOLVED** via `2f6f3aa6` for range/adjacency/bounds/ownership in C4, and `91fccc2d` for PortConfig capacity and inventory validation in C8).
4. **Implement sync redaction (C3)** and a test on the serialized payload.
5. **Resolve the bump safeguard (C5).** Make it genuinely free or correct the docs; wire or remove `INPUT_BUFFER_CLEARED`.
6. [x] **Remove the architecture violations (C6).** (✅ **RESOLVED** via commits `73842d7f`..`519b3487`: stability recovery into Phase.REACTION query; volatile damage via DamageIntent; ABORT_RUN hook and React interceptor out of @engine; client prediction boundary enforced).
7. [x] **Fix the `+2%` farm (C7)** and decide on the stability rebalance in a separate, signed-off change. (✅ **RESOLVED** via `0d33d784`: threat purge strictly filtered to Hostile, documented in `STABILITY-ANCHOR-SYSTEM.md`, regeneration aligned to +2 HP, additive `HealIntent` stacking).

### P1: should fix in this branch
8. Unify key accounting and reset or scope keys per floor (M1); count `vaultsBreached` on both paths (M2).
9. Fix the dead-drop charge-before-validate bug (M3).
10. [x] **Fix `HealIntent` overwrites (C7)** by stacking amounts or using separate tag components. (✅ **RESOLVED** via `0d33d784`: `addHealIntent` additive stacking and PRE_TURN/REACTION two-phase resolution).
11. Re-validate connectivity after prop placement (M10).
12. Fix the logger typo and add rotation and redaction (M11).
13. [x] **Consolidate the duplicate action handling in `route.ts` and `action-pipeline.ts` (C6).** (✅ **RESOLVED** via commit `f15f26ac`: route delegates to canonical `processAction`).
14. Replace `Math.random()` with the seeded RNG (M4).
15. Either implement `THERMAL_SURGE` / `DARK_SUBNET` or stop guaranteeing them (M5). Remove or implement unused schema surface (M6).

### P2: cleanup
16. Mount or delete `ContainerOverlay` (M9). Implement or remove "Take All".
17. Burn down the 37 `as unknown as` casts and the `any` / `eslint-disable` lines (M12). Add the missing event types instead.
18. Update the three architecture docs, `TRACKING.md`, `docs/design/INTERACTIVE-ENVIRONMENTS.md` and the handoff itself.
19. Move magic numbers into data files.

### Process recommendations
- **Split the branch.** Suggested slices: (a) env schemas and systems, (b) procgen and prefabs, (c) rendering, (d) UI modals and hotkeys, (e) inventory, consumables and stability fixes, (f) engine and logging changes. Slice (e) in particular is unrelated bug-fix work mixed with a feature branch.
- **Add property-style generator tests** in CI (all depths × N seeds, no throw, connected, key-per-lock, no blocked stairs).
- **Add an architecture lint/test** that fails on `eventBus.on(...)` inside `src/game/systems/**` (except documented UI-bridge files) and on direct `patchComponent(..., Health, ...)` outside `CombatSystem`.
- **Make handoffs evidence-based.** Each "delivered" claim should link to the test or command that proves it.

---

## 8. Suggested merge gate

- [x] Depth 1–15 × ≥50 seeds: `generateDungeon` never throws and the floor is connected (✅ **RESOLVED** in C1: `30ff0a4c`)
- [x] Real floors F6–F15 contain locks, every lock has a reachable key, and Faraday bounds match their own vault (✅ **RESOLVED** in C2: `c4d2d761`)
- [x] Serialized `FULL` and `DELTA` payloads contain no `storedLoot`, `scrapYield`, `fluxYield`, `grantsAccessKey` or unrevealed `trapType` (✅ **RESOLVED** in C3: `b1a7999a`)
- [x] Server rejects out-of-range `PICKUP`, `DROP_ITEM`, `USE_CONSUMABLE` targets, and out-of-capacity burns (✅ **RESOLVED** in C4: `2f6f3aa6`; C8: `91fccc2d`)
- [x] `TurnManager`-level test proves the energy outcome of a blocked bump (✅ **RESOLVED** in C5: `32a8a320`)
- [x] Zero `eventBus.on` in gameplay systems; zero direct `Health` patches outside `CombatSystem`; `@engine` has no game or React strings (✅ **RESOLVED** in C6)
- [x] Stability: crate destruction does not restore stability (✅ **RESOLVED** in C7: `0d33d784`; threat purge strictly filtered to Hostile, documented in `STABILITY-ANCHOR-SYSTEM.md`, regeneration aligned to +2 HP, additive `HealIntent` stacking)
- [x] Architecture docs and handoff updated to match (✅ **RESOLVED**: `DEATH_PROTOCOL.md`, `ENGINE_GUIDELINES.md`, `SYSTEM_OVERVIEW.md` updated)

---

## 9. Scope and limits of this review

**Reviewed in depth:** `prop-interaction.ts`, `combat.ts` (cover and destruction), `movement.ts`, `teleport.ts`, `stability.ts`, `status-effects.ts`, `item-pickup.ts`, `firmware.ts`, `floor-manager.ts`, `entity-placement.ts`, `dungeon-generator.ts` and all four prefabs, `environment.ts` schemas, `shared/types.ts`, `inventory-util.ts`, `route.ts` (action), `turn-manager.ts`, `game-turn-adapter.ts`, `logger.ts`, `error-logger.ts`, `ContainerOverlay.tsx`, plus a 900-floor empirical generation sweep.

> [!NOTE]
> **Update:** The items listed below as "skimmed or not reviewed" were covered in **[Part 2: Addendum](#part-2-addendum-rendering-ui-and-asset-review)**, appended at the end of this document. Part 1 (everything above) is unchanged apart from the `next build` row in §1.

**Originally listed as skimmed or not reviewed (now covered in Part 2):** PixiJS shader and outline rendering ([`glitch-effects.ts`](../../src/rendering/filters/glitch-effects.ts), [`render-system.ts`](../../src/rendering/render-system.ts)), the full body of [`tile-inspector.ts`](../../src/rendering/tile-inspector.ts) (609 lines), most hub/loadout/workshop React components, [`GroundTransferModal.tsx`](../../src/components/ui/inventory/GroundTransferModal.tsx) internals, tileset PNG assets and build scripts, and CSS. `next build` was not re-run. A follow-up pass on the UI and rendering layers is recommended, especially checking that fog-of-war gating in the inspector and tooltip cannot leak hidden props or traps, given C3.


---
---

# Part 2: Addendum: Rendering, UI and Asset Review

> **Scope:** the areas Part 1 §9 listed as not reviewed: PixiJS rendering and shaders, the tile inspector, the in-run UI (modals, tooltip, backpack, equipment), hub components, CSS, and the sprite and tileset assets and scripts.
> **Method:** static code review plus a few mechanical checks (byte-identical assets, atlas slot collisions, sprite key coverage, `next build`). **I did not run the game in a browser.** Findings about runtime behaviour (frame cost, visual overlap) are derived from code reading and are marked where I could not confirm them.
> **Numbering:** `R` = rendering, `U` = UI, `A` = assets.

## P2.0 TL;DR

| # | Finding | Severity |
|---|---|---|
| U1 | ✅ **RESOLVED:** **UI leaks hidden traps and live prop state.** The renderer outlines every trapped prop pink regardless of `revealed`, and the inspector shows trap badges and live prop and item state on any *explored* tile, even out of sight. | 🔴 High (Fixed) |
| U2 | ✅ **RESOLVED:** **Overclock bypass, forced interaction and Dead-Drop Uplink are unreachable from the UI.** No client code ever sends `INTERACT_PROP` or `DEAD_DROP_ITEM`. | 🔴 High (Fixed) |
| U3 | ✅ **RESOLVED:** **Quick-use consumable discards the server delta**, and several modals run their own `fetch` outside the input and reconciliation pipeline. The server has no per-session request serialization. | 🔴 High (Fixed) |
| U4 | **Dropping a consumable stack destroys all but one item.** | 🟠 High |
| U5 | **The "duplicate React key" fix masks a real vault ID-collision bug.** | 🟠 High |
| R1 | Tile hover inspection re-runs a full-world query and pushes a new object into the store **every frame**; the tooltip then re-renders and re-lays-out at ~60 Hz with `aria-live`. | 🟠 Medium-High |
| R2 | The prop outline state is stale after disarm or reveal, and the "searched" dimming is **overwritten every frame** by the FOV pass. | 🟡 Medium |
| R3 | Camera input contradicts the Hotkeys manual (left-drag pans, wheel pans instead of zooming). | 🟡 Medium |
| R4 | `window.gameContext` is exposed in production. The server sends all entities regardless of FOV, so `/show-map` is cosmetic. | 🟡 Medium |
| U6–U12 | Capacity and display mismatch, doc and hint inaccuracies, fabricated abort results, duplicated upgrade math, design-system violations. | 🟡 / 🔵 |
| A1 | Asset claims are inaccurate (16×16 vs 32×32; "state" sprites are identical copies). | 🔵 Low |

**What held up:** `npm run build` passes; the atlas has no slot collisions; every entity template sprite key resolves to a frame (except a pre-existing `dead_zone`); the renderer's event listener registration and cleanup are symmetric; fog gating for *enemies* in the inspector is correct; damage-filter cleanup is safe against destroyed sprites. See P2.7.

---

## P2.1 High-severity findings

### U1. ✅ RESOLVED — The UI leaks hidden traps and live prop state (compounds C3)

> **Resolution:** `resolvePropOutlineState` in [`src/rendering/render-system.ts`](../../src/rendering/render-system.ts) and [`src/rendering/tile-inspector.ts`](../../src/rendering/tile-inspector.ts) now gate `'corrupted'` outlines and `CORRUPTED NODE` badges strictly on `corrupted.revealed && !corrupted.isDisarmed && !corrupted.triggered`. Explored-but-unseen tiles use client-remembered prop and ground-item snapshots (`rememberedProps`, `rememberedTileItems`) updated only when tiles are inside active FOV, and `/show-map` (`isMapRevealed`) sets `isExplored` without overriding `isVisibleInFov`. Verified in [`src/rendering/__tests__/tile-inspector.test.ts`](../../src/rendering/__tests__/tile-inspector.test.ts).

Part 1 C3 showed that `CorruptedNode.trapType` and `revealed` are visible in sync payloads. The presentation layer also ignores `revealed`:

- **Renderer:** [`render-system.ts` L228-L243](../../src/rendering/render-system.ts) (and `handlePropUpdated`, L247-L265) picks the `'corrupted'` outline (pink, with glitch jitter) for **every** prop that has a `CorruptedNode` and `!isDisarmed`. It never checks `revealed`. The firmware and subnet-console "reveal" mechanics therefore change nothing visually: **every trapped prop is flagged from the moment it spawns.**
- **Inspector:** [`tile-inspector.ts` L391-L440](../../src/rendering/tile-inspector.ts) shows `CORRUPTED NODE [LVL n]`, a `danger` badge and "Hazardous trap payload active" for any armed node, again ignoring `revealed`.
- **Fog gating is partial.** The inspector returns early only if the tile is neither explored nor visible (L237). The **enemy** branch additionally requires `isVisibleInFov` (L254). The **prop, item and plain-tile** branches do not. Hovering a tile that was *explored earlier* reports its *current* server state: `SEARCHED / DEPLETED`, lock state, container contents status and ground items. That is live information about areas the player cannot see.
- The `/show-map` flag (`isMapRevealed`) sets both `isVisibleInFov` and `isExplored` true globally (render-system L149-L150), so with it on, the enemy HP, behaviour and status effects of every enemy on the floor are inspectable.

**Why it matters:** the hidden-trap mechanic (and the detection-difficulty fields on `CorruptedNode`, and the Subnet Console and `Extended_Sight` counterplay) has no gameplay value if the default presentation already reveals everything.

**Fix:** drive the outline and inspector from a *client-visible* state (`revealed || isDisarmed || triggered`), not the raw component. For props on explored-but-not-visible tiles, show remembered state, not live state. Pair with the server-side redaction from C3.

### U2. ✅ RESOLVED — Overclock, forced interaction and the Dead-Drop Uplink cannot be triggered from the UI

> **Resolution:** Wired `[E]` (`GameAction.INTERACT_ANCHOR`) and `[Shift + .]` (`GameAction.INTERACT_STAIRCASE`) in [`src/game/setup.ts`](../../src/game/setup.ts) to prioritize active Stability Anchors/Staircases on the player's tile and otherwise target adjacent props with `INTERACT_PROP` (`forceOverride: true` for Overclock Bypass / forced trap interaction) or open the Dead-Drop Uplink item picker ([`src/components/ui/inventory/DeadDropModal.tsx`](../../src/components/ui/inventory/DeadDropModal.tsx)). Also wired `PROP_INTERACTED` (`dead_drop_uplink`, `outcome: 'ready'`) in [`src/game/ui/sync-bridge.ts`](../../src/game/ui/sync-bridge.ts) to open the modal on bump, and persisted `DEAD_DROP_TRANSMITTED` items and blueprints to `profile.vault`/`profile.overflow`/`profile.blueprintLibrary` in [`src/app/api/action/route.ts`](../../src/app/api/action/route.ts). Verified in [`tests/game/u2-prop-interact-dead-drop.test.ts`](../../tests/game/u2-prop-interact-dead-drop.test.ts).

A grep of all of `src/` outside the API route, pipeline and schemas finds **no sender** of `INTERACT_PROP` or `DEAD_DROP_ITEM` (the only `forceOverride` occurrences are the schema and the movement system, which always sets it to `false`). Consequences:

- **Locked safes and vault doors:** the bump safeguard warns about the Overclock Bypass and then halts. Because nothing can send `forceOverride: true`, the Overclock Bypass advertised in the warning text **is not available to the player**. Without a key, a locked barrier cannot be opened.
- **Armed Corrupted Nodes:** bump is always blocked with a warning, and the force path does not exist, so the only counterplay is a stun firmware shot.
- **Dead-Drop Uplink** (`prop-dead-drop`, `deadDropFluxCost`): there is no UI to select an item, and nothing sends the action. The prop is decorative.
- **Misleading hints:** `[E]` is bound to `INTERACT_ANCHOR` (stability anchors) only. The inspector says `[E] to offload cargo to vault` for the uplink, and the Hotkeys manual says `[E] Engage Stability Anchor / Access Terminal`. Neither works for props.

This stacks with C2: the content is unreachable in generation, *and* three of its mechanics are unreachable from input even if generation were fixed.

**Fix:** add an explicit interact action (an `[E]` handler that targets the adjacent prop and sends `INTERACT_PROP` with an optional override confirmation), a Dead-Drop item picker, and tests that drive the action through the client input layer.

### U3. ✅ RESOLVED — Quick-use discards the delta; several UI paths bypass the input and reconciliation pipeline

> **Resolution:** Exposed a single canonical `submitAction(intent)` on `GameContext` in [`src/game/setup.ts`](../../src/game/setup.ts) (backed by `resolveActiveSessionId`, `inputManager.setRequestPending`, `applyStateDelta`, and `MESSAGE_EMITTED` error reporting). Refactored [`src/components/ui/inventory/BackpackGrid.tsx`](../../src/components/ui/inventory/BackpackGrid.tsx), [`src/components/ui/inventory/GroundTransferModal.tsx`](../../src/components/ui/inventory/GroundTransferModal.tsx), and [`src/components/ui/inventory/DeadDropModal.tsx`](../../src/components/ui/inventory/DeadDropModal.tsx) to route all actions through `submitAction` and removed direct `ctx.grid.removeItem` view-layer mutations. Added per-session lock acquisition/release (`tryAcquireSessionLock` / `releaseSessionLock`) in [`src/server/session/session-manager.ts`](../../src/server/session/session-manager.ts) and [`src/app/api/action/route.ts`](../../src/app/api/action/route.ts) to reject overlapping concurrent requests with HTTP 409. Verified in [`tests/game/u3-action-serialization.test.ts`](../../tests/game/u3-action-serialization.test.ts).

[`BackpackGrid.tsx` L111 and L308](../../src/components/ui/inventory/BackpackGrid.tsx) (the "USE REPAIR CANISTER" button and double-click) call `fetch('/api/action', { USE_CONSUMABLE })` and **ignore the response**. The server computes each `DELTA` by diffing the world before and after *that request*. If the client never applies it, the next delta (computed from the server's new baseline) will not contain those changes. The client keeps stale HP, stability and inventory until a `FULL` sync.

Related issues in the same family:

- [`GroundTransferModal.tsx`](../../src/components/ui/inventory/GroundTransferModal.tsx) re-implements fetch and `applyStateDelta` twice (`handleTakeItem`, `handleDropItem`). [`setup.ts` `sendActionToServer`](../../src/game/setup.ts) is the canonical path. There are now at least four copies of the request code, with three different fallback session IDs (`'default-session'` in `setup.ts`, `'default-player-session'` in the modal, backpack, dev terminal and debug API, plus `localStorage` and `playerProfile` fallbacks).
- These paths skip `inputManager.setRequestPending`, so a keypress can fire a second `/api/action` while a modal request is in flight.
- [`route.ts`](../../src/app/api/action/route.ts) has **no per-session lock or queue** (grep for `mutex|lock|queue|inFlight` is empty). Concurrent requests for the same session interleave at each `await`. The transactional rollback (`world.loadSerializableState(oldWorldState)`) then restores a *stale snapshot over another request's changes*.
- `!res.ok` responses in the modal are silent (nothing is shown to the player and the state delta is not applied). The backpack double-click consume has no error handling at all.
- The modal calls `ctx.grid.removeItem` from React handlers and `rescanNearby`, mutating the client's mirror of authoritative state from the view layer.

**Fix:** route every action through one client function that serializes requests, applies the returned payload, and surfaces errors. Add a per-session async mutex around the turn pipeline on the server.

### U4. Dropping a consumable stack destroys the rest of the stack

[`route.ts` DROP_ITEM (L382+)](../../src/app/api/action/route.ts) calls `removeItemByEntityId`, which removes the **entire** `RunInventoryItem` entry (including `quantity`). It then re-materialises a single ground entity. Picking that entity up again goes through `addConsumable`, which adds **one** unit. A stack of 10 repair canisters dropped to make room becomes 1. (The UI's "DROP" button in `GroundTransferModal` is offered for every backpack row, including stacks.) The dropped entity also gets a generic `SpriteComponent { key: 'item' }`, not its original sprite.

**Fix:** drop one unit (or an explicit quantity), spawn a ground entity per dropped unit or carry `quantity` on the ground item, and preserve the original sprite and template.

### U5. The "duplicate React key" fix hides a real ID-collision bug

The handoff §5.6 says duplicate keys were "fixed across all hub and vault list components". The changes use `key={`${entityId}-${idx}`}` (VaultTab, LoadoutTab) and add a `console.error` interceptor to name the culprit. That addresses the symptom only:

- Vault items are persisted with their **run-local** `entityId` (see `run-ender.ts`: `entityId: item.entityId`). Entity IDs restart in each session, so items extracted from different runs routinely share an `entityId` inside `profile.vault`.
- Everything downstream treats `entityId` as a unique key: `findIndex(item.entityId === entityId)` in [`equip-from-vault/route.ts` L42](../../src/app/api/vault/equip-from-vault/route.ts), the sell and discard routes, `LoadoutTab`'s optimistic `vault.filter(i => i.entityId !== entityId)` (which removes **all** items with that ID from the UI), and `selectedItem` comparison in the vault UI. Equipping, selling or discarding one of two colliding items acts on the **first match**, which may be the wrong item.
- Using `idx` in keys makes React reconcile by position, which causes wrong-row state when the list is re-sorted (the vault now sorts by rarity, type and value).
- The interceptor in [`engine/utils/logger.ts`](../../src/engine/utils/logger.ts) (see C6) exists to find a bug that the fix then hides.

**Fix:** mint a unique, stable `vaultItemId` (UUID or monotonic profile counter) at extraction time, migrate existing vault records, and key routes and UI on it. Remove the `idx` keys and the console interceptor.

---

## P2.2 Rendering findings

### R1. Hover inspection runs every frame and re-renders the tooltip at frame rate

[`render-system.ts` L668](../../src/rendering/render-system.ts): `renderSystem()` is attached to the Pixi ticker ([`page.tsx` L132-L136](../../src/app/page.tsx)). At its end, if a pointer position exists, it calls `updateHoverInspection(lastPointerEvent)` **every frame**, in addition to the `pointermove` call. Each call:

1. runs `resolveTileInspection`, which does `world.query(Position).filter(getComponent…)`: an O(entities) scan with per-entity component lookups;
2. returns a **freshly allocated object** (even if the content is identical);
3. calls `setHoveredEntity(info)` ([L155](../../src/rendering/render-system.ts)). The store setter is `set({ hoveredEntity: info })` with no equality check, so every subscriber is notified each frame.

[`TacticalInspectTooltip.tsx`](../../src/components/ui/TacticalInspectTooltip.tsx) depends on `hoveredEntity` in a `useLayoutEffect` that measures the DOM and calls `setCoords`, which means **a React render, a forced layout read and a second render per frame** while the cursor rests on any inspectable tile. The root element also has `aria-live="polite"` and re-renders at ~60 Hz, which is hostile to screen readers.

I did not profile this. By code reading it is the most likely source of hover jank on large floors.

**Fix:** resolve the tile only when the hovered grid cell or the relevant world revision changes; use a spatial index (`grid.getEntitiesAt`) instead of scanning all entities; compare the new info with the old before `set`; drop `aria-live` from a hover tooltip (or move it to a debounced live region).

### R2. Prop outline state goes stale; the "searched" dimming never sticks

- **Update triggers:** outlines are recomputed only on `ENTITY_CREATED`, `PROP_INTERACTED` and `LOCK_UNLOCKED`. Disarming a node via firmware ([`firmware.ts`](../../src/game/systems/firmware.ts)) emits neither, and revealing nodes emits none. A disarmed trap keeps its pink outline until the sprite is recreated.
- **Alpha overwrite:** `applyPropOutline(sprite, 'searched')` sets `sprite.alpha = 0.6`. The main loop at [render-system L654](../../src/rendering/render-system.ts) then sets `sprite.alpha = alpha` for **every** renderable on every frame (the FOV visibility alpha), erasing it. Depleted props are distinguishable only by the missing outline. The handoff's "Dimmed Alpha (0.4)" is also wrong (code and comment say 0.6).
- **Filter clobbering:** `applyPropOutline` assigns `sprite.filters` wholesale and `removePersistentGlitch` sets `filters = null`. An in-flight `applyDamageDistortion` filter (a temporary glitch on damage) is dropped, and the tracked entry in `activeDamageFilters` becomes inconsistent.
- **Resource use:** every state change allocates new `OutlineFilter` (and `GlitchFilter`) instances; replaced filters are never `destroy()`ed. With 8–12 props this is small, but each filtered sprite also forces its own filter pass per frame.

**Fix:** derive outline state from a single "prop visual state" function used by both creation and update, trigger it on component change (or on `STATE_RECONCILED`), keep a per-sprite filter set so layers compose, and apply "depleted" dimming in the same place that computes visibility alpha.

### R3. Camera input contradicts the manual

- The Hotkeys manual says **right-click or middle-click drag** pans and the **wheel zooms**. [`handlePointerDown` (L158)](../../src/rendering/render-system.ts) starts a drag for **any** button, so **left-click drag pans** (and a simple click clears the hover and can nudge the camera). [`handleWheel` (L191)](../../src/rendering/render-system.ts) **pans** by `deltaX/deltaY`; there is no zoom anywhere.
- Left-drag-to-pan will collide with future click-to-move or click-to-target. It also means the existing targeting reticle and any canvas click handler race with the pan.
- The wheel handler is registered `{ passive: false }` with `preventDefault()` on the canvas, so page scroll over the canvas is blocked (acceptable) but trackpad two-finger gestures now silently pan the world.
- The hover handler uses canvas bounds only. It does not check whether another element (HUD panels, sidebars, the message log) is on top at that point, so the tooltip can appear while hovering HUD controls that overlap the canvas. The modal visibility check covers only the listed modals. (Not confirmed in the browser.)

### R4. Debug and fog-of-war surface

- [`page.tsx` L114](../../src/app/page.tsx) sets `window.gameContext = context` **unconditionally**, with only a comment ("Expose for debugging"). `DevTerminal` and `window.__DEBUG__` are correctly gated on `NODE_ENV === 'development'`, but `gameContext` (full `World`, `Grid`, `EventBus`, `sessionId`) is available in production builds, and three components depend on it at runtime.
- Fog of war is **purely cosmetic**. The server sends every entity and tile in `FULL`/`DELTA` payloads. `/show-map` is therefore only a convenience for the client; anyone can read all enemy positions, props and loot from the network response or `window.gameContext` today. This is a design property, not new, but this branch increases what the payload exposes (C3), and the handoff presents `/show-map` as a deliberate dev feature.
- The server-side `REVEAL_MAP` / `EXPOSE_MAP` debug cases are no-ops that only log.

---

## P2.3 UI findings

### U6. `GroundTransferModal` (458 lines)

Beyond U3:
- Backpack names are hard-coded: any `isConsumable` item without a definition is labelled `'Nanite Canister'` (or `'Repair Nanites'` only for template `nanite-canister`). The health potion (`health-potion`) shows up as **"Nanite Canister"** in the modal and in the backpack grid.
- The capacity check counts `software.length + equipment.length` against `maxSlots`, so "TAKE" and "TAKE ALL" are disabled when the pack is full **even if the item would stack** onto an existing consumable.
- Backpack contents are read from the live ECS inside the render body; the component refreshes only because it subscribes to `inventoryRevision` (`void inventoryRevision;`). The same pattern appears in `EquipmentPanel` and `ChassisTelemetrySidebar`. It works only while some code remembers to bump the revision, and U3 shows paths that do not.
- 90% of styling is inline `style={{…}}` with literal colours. It reuses [`ContainerOverlay.module.css`](../../src/components/ui/inventory/ContainerOverlay.module.css), and `ContainerOverlay.tsx` itself is unmounted (Part 1 M9).
- `role="dialog" aria-modal` with no focus trap, no initial focus, and background click closing. ESC handling is fine.

### U7. Backpack capacity and display disagree

- Run backpack capacity is `RunInventory.maxSlots`: **5** by default (schema), **30** when a loadout supplies reserve items ([`engine-factory.ts` L312](../../src/game/engine-factory.ts)), and `|| 20` in `addConsumable` and the modal.
- [`BackpackGrid.tsx` L76](../../src/components/ui/inventory/BackpackGrid.tsx) renders a fixed `Array(15)`. When capacity is 30, slots 16–30 can hold items that **cannot be seen, selected, burned or used** from the grid. Because this branch routes firmware, augments and consumables into the backpack instead of auto-equipping them, this limit is now reachable.
- Firmware burn buttons are hard-coded to `[0, 1, 2]` and the augment burn sends no `slotIndex`, regardless of the shell's port configuration. This is the UI half of C8.

### U8. Hotkeys manual and handoff are inaccurate

| Claim | Reality |
|---|---|
| "Press `G` **or Space** to open the Ground Transfer Modal" (handoff §8) | Only `KeyG` ([`actions.ts`](../../src/game/input/actions.ts)). Space is Wait |
| Manual: "R-CLICK DRAG / M-CLICK DRAG: free-pan" | Any button pans (R3) |
| Manual: "WHEEL SCROLL: optical zoom in / out" | Wheel pans; no zoom |
| Manual: "`E` Access Terminal" and tooltip "`[E]` to engage / offload cargo" | `E` only affects stability anchors (U2) |
| Manual: "BUMP: pry open crates, lockers and forensic nodes" | Bumping an armed Corrupted Node is blocked (C5/U2) |
| Manual lists `/show-map` and the backtick console in production | The terminal is mounted only when `NODE_ENV === 'development'` |
| Handoff §4 and §7: `HoldToConfirmButton.tsx` with a **1.5 s** hold | No such file. Hold-to-confirm is the pre-existing `BtnLever` prop (default 2000 ms); this branch uses **600 ms** for destructive burns |
| Manual footer: "NIRMATA OS // REV 2.6.0", "SPEC-2026" | Hard-coded placeholders |

A 600 ms hold on *permanent, irreversible* actions (burning firmware or augments, which also destroy the replaced item) is a weak confirmation.

### U9. `AbortMissionDialog` fabricates run results client-side

[`AbortMissionDialog.tsx`](../../src/components/ui/AbortMissionDialog.tsx): if the sync bridge has not moved the game to `GameOver`, the dialog builds its own `RunResultsData` with `score = currentFloor * 100 + kills * 10`, `itemsSecured` all zero except `scrap = floor(xp * 0.5)`, and a made-up reason `OPERATOR_MANUAL_DESYNC`, then forces the BSOD state. These numbers can contradict the authoritative result the server already persisted (leaderboard score, extracted items). Authoritative results should never be recreated in the client.

### U10. Shell upgrade math duplicated, and the server's version is heuristic

[`ShellTab.tsx`](../../src/components/ui/hub/ShellTab.tsx) and [`LoadoutTab.tsx`](../../src/components/ui/hub/LoadoutTab.tsx) hard-code the formulas (`speed × 5`, `armor × 1`, `stability × 10`, additional ports added to firmware, augment, and software). [`applyShellUpgradesToRecord`](../../src/game/shells/server/shell-registry.ts) uses `upgrades.speed > 5 ? upgrades.speed : upgrades.speed * 5` (same for stability), i.e. it guesses whether a stored value is a *level* or a *raw bonus*. For any level > 5 the hub shows `level × 5` while the server applies `level`. `ShellTab` shows only FW and AG ports, while the server also raises the software port count. Put the formula in `@shared` and call it from both places; remove the `> 5` heuristic by storing one unit consistently.

### U11. Design-system violations ([`UI-DESIGN-SYSTEM.md`](../design/UI-DESIGN-SYSTEM.md))

- **Token semantics are inverted.** In [`globals.css`](../../src/app/globals.css), `--c-accent` is **acid chartreuse `#d8ff00`** and `--c-accent-secondary` is **cyan `#00f0ff`**. The new inline styles are written as `var(--c-accent, #00f0ff)` (cyan intended) and `var(--c-accent-secondary, #d8ff00)` (chartreuse intended). Because the variables are defined, the fallbacks never apply, so the **Flux chip, backpack selection highlight, hold buttons and many borders render chartreuse where cyan was intended, and the Blueprints chip renders cyan instead of chartreuse.** The HUD currency strip is colour-coded inconsistently with the sidebar.
- `--c-nanites` is used with a fallback but is **not defined** in `globals.css`.
- The three new CSS modules (tooltip, hotkeys, container overlay) contain about 58 literal hex colours in total; the tooltip module, for comparison, has only 24 `var(--…)` uses. The design spec says all UI must reference the canonical tokens.
- Heavy inline styles in `GroundTransferModal`, `BackpackGrid`, `EquipmentPanel` and `VaultTab`, instead of CSS modules.
- Ad-hoc z-index values (`1500` inventory, `1550` hotkeys, `1600` container, `9999` abort dialog, `99999` tooltip) with no scale. The tooltip can sit above the abort dialog.
- No `prefers-reduced-motion` handling for the new fade-ins; no visible `:focus` styles in the new modals; hold-to-confirm is pointer-driven (keyboard users cannot complete it unless the pre-existing `BtnLever` key handling covers it; I did not verify).

### U12. Tooltip text contradicts behaviour

- Armed Corrupted Node: "`[BUMP]` to scavenge (Hazardous trap payload active)": bump is blocked (C5/U2).
- Locked prop: "`[BUMP]` to attempt bypass (Keycard or overclock required)": bump halts; overclock is unreachable (U2).
- `PROP_CLASS_LORE` hard-codes faction text (e.g. locker is always "Traxus", workstation always "CyberAcme") regardless of `prop.faction`, and the lore for `vault_door` describes a Faraday bulkhead that is never spawned (C2).

---

## P2.4 Asset and script findings

### A1. Tileset, sprites and scripts

- **Wrong size claim.** The handoff says "custom **16×16** environment sprites". The scripts, tileset frames and test use **32×32**.
- **"State" sprites are byte-identical copies.** `prop_biocabinet`/`_full`, `prop_dead_drop`/`_ready`, `prop_stabilizer`/`_active` and `prop_vault_door`/`_locked` have identical MD5s (aliases written by the build script). The vault door template uses `prop_vault_door_locked`, and no code swaps the sprite when the lock opens, so **locked vs unlocked, closed vs open, ready vs used all look the same** (state is conveyed only by outline colour, which is itself unreliable: R2).
- **Wrong sprite on a new item.** [`item-access-key.json`](../../src/game/entities/templates/item-access-key.json) uses `"sprite": { "key": "item_flux" }`, not the new `item_access_key` art.
- **Build process is two undocumented steps.** `build-environment-tiles.cjs` (892 lines) writes individual PNGs and preview sheets; `add-environment-sprites.cjs` composites them into `tileset.png` and edits `tileset.json`. There is no `npm` script or doc, and the handoff attributes the atlas composition to the first script. The atlas is written to two identical locations (`public/assets/tileset.png`, `public/assets/tiles/tileset.png`).
- **Shipping dev artefacts.** `public/assets/tiles/previews/` (16 inspection sheets, ~376 KB) is under `public/`, so it is served to every player.
- **Test fragility.** [`environment-tileset.test.ts`](../../tests/game/environment-tileset.test.ts) imports `canvas`, which is an **optionalDependency** (native build). On a machine where the optional install fails the test file fails to load. It also asserts only that each frame has > 150 opaque pixels; the handoff's "pixel-perfect alignment" is not what is tested (the frame x/y modulo check is, which does verify grid alignment).
- **Verified fine:** no atlas slot collisions with pre-existing frames (the 16 new tiles occupy `x ≥ 128`, `y < 128`, where the old atlas had none), every template sprite key resolves to a frame (only the pre-existing `dead_zone` does not), and the atlas stays 256×256 with room left.

---

## P2.5 CSS

Skimmed rather than line-reviewed. Beyond U11: the modal overlays use `position: fixed` with a mix of `100vh` and `calc(100vh - 60px)` max heights (no `dvh`, so mobile browser chrome can clip the Hotkeys modal), the tooltip root is `pointer-events: none` (correct), and the Hotkeys grid has one `max-width: 768px` breakpoint. No functional CSS defects found beyond those listed.

---

## P2.6 Additions to the risk register and merge gate

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hidden-trap mechanic is invisible to design because everything is pre-revealed (U1) | Certain | Trap and detection features have no tactical value | Visual state from client-visible fields; redaction (C3) |
| Core interactions are unreachable from input (U2) | Certain | Overclock and Dead-Drop never usable; locks impassable without a key | Add interact action and UI; add input-driven tests |
| Client and server desync after quick-use; interleaved requests (U3) | High | Wrong HP and inventory, double-use, rollback overwriting a concurrent request | One request function with serialization; per-session mutex |
| Item loss on drop (U4); wrong-item sell and equip from ID collisions (U5) | High | Player-visible data loss and profile corruption | Unit-aware drop; unique vault IDs and migration |
| Hover-inspection frame cost (R1) | Medium | Jank on large floors, screen-reader noise | Throttle, spatial lookup, equality check |
| Misleading docs and hints (U8, U12) | Certain | Player confusion, support burden | Fix or remove the claims |

**Additional merge-gate items** (extend §8):

- [x] Trap outlines and inspector badges depend on `revealed`; explored-but-unseen tiles show remembered state only
- [x] An input-driven test can open a locked safe via overclock and use a Dead-Drop Uplink
- [x] Every client action path goes through one request function that applies the returned payload; server rejects overlapping requests per session
- [ ] Dropping then picking up a consumable stack preserves the count
- [ ] Vault items have unique IDs; two vault entries with the same legacy ID cannot be confused by equip, sell or discard
- [ ] Hover inspection is not recomputed every frame
- [ ] Hotkeys manual, tooltip hints and handoff match actual bindings and behaviour
- [ ] New UI uses design tokens with correct semantics (cyan vs chartreuse); `--c-nanites` defined

## P2.7 What was checked and held up

- `npm run build` (Next 16.2.6 / Turbopack): compiled, type-checked and generated 36 static pages.
- Renderer lifecycle: every `eventBus.on` added in `init()` has a matching `off` in `dispose()`, and pointer and wheel listeners are removed symmetrically.
- Inspector fog gating for **enemies** requires `isVisibleInFov`; the player-tile branch, staircase and anchor branches behave as intended.
- `cleanupDamageFilter` and `removePersistentGlitch` guard against destroyed sprites and clear their timeouts.
- Optimistic-rollback hardening (`structuredClone(playerProfile)`) in `LoadoutTab` is a real improvement over the shallow copies it replaced.
- `HotkeysModal` and the input bindings do not conflict with each other (`H` and `?` both toggle through the same action; the modal's capture-phase `H` handler stops propagation, so there is no double toggle).
- `TacticalInspectTooltip` is `pointer-events: none` and clamps to the viewport.

## P2.8 Scope and limits of Part 2

**Reviewed:** `render-system.ts` (diff plus surrounding frame loop), `filters/glitch-effects.ts`, `tile-inspector.ts` (in full), `TacticalInspectTooltip.tsx`, `HotkeysModal.tsx`, `GroundTransferModal.tsx` (in full), `BackpackGrid.tsx`, `EquipmentPanel.tsx`, `ChassisTelemetrySidebar.tsx` (diff, partially), `HUDOverlay.tsx`, `AbortMissionDialog.tsx`, `ShellTab.tsx`, `LoadoutTab.tsx`, `LoadoutSlotPanel.tsx`, `VaultTab.tsx`, `ItemCard.tsx`, `DevTerminal.tsx`, input bindings, `build-environment-tiles.cjs`, `add-environment-sprites.cjs`, `tileset.json`, the tileset test, and the design tokens.

**Not done:**
- **No runtime or browser testing.** Visual issues (colour inversion, overlap, tooltip behaviour over HUD) and frame cost are inferred from code. A short manual pass with the dev server would confirm U11, R1 and R3.
- `ChassisTelemetrySidebar.tsx` (405-line diff) and `EquipmentPanel.tsx` were read in part, not line by line. `ShellStatCard`, `SlotBox`, `StashItemList`, `VaultGrid` and `VaultOverflowBanner` (all small diffs) were **not individually read**; they were included in a bulk diff whose output was truncated, so treat them as unreviewed.
- Test files for the UI components were not audited for quality (Part 1 M14 covers the pattern).
- The PNG artwork itself was checked mechanically (hashes, slots, opaque pixel counts), not for aesthetics or consistency with the mock.
