# Requirements: Roguelike Dungeon Crawler Engine

**Defined:** 2026-03-13
**Core Value:** A solid, server-authoritative turn-based engine foundation where every player action is validated server-side while the client remains responsive through optimistic simulation.

## v1 Requirements

Requirements for engine core + tech demo. Each maps to roadmap phases.

### ECS & Entity Composition

- [ ] **ECS-01**: Engine provides entity lifecycle management (create, destroy, query by ID)
- [ ] **ECS-02**: Engine provides component CRUD (add, remove, get, has) with O(1) lookup
- [ ] **ECS-03**: Engine provides system registration with explicit execution ordering
- [ ] **ECS-04**: Engine provides component-based queries (find all entities with Position + Health)
- [ ] **ECS-05**: Engine emits entity lifecycle events (ENTITY_CREATED, ENTITY_DESTROYED, COMPONENT_ADDED, COMPONENT_REMOVED)
- [ ] **ECS-06**: Entity templates are defined in JSON with component data
- [ ] **ECS-07**: Entity builder assembles entities from JSON templates at runtime
- [ ] **ECS-08**: Entity registry stores named templates for lookup by type name
- [ ] **ECS-09**: Entity factory stamps entities from registered templates
- [ ] **ECS-10**: JSON entity templates are validated against Zod schemas at assembly time with clear error messages

### Event System

- [ ] **EVT-01**: Engine provides a typed event bus with subscribe/emit/unsubscribe
- [ ] **EVT-02**: Events are synchronous within a turn (handlers execute inline on emit)
- [ ] **EVT-03**: Game-specific event types are defined in game layer, not engine layer

### State Machine

- [ ] **FSM-01**: Engine provides a generic finite state machine with states, transitions, enter/exit hooks
- [ ] **FSM-02**: Game defines 5 states: Loading, MainMenu, Playing, Paused, GameOver
- [ ] **FSM-03**: Each state defines which systems execute (e.g., AI only runs in Playing)
- [ ] **FSM-04**: State transitions are validated (only defined transitions are allowed)

### Turn System

- [ ] **TURN-01**: Turn manager orchestrates phases: pre-turn → player action → enemy turns → post-turn → await input
- [ ] **TURN-02**: Nothing in the game world changes until the player acts
- [ ] **TURN-03**: Enemy turn order is deterministic (sorted by entity ID or energy value)
- [ ] **TURN-04**: Dead entities are skipped during enemy turn processing
- [ ] **TURN-05**: Energy/speed system determines turn frequency (fast entities act more often)
- [ ] **TURN-06**: Input is gated during turn processing and animations

### Grid & World

- [ ] **GRID-01**: Engine provides a 2D grid data structure with tile storage and spatial indexing
- [ ] **GRID-02**: Grid supports walkability queries per tile
- [ ] **GRID-03**: Grid supports entity-at-position lookups
- [ ] **GRID-04**: Grid supports multi-layer data (terrain layer, entity layer, item layer)

### Dungeon Generation

- [ ] **GEN-01**: Engine defines a generator interface (config + RNG → populated grid)
- [ ] **GEN-02**: Game implements BSP tree dungeon generation algorithm
- [ ] **GEN-03**: BSP generates rooms (min 3x3 interior), corridors, and doors
- [ ] **GEN-04**: Post-generation flood fill validates all rooms are reachable from player spawn
- [ ] **GEN-05**: Generation is seed-based (rot-js Alea PRNG) for reproducibility
- [ ] **GEN-06**: Generator places player spawn, enemy positions, and item locations
- [ ] **GEN-07**: Generation parameters are configurable (room size range, density, etc.)

### Movement & Input

- [ ] **MOV-01**: Player moves in cardinal directions (4-directional) on the grid
- [ ] **MOV-02**: Movement checks walkability and entity occupancy (collision)
- [ ] **MOV-03**: Moving into an enemy tile triggers combat (bump-to-attack)
- [ ] **INP-01**: Input system maps keyboard events to semantic actions (ArrowUp → MOVE_NORTH)
- [ ] **INP-02**: Action map is rebindable
- [ ] **INP-03**: Browser default key behaviors are suppressed (arrow key scrolling)

### Combat

- [ ] **CMB-01**: Basic attack resolution: attacker's attack vs defender's defense → damage (minimum 1)
- [ ] **CMB-02**: Health component tracks current and max HP
- [ ] **CMB-03**: Entity death triggers cleanup (remove from grid, destroy entity, emit ENTITY_DIED)
- [ ] **CMB-04**: Death may trigger loot drop (item entity placed on ground)

### AI

- [ ] **AI-01**: Enemies have behavior states: idle, chasing, attacking
- [ ] **AI-02**: Enemies only chase when they can see the player (FOV-aware)
- [ ] **AI-03**: Enemies pathfind toward the player using rot-js A*
- [ ] **AI-04**: Enemies bump-to-attack when adjacent to the player

### Items

- [ ] **ITEM-01**: Items are entities on the grid with an Item component
- [ ] **ITEM-02**: Player can pick up items by walking over them
- [ ] **ITEM-03**: Immediate-effect items apply on pickup (e.g., health potion heals)

### Rendering

