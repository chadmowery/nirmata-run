# Coding Conventions

**Analysis Date:** 2024-03-15

## Naming Patterns

**Files:**
- kebab-case for all source and test files (e.g., `event-bus.ts`, `state-machine.ts`, `item-pickup.test.ts`).
- `index.ts` used for barrel exports (e.g., `src/engine/index.ts`).

**Functions:**
- camelCase for functions and methods (e.g., `createItemPickupSystem`, `computeCameraTarget`).
- Factory functions often prefixed with `create` (e.g., `createEngineInstance`, `createGame`).

**Variables:**
- camelCase for standard variables.
- UPPER_SNAKE_CASE for constants (e.g., `TILE_SIZE`, `VIEWPORT_W`, `GAME_TRANSITIONS`).

**Types:**
- PascalCase for Classes, Interfaces, and Types (e.g., `EntityRegistry`, `HealthData`, `ComponentDef`).
- PascalCase for Zod schema definitions (e.g., `export const Health = defineComponent(...)`).

## Code Style

**Formatting:**
- Prettier is used.
- Settings: `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`.

**Linting:**
- ESLint (Flat Config `eslint.config.js`) with `typescript-eslint`.
- Key rules: Strict dependency boundaries enforced via `import-x/no-restricted-paths`. The `@engine` layer is strictly forbidden from importing from `@game`, `@rendering`, `@network`, or `@ui`.

## Import Organization

**Order:**
1. External libraries (e.g., `import { z } from 'zod'`, `import { Application } from 'pixi.js'`)
2. Internal aliases (e.g., `@engine/...`, `@shared/...`)
3. Relative imports (e.g., `../events/types`)

**Path Aliases:**
- Heavily utilized. Configured in `tsconfig.json` and `vitest.config.ts`.
- Aliases: `@/`, `@engine/`, `@game/`, `@shared/`, `@rendering/`, `@components/`.

## Error Handling

**Patterns:**
- Extensive use of Zod for runtime schema validation and type inference, especially for component data (e.g., `z.infer<typeof Health.schema>`).

## Comments

**When to Comment:**
- JSDoc is used for public API boundaries, classes, and complex logic (e.g., `/** The World class is the central coordinator of the ECS. */` in `src/engine/ecs/world.ts`).

**JSDoc/TSDoc:**
- Used for class descriptions, method signatures, and interface properties.

## Function Design

**Size:** Focused, single-responsibility functions.

**Parameters:** Use of configuration objects for complex initializations (e.g., `config: GameConfig` in `createGame`).

**Return Values:** Factory functions return strongly typed instances or context objects (e.g., `GameContext`, `EngineInstance`).

## Module Design

**Exports:**
- Named exports are preferred over default exports (e.g., `export class World`, `export function computeCameraTarget`).
- Barrel files (`index.ts`) are used to expose public APIs for layers (e.g., `src/engine/index.ts` exports `World`, `EventBus`, etc., keeping internals hidden).