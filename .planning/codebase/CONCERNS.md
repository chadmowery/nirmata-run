# Codebase Concerns

> Last updated: 2026-04-09

## Technical Debt

### High Priority

**Shared → Game Layer Violation:**
- `src/shared/pipeline.ts` imports directly from `src/game/systems/` (run-inventory, combat, software-effects)
- `src/shared/utils/economy-util.ts` imports from `src/game/entities/templates/economy.json`
- Shared code should be isomorphic and not depend on the game layer. This violates the architecture described in AGENTS.md and will prevent clean server-side reuse.

**HACK: Currency Event for UI Sync:**
- `src/game/setup.ts:320` — emits a fake `CURRENCY_PICKED_UP` event with amount 0 to trigger UI refresh after server state reconciliation.
- Comment: `// TODO: This is a HACK and needs to be cleaned up!`
- Fix: Introduce a dedicated reconciliation-complete event or use `RUN_INVENTORY_SYNCED` consistently.

**Hardcoded Floor Number in Stability System:**
- `src/game/systems/stability.ts:138` — `const floorNumber = 1; // TODO: Get actual floor number`
- Stability turn-bleed calculations will be incorrect on any floor beyond floor 1.

**Reconciliation Event Replay uses `as any`:**
- `src/shared/reconciliation.ts:49` — `eventBus.emit(event.type as any, event.payload as any)`
- Server events replayed to client bypass all type checking. A payload shape mismatch would cause silent runtime failures in animation/UI systems.

### Medium Priority

**Incomplete System Cleanup in `destroyGame`:**
- `src/game/setup.ts:389-412` lists 12 systems for disposal, but `deadZoneSystem`, `stabilitySystem`, `floorManagerSystem`, `anchorInteractionSystem`, and `currencyDropSystem` are created in `src/game/engine-factory.ts:115-127` and NOT included in the teardown list.
- Systems with empty `dispose()`: `tile-corruption.ts:246`, `movement.ts:93`, `ai.ts:576`, `firmware.ts:189` — these register `eventBus.on()` listeners but never unregister them.
- Risk: Event listener leaks across game restarts when the EventBus is not fully cleared.

**EventOriginContext is a Mutable Global Singleton:**
- `src/shared/utils/event-context.ts` — single mutable object shared across the entire runtime.
- If an async operation interleaves reconciliation with a player action, the origin context could be wrong. No guards against concurrent access.

**`any` Usage in API Error Handling:**
- 8 API routes use `catch (error: any)` with `eslint-disable` comments: economy routes (`upgrade`, `install`, `uninstall`, `compile`, `purchase`), `admin/grant`, `admin/reset`, `session`.
- Should use `catch (error: unknown)` with `instanceof Error` checks (as `src/app/api/action/route.ts:186` already does).

### Low Priority

**Inconsistent Logging — `console.*` vs `logger.*`:**
- All 12+ API routes under `src/app/api/` use raw `console.error()`/`console.log()`.
- Game/shared code uses the structured `logger` from `src/shared/utils/logger.ts`.
- Mix makes log filtering and level control inconsistent.

**Large Files Accumulating Complexity:**
- `src/game/systems/ai.ts` (580 lines) — AI behavior, pathfinding, pack coordination, admin detection
- `src/shared/pipeline.ts` (463 lines) — action processing, combat, items, extraction, inventory
- `src/game/setup.ts` (412 lines) — initialization, input handling, server sync, teardown
- `src/engine/generation/bsp.ts` (376 lines) — BSP tree, room splitting, corridor generation
- `src/game/generation/entity-placement.ts` (321 lines)

## Known Issues

**Silent Null Returns in Critical Paths:**
- `src/engine/generation/bsp.ts:244` — returns `null` silently when source/target room arrays are empty
- `src/game/systems/ai.ts:40,92` — returns `null` for pathfinding failures without logging
- `src/engine/turn/turn-manager.ts:195` — returns `null` on lookup failure
- No error logging or metrics for these failure paths; in production they manifest as "nothing happened" with no clue why.

**Turn Manager Sub-tick Overflow:**
- `src/engine/turn/turn-manager.ts:124` — `MAX_SUB_TICKS = 1000` hard limit.
- Degenerate speed values can trigger the limit, throwing an error that propagates to the caller with no recovery strategy.

**Dungeon Generation Retry Limit:**
- `src/game/generation/dungeon-generator.ts:30` — `MAX_ATTEMPTS = 10` with no fallback if all attempts fail.

## Security Concerns

**No Authentication or Authorization on Admin Routes:**
- `src/app/api/admin/reset/route.ts`, `src/app/api/admin/grant/route.ts`, `src/app/api/admin/inspect/route.ts`, `src/app/api/admin/seed-rotation/route.ts`, `src/app/api/admin/reset-attempts/route.ts`
- All admin endpoints are publicly accessible — any client can reset profiles, grant items, or inspect state.

