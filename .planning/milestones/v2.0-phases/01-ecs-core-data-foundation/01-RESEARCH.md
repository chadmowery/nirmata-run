# Phase 1: ECS Core & Data Foundation - Research

**Researched:** 2026-03-13
**Domain:** Custom ECS architecture, entity composition, event systems, 2D grid data structures, TypeScript project scaffolding
**Confidence:** HIGH

## Summary

Phase 1 builds the engine's data backbone — a custom ECS, typed event bus, 2D grid, and entity composition pipeline — all in pure TypeScript with zero browser dependencies. The technical domain is well-understood: ECS patterns are established in game engine literature, Zod validation is mature, and ESLint import restrictions are straightforward to configure. The primary risk is over-engineering the ECS (Pitfall 1 from project research) rather than any technical unknown.

The user's decisions in CONTEXT.md lock the key architectural choices: mixin-based template composition, mutable component references, queued event delivery with end-of-turn flush, component identification via class/constant references, per-tile property flags with multi-occupancy, and systems as pure `(world) => void` functions. These decisions are specific enough to drive implementation directly.

**Primary recommendation:** Start with project scaffolding (TypeScript + Vitest + ESLint boundary rules), then build ECS core → event bus → grid → entity composition pipeline. Timebox ECS core to 2 days maximum — use `Map<ComponentKey, Map<EntityId, ComponentData>>` storage, auto-incrementing integer entity IDs, and simple array-returning queries.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Entity Template Composability**: Mixin composition model — templates list mixin names that get merged. Conflicting components across mixins are an error at assembly time. Templates use an `overrides` block. Templates and mixins share the same JSON format — any template can be referenced as a mixin.
- **Component Mutability & Access**: Mutable references — systems get the actual component object and mutate it directly. No change tracking. Components are POJOs at runtime. Components are identified by symbol/class-reference keys for type-safe access (e.g., `world.getComponent(entity, Position)`).
- **Grid Tile Data Model**: Per-tile property flags (walkable, transparent, etc.). Unified grid with layered tile data. Component-authoritative positions (Position component is truth; grid spatial index synced from Position). Multi-occupancy per layer.
- **Event System**: Engine auto-emits lifecycle events only (ENTITY_CREATED, ENTITY_DESTROYED, COMPONENT_ADDED, COMPONENT_REMOVED). Game systems emit domain events explicitly. Queued event delivery with end-of-turn flush. Generic type map for type safety (`EventBus<{ ENTITY_CREATED: EntityEvent }>`).
- **System Ordering Model**: Named phase groups (pre-turn, action, post-turn, render). Registration order = execution order within a phase. Phases are engine-defined. Systems are pure functions: `(world) => void`. Game state machine controls system activation.
- **Entity ID scheme**: Claude's discretion (recommend auto-incrementing integers)
- **Query API shape**: Claude's discretion (recommend `EntityId[]` return type)
- **Zod validation strategy**: Claude's discretion (recommend `defineComponent` pattern combining key + schema + type)
- **Internal data structures**: Claude's discretion (recommend Map-of-Maps)

