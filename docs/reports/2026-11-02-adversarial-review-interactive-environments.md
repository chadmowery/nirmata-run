# Adversarial Review: `feat/interactive-environments`

> **Subject:** [`2026-11-02-branch-handoff-interactive-environments.md`](./2026-11-02-branch-handoff-interactive-environments.md) and the 25 commits / 188 files / +12.8k lines it describes
> **Reviewed against:** `AGENTS.md`, [`docs/architecture/`](../architecture/) (`SYSTEM_OVERVIEW`, `ENGINE_GUIDELINES`, `DEATH_PROTOCOL`)
> **Review date:** 2026-11-02
> **Verdict:** 🔴 **Do not merge.** The branch is green on every automated gate, but the handoff's "Fully Implemented, Verified, and Ready for Merge" status is not supported. Floor generation crashes on every floor from 11 to 15. The headline lock/vault/key feature set never appears in generated floors. Several documented safety and security claims are false.

---

## 0. TL;DR

| # | Finding | Severity |
|---|---|---|
| C1 | **Floors 11–15 can never be generated.** Sealed prefabs make `generateDungeon` throw `Failed to generate connected dungeon` on about 100% of seeds. The run is stuck on floor 10. | 🔴 Critical |
| C2 | **Locks, vaults, safes, keys, overclock bypass and Faraday shielding never spawn on floors 1–10.** The only paths that could create them are broken or unreachable. | 🔴 Critical |
| C3 | **"Masked loot" is not masked.** `storedLoot`, `scrapYield`, `fluxYield` and `grantsAccessKey` are serialized to the client in full. | 🔴 High (anti-cheat) |
| C4 | **`PICKUP` and `DROP_ITEM` have no server-side range or position validation.** The client can pick up any item on the map by entity ID and drop items on arbitrary tiles. | 🔴 High (security) |
| C5 | **The "0-turn bump safeguard" does not exist.** The energy cost is deducted before the action runs and never refunded. `INPUT_BUFFER_CLEARED` has no listener. | 🟠 High (false claim) |
| C6 | **Direct `ECS` architecture violations.** There is an `eventBus.on()` that drives game logic, direct `Health` patching that bypasses `DamageIntent`, and a game-specific string in the engine layer. | ✅ **RESOLVED** (`73842d7f`..`519b3487`) |
| C7 | **Stability "threat purge" is exploitable.** It fires on any `ENTITY_DIED` the player causes, including crates and traps. The stability rebalance is also a 5–80% nerf shipped as a "bug fix". | 🟠 High |
| C8 | **`BURN_FIRMWARE` / `BURN_AUGMENT` ignore shell port capacity.** They use hard-coded slot caps and can push `0` placeholder entity IDs. | 🟠 High |
| M1–M14 | Medium and low issues (dead code, inconsistent key accounting, 2 of 3 sector conditions are no-ops, a log-format typo, and others). | 🟡 / 🔵 |

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

### C1. Sealed prefabs crash floor generation on floors 11–15 (and silently shrink content elsewhere)

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

### C2. The lock/vault/key content is unreachable in generated floors

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

### C3. "Masked client loot" is not masked

The handoff (§3 M1, §3 M2) and the test titled *"masks container loot from network/client payload"* claim that only `highestRarity` is exposed until searched.

- No code strips `Container.storedLoot`, `scrapYield`, `fluxYield`, `grantsAccessKey` or `blueprintId` from `serializeWorld`, `createECSWorldDelta` or the `FULL` payload. A grep for those fields shows they appear only in `environment.ts`, `prop-interaction.ts`, `entity-placement.ts` and tests.
- The "masking" test asserts `itemEntityIds` is `[]` and `storedLoot` is **defined**. That proves the opposite of masking: the secret field is present in the component.
- `CorruptedNode.trapType` and `revealed` are likewise visible in every payload. The "hidden trap / reveal" mechanic is cosmetic. Anyone reading the network response sees all traps and the exact loot of each container.

**Fix:** Decide the intended model and make the server enforce it. Either:
- store the secret roll in a server-only component or side table that is excluded from sync (preferred), or
- add a per-component sync filter (redaction hook) to `serializeWorld` / `createECSWorldDelta`.

Then add a test that asserts the *serialized payload* contains no `storedLoot`.