**Path Traversal Risk via `sessionId`:**
- `src/app/persistence/fs-profile-repository.ts:12` — `path.join(PROFILES_DIR, \`${sessionId}.json\`)`
- `sessionId` is validated only as `z.string()` in `ActionRequestSchema` (`src/shared/types.ts:120`). A crafted sessionId like `../../etc/passwd` could read/write outside the profiles directory.
- Same risk in leaderboard submit where `sessionId` is not validated with Zod at all.

**15 API Routes Without Zod Validation:**
- Routes using bare `await req.json()` without schema validation:
  - `src/app/api/session/route.ts`
  - `src/app/api/run-mode/launch/route.ts`, `src/app/api/run-mode/available/route.ts`
  - `src/app/api/leaderboard/submit/route.ts`, `daily/route.ts`, `weekly/route.ts`
  - `src/app/api/admin/inspect/route.ts`, `seed-rotation/route.ts`, `reset-attempts/route.ts`
  - All 5 vault routes (`sell`, `discard`, `move-to-vault`, `equip-from-vault`, `overflow`)
  - `src/app/api/debug/log/route.ts`

**No Rate Limiting on Any Endpoint:**
- No rate limiting middleware detected anywhere. All endpoints can be called without throttling.

**Debug Endpoint Writes to Filesystem:**
- `src/app/api/debug/log/route.ts` writes arbitrary JSON arrays to `debug/session_events.json` with no size limit or access control.

## Performance Concerns

**Event Bus Circular Chain Risk:**
- `src/engine/events/event-bus.ts:16` — `MAX_FLUSH_DEPTH = 10` to prevent infinite recursion.
- During flush, new events can be emitted which trigger re-flush. The hard limit prevents crashes but losing events silently at depth 10 could cause state inconsistency.

**Turn Manager Energy Loop:**
- `src/engine/turn/turn-manager.ts:124-146` — while-loop processes up to 1000 sub-ticks per turn advance. No minimum speed enforcement exists at entity creation time.

**SessionManager In-Memory Storage:**
- `src/engine/session/SessionManager.ts` — all session state (World, Grid, TurnManager) stored in a `Map` in process memory.
- No session expiration, eviction, or memory limits. Each concurrent session holds entire game state.

## Fragile Areas

**Sync Bridge (299 lines, no dispose):**
- `src/game/ui/sync-bridge.ts` registers 15+ event listeners on the EventBus to bridge game events to React/Zustand state.
- No cleanup function — relies entirely on `eventBus.clear()` in `destroyGame`.
- Comment at line 78 notes a race condition: `"This was causing a race condition in React by triggering a cleanup/init cycle."`

**Pipeline Imports Create Tight Coupling:**
- `src/shared/pipeline.ts` imports `resolveDamage`, `collectDamageModifiers`, `checkAutoLoader`, `applyBleedOnHit`, `applyVampireOnKill` from game layer.
- Any change to combat or software-effects systems can break the authoritative pipeline.

**Targeting System Type Escape:**
- `src/game/input/targeting.ts:90` — `// Note: Added to types.ts in later phase if needed, using as any for now`
- Indicates incomplete type coverage in the targeting interaction flow.

## Test Coverage Gaps

**13 Game Systems Without Tests:**
- `src/game/systems/anchor-interaction.ts` (168 lines)
- `src/game/systems/currency-drop.ts` (110 lines)
- `src/game/systems/dead-zone.ts` (109 lines)
- `src/game/systems/floor-manager.ts` (129 lines)
- `src/game/systems/run-inventory.ts` (223 lines)
- `src/game/systems/stability.ts` (152 lines)
- `src/game/systems/tile-corruption.ts` (264 lines)
- `src/game/systems/weekly-reset.ts` (112 lines)
- `src/game/systems/pack-coordinator.ts` (133 lines)
- `src/game/systems/software-effects.ts` (114 lines)
- `src/game/systems/shop-rotation.ts` (54 lines)
- `src/game/systems/shell-stats.ts` (48 lines)
- `src/game/systems/legacy-code.ts` (37 lines)

**Shared Code Missing Tests:**
- `src/shared/reconciliation.ts` (56 lines) — core client-server sync logic, untested
- `src/shared/profile.ts` (80 lines) — player profile schema/defaults, untested
- `src/shared/vault.ts` (25 lines) — vault constants/sell values, untested

**Engine Gaps:**
- `src/engine/entity/factory.ts` (44 lines) — entity creation, untested
- `src/engine/session/SessionManager.ts` (66 lines) — session lifecycle, untested

**Event Bus Edge Cases:**
- `MAX_FLUSH_DEPTH` error path not tested
- Cascading event chains not covered

## Missing Infrastructure

**No Authentication/Authorization Layer:**
- No middleware, no session tokens, no role checks. Every API route is open.

**No Request Validation Middleware:**
- Each route implements its own validation (or doesn't). No shared validation layer.

**File-Based Persistence:**
- Profiles: `data/profiles/{sessionId}.json`
- Leaderboards: `data/leaderboards/{periodId}.json`
- No database, no transactions, no concurrent-access safety beyond atomic write in profile repo.

**No Monitoring/Observability:**
- No error tracking service, no metrics, no health endpoint.
- Mixed `console.*` and `logger.*` usage with no structured logging format.
