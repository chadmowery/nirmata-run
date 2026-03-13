# Phase 3: Rendering & Camera - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

PixiJS renders the game world with tile-based maps, entity sprites, camera tracking, FOV, and animations. First browser/canvas work. Delivers: PixiJS application mounting, CompositeTilemap rendering with layer ordering, camera viewport centered on player with smooth lerp, FOV with visible/explored/hidden states, movement/attack/death animations, and sprite lifecycle management (EntityId → DisplayObject tracking with cleanup on destroy). Builds on Phase 1 ECS + grid and Phase 2 game loop + turn system.

</domain>

<decisions>
## Implementation Decisions

### Tile Size & Visual Approach
- 32×32 pixel tiles — balanced detail and visibility
- Geometric placeholder sprites — simple shapes (circles, triangles, squares) with flat colors, not ASCII symbols
- Static PNG spritesheet committed to repo — hand-drawn minimal PNGs loaded via PixiJS Assets
- Medium viewport (~960×640, 30×20 tiles visible) — enough dungeon context without feeling sprawling
- Spritesheet is the single swap point for upgrading to real art later

### FOV Radius & Explored Feel
- 8-tile FOV radius — classic roguelike balance of planning and surprise
- Shadowcast algorithm (rot-js PreciseShadowcasting) for circular, natural-looking FOV that handles corners and walls
- Heavy dim (30% brightness) for explored-but-not-visible tiles — dark but terrain is readable
- Distance-based brightness gradient within FOV — tiles near FOV edge are dimmer than tiles near the player
- Walls at FOV boundary are visible — player can see what's blocking their view
- Hidden (never-explored) tiles are solid black — zero information about unexplored areas
- Items stay visible on explored tiles (dimmed like terrain) — helps player remember loot locations
- Enemies are NOT shown on explored tiles — only visible when in current FOV

### Animation & Camera Feel
- Tight camera follow (~50ms fast lerp) — responsive, direct control feel
- State updates instantly; animations are purely cosmetic — no input gating during animations, fastest possible response
- Attack animation: red tint on defender + attacker lunges slightly toward target — dramatic, clear feedback
- Death animation: quick fade to transparent over ~300ms — clean and quick removal
- Movement lerp ~100ms between tiles (per requirements)

### Entity Visual Identity
- Player: colored circle (bright, distinct color like blue or green) — immediately identifiable
- Enemies: different geometric shapes per type (triangle, square, hexagon, etc.) — shape = identity
- Items: simple iconic shapes (plus sign for health potion, star for powerup, etc.) — descriptive at a glance
- Terrain: dark gray floor, lighter solid walls, distinct color for doors — high contrast between walkable and non-walkable

### Claude's Discretion
- Specific color palette choices (exact hex values for player, enemies, terrain)
- Camera lerp easing function
- PixiJS Application configuration details (antialias, background color, resolution)
- Spritesheet layout and sprite naming conventions
- FOV update scheduling (every move vs dirty flag)
- Exact brightness values for the distance gradient within FOV
- CompositeTilemap configuration and batching strategy

</decisions>

<specifics>
## Specific Ideas

- Distance-based brightness gradient within FOV is a notable visual polish choice — tiles aren't uniformly bright within the visible radius, creating a natural "light falloff" effect
- Attacker lunge animation adds directionality to combat — the attacker briefly shifts toward the target before snapping back
- Items persisting on explored tiles (while enemies don't) is a deliberate asymmetry — static objects are remembered, mobile ones aren't

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing application code — greenfield project (Phases 1-2 not yet executed)

### Established Patterns (from Phase 1-2 decisions)
- Systems are pure functions: `(world) => void` registered into named phase groups including "render"
- Position component is authoritative; grid spatial index synced from Position components
- Grid has terrain/entities/items layers accessible via one lookup
- FSM controls system activation — rendering always runs regardless of game state
- Queued event delivery with end-of-turn flush
- Components are mutable POJOs
- Energy/speed system with accumulate-to-threshold model (Phase 2)
- Bump-to-attack triggered by moving into hostile entity tile (Phase 2)

### Integration Points
- Phase 1 grid data (tile terrain types, walkability, entity positions) drives what gets rendered
- Phase 1 ECS queries (entities with Position + Sprite components) determine what sprites to create/update
- Phase 1 event bus (ENTITY_CREATED, ENTITY_DESTROYED, COMPONENT_ADDED, COMPONENT_REMOVED) triggers sprite lifecycle
- Phase 2 game state machine controls rendering behavior (e.g., what to show in MainMenu vs Playing)
- Phase 2 movement/combat events trigger animation playback
- Research documents in `.planning/research/` covering architecture, features, pitfalls, and stack decisions

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-rendering-camera*
*Context gathered: 2026-03-13*