### Claude's Discretion
- Entity ID scheme (auto-incrementing integers vs UUIDs)
- Query API shape (return type, iteration style)
- Zod validation strategy (schema per component, registry approach)
- Internal data structures for component storage and query indexing

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ECS-01 | Entity lifecycle management (create, destroy, query by ID) | World class with auto-incrementing IDs, `createEntity()`, `destroyEntity()`, entity existence check |
| ECS-02 | Component CRUD with O(1) lookup | Map-of-Maps storage: `Map<ComponentKey, Map<EntityId, Data>>` gives O(1) via double-key lookup |
| ECS-03 | System registration with explicit execution ordering | Named phase groups with ordered arrays; registration order = execution order within phase |
| ECS-04 | Component-based queries (e.g., all entities with Position + Health) | Query function that intersects entity sets from component maps; optional query caching with invalidation on add/remove |
| ECS-05 | Entity lifecycle events (ENTITY_CREATED, ENTITY_DESTROYED, COMPONENT_ADDED, COMPONENT_REMOVED) | World auto-emits to event bus; queued delivery enables safe iteration during system execution |
| ECS-06 | Entity templates defined in JSON with component data | JSON format with `name`, `components` map, optional `mixins` array, optional `overrides` block |
| ECS-07 | Entity builder assembles entities from JSON templates | Builder parses template, resolves mixins, validates with Zod, calls world.createEntity + addComponent |
| ECS-08 | Entity registry stores named templates for lookup | Simple `Map<string, EntityTemplate>` with registration and lookup by name |
| ECS-09 | Entity factory stamps entities from registered templates | Factory wraps registry lookup + builder assembly; accepts position/runtime overrides |
| ECS-10 | JSON templates validated against Zod schemas at assembly time | `defineComponent` pattern: each component definition bundles key + Zod schema + inferred TS type |
| EVT-01 | Typed event bus with subscribe/emit/unsubscribe | Generic `EventBus<EventMap>` with type-safe handlers per event type |
| EVT-02 | Events are synchronous within a turn | **Note:** CONTEXT.md chose queued delivery with end-of-turn flush. Implementation queues events during system execution, then flushes all handlers after systems complete. This modifies EVT-02's "inline on emit" to "batched within turn boundary." |
| EVT-03 | Game-specific event types defined in game layer, not engine | Engine defines the `EventBus` generic class and lifecycle event types; game layer defines domain event types (DAMAGE_DEALT, etc.) in `game/events/` |
| GRID-01 | 2D grid data structure with tile storage and spatial indexing | Grid class with flat array storage (`width * height`), coordinate-to-index conversion, spatial index `Map<string, Set<EntityId>>` keyed by `"x,y"` |
| GRID-02 | Grid supports walkability queries per tile | Each tile stores explicit `walkable` boolean flag; `grid.isWalkable(x, y)` checks flag |
| GRID-03 | Grid supports entity-at-position lookups | Spatial index: `grid.getEntitiesAt(x, y)` returns entity set from position-keyed map |
| GRID-04 | Grid supports multi-layer data | Tile has `terrain`, `entities` (Set), `items` (Set) layers; single lookup returns all layers |
| ARCH-01 | Engine code never imports from game, rendering, network, or UI | Directory structure enforced by ESLint `import/no-restricted-paths` (via `eslint-plugin-import-x` for ESLint 9 flat config) |
| ARCH-02 | ESLint import/no-restricted-paths enforces engine/game boundary from first commit | Configure in `eslint.config.js`; engine zone restricted from importing game/, rendering/, network/, ui/ |
</phase_requirements>

## Standard Stack

### Core (Phase 1 Only — No Browser Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.9.3 | Static typing for all engine + game code | Latest stable; satisfies const type params and inference needed for ECS generic typing |
| Vitest | ^4.1.0 | Unit testing for all Phase 1 code | Native ESM + TypeScript out of the box; fastest TS test runner; Jest-compatible API |
| Zod | ^3.x | Runtime validation of JSON entity templates and component data | TypeScript-first schema validation; `z.infer` derives TS types from schemas, ensuring runtime + compile-time agreement |
| ESLint | ^9.x | Linting + architecture enforcement | Flat config format (ESLint 9 standard); boundary enforcement via import restriction rules |
| eslint-plugin-import-x | latest | `no-restricted-paths` rule for ESLint 9 flat config | ESLint 9-compatible fork of eslint-plugin-import; provides `import-x/no-restricted-paths` for architectural boundary enforcement |
| Prettier | ^3.x | Code formatting | De facto standard; separate from ESLint (linting for logic, Prettier for style) |

### Not Needed in Phase 1

| Library | When Needed | Why Not Now |
|---------|-------------|-------------|
| PixiJS | Phase 3 | Zero rendering in Phase 1; pure data layer |
| React | Phase 3+ | No UI or DOM in Phase 1 |
| Next.js | Phase 5 | No server, no API routes in Phase 1 |
| rot-js | Phase 2+ | FOV/pathfinding not needed; grid is custom data structure |
| zustand | Phase 6 | No UI state bridge in Phase 1 |

**Installation (Phase 1):**
```bash
npm init -y
npm install zod
npm install -D typescript@^5.9 vitest@^4.1 eslint@^9 eslint-plugin-import-x prettier@^3
npx tsc --init
```