### C4. `PICKUP` and `DROP_ITEM` trust the client for position and range

**Where:** [`item-pickup.ts`](../../src/game/systems/item-pickup.ts) (explicit pickup branch), [`route.ts` L371-L395](../../src/app/api/action/route.ts)

- `PICKUP { itemId }`: when the item has a `Position`, the code uses it directly with **no adjacency check** to the actor. Any item, including items in unexplored rooms, enemy drops and (if C2 is fixed) vault contents, can be taken by entity ID from anywhere on the map. Entity IDs are small sequential integers.
- The "desync resilience" fallback silently substitutes **a different item** if the requested one is not item-like. It picks whatever item is at the target coordinates, or any item within one tile of the actor. That hides client/server desync and can give the player something they did not ask for. Fail loudly instead.
- `DROP_ITEM { targetX, targetY }`: coordinates default to the player's position only when omitted. If supplied, there is no distance, bounds or walkability check. A client can place an item inside a wall or in the far corner of the map. `session.grid.addItem` is called directly in the API route.
- `USE_CONSUMABLE { targetEntityId }`: the client can pick any entity as the heal and stability target. Only the player's own stability and HP should be affected.
- `BURN_FIRMWARE` / `BURN_AUGMENT`: see C8.

**Fix:** Validate every client-supplied coordinate and entity ID server-side before attaching the intent: adjacency (Manhattan ≤ 1), bounds, walkability, ownership. Keep all state mutation inside systems that run in a Phase. The route should only validate and attach intents.

### C5. The Two-Tier Bump Safeguard does not do what the handoff says

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

### C7. Stability changes: exploit and unreviewed rebalance

- **Exploit:** [`handleEntityDied`](../../src/game/systems/stability.ts) grants `+2%` for every non-player `ENTITY_DIED` whose `killerId` is the player. There is no `Hostile` check, and `handlePropDestruction` emits `ENTITY_DIED` for crates, vats, capacitor banks and corrupted nodes. The handoff says "Eliminating a hostile enemy". In reality **smashing crates heals Reality Stability.** With cover props being cheap, destructible and numerous, this is a free stability farm. Cascades make it multiplicative.
- **Handoff inaccuracy:** it says `ENTITY_DIED` carries `reason: 'threat_purged'`. In code the reason is on `STABILITY_CHANGED`.
- **Unreviewed balance change:** the "fix" in commit `7d269b75` changes `perTurnBleedScale` from 0.1 to 0.02 (-80%), `perTurnBleedBase` from 0.01 to 0.005 (-50%), `perFloorChunkBase` from 5 to 3 (-40%) and `perFloorChunkScale` from 0.5 to 0.2 (-60%), with no design-doc update. `docs/design/STABILITY-ANCHOR-SYSTEM.md` and `RUN-ECONOMY.md` are untouched. It was bundled with unrelated fixes, so it will be hard to revert independently.
- **Regeneration math doesn't match the handoff.** It says "+2 HP per turn". [`route.ts`](../../src/app/api/action/route.ts) applies `magnitude: 1` (+1 per turn).
- **`HealIntent` collision.** `HealIntent` is single-slot per entity. The potion attaches one `HealIntent` (+5) from the route, and the regeneration status can attach another in `PRE_TURN` via `addComponent`, which **overwrites** it. Depending on ordering, the instant +5 can be lost, and a pickup-heal in the same turn can overwrite either one.

### C8. `BURN_FIRMWARE` / `BURN_AUGMENT` ignore port capacity

[`route.ts` L229-L330](../../src/app/api/action/route.ts), [`shared/types.ts`](../../src/shared/types.ts)

- Slot bounds are hard-coded in the Zod schema (`slotIndex ≤ 2` for firmware, `≤ 3` for augments). The same branch ships shell port **upgrades** that expand capacity, yet burning never consults the shell's `portConfig` or applies upgrades. A shell with 1 firmware port can burn into slot 2, which bypasses the capacity limit.
- `while (equipped.length < slotIndex) equipped.push(0)` fills gaps with entity ID `0`, which is a valid ID shape and will be passed to `getComponent` / `world.query`.
- The old firmware or augment is condemned with `Dying` (`reason: 'overwritten'`) with no confirmation or refund.
- Inventory items are removed (`removeItemByEntityId`) before the capacity check. If the burn is later skipped, the item is already gone.

