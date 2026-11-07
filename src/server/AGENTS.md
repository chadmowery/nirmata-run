# Server Layer (`src/server/`) — Architectural Rules & Guidelines

The Server layer executes the authoritative turn-based roguelike simulation, procedural generation, session lifecycle, and persistence.

## 1. Import Boundaries (Strictly Enforced)
- **Allowed Imports**: `@engine/*`, `@shared/*`, `@server/*`, server systems and templates in `@game/*`.
- **FORBIDDEN Imports**: `@rendering/*`, `@client/*`, `@dev-tool/*` (in production), PixiJS, WebGL, Canvas, React DOM, UI overlays.

## 2. Core Architectural Mandates
1. **Authoritative Simulation Loop (`createServerEngine`)**:
   - Executes the complete 23-phase turn cycle:
     `Movement → Teleport → Equipment → AnchorInteraction → Firmware → Augment → Software → ShellStats → TagCleanup → AISystem → CombatSystem → RewardDropSystem → StabilitySystem → TileCorruptionSystem → HeatSystem → KernelPanicSystem → GravediggerSystem ...`
   - Client commands sent to `/api/action` are strictly validated before execution (range checks, inventory ownership, input cooldowns).
2. **The Death Protocol (`GravediggerSystem`)**:
   - **MANDATE**: ONLY [`GravediggerSystem`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/src/game/systems/gravedigger.ts) may call `world.destroyEntity()`.
   - All other systems must mark entities for condemnation by attaching the `Dying` component:
     ```ts
     world.addComponent(entityId, Dying, { killerId, reason });
     ```
   - Never remove dying entities prematurely during the `ACTION` or `REACTION` phases.
3. **Procedural Generation & Loot Allocation**:
   - Maps and entity placements are generated authoritatively on the server via `dungeon-generator.ts` and `entity-placement.ts`.
   - Procedural generation guarantees 100% room connectivity (flood fill validation), perimeter portals, guaranteed anchor placement, and key/loot reachability.
4. **Session Concurrency & Lifecycle**:
   - Managed by `SessionManager` (`src/server/session/session-manager.ts`).
   - Every active run acquires a session lock (`acquireLock` / `releaseLock`) to serialize incoming action requests and prevent concurrent state corruption.
   - Sliding inactivity TTL automatically evicts stale sessions from memory.
5. **Anti-Cheat Wire Serialization**:
   - The server must never transmit raw internal state to the client. Always run `serializeWorld(world, { redactForClient: true })` or `redactDeltaForClient(delta)` before responding to client network requests.

## 3. Related Documentation
- [`DEATH_PROTOCOL.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/architecture/DEATH_PROTOCOL.md) — Two-phase condemnation and cleanup lifecycle.
- [`ENEMY-HIERARCHY.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/design/ENEMY-HIERARCHY.md) — Enemy archetype taxonomy and AI behavior specifications.
- [`RUN-ECONOMY.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/design/RUN-ECONOMY.md) — Scrap, Flux, and Blueprint progression and drop rates.
- [`STABILITY-ANCHOR-SYSTEM.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/design/STABILITY-ANCHOR-SYSTEM.md) — Anchor extraction, descent, and stabilization mechanics.