## Architecture Patterns

### Recommended Project Structure (Phase 1 Scope)
```
src/
├── engine/                    # Game-agnostic infrastructure (ARCH-01)
│   ├── ecs/
│   │   ├── world.ts           # World class: entity lifecycle, component storage, queries
│   │   ├── types.ts           # EntityId, ComponentDef, SystemFn, Phase types
│   │   └── query.ts           # Query logic, optional caching
│   ├── events/
│   │   ├── event-bus.ts       # Generic typed EventBus<EventMap> with queue + flush
│   │   └── types.ts           # EventMap constraints, handler types, lifecycle events
│   ├── entity/
│   │   ├── builder.ts         # Template resolution, mixin merging, Zod validation
│   │   ├── registry.ts        # Named template storage (Map<string, template>)
│   │   └── factory.ts         # Stamps entities from registry via builder
│   ├── grid/
│   │   ├── grid.ts            # 2D grid with flat array, spatial index, tile CRUD
│   │   └── types.ts           # Tile, GridConfig, layer types
│   └── index.ts               # Public engine API barrel export
│
├── game/                      # Game-specific (imports from engine/ only)
│   ├── components/            # Component definitions with Zod schemas
│   │   ├── position.ts        # defineComponent('position', z.object({...}))
│   │   ├── health.ts          # defineComponent('health', z.object({...}))
│   │   └── index.ts           # Re-exports all components
│   ├── entities/              # JSON entity templates
│   │   ├── templates/         # JSON files: goblin.json, player.json, etc.
│   │   └── index.ts           # Loads + registers templates
│   └── events/
│       └── types.ts           # Game event type map (DAMAGE_DEALT, etc.)
│
├── __tests__/                 # Or colocated *.test.ts files
│   ├── engine/
│   │   ├── ecs/
│   │   ├── events/
│   │   ├── entity/
│   │   └── grid/
│   └── game/
│       ├── components/
│       └── entities/
│
eslint.config.js               # Flat config with import-x/no-restricted-paths
tsconfig.json                  # Strict mode, path aliases
vitest.config.ts               # Vitest configuration
package.json
```

### Pattern 1: Component Definition via `defineComponent`

**What:** A factory function that creates a component definition bundling a unique key, Zod schema, and inferred TypeScript type — serving as both the component identifier and validator.

**Why:** Satisfies three requirements simultaneously: (1) type-safe component access via class/constant reference keys per CONTEXT.md, (2) Zod validation per ECS-10, (3) TypeScript compile-time type inference.

```typescript
import { z, ZodObject, ZodRawShape } from 'zod';

// The component definition IS the key — passed to world.getComponent(entity, Position)
interface ComponentDef<T extends ZodRawShape> {
  readonly key: string;
  readonly schema: ZodObject<T>;
  // TypeScript type is: z.infer<typeof schema>
}

function defineComponent<T extends ZodRawShape>(
  key: string,
  shape: T
): ComponentDef<T> {
  return {
    key,
    schema: z.object(shape),
  };
}

// Usage — game/components/position.ts
export const Position = defineComponent('position', {
  x: z.number(),
  y: z.number(),
});
// Type: z.infer<typeof Position.schema> = { x: number; y: number }

export const Health = defineComponent('health', {
  current: z.number().int().min(0),
  max: z.number().int().positive(),
});

// World API uses the definition as the key:
const pos = world.getComponent(entity, Position); // pos is { x: number, y: number }
const hp = world.getComponent(entity, Health);     // hp is { current: number, max: number }
```

**Key insight:** The `ComponentDef` object serves as:
1. **Map key** — `Position.key` indexes into storage
2. **Type parameter** — generic inference gives correct return type
3. **Runtime validator** — `Position.schema.parse(data)` validates JSON template data

### Pattern 2: Map-of-Maps ECS Storage

**What:** Two-level Map: component type → (entity ID → component data). O(1) lookup by (entity, component).

**Why:** Simplest correct approach. Optimized for developer ergonomics, not cache coherence (irrelevant at <200 entities/turn). Trivially debuggable — inspect any component store in the Chrome debugger.