---

## 3. Medium and low findings

**M1. Inconsistent access-key accounting (latent infinite-key bug).** `playerHasAccessKey` checks `FloorState.accessKeysHeld`, **and** any `RunInventory.software`/`equipment` entry whose `templateId` contains `'access-key'`. `consumeAccessKey` only consumes from `FloorState` or `software`, never `equipment`. [`prop-interaction.ts` L178-L180](../../src/game/systems/prop-interaction.ts) ignores the return value of `consumeAccessKey` and unlocks anyway. A key sitting in `equipment` would be reusable forever. The `String.includes('access-key')` match is also fragile. `accessKeysHeld` is never reset on floor transition ([`floor-manager.ts`](../../src/game/systems/floor-manager.ts) only patches `currentFloor` and `sectorCondition`), so keys carry over between floors.

**M2. `vaultsBreached` (+150 pts) is only counted on the overclock path.** Unlocking with a key at [L178-L194](../../src/game/systems/prop-interaction.ts) never increments it. Overclocking, the *riskier* path, scores; the intended path does not. Also check that `scoring.ts` multiplies by what the handoff says.

**M3. Dead-drop uplink charges Flux even when no item is removed.** [`prop-interaction.ts` L370-L425](../../src/game/systems/prop-interaction.ts): `removeCurrency` runs before the item lookup. If the selection ID matches nothing, Flux is spent, `DEAD_DROP_TRANSMITTED` fires and "Item transmitted" is logged, but nothing is vaulted.

**M4. `Math.random()` in server game logic.** [`prop-interaction.ts` L505](../../src/game/systems/prop-interaction.ts) picks the lore line with `Math.random()`. This is cosmetic, but it breaks replay and snapshot determinism and conflicts with the "100% deterministic" posture of seeded generation. Use the session RNG.

**M5. Two of three sector conditions are no-ops.** `THERMAL_SURGE` and `DARK_SUBNET` are rolled, stored on `FloorState`, and guaranteed on floors 6/10/15, but nothing reads them. Only `OVERCLOCKED_GRID` has any effect (loot ×1.5, 2 stabilizers). The handoff §9 proposes *adding* `LOW_GRAVITY` and `TOXIC_VENTILATION` while the existing conditions are placeholders. The in-code probability comments ("10 / 25, 8 / 25, 7 / 25") also do not match the thresholds used (`0.4 / 0.72` is 40% / 32% / 28%).

**M6. Unused schema surface.** `thermal_burst` (`hazardOnDestroy`), `bulkhead_switch` (`PropClass`), `loreSnippetId`, `Container.capacity` and `blueprintType`/`blueprintId` on `Container` have no consumers.

**M7. Cover is not "directional" and does not raycast.** The handoff says "Raycasts between attacker and defender. Intervening orthogonal cover…". [`checkDirectionalCover`](../../src/game/systems/combat.ts) has no raycast. It finds any `InteractiveSurface` at Manhattan distance 1 from the defender whose Manhattan distance to the attacker is smaller than the defender's. That is a half-plane test, so cover on a defender's side can count for a diagonal attack, and walls and LoS are ignored. The Bastion override (`isBastion ? 0.35 : surface.coverDamageReduction`) *replaces* a higher per-prop value rather than taking the max. The function also iterates all surfaces on every hit.

**M8. Cryo "spill" is a one-shot, not a hazard.** The handoff describes a "3×3 chemical spill dealing 4 tick damage". The code applies 4 damage once plus a 2-turn slow to anything in the 3×3 at the moment of destruction. There is no persistent hazard tile or `DeadZone`. EMP radius (2) is hard-coded while cascade radius is data-driven (`cascadeRadius`). There is no friendly-fire opt-out for the player.

**M9. Container search does not match the handoff.** The handoff says loot is "transferred directly to backpack or dropping to ground on overflow". The code just creates item entities at the prop's position and links them with `Children`. There is no backpack transfer or overflow path. Also: the `Children` component means that if the container is ever condemned, `GravediggerSystem` will hierarchically destroy loot the player has not picked up. [`ContainerOverlay.tsx`](../../src/components/ui/inventory/ContainerOverlay.tsx) is **not mounted anywhere** (only its CSS is reused by `GroundTransferModal`) and has **no "Take All"**, contrary to the handoff.

