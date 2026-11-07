# Engine Layer (`src/engine/`) — Architectural Rules & Guidelines

The Engine layer is the self-contained mathematical, spatial, and computational foundation of Nirmata Runner.

## 1. Purity & Import Boundary (Strictly Enforced)
- **Allowed Imports**: `@engine/*` only.
- **FORBIDDEN Imports**: **Zero** imports from `@shared/*`, `@game/*`, `@client/*`, `@server/*`, `@rendering/*`, `@dev-tool/*`, UI, React, Next.js, or DOM.
- The Engine must remain 100% platform-agnostic (runnable in browser main thread, web worker, or Node.js server runtime).

## 2. Core Architectural Mandates
1. **Deterministic Turn Scheduling**:
   - Turn advances proceed through discrete deterministic phases: `PRE_TURN → GATHER_INTENT → ACTION → REACTION → CLEANUP → POST_TURN`.
   - `TurnManager` communicates with higher-level simulation through the decoupled `TurnSchedulerAdapter` interface. Never couple turn scheduling directly to concrete gameplay components.
2. **Spatial Grid Indexing (O(1) Lookups)**:
   - `Grid` maintains separate spatial coordinate lookups for terrain impassability, entity occupancy (`getEntitiesAt(x, y)`), and item drops (`getItemsAt(x, y)`).
   - Systems must never linearly scan all entities to find entities at a specific tile coordinate.
3. **Pure ECS Memory Model**:
   - Entities are lightweight integer IDs (`EntityId`).
   - Components are pure data objects. No methods or logic inside components.
   - Systems query entities matching component sets (`world.query(...)`) and perform batch updates.
   - Component updates must always use `world.addComponent()` or `world.patchComponent()`. Never mutate retrieved components directly in place.

## 3. Related Documentation
- [`ENGINE_GUIDELINES.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/architecture/ENGINE_GUIDELINES.md) — Comprehensive ECS memory model, TurnManager lifecycle, and grid geometry patterns.