```typescript
type EntityId = number;

class World {
  private nextId: EntityId = 1;
  private entities = new Set<EntityId>();
  private stores = new Map<string, Map<EntityId, unknown>>();

  createEntity(): EntityId {
    const id = this.nextId++;
    this.entities.add(id);
    // Queue ENTITY_CREATED event
    return id;
  }

  addComponent<T extends ZodRawShape>(
    entity: EntityId,
    def: ComponentDef<T>,
    data: z.infer<ZodObject<T>>
  ): void {
    let store = this.stores.get(def.key);
    if (!store) {
      store = new Map();
      this.stores.set(def.key, store);
    }
    store.set(entity, data);
    // Queue COMPONENT_ADDED event
    // Invalidate cached queries involving this component type
  }

  getComponent<T extends ZodRawShape>(
    entity: EntityId,
    def: ComponentDef<T>
  ): z.infer<ZodObject<T>> | undefined {
    return this.stores.get(def.key)?.get(entity) as z.infer<ZodObject<T>> | undefined;
  }

  query(...defs: ComponentDef<any>[]): EntityId[] {
    // Intersect entity sets from each component's store
    // Start with smallest store for efficiency
    // Optional: cache result, invalidate on add/remove of relevant component types
  }
}
```

**Entity IDs — auto-incrementing integers (recommended):**
- Simplest possible implementation
- Deterministic ordering for enemy turns (sort by ID = creation order)
- No dependencies (no nanoid/uuid)
- Sufficient for single-process, single-session game
- Counter resets per World instance

### Pattern 3: Queued Event Bus with Type-Safe Generic Map

**What:** Events emitted during system execution are queued; all handlers fire during a flush phase at end-of-turn.

**Why:** User chose this model in CONTEXT.md. Prevents handler re-entrancy problems (handler A emits event B which triggers handler C which emits event A...). Systems can emit freely without worrying about execution order of handlers.

**Note on EVT-02:** The requirement says "synchronous within a turn (handlers execute inline on emit)." The user's CONTEXT.md decision chose queued delivery with end-of-turn flush instead. The planner should treat the CONTEXT.md decision as authoritative — events are still processed within the same turn (not deferred to next turn), but handlers execute in a batch after all systems complete rather than inline at emit-time.

```typescript
type EventHandler<T> = (event: T) => void;

class EventBus<TEventMap extends Record<string, unknown>> {
  private handlers = new Map<string, Set<EventHandler<any>>>();
  private queue: Array<{ type: string; event: unknown }> = [];

  on<K extends keyof TEventMap & string>(
    type: K,
    handler: EventHandler<TEventMap[K]>
  ): void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
  }

  off<K extends keyof TEventMap & string>(
    type: K,
    handler: EventHandler<TEventMap[K]>
  ): void {
    this.handlers.get(type)?.delete(handler);
  }

  emit<K extends keyof TEventMap & string>(
    type: K,
    event: TEventMap[K]
  ): void {
    this.queue.push({ type, event });
  }

  flush(): void {
    const pending = this.queue.splice(0);
    for (const { type, event } of pending) {
      const set = this.handlers.get(type);
      if (set) {
        for (const handler of set) {
          handler(event);
        }
      }
    }
    // If handlers emitted new events during flush, flush again
    if (this.queue.length > 0) {
      this.flush(); // Recursive — handle cascading events within same turn
    }
  }
}

// Engine lifecycle events (defined in engine)
interface EngineEvents {
  ENTITY_CREATED: { entityId: EntityId };
  ENTITY_DESTROYED: { entityId: EntityId };
  COMPONENT_ADDED: { entityId: EntityId; componentKey: string };
  COMPONENT_REMOVED: { entityId: EntityId; componentKey: string };
}
```

**Recursive flush consideration:** When handlers emit events during flush, those events are queued and processed in the same flush cycle. Add a max-depth guard (e.g., 10 iterations) to prevent infinite loops from circular event chains.

### Pattern 4: Mixin-Based Entity Template Composition

**What:** Templates list mixin names; builder merges mixin components, applies overrides, validates with Zod.

