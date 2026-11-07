# AGENTS.md — Nirmata Runner Engineering Rules & Progressive Disclosure Index

Nirmata Runner is a turn-based, server-authoritative extraction roguelike (Next.js 16, React 19, PixiJS 8, TypeScript, Zustand, Zod).

## 1. Commands & Tooling
- **Never** use the project `Makefile` (human-only).
- **Test**: `npm test` (Vitest)
- **Typecheck**: `npm run typecheck` (`tsc --noEmit`)
- **Lint**: `npm run lint` (`eslint src/`)
- **Build**: `npm run build` (`next build`)
- **Dev**: `npm run dev`
- **Dev Studio**: `npm run dev:studio`

## 2. Progressive Disclosure & Layer Rulebooks
To eliminate architectural drift and avoid cognitive overload, each layer maintains its own scoped rulebook with specific constraints, import boundaries, and design documentation references:

| Layer | Rulebook & Guidelines | Primary Path / Alias | Boundary Summary |
| :--- | :--- | :--- | :--- |
| **Engine** | [`src/engine/AGENTS.md`](src/engine/AGENTS.md) | `src/engine/` (`@engine/*`) | Pure ECS, Grid, EventBus, TurnManager, BSP. **Zero** external dependencies. |
| **Shared** | [`src/shared/AGENTS.md`](src/shared/AGENTS.md) | `src/shared/` (`@shared/*`) | Zod schemas, wire delta compression, anti-cheat redaction, event taxonomy. |
| **Rendering** | [`src/rendering/AGENTS.md`](src/rendering/AGENTS.md) | `src/rendering/` (`@rendering/*`) | PixiJS 8 WebGL scene graph, camera lerp, FOV/glitch shaders, sprite lifecycle. |
| **Client** | [`src/client/AGENTS.md`](src/client/AGENTS.md) | `src/client/` (`@client/*`) | 9 prediction systems, input buffer, Zustand UI store. **Zero** server procgen or dev tools. |
| **Server** | [`src/server/AGENTS.md`](src/server/AGENTS.md) | `src/server/` (`@server/*`) | Authoritative 23-phase loop, Death Protocol, procgen, session locks, persistence. |
| **Dev Tool** | [`src/dev-tool/AGENTS.md`](src/dev-tool/AGENTS.md) | `src/dev-tool/` (`@dev-tool/*`) | Gamedata Studio, AST editors, DevTerminal. Strictly quarantined from production. |

## 3. Non-Negotiable ECS & Architecture Mandates
1. **Phase-Driven Intents (No Internal RPCs)**:
   - Systems **never** call methods on other systems or use `eventBus.on()` to trigger game logic.
   - Cross-system behavior is triggered by attaching an **Intent** or **Tag** component (`MoveIntent`, `AttackIntent`, `DamageIntent`, `MovedThisTurn`, etc.) queried in its registered `Phase` (`PRE_TURN → GATHER_INTENT → ACTION → REACTION → CLEANUP → POST_TURN`).
2. **The Death Protocol (`GravediggerSystem`)**:
   - **Only** [`GravediggerSystem`](src/game/systems/gravedigger.ts) may call `world.destroyEntity()`.
   - All other systems must mark entities for removal by attaching the [`Dying`](src/shared/components/dying.ts) component (`world.addComponent(id, Dying, { killerId, reason })`).
3. **Immutable Component Updates**:
   - **Never** mutate objects returned by `world.getComponent()` in place. Always use `world.patchComponent(id, Def, partial)` or `world.addComponent(id, Def, data)`.
   - All combat/hazard damage must route through `AttackIntent` or `DamageIntent` (resolved by `CombatSystem`).
4. **Client Prediction vs. Server Authority**:
   - Client (`isClient: true`) registers only prediction-safe movement/intent systems and executes only the player's action sequence.
   - Server (`isClient: false`) executes the full turn cycle (including AI, combat, loot, hazards, and persistence) and syncs via `createECSWorldDelta` (`DELTA`) or `FULL` state payloads.
   - Client map state is initialized strictly from server `/api/run-mode/launch` or `/api/session` `initialState` payloads via `applyStateDelta()`. The client never runs procgen.
5. **Data-Driven Entities**:
   - All entities, mixins, shells, and spawn tables are defined in JSON templates validated by Zod component schemas (`COMPONENTS_REGISTRY`). No hardcoded entity classes.

## 4. Event Tier Classification
Ask: **"Does the authoritative server pipeline emit or react to this event?"**

| Tier | File | Scope |
| :--- | :--- | :--- |
| **`EngineEvents`** | [`src/engine/events/types.ts`](src/engine/events/types.ts) | Pure ECS/turn lifecycle plumbing (`ENTITY_CREATED`, `ENTITY_DESTROYED`, `TURN_START`, `TURN_END`). |
| **`GameplayEvents`** | [`src/shared/events/types.ts`](src/shared/events/types.ts) | Authoritative action/result events synced from server to client (`DAMAGE_DEALT`, `ENTITY_DIED`, `FLOOR_TRANSITION`, `RUN_ENDED`). |
| **`GameEvents`** | [`src/game/events/types.ts`](src/game/events/types.ts) | Client-only UI, camera, shader, or animation signals (`AUGMENT_FLASH`, `LOCAL_ACTION_PREDICTED`, `STATE_RECONCILED`). |

## 5. Key Documentation References
- **Project Tracker & Backlog**: [`docs/TRACKING.md`](docs/TRACKING.md)
- **Architecture & ECS Guidelines**: [`docs/architecture/APPLICATION_SEPARATION_SPEC.md`](docs/architecture/APPLICATION_SEPARATION_SPEC.md), [`docs/architecture/SYSTEM_OVERVIEW.md`](docs/architecture/SYSTEM_OVERVIEW.md), [`docs/architecture/ENGINE_GUIDELINES.md`](docs/architecture/ENGINE_GUIDELINES.md), [`docs/architecture/DEATH_PROTOCOL.md`](docs/architecture/DEATH_PROTOCOL.md)
- **UI/UX Design System & Style Guide**: [`docs/design/UI-DESIGN-SYSTEM.md`](docs/design/UI-DESIGN-SYSTEM.md), [`docs/mocks/mashup-6-26.html`](docs/mocks/mashup-6-26.html)
- **Game Design Specs**: [`docs/design/DESIGN-BRIEF.md`](docs/design/DESIGN-BRIEF.md), [`docs/design/FIRMWARE-AUGMENTS-SYSTEM.md`](docs/design/FIRMWARE-AUGMENTS-SYSTEM.md), [`docs/design/ENEMY-HIERARCHY.md`](docs/design/ENEMY-HIERARCHY.md), [`docs/design/RUN-ECONOMY.md`](docs/design/RUN-ECONOMY.md), [`docs/design/STABILITY-ANCHOR-SYSTEM.md`](docs/design/STABILITY-ANCHOR-SYSTEM.md), [`docs/design/INTERACTIVE-ENVIRONMENTS.md`](docs/design/INTERACTIVE-ENVIRONMENTS.md)
