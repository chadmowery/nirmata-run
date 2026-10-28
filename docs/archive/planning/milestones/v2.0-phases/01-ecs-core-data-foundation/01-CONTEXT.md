# Phase 1: ECS Core & Data Foundation - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Engine data backbone and entity composition pipeline work end-to-end with zero browser dependencies. Delivers: ECS core (world, entities, components, systems, queries), event bus, 2D grid, entity composition pipeline (builder/registry/factory with JSON templates + Zod validation), and architecture enforcement via ESLint boundary rules. Pure TypeScript + Vitest.

</domain>

<decisions>
## Implementation Decisions

### Entity Template Composability
- Mixin composition model — templates list mixin names that get merged (e.g. `"mixins": ["physical", "combatant", "ai_basic"]`)
- Conflicting components across mixins are an error at assembly time — forces explicit resolution
- Templates use an `overrides` block to customize values from their mixins (e.g. `"overrides": { "Health": { "max": 50 } }`)
- Templates and mixins share the same JSON format — any template can be referenced as a mixin

### Component Mutability & Access
- Mutable references — systems get the actual component object and mutate it directly
- No change tracking — systems read current state each tick, no dirty flags or auto-detection
- Components are plain objects (POJOs) at runtime — simple, serializable, Zod-validatable
- Components are identified by symbol/class-reference keys for type-safe access (e.g. `world.getComponent(entity, Position)`)

### Grid Tile Data Model
- Per-tile property flags — each tile stores explicit flags (walkable, transparent, etc.) rather than deriving from terrain type
- Unified grid with layered tile data — single grid object, tile has terrain/entities/items layers accessible via one lookup
- Component-authoritative positions — Position component is the truth; grid spatial index is synced from Position components
- Multi-occupancy per layer — multiple entities can share a tile on the same layer (e.g. multiple items on the floor)

### Event System
- Engine auto-emits lifecycle events only (ENTITY_CREATED, ENTITY_DESTROYED, COMPONENT_ADDED, COMPONENT_REMOVED)
- Game systems emit domain events explicitly (DAMAGE_DEALT, ENTITY_DIED, etc.)
- Queued event delivery with end-of-turn flush — events are collected and processed after all systems complete
- Generic type map for type safety — `EventBus<{ ENTITY_CREATED: EntityEvent, DAMAGE_DEALT: DamageEvent }>` with autocomplete

### System Ordering Model
- Named phase groups — systems are registered into engine-defined phases (pre-turn, action, post-turn, render)
- Within a phase, registration order = execution order
- Phases are engine-defined — game registers systems into fixed phases, not custom ones
- Systems are pure functions: `(world) => void` — stateless, all data lives in components
- Game state machine controls system activation — Playing state runs all game systems, Paused skips AI/input, etc.

### Claude's Discretion
- Entity ID scheme (auto-incrementing integers vs UUIDs)
- Query API shape (return type, iteration style)
- Zod validation strategy (schema per component, registry approach)
- Internal data structures for component storage and query indexing

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User deferred all technical implementation details to Claude's discretion beyond the decisions captured above.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing application code — greenfield project

### Established Patterns
- No codebase patterns yet — Phase 1 establishes the foundational patterns

### Integration Points
- Research documents available in `.planning/research/` covering architecture, features, pitfalls, and stack decisions
- Architecture research defines the 4-layer system (Platform → Engine → Game → Presentation) with strict downward-only dependencies

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-ecs-core-data-foundation*
*Context gathered: 2026-03-13*