- [ ] **RND-01**: PixiJS Application mounts independently to a canvas element (not through React reconciler)
- [ ] **RND-02**: Tile rendering uses @pixi/tilemap CompositeTilemap for batched GPU rendering
- [ ] **RND-03**: Render system maintains a strict Map<EntityId, DisplayObject> for sprite tracking
- [ ] **RND-04**: Entity destruction triggers display object cleanup (remove from container, destroy, delete from map)
- [ ] **RND-05**: Tilemap is built once at generation time, not rebuilt per turn
- [ ] **RND-06**: Layer ordering: terrain → items → entities → effects
- [ ] **RND-07**: Camera viewport is centered on the player entity; map scrolls around a fixed center
- [ ] **RND-08**: Viewport culling: only tiles within the camera view are submitted to the renderer
- [ ] **RND-09**: FOV rendering shows three visibility states: visible (full), explored (dimmed), hidden (black)
- [ ] **RND-10**: Entities are only visible when their tile is in the player's current FOV
- [ ] **RND-11**: Smooth movement tweens between tiles (~100ms lerp)
- [ ] **RND-12**: Attack animations (sprite shake/flash on hit)
- [ ] **RND-13**: Death animations (fade out)
- [ ] **RND-14**: Smooth camera lerp when player moves (instead of snap)

### Server Authority

- [ ] **SRV-01**: Client sends action intents to Next.js API route via HTTP POST
- [ ] **SRV-02**: Server validates all player actions (movement, attack, item pickup) against authoritative state
- [ ] **SRV-03**: Server processes enemy turns during the player action request
- [ ] **SRV-04**: Server returns full authoritative state snapshot after each action
- [ ] **SRV-05**: Client applies optimistic visual updates before server responds (sprite position only)
- [ ] **SRV-06**: Client replaces full state with server snapshot on response (full-state-replace reconciliation)
- [ ] **SRV-07**: Irreversible side effects (death, messages, inventory changes) wait for server confirmation
- [ ] **SRV-08**: Action pipeline is a pure function usable both client-side (local) and server-side (API route)

### UI

- [ ] **UI-01**: Engine systems write to zustand stores (vanilla API, no React hooks in engine)
- [ ] **UI-02**: React UI layer reads from zustand stores and re-renders reactively
- [ ] **UI-03**: HUD displays player health and basic stats
- [ ] **UI-04**: Scrollable message log shows combat events, pickups, and system messages
- [ ] **UI-05**: Main menu screen with "Start Game" action
- [ ] **UI-06**: Game over screen with restart option

### Architecture

- [ ] **ARCH-01**: Engine code never imports from game, rendering, network, or UI directories
- [ ] **ARCH-02**: ESLint import/no-restricted-paths enforces engine/game boundary from first commit
- [ ] **ARCH-03**: game/setup.ts is the sole wiring point between engine and game
- [ ] **ARCH-04**: Shared types (action payloads, state snapshots) live in a shared/ directory used by both client and server

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Extended Gameplay

- **V2-01**: 8-directional movement
- **V2-02**: Inventory & equipment system (slots, equip/unequip, stat modifiers)
- **V2-03**: Ability / targeting system (ranged attacks, AoE, target selection UI)
- **V2-04**: Status effect system (poison, stun, buffs with duration tracking)
- **V2-05**: Interaction system (doors open/close, locked doors, chests, stairs)
- **V2-06**: Multiple dungeon floors with level transitions

### Extended Generation

- **V2-07**: Alternative generation algorithms (cellular automata, drunkard's walk, WFC)
- **V2-08**: Themed tilesets per dungeon level
- **V2-09**: Difficulty scaling across floors

### Extended Infrastructure

- **V2-10**: Save / load system (full ECS serialization)
- **V2-11**: Audio system
- **V2-12**: Debug / inspector tools (entity viewer, FOV overlay, pathfinding overlay)
- **V2-13**: Minimap
- **V2-14**: Particle effects (@pixi/particle-emitter integration)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multiplayer | Server validation is for anti-cheat in single-player only |
| Mobile / touch input | Desktop web only for v1 |
| Reusable engine package | Engine is an architectural boundary, not a distributable library |
| Character classes / races | Game content, not engine systems — use JSON entity templates |
| Skill trees / talents | Game content layered on stat system — not engine concern |
| Quest / objective system | Game content — not relevant to tech demo |
| Dialogue / NPC system | Game content — no NPCs in tech demo |
| Crafting system | Game content feature |
| Item modifiers / enchantments | Complex content feature — items are simple for v1 |
| Meta-progression / roguelite unlocks | Not building a roguelite — each run is self-contained |
| Modding API / plugin system | JSON entity definitions provide sufficient extensibility |
| Replay system | Not needed to validate engine |
| Accessibility (screen reader, high contrast) | Important but post-v1 polish |
| Localization / i18n | No meaningful user-facing text in tech demo |
| Tutorial / onboarding | Tech demo audience is the developer |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ECS-01 through ECS-10 | TBD | Pending |
| EVT-01 through EVT-03 | TBD | Pending |
| FSM-01 through FSM-04 | TBD | Pending |
| TURN-01 through TURN-06 | TBD | Pending |
| GRID-01 through GRID-04 | TBD | Pending |
| GEN-01 through GEN-07 | TBD | Pending |
| MOV-01 through MOV-03 | TBD | Pending |
| INP-01 through INP-03 | TBD | Pending |
| CMB-01 through CMB-04 | TBD | Pending |
| AI-01 through AI-04 | TBD | Pending |
| ITEM-01 through ITEM-03 | TBD | Pending |
| RND-01 through RND-14 | TBD | Pending |
| SRV-01 through SRV-08 | TBD | Pending |
| UI-01 through UI-06 | TBD | Pending |
| ARCH-01 through ARCH-04 | TBD | Pending |

**Coverage:**
- v1 requirements: 67 total
- Mapped to phases: 0
- Unmapped: 67 ⚠️

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after initialization*