```json
// entities/templates/base-enemy.json (also usable as a mixin)
{
  "name": "base_enemy",
  "components": {
    "health": { "current": 5, "max": 5 },
    "blocks_movement": {}
  }
}

// entities/templates/goblin.json
{
  "name": "goblin",
  "mixins": ["base_enemy"],
  "components": {
    "melee_attack": { "damage": 3 },
    "sprite": { "key": "goblin_idle" },
    "ai_behavior": { "state": "idle" }
  },
  "overrides": {
    "health": { "current": 8, "max": 8 }
  }
}
```

**Resolution order:**
1. Load mixin templates in order (resolve nested mixins recursively, max depth 3)
2. Merge mixin components (later mixins override earlier ones for same component key)
3. Apply template's own `components` on top
4. Apply `overrides` block on top (deep merge per-component)
5. Validate each final component against its Zod schema
6. If any component key is unknown or validation fails → throw with clear error message

**Conflict handling (locked decision):** Conflicting components across mixins are an error at assembly time. If mixin A and mixin B both define `health` with different values, the builder throws: `"Template 'goblin': component 'health' defined in multiple mixins ['base_enemy', 'physical']. Use 'overrides' to resolve."` The template author must use `overrides` to explicitly choose the value.

### Pattern 5: 2D Grid with Layered Tile Data

**What:** Single Grid object with flat array storage, per-tile property flags, and a spatial index synced from Position components.

```typescript
interface Tile {
  terrain: string;           // e.g., 'floor', 'wall', 'door'
  walkable: boolean;         // explicit flag, not derived
  transparent: boolean;      // for FOV in future phases
  entities: Set<EntityId>;   // entity layer (multi-occupancy)
  items: Set<EntityId>;      // item layer (multi-occupancy)
}

class Grid {
  private tiles: Tile[];
  private spatialIndex: Map<string, Set<EntityId>>; // "x,y" → entities

  constructor(public readonly width: number, public readonly height: number) {
    this.tiles = new Array(width * height);
    this.spatialIndex = new Map();
    // Initialize all tiles
  }

  getTile(x: number, y: number): Tile | undefined {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return undefined;
    return this.tiles[y * this.width + x];
  }

  isWalkable(x: number, y: number): boolean {
    return this.getTile(x, y)?.walkable ?? false;
  }

  getEntitiesAt(x: number, y: number): Set<EntityId> {
    return this.getTile(x, y)?.entities ?? new Set();
  }

  // Called when Position component changes
  moveEntity(entityId: EntityId, fromX: number, fromY: number, toX: number, toY: number): void {
    this.getTile(fromX, fromY)?.entities.delete(entityId);
    this.getTile(toX, toY)?.entities.add(entityId);
  }
}
```

**Component-authoritative positions (locked decision):** The Position component is the source of truth. The grid's spatial index is a derived data structure that must be kept in sync. Sync happens via the event bus: listen for COMPONENT_ADDED/COMPONENT_REMOVED on Position, or explicitly call `grid.moveEntity()` in the movement system after mutating Position.

### Pattern 6: System Registration with Phase Groups

```typescript
type SystemFn = (world: World) => void;

enum Phase {
  PRE_TURN = 'pre-turn',
  ACTION = 'action',
  POST_TURN = 'post-turn',
  RENDER = 'render',
}

interface SystemRegistry {
  register(phase: Phase, system: SystemFn): void;
  getSystemsForPhase(phase: Phase): SystemFn[];
}

// Registration order = execution order within phase
// Engine defines the phases; game registers systems into them
```

### Anti-Patterns to Avoid
- **Over-engineering ECS storage:** Don't build archetype tables, bitmasked queries, or component pooling. Map-of-Maps with <200 entities. Premature optimization is the primary risk.
- **Leaky engine boundary:** Engine files must never import from `game/`. Use `defineComponent` in `game/components/`, never in `engine/`.
- **Component classes with methods:** Components are POJOs. No `health.takeDamage()` methods. Systems operate on data.
- **Inheritance-based entities:** No `class Goblin extends Enemy`. Entities are IDs. Composition via templates.
- **String-based component access without type safety:** Always use `ComponentDef` keys, never raw strings in game code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Custom JSON validator | Zod v3 | Covers edge cases (nested objects, unions, defaults, transforms), derives TS types, clear error messages |
| Import boundary enforcement | Manual code review | eslint-plugin-import-x `no-restricted-paths` | Automated, catches violations at lint time, CI-enforceable |
| Code formatting | Style debates | Prettier | Zero-config consistency |
| Test framework | Custom assertion lib | Vitest | Watch mode, coverage, snapshot tests, rich matchers |