**M10. Prop placement can disconnect the map.** Placement does not re-validate connectivity after adding `BlocksMovement` props. 6 of 404 sampled floors (1.5%) had a walkable region cut off (potentially including stairs, items or enemies). Anchor filtering only avoids tiles within distance 1 of a door.

**M11. Error logger issues.** [`error-logger.ts` L110](../../src/server/utils/error-logger.ts): the ANSI string is `\x1b[31${separator}` (missing the `m`), so the closing line prints garbage escape codes. The logger appends full component dumps for the player to an unbounded `logs/game-errors.log` with no rotation, size cap or PII review. `logs/` was added to `.gitignore`, but the file will grow forever in long-lived server processes. `await`-ing disk I/O inside the request path of a failing turn adds latency to the failure case.

**M12. Type-safety erosion.** In `src/` this branch adds 37 `as unknown as` casts, 7 `any`, and 3 `eslint-disable` lines. Many are `as keyof T` / `as T[keyof T]` event-emit casts that hide missing event definitions. They are the reason lint stays green despite C5 and C6.

**M13. Unreviewed behaviour changes bundled in.** Default shell ID changed from `player-shell-default` to `vanguard-v1` (client `setup.ts` and `session/route.ts`). The BFS/pathing changes in `auto-pathfind.ts` treat every `Hostile` as a wall (can fail to find paths in corridors; `path.length === 0` now cancels). `GameTurnAdapter` gained `Dying` checks and `entityExists` guards. None of it is in the handoff.

**M14. Weak or misleading tests.**
- *"masks container loot…"* asserts the opposite (see C3).
- The bump-safeguard tests call `MovementSystem` directly and never exercise energy cost, input buffering or client/server parity (see C5).
- Procgen tests use a handful of lucky seeds (see C1).
- `prop-interaction` tests use mocked factories and catch template-instantiation failures with a bare `catch {}` ("Ignore … if mock/test"). The production system also has this `catch {}` at [L487](../../src/game/systems/prop-interaction.ts). A bad template silently produces an empty container in production.
- No test covers client-side prediction parity for the new systems.

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
3. **Server-side validation of every new client intent (C4, C8).** Adjacency, bounds, walkability, ownership and capacity. Remove the "substitute another item" fallback.
4. **Implement sync redaction (C3)** and a test on the serialized payload.
5. **Resolve the bump safeguard (C5).** Make it genuinely free or correct the docs; wire or remove `INPUT_BUFFER_CLEARED`.
6. [x] **Remove the architecture violations (C6).** (✅ **RESOLVED** via commits `73842d7f`..`519b3487`: stability recovery into Phase.REACTION query; volatile damage via DamageIntent; ABORT_RUN hook and React interceptor out of @engine; client prediction boundary enforced).
7. **Fix the `+2%` farm (C7)** and decide on the stability rebalance in a separate, signed-off change.

### P1: should fix in this branch
8. Unify key accounting and reset or scope keys per floor (M1); count `vaultsBreached` on both paths (M2).
9. Fix the dead-drop charge-before-validate bug (M3).
10. Fix `HealIntent` overwrites (C7) by stacking amounts or using separate tag components.
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

- [ ] Depth 1–15 × ≥50 seeds: `generateDungeon` never throws and the floor is connected
- [ ] Real floors F6–F15 contain locks, every lock has a reachable key, and Faraday bounds match their own vault
- [ ] Serialized `FULL` and `DELTA` payloads contain no `storedLoot`, `scrapYield`, `fluxYield`, `grantsAccessKey` or unrevealed `trapType`
- [ ] Server rejects out-of-range `PICKUP`, `DROP_ITEM`, `USE_CONSUMABLE` targets and out-of-capacity burns (negative tests)
- [ ] `TurnManager`-level test proves the energy outcome of a blocked bump
- [x] Zero `eventBus.on` in gameplay systems; zero direct `Health` patches outside `CombatSystem`; `@engine` has no game or React strings (✅ **RESOLVED** in C6)
- [ ] Stability: crate destruction does not restore stability (mitigated in C6 hostile filter; rebalance review pending)
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
| U1 | **UI leaks hidden traps and live prop state.** The renderer outlines every trapped prop pink regardless of `revealed`, and the inspector shows trap badges and live prop and item state on any *explored* tile, even out of sight. | 🔴 High |
| U2 | **Overclock bypass, forced interaction and Dead-Drop Uplink are unreachable from the UI.** No client code ever sends `INTERACT_PROP` or `DEAD_DROP_ITEM`. | 🔴 High |
| U3 | **Quick-use consumable discards the server delta**, and several modals run their own `fetch` outside the input and reconciliation pipeline. The server has no per-session request serialization. | 🔴 High |
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

