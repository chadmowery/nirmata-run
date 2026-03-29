<!-- GSD:project-start source:PROJECT.md -->
## Project

**Nirmata Runner — Extraction Roguelike**

A web-based turn-based extraction roguelike set in a Sci-Fi "Vibrant Decay" universe (Marathon (2026) aesthetic). Built on a server-authoritative ECS engine with PixiJS rendering, React/TypeScript UI, and Next.js. The core innovation is the "One Shot" Weekly Challenge — players get exactly one life per week to compete on a public seed. Everything else (Neural Simulations, Daily Runs, the economy) serves as preparation for that one definitive moment.

**Core Value:** The Shell/Firmware/Augment/Software customization hierarchy combined with the Neural Heat risk system — every encounter is a resource management puzzle where players balance power output against overclock risk, creating high-skill-ceiling tactical depth within a turn-based extraction loop.

### Constraints

- **Stack**: PixiJS + React + TypeScript + Next.js — non-negotiable
- **Architecture**: Engine and game logic must be fully separated at the module level
- **Validation**: All player actions round-trip through server before becoming authoritative
- **Composability**: Every entity type definable in JSON, no hardcoded entity classes
- **Turn-based**: All combat and movement is discrete turn-based, no real-time elements
- **Economy balance**: Weekly reset cycle must prevent power creep while respecting player investment
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript `5.9.3` - Core application logic, Next.js routes, components (`src/**/*.ts`, `src/**/*.tsx`)
- JavaScript - Configuration files (e.g., `eslint.config.js`)
## Runtime
- Node.js (Types `25.5.0`, `type: module`)
- npm
- Lockfile: present (`package-lock.json`)
## Frameworks
- Next.js `16.1.6` - App routing and React framework
- React `19.2.4` - UI components
- PixiJS `8.17.0` - 2D WebGL rendering engine
- Vitest `4.1.0` - Test runner (`vitest.config.ts`)
- jsdom `28.1.0` - DOM environment for tests
- TypeScript `5.9.3` - Type checking (`tsc`)
- ESLint `9.39.4` - Linting (`eslint.config.js`)
- Prettier `3.8.1` - Formatting (`.prettierrc`)
## Key Dependencies
- `@pixi/tilemap` `5.0.2` - Tilemap rendering for PixiJS
- `rot-js` `2.2.1` - Roguelike toolkit (FOV, map generation, pathfinding)
- `zustand` `5.0.11` - State management
- `zod` `4.3.6` - Schema validation (used in API routes for validation)
- `json-diff-ts` `4.10.0` - State diffing (used for game tick deltas in `src/app/api/action/route.ts`)
- `lucide-react` `0.577.0` - UI icons
## Configuration
- Not detected (No `.env` explicitly required or found in standard paths)
- Checks `process.env.NODE_ENV` in `src/engine/session/SessionManager.ts`
- `tsconfig.json` (TypeScript config with extensive path aliases like `@engine`, `@game`, etc.)
- `vitest.config.ts` (Vitest config)
- `eslint.config.js` (ESLint config)
- `.prettierrc` (Prettier config)
## Platform Requirements
- Node.js
- npm
- Next.js deployment target (Vercel or custom Node server)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- kebab-case for all source and test files (e.g., `event-bus.ts`, `state-machine.ts`, `item-pickup.test.ts`).
- `index.ts` used for barrel exports (e.g., `src/engine/index.ts`).
- camelCase for functions and methods (e.g., `createItemPickupSystem`, `computeCameraTarget`).
- Factory functions often prefixed with `create` (e.g., `createEngineInstance`, `createGame`).
- camelCase for standard variables.
- UPPER_SNAKE_CASE for constants (e.g., `TILE_SIZE`, `VIEWPORT_W`, `GAME_TRANSITIONS`).
- PascalCase for Classes, Interfaces, and Types (e.g., `EntityRegistry`, `HealthData`, `ComponentDef`).
- PascalCase for Zod schema definitions (e.g., `export const Health = defineComponent(...)`).
## Code Style
- Prettier is used.
- Settings: `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`.
- ESLint (Flat Config `eslint.config.js`) with `typescript-eslint`.
- Key rules: Strict dependency boundaries enforced via `import-x/no-restricted-paths`. The `@engine` layer is strictly forbidden from importing from `@game`, `@rendering`, `@network`, or `@ui`.
## Import Organization
- Heavily utilized. Configured in `tsconfig.json` and `vitest.config.ts`.
- Aliases: `@/`, `@engine/`, `@game/`, `@shared/`, `@rendering/`, `@components/`.
## Error Handling
- Extensive use of Zod for runtime schema validation and type inference, especially for component data (e.g., `z.infer<typeof Health.schema>`).
## Comments
- JSDoc is used for public API boundaries, classes, and complex logic (e.g., `/** The World class is the central coordinator of the ECS. */` in `src/engine/ecs/world.ts`).
- Used for class descriptions, method signatures, and interface properties.
## Function Design
## Module Design
- Named exports are preferred over default exports (e.g., `export class World`, `export function computeCameraTarget`).
- Barrel files (`index.ts`) are used to expose public APIs for layers (e.g., `src/engine/index.ts` exports `World`, `EventBus`, etc., keeping internals hidden).
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Pure Entity-Component-System (ECS) shared between Client and Server.
- Turn-based state machine synced via json-diff-ts deltas.
- Local prediction with server reconciliation for input.
- Decoupled Rendering (PixiJS) from core Game Logic.
## Layers
- Purpose: Core ECS, Grid, and Turn Management primitives. Unaware of specific game rules.
- Location: `src/engine/`
- Contains: `World`, `EventBus`, `Grid`, `TurnManager`.
- Depends on: None.
- Used by: Game Logic, Server API, Rendering.
- Purpose: Specific gameplay rules, components, systems, and entity factories.
- Location: `src/game/`
- Contains: Combat, Movement, AI, Item Pickup systems, input handling.
- Depends on: Engine Layer, Shared Layer.
- Used by: Client App, Server API.
- Purpose: State serialization, delta generation, and reconciliation logic.
- Location: `src/shared/`
- Contains: `pipeline.ts`, `reconciliation.ts`, `serialization.ts`.
- Depends on: Engine Layer.
- Used by: Game Logic, Server API, Client App.
- Purpose: Visual representation of the game state using PixiJS.
- Location: `src/rendering/`
- Contains: `render-system.ts`, `camera.ts`, `tilemap.ts`.
- Depends on: Engine Layer, Game Logic.
- Used by: Client App.
## Data Flow
- ECS state is housed in `World` (`src/engine/ecs/world.ts`).
- UI state is managed via Zustand store (`src/game/ui/store.ts`).
- Game phase state is managed by `StateMachine` (`src/engine/state-machine/state-machine.ts`).
## Key Abstractions
- Purpose: Container for entities and component data.
- Examples: `src/engine/ecs/world.ts`
- Pattern: Data-oriented ECS.
- Purpose: Coordinates actor turns based on energy/speed costs.
- Examples: `src/engine/turn/turn-manager.ts`
- Pattern: Priority queue / Energy system.
- Purpose: Minimal representation of world changes for network sync.
- Examples: `src/shared/reconciliation.ts`, `src/shared/serialization.ts`
- Pattern: JSON diffing and patching.
## Entry Points
- Location: `src/app/page.tsx`
- Triggers: Browser load.
- Responsibilities: Initializes React UI, PixiJS canvas, and bootstraps the `createGame` context.
- Location: `src/game/setup.ts`
- Triggers: Client or Server initialization.
- Responsibilities: Wires engine, systems, and network bridges together.
- Location: `src/app/api/action/route.ts`
- Triggers: POST requests from client.
- Responsibilities: Validates session, processes intent, returns state delta.
## Error Handling
- Invalid intents are dropped or rejected by the server API.
- Reconciliations apply forced server state if prediction diverges wildly.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