**Key insight:** Phase 1 has no complex library dependencies. The "don't hand-roll" list is short because most Phase 1 code IS the custom implementation (ECS, event bus, grid). The hand-rolled code is the deliverable.

## Common Pitfalls

### Pitfall 1: Over-Engineering the ECS
**What goes wrong:** Spending weeks on archetype storage, bitmasked queries, system dependency graphs before a single game system exists.
**Why it happens:** ECS design is intellectually compelling. There's always a "better" storage strategy.
**How to avoid:** Timebox to 2 days. Map-of-Maps storage. Build 3 real game systems before refactoring. Optimize for developer ergonomics (easy JSON composition), not runtime performance (irrelevant at <200 entities/turn).
**Warning signs:** >3 days on ECS core, TypeScript generics >3 levels deep, benchmarking before having 5 real components.

### Pitfall 2: Schema Drift in JSON Entity Templates
**What goes wrong:** JSON templates reference nonexistent component types or use wrong field names. Entity assembles "successfully" but is broken — goblin with `{ "helath": 10 }` (typo) has no health.
**Why it happens:** JSON has no compile-time type safety. Component shapes change but templates don't.
**How to avoid:** Zod validation at assembly time is mandatory (ECS-10). Component registry rejects unknown types with helpful errors. Integration test loads ALL templates and validates — catches drift in CI.
**Warning signs:** Entities behaving unexpectedly with no error output, `getComponent()` returning undefined for components that "should" exist.

### Pitfall 3: Leaky Engine/Game Boundary from Day One
**What goes wrong:** Engine code imports game component definitions, hardcodes component type strings, or references game concepts.
**Why it happens:** Faster to hardcode than abstract properly, especially under time pressure.
**How to avoid:** ESLint `import-x/no-restricted-paths` configured before writing any engine code. Run linter in CI. The engine uses generic types/interfaces; game implements them.
**Warning signs:** Any file in `src/engine/` importing from `src/game/`.

### Pitfall 4: Circular References in Entity Template Mixins
**What goes wrong:** Template A uses mixin B which uses mixin A, creating infinite resolution loop.
**Why it happens:** As template library grows, cross-references creep in.
**How to avoid:** Max mixin depth guard (3 levels). Track resolution stack and throw on cycles: `"Circular mixin reference: goblin → base_enemy → goblin"`.
**Warning signs:** Stack overflow during template resolution.

### Pitfall 5: Event Queue Infinite Loops
**What goes wrong:** Handler for event A emits event B, handler for B emits event A. Recursive flush never terminates.
**Why it happens:** Queued event delivery with recursive flush enables cascading events — a feature that can become a bug.
**How to avoid:** Max flush depth (10 iterations). Log warning when depth exceeded. Design events as "what happened" (past tense), not "what to do" (commands) — reduces circular chains.
**Warning signs:** Flush depth warning in development mode.

## Code Examples

### World API Surface (Verified from ARCHITECTURE.md + CONTEXT.md decisions)

```typescript
// src/engine/ecs/world.ts — minimal correct API
class World {
  createEntity(): EntityId;
  destroyEntity(id: EntityId): void;
  entityExists(id: EntityId): boolean;

  addComponent<T>(entity: EntityId, def: ComponentDef<T>, data: ComponentData<T>): void;
  removeComponent(entity: EntityId, def: ComponentDef<any>): void;
  getComponent<T>(entity: EntityId, def: ComponentDef<T>): ComponentData<T> | undefined;
  hasComponent(entity: EntityId, def: ComponentDef<any>): boolean;

  query(...defs: ComponentDef<any>[]): EntityId[];

  // System management
  registerSystem(phase: Phase, system: SystemFn): void;
  executeSystems(phase: Phase): void;
}
```

### ESLint Flat Config with Import Restrictions

