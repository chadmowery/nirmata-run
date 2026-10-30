# AGENTS.md — Nirmata Runner Engineering Rules

Nirmata Runner is a turn-based, server-authoritative extraction roguelike (Next.js 16, React 19, PixiJS 8, TypeScript, Zustand, Zod).

## 1. Commands & Tooling
- **Never** use the project `Makefile` (human-only).
- **Test**: `npm test` (Vitest)
- **Typecheck**: `npm run typecheck` (`tsc --noEmit`)
- **Lint**: `npm run lint` (`eslint src/`)
- **Build**: `npm run build` (`next build`)

## 2. Layer Boundaries (Enforced by ESLint)
| Layer | Path / Alias | Rule |
| :--- | :--- | :--- |
| **Engine** | `src/engine/` (`@engine/*`) | Pure ECS, Grid, EventBus, TurnManager, BSP. **Zero** imports from `@shared`, `@game`, `@rendering`, `@server`, or UI. |
| **Shared** | `src/shared/` (`@shared/*`) | Zod component schemas (`src/shared/components/`), `GameplayEvents`, serialization, `ecs-delta.ts`, `reconciliation.ts`. |
| **Game** | `src/game/` (`@game/*`) | Gameplay systems (`src/game/systems/`), `GameTurnAdapter`, JSON templates, input, Zustand UI store & `sync-bridge.ts`. |
| **Rendering** | `src/rendering/` (`@rendering/*`) | PixiJS renderer, tilemap, camera, FOV, shaders, `EntitySpriteMap`. Client-only. |
| **Server / API** | `src/server/` (`@server/*`), `src/app/api/` | `session-manager.ts`, `leaderboard-service.ts`, authoritative Next.js API routes. |

## 3. Non-Negotiable ECS & Architecture Mandates
1. **Phase-Driven Intents (No Internal RPCs)**:
   - Systems **never** call methods on other systems or use `eventBus.on()` to trigger game logic.
   - To trigger cross-system behavior, attach an **Intent** or **Tag** component (`MoveIntent`, `AttackIntent`, `DamageIntent`, `MovedThisTurn`, etc.) and let the target system query it in its registered `Phase` (`PRE_TURN → GATHER_INTENT → ACTION → REACTION → CLEANUP → POST_TURN`).
2. **The Death Protocol (`GravediggerSystem`)**:
   - **Only** [`GravediggerSystem`](src/game/systems/gravedigger.ts) may call `world.destroyEntity()`.
   - All other systems must mark entities for removal by attaching the [`Dying`](src/shared/components/dying.ts) component (`world.addComponent(id, Dying, { killerId, reason })`).
3. **Immutable Component Updates**:
   - **Never** mutate objects returned by `world.getComponent()` in place. Always use `world.patchComponent(id, Def, partial)` or `world.addComponent(id, Def, data)`.
   - All combat/hazard damage must route through `AttackIntent` or `DamageIntent` (resolved by `CombatSystem`).
4. **Client Prediction vs. Server Authority**:
   - Client (`isClient: true`) registers only prediction-safe movement/intent systems and executes only the player's action sequence.
   - Server (`isClient: false`) executes the full turn cycle (including AI, combat, loot, hazards, and persistence) and syncs via `createECSWorldDelta` (`DELTA`) or `FULL` state payloads.
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
- **Architecture & ECS Guidelines**: [`docs/architecture/SYSTEM_OVERVIEW.md`](docs/architecture/SYSTEM_OVERVIEW.md), [`docs/architecture/ENGINE_GUIDELINES.md`](docs/architecture/ENGINE_GUIDELINES.md), [`docs/architecture/DEATH_PROTOCOL.md`](docs/architecture/DEATH_PROTOCOL.md)
- **UI/UX Design System & Style Guide**: [`docs/design/UI-DESIGN-SYSTEM.md`](docs/design/UI-DESIGN-SYSTEM.md), [`docs/mocks/mashup-6-26.html`](docs/mocks/mashup-6-26.html)
- **Game Design Specs**: [`docs/design/DESIGN-BRIEF.md`](docs/design/DESIGN-BRIEF.md), [`docs/design/FIRMWARE-AUGMENTS-SYSTEM.md`](docs/design/FIRMWARE-AUGMENTS-SYSTEM.md), [`docs/design/ENEMY-HIERARCHY.md`](docs/design/ENEMY-HIERARCHY.md), [`docs/design/RUN-ECONOMY.md`](docs/design/RUN-ECONOMY.md), [`docs/design/STABILITY-ANCHOR-SYSTEM.md`](docs/design/STABILITY-ANCHOR-SYSTEM.md), [`docs/design/INTERACTIVE-ENVIRONMENTS.md`](docs/design/INTERACTIVE-ENVIRONMENTS.md)