### U1. The UI leaks hidden traps and live prop state (compounds C3)

Part 1 C3 showed that `CorruptedNode.trapType` and `revealed` are visible in sync payloads. The presentation layer also ignores `revealed`:

- **Renderer:** [`render-system.ts` L228-L243](../../src/rendering/render-system.ts) (and `handlePropUpdated`, L247-L265) picks the `'corrupted'` outline (pink, with glitch jitter) for **every** prop that has a `CorruptedNode` and `!isDisarmed`. It never checks `revealed`. The firmware and subnet-console "reveal" mechanics therefore change nothing visually: **every trapped prop is flagged from the moment it spawns.**
- **Inspector:** [`tile-inspector.ts` L391-L440](../../src/rendering/tile-inspector.ts) shows `CORRUPTED NODE [LVL n]`, a `danger` badge and "Hazardous trap payload active" for any armed node, again ignoring `revealed`.
- **Fog gating is partial.** The inspector returns early only if the tile is neither explored nor visible (L237). The **enemy** branch additionally requires `isVisibleInFov` (L254). The **prop, item and plain-tile** branches do not. Hovering a tile that was *explored earlier* reports its *current* server state: `SEARCHED / DEPLETED`, lock state, container contents status and ground items. That is live information about areas the player cannot see.
- The `/show-map` flag (`isMapRevealed`) sets both `isVisibleInFov` and `isExplored` true globally (render-system L149-L150), so with it on, the enemy HP, behaviour and status effects of every enemy on the floor are inspectable.

**Why it matters:** the hidden-trap mechanic (and the detection-difficulty fields on `CorruptedNode`, and the Subnet Console and `Extended_Sight` counterplay) has no gameplay value if the default presentation already reveals everything.

**Fix:** drive the outline and inspector from a *client-visible* state (`revealed || isDisarmed || triggered`), not the raw component. For props on explored-but-not-visible tiles, show remembered state, not live state. Pair with the server-side redaction from C3.

### U2. Overclock, forced interaction and the Dead-Drop Uplink cannot be triggered from the UI

A grep of all of `src/` outside the API route, pipeline and schemas finds **no sender** of `INTERACT_PROP` or `DEAD_DROP_ITEM` (the only `forceOverride` occurrences are the schema and the movement system, which always sets it to `false`). Consequences:

- **Locked safes and vault doors:** the bump safeguard warns about the Overclock Bypass and then halts. Because nothing can send `forceOverride: true`, the Overclock Bypass advertised in the warning text **is not available to the player**. Without a key, a locked barrier cannot be opened.
- **Armed Corrupted Nodes:** bump is always blocked with a warning, and the force path does not exist, so the only counterplay is a stun firmware shot.
- **Dead-Drop Uplink** (`prop-dead-drop`, `deadDropFluxCost`): there is no UI to select an item, and nothing sends the action. The prop is decorative.
- **Misleading hints:** `[E]` is bound to `INTERACT_ANCHOR` (stability anchors) only. The inspector says `[E] to offload cargo to vault` for the uplink, and the Hotkeys manual says `[E] Engage Stability Anchor / Access Terminal`. Neither works for props.

This stacks with C2: the content is unreachable in generation, *and* three of its mechanics are unreachable from input even if generation were fixed.

**Fix:** add an explicit interact action (an `[E]` handler that targets the adjacent prop and sends `INTERACT_PROP` with an optional override confirmation), a Dead-Drop item picker, and tests that drive the action through the client input layer.

### U3. Quick-use discards the delta; several UI paths bypass the input and reconciliation pipeline

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

- [ ] Trap outlines and inspector badges depend on `revealed`; explored-but-unseen tiles show remembered state only
- [ ] An input-driven test can open a locked safe via overclock and use a Dead-Drop Uplink
- [ ] Every client action path goes through one request function that applies the returned payload; server rejects overlapping requests per session
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