```javascript
// eslint.config.js
import importPlugin from 'eslint-plugin-import-x';

export default [
  {
    plugins: {
      'import-x': importPlugin,
    },
    rules: {
      'import-x/no-restricted-paths': ['error', {
        zones: [
          {
            target: './src/engine/**',
            from: './src/game/**',
            message: 'Engine must not import from game layer.',
          },
          {
            target: './src/engine/**',
            from: './src/rendering/**',
            message: 'Engine must not import from rendering layer.',
          },
          {
            target: './src/engine/**',
            from: './src/network/**',
            message: 'Engine must not import from network layer.',
          },
          {
            target: './src/engine/**',
            from: './src/ui/**',
            message: 'Engine must not import from UI layer.',
          },
        ],
      }],
    },
  },
];
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@engine': './src/engine',
      '@game': './src/game',
    },
  },
});
```

### Entity Template Validation Flow

```typescript
// Builder validates each component in a template:
function buildEntity(world: World, template: RawTemplate, componentRegistry: ComponentRegistry): EntityId {
  // 1. Resolve mixins
  const resolved = resolveMixins(template, templateRegistry);

  // 2. Validate each component
  for (const [key, data] of Object.entries(resolved.components)) {
    const def = componentRegistry.get(key);
    if (!def) {
      throw new Error(`Template '${template.name}': unknown component '${key}'`);
    }
    const result = def.schema.safeParse(data);
    if (!result.success) {
      throw new Error(
        `Template '${template.name}', component '${key}': ${result.error.message}`
      );
    }
  }

  // 3. Create entity and add validated components
  const entity = world.createEntity();
  for (const [key, data] of Object.entries(resolved.components)) {
    const def = componentRegistry.get(key)!;
    world.addComponent(entity, def, def.schema.parse(data));
  }
  return entity;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| eslint-plugin-import for flat config | eslint-plugin-import-x | 2024 | eslint-plugin-import-x is the ESLint 9 flat config compatible fork; use it for new projects |
| Jest for TS testing | Vitest ^4.x | 2024-2025 | Native ESM/TS, faster, simpler config |
| Runtime type checking with io-ts | Zod v3 | 2023+ | Zod won the ecosystem; simpler API, better error messages, wider adoption |
| Class-based components | POJO components with Zod schemas | Current best practice | JSON composability, serialization, simplicity |

## Open Questions

1. **Query caching granularity**
   - What we know: Caching query results avoids repeated set intersections. Invalidation needed on component add/remove.
   - What's unclear: Whether the overhead of cache management is worth it at <200 entities. Simple query (intersect 2 maps) is microseconds.
   - Recommendation: Start without caching. Add it only if profiling shows query as a bottleneck. Keep the cache interface ready (invalidation hooks are already needed for event emission).

2. **Grid-Position sync mechanism**
   - What we know: Position component is authoritative. Grid spatial index must stay in sync.
   - What's unclear: Should sync happen via event bus (COMPONENT_ADDED for Position), or explicitly in movement system?
   - Recommendation: Use explicit sync in movement system for Phase 1 (simpler, fewer moving parts). Event-based sync can be added later when other systems need position-change awareness.

3. **Plan execution order**
   - What we know: ROADMAP.md lists Plan 01-04 (Project Scaffolding) last, but scaffolding is logically a prerequisite.
   - Recommendation: Planner should reorder so scaffolding executes first: 01-04 → 01-01 → 01-03 → 01-02 (scaffolding → ECS core → event bus + grid → entity composition pipeline, since entity composition depends on ECS + event bus + Zod).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` — Wave 0 gap (must be created) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ECS-01 | Entity create/destroy/query by ID | unit | `npx vitest run src/engine/ecs/world.test.ts -t "entity lifecycle"` | ❌ Wave 0 |
