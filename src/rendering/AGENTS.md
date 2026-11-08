# Rendering Layer (`src/rendering/`) — Architectural Rules & Guidelines

The Rendering layer provides the client-only 2D hardware-accelerated presentation pipeline using PixiJS 8 and WebGL.

## 1. Import Boundaries (Strictly Enforced)
- **Allowed Imports**: `@engine/*`, `@shared/*`, `@rendering/*`.
- **FORBIDDEN Imports**: `@server/*`, `@dev-tool/*`, Node.js server packages, authoritative simulation pipelines.

## 2. Core Architectural Mandates
1. **Simulation Decoupling (Read-Only Representation)**:
   - The renderer is purely a visual subscriber. It reads components from `World` and `Grid` and listens to `EventBus` signals.
   - **Never** mutate game state, dispatch combat intents, spawn gameplay entities, or advance turn numbers from within rendering systems.
2. **WebGL Scene Graph & Layer Hierarchy**:
   - Organized in strict visual depth:
     1. `Terrain Tilemap` (composite directional autotiles)
     2. `Prop Fixtures` & Environmental deco
     3. `Ground Loot` & Dropped containers
     4. `Actors` (Player, Hostiles, Summons)
     5. `Particle Emitters` & VFX meshes
     6. `Lighting & Fog-of-War Shader Overlays`
     7. `Post-Process Screen Shaders` (CRT, Bloom, Heat Glitch, Glitch Matrix)
3. **Filter & Resource Lifecycle Management**:
   - Any PixiJS filter attached to sprites must be tracked and properly disposed. When an entity dies or a sprite is removed from `EntitySpriteMap`, invoke cleanup to avoid WebGL texture/uniform memory leaks.
4. **Camera & Viewport Controls**:
   - `Camera` provides smooth lerp centering on the player actor.
   - Supports tactical optical zoom (levels 0.75x–2.0x), keyboard pan, and click-drag panning with boundaries clamped to grid extents.

## 3. Related Documentation
- [`TILEMAP_GUIDE.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/TILEMAP_GUIDE.md) — 32×32 tileset specifications, autotiling solvers, and atlas packing.
- [`SPRITE-ANIMATIONS.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/design/SPRITE-ANIMATIONS.md) — Single-atlas sprite animation runtime, state machine, FOV culling, and DevTool preview architecture.
- [`UI-DESIGN-SYSTEM.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/design/UI-DESIGN-SYSTEM.md) — Visual styling, color tokens, and CRT post-processing.