| ECS-02 | Component CRUD with O(1) lookup | unit | `npx vitest run src/engine/ecs/world.test.ts -t "component"` | ❌ Wave 0 |
| ECS-03 | System registration + ordering | unit | `npx vitest run src/engine/ecs/world.test.ts -t "system"` | ❌ Wave 0 |
| ECS-04 | Component-based queries | unit | `npx vitest run src/engine/ecs/world.test.ts -t "query"` | ❌ Wave 0 |
| ECS-05 | Lifecycle events emitted | unit | `npx vitest run src/engine/ecs/world.test.ts -t "event"` | ❌ Wave 0 |
| ECS-06 | JSON templates with component data | unit | `npx vitest run src/engine/entity/builder.test.ts -t "template"` | ❌ Wave 0 |
| ECS-07 | Builder assembles from templates | unit | `npx vitest run src/engine/entity/builder.test.ts -t "build"` | ❌ Wave 0 |
| ECS-08 | Registry stores/retrieves templates | unit | `npx vitest run src/engine/entity/registry.test.ts` | ❌ Wave 0 |
| ECS-09 | Factory stamps from registry | unit | `npx vitest run src/engine/entity/factory.test.ts` | ❌ Wave 0 |
| ECS-10 | Zod validation rejects malformed | unit | `npx vitest run src/engine/entity/builder.test.ts -t "validation"` | ❌ Wave 0 |
| EVT-01 | subscribe/emit/unsubscribe | unit | `npx vitest run src/engine/events/event-bus.test.ts -t "subscribe"` | ❌ Wave 0 |
| EVT-02 | Queued delivery + flush within turn | unit | `npx vitest run src/engine/events/event-bus.test.ts -t "queue"` | ❌ Wave 0 |
| EVT-03 | Game events in game layer | integration | `npx vitest run src/game/events/events.test.ts` | ❌ Wave 0 |
| GRID-01 | Grid with tile storage + index | unit | `npx vitest run src/engine/grid/grid.test.ts -t "storage"` | ❌ Wave 0 |
| GRID-02 | Walkability queries | unit | `npx vitest run src/engine/grid/grid.test.ts -t "walkable"` | ❌ Wave 0 |
| GRID-03 | Entity-at-position lookup | unit | `npx vitest run src/engine/grid/grid.test.ts -t "entity"` | ❌ Wave 0 |
| GRID-04 | Multi-layer tile data | unit | `npx vitest run src/engine/grid/grid.test.ts -t "layer"` | ❌ Wave 0 |
| ARCH-01 | Engine has zero game imports | lint | `npx eslint src/engine/` | ❌ Wave 0 |
| ARCH-02 | ESLint enforces boundary | lint | `npx eslint src/engine/` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green + ESLint clean before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — Vitest configuration (no existing test infrastructure)
- [ ] `eslint.config.js` — ESLint flat config with import restrictions
- [ ] `tsconfig.json` — TypeScript configuration (strict mode, path aliases)
- [ ] `package.json` — Project initialization with all Phase 1 dependencies
- [ ] `.prettierrc` — Prettier configuration
- [ ] All test files listed above — none exist yet (greenfield)

## Sources

### Primary (HIGH confidence)
- Project research documents: `.planning/research/ARCHITECTURE.md`, `FEATURES.md`, `PITFALLS.md`, `STACK.md`, `SUMMARY.md` — comprehensive project-level research already completed
- User decisions: `.planning/phases/01-ecs-core-data-foundation/01-CONTEXT.md` — locked architectural choices

### Secondary (MEDIUM confidence)
- Zod v3 API patterns: established TypeScript ecosystem library; `z.infer`, `safeParse`, schema composition are stable APIs
- eslint-plugin-import-x: ESLint 9 flat config compatible fork of eslint-plugin-import; `no-restricted-paths` rule API matches original
- Vitest v4: stable API, well-documented, Native ESM + TypeScript support

### Tertiary (LOW confidence)
- Specific eslint-plugin-import-x version compatibility with ESLint 9.x — verify at install time
- Exact `defineComponent` pattern ergonomics — may need refinement during implementation based on TypeScript inference behavior with Zod generics

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are established, versions verified in STACK.md research
- Architecture: HIGH — patterns derived from well-established ECS literature + project research documents + user decisions
- Pitfalls: HIGH — comprehensively documented in project PITFALLS.md; Phase 1-specific pitfalls are subset
- Validation: HIGH — Vitest for pure TS is straightforward; ESLint for boundary enforcement is well-understood

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (30 days — stack is stable, no fast-moving dependencies in Phase 1)
