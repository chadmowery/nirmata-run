# Phase 3: Rendering & Camera - Research

**Researched:** 2026-03-13
**Domain:** PixiJS v8 tile rendering, camera viewport, FOV/visibility, sprite animations, display object lifecycle
**Confidence:** HIGH

## Summary

Phase 3 introduces the first browser/canvas work: mounting PixiJS independently from React, rendering tile-based dungeon maps with batched GPU rendering via @pixi/tilemap's CompositeTilemap, implementing a player-centered camera with smooth lerp and viewport culling, FOV with three visibility states using rot-js PreciseShadowcasting, movement/attack/death animations via PixiJS ticker, and strict EntityId→DisplayObject lifecycle management.

The stack is fully decided (PixiJS v8.17, @pixi/tilemap v5.0.2, rot-js v2.2.1). The critical patterns are: PixiJS Application created as a singleton outside React's render tree, CompositeTilemap built once at dungeon generation and tinted per-tile for FOV, camera implemented by positioning a world container (not moving individual tiles), and entity sprites tracked in a `Map<EntityId, DisplayObject>` with cleanup driven by ECS lifecycle events.

**Primary recommendation:** Build rendering as four discrete layers (terrain tilemap, item container, entity container, effects container) inside a single world container whose position is the camera offset. FOV tinting and viewport culling operate on the CompositeTilemap's tile alpha values and camera bounds respectively.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- 32×32 pixel tiles — balanced detail and visibility
- Geometric placeholder sprites — simple shapes (circles, triangles, squares) with flat colors, not ASCII symbols
- Static PNG spritesheet committed to repo — hand-drawn minimal PNGs loaded via PixiJS Assets
- Medium viewport (~960×640, 30×20 tiles visible) — enough dungeon context without feeling sprawling
- Spritesheet is the single swap point for upgrading to real art later
- 8-tile FOV radius — classic roguelike balance
- Shadowcast algorithm (rot-js PreciseShadowcasting) for circular FOV
- Heavy dim (30% brightness) for explored-but-not-visible tiles
- Distance-based brightness gradient within FOV — tiles near edge dimmer
- Walls at FOV boundary are visible
- Hidden (never-explored) tiles are solid black
- Items stay visible on explored tiles (dimmed); enemies NOT shown on explored tiles
- Tight camera follow (~50ms fast lerp) — responsive feel
- State updates instantly; animations are purely cosmetic — no input gating during animations
- Attack: red tint on defender + attacker lunges toward target
- Death: quick fade to transparent over ~300ms
- Movement lerp ~100ms between tiles
- Player: colored circle; Enemies: different geometric shapes; Items: simple iconic shapes
- Terrain: dark gray floor, lighter solid walls, distinct color for doors

### Claude's Discretion
- Specific color palette choices (exact hex values)
- Camera lerp easing function
- PixiJS Application configuration details (antialias, background color, resolution)
- Spritesheet layout and sprite naming conventions
- FOV update scheduling (every move vs dirty flag)
- Exact brightness values for distance gradient within FOV
- CompositeTilemap configuration and batching strategy

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RND-01 | PixiJS Application mounts independently to a canvas element (not through React reconciler) | Application singleton pattern with `app.init({ canvas })`, guarded against React double-mount |
| RND-02 | Tile rendering uses @pixi/tilemap CompositeTilemap for batched GPU rendering | CompositeTilemap `.tile()` API, `.clear()` for rebuild, alpha option per tile |
| RND-03 | Render system maintains a strict Map<EntityId, DisplayObject> for sprite tracking | EntityId→DisplayObject map pattern with creation on ENTITY_CREATED, cleanup on ENTITY_DESTROYED |
| RND-04 | Entity destruction triggers display object cleanup (remove from container, destroy, delete from map) | Subscribe to ECS lifecycle events; `sprite.removeFromParent()`, `sprite.destroy()`, `map.delete(id)` |
| RND-05 | Tilemap is built once at generation time, not rebuilt per turn | Build tilemap in dungeon generation callback, only update tile alpha/tint for FOV changes |
| RND-06 | Layer ordering: terrain → items → entities → effects | Four Container children on worldContainer with addChild order = render order |
| RND-07 | Camera viewport centered on player entity; map scrolls around fixed center | Set worldContainer.position to `(viewportCenter - playerWorldPos)` each frame |
| RND-08 | Viewport culling: only tiles within camera view submitted to renderer | Compute visible tile range from camera offset, only `.tile()` visible tiles on CompositeTilemap |
| RND-09 | FOV: three visibility states — visible (full), explored (dimmed), hidden (black) | Per-tile alpha on CompositeTilemap: 1.0 visible, 0.3 explored, 0.0 hidden; explored tiles tracked in persistent Set |
| RND-10 | Entities only visible when tile is in player's current FOV | Check entity position against FOV Set; set `sprite.visible = fovSet.has(tileKey)` |
| RND-11 | Smooth movement tweens between tiles (~100ms lerp) | Ticker-based linear interpolation from previous grid position to current position |
| RND-12 | Attack animations (sprite shake/flash on hit) | Red tint (`sprite.tint = 0xFF0000`) + position offset lunge toward target, reset after ~150ms |
| RND-13 | Death animations (fade out) | Animate `sprite.alpha` from 1→0 over ~300ms, then destroy |
| RND-14 | Smooth camera lerp when player moves | Lerp worldContainer.position toward target offset each tick, ~50ms fast lerp factor |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pixi.js | ^8.17.0 | 2D rendering engine — Application, Container, Sprite, Graphics, Ticker | WebGL2/WebGPU dual renderer, async init pattern, built-in ticker for game loop |
| @pixi/tilemap | ^5.0.2 | Batched GPU tilemap rendering | CompositeTilemap renders all tiles in 1-2 draw calls vs 1 per tile; v5.x is PixiJS v8 compatible |
| rot-js | ^2.2.1 | FOV computation (PreciseShadowcasting) | Standard roguelike FOV algorithm, TypeScript-native, tree-shakeable ES modules |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pixi.js (Assets) | ^8.17.0 | Spritesheet/texture loading | Load the PNG spritesheet at game init via Assets.load() |
| pixi.js (Graphics) | ^8.17.0 | Dynamic geometric shapes | Fallback for programmatic sprite generation if needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CompositeTilemap | Individual Sprites per tile | 100-1000x worse GPU utilization; unacceptable at 600+ tiles |
| PreciseShadowcasting | RecursiveShadowcasting | RecursiveShadowcasting supports 90°/180° partial views but PreciseShadowcasting gives better visibility gradients (0..1 fractional visibility values per cell) which directly maps to distance-based brightness |
| Ticker-based tweens | Animation library (gsap, etc.) | External dependency unnecessary; PixiJS Ticker + simple lerp math covers all animation needs for this phase |
| PNG spritesheet | Graphics API (runtime shapes) | PNG is the locked decision — single swap point for real art. Graphics API as fallback only |

**Installation:**
```bash
npm install pixi.js@^8.17.0 @pixi/tilemap@^5.0.2 rot-js@^2.2.1
```

## Architecture Patterns

### Recommended Rendering Structure

```
app.stage (PixiJS root)
└── worldContainer (Container) ← camera offset applied here
    ├── terrainLayer (CompositeTilemap) ← built once, alpha updated for FOV
    ├── itemLayer (Container) ← item Sprites, visible when tile explored
    ├── entityLayer (Container) ← entity Sprites, visible only in current FOV
    └── effectsLayer (Container) ← animation effects, particles (future)
```

**Key insight:** Camera movement = translating `worldContainer.position`. All children (tiles, items, entities) move together. No per-tile position updates needed for camera.

### Pattern 1: PixiJS Application Singleton (Outside React)

**What:** Create PixiJS Application as a module-level singleton, not inside React lifecycle.
**When to use:** Always — this is the only correct mount pattern.

```typescript
// rendering/renderer.ts — NOT inside a React component
import { Application } from 'pixi.js';

let app: Application | null = null;

export async function initRenderer(canvas: HTMLCanvasElement): Promise<Application> {
  if (app) return app; // Guard against React Strict Mode double-mount
  app = new Application();
  await app.init({
    canvas,
    width: 960,
    height: 640,
    backgroundColor: 0x000000,
    antialias: false,    // Pixel art — no antialiasing
    resolution: 1,
    preference: 'webgl',
  });
  return app;
}

export function destroyRenderer(): void {
  if (!app) return;
  app.destroy(true, { children: true, texture: false, textureSource: false });
  app = null;
}

export function getApp(): Application | null {
  return app;
}
```

React component only provides DOM mount point:
```typescript
// ui/components/GameCanvas.tsx
function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    initRenderer(canvasRef.current);
    return () => destroyRenderer();
  }, []);
  return <canvas ref={canvasRef} />;
}
```

### Pattern 2: CompositeTilemap — Build Once, Tint for FOV

**What:** Build the full dungeon tilemap once at generation time. Update only per-tile alpha for FOV changes.
**When to use:** When grid/dungeon is generated or regenerated.

```typescript
import { CompositeTilemap } from '@pixi/tilemap';

function buildTilemap(
  grid: Grid,
  tilemap: CompositeTilemap,
  fovSet: Set<string>,
  exploredSet: Set<string>,
): void {
  tilemap.clear();

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const key = `${x},${y}`;
      const tile = grid.getTile(x, y);

      // Determine visibility alpha
      let alpha: number;
      if (fovSet.has(key)) {
        // Distance-based gradient within FOV
        alpha = computeFovAlpha(x, y, playerX, playerY, fovRadius);
      } else if (exploredSet.has(key)) {
        alpha = 0.3; // Heavy dim for explored
      } else {
        alpha = 0.0; // Hidden = black (skip tile entirely)
      }

      if (alpha <= 0) continue; // Don't submit hidden tiles

      const textureName = tileTextureMap[tile.terrain]; // 'floor.png', 'wall.png', etc.
      tilemap.tile(textureName, x * TILE_SIZE, y * TILE_SIZE, { alpha });
    }
  }
}
```

**Note:** `CompositeTilemap.tile()` accepts an `alpha` option per tile. This is how FOV dimming works — no filters or separate overlay needed.

### Pattern 3: Camera Viewport Centering

**What:** Center camera on player by offsetting the world container.
**When to use:** Every frame (in ticker callback).

```typescript
const VIEWPORT_W = 960;
const VIEWPORT_H = 640;
const TILE_SIZE = 32;

function updateCamera(
  worldContainer: Container,
  playerX: number, // grid x
  playerY: number, // grid y
  dt: number,      // delta time in ms
): void {
  const targetX = VIEWPORT_W / 2 - playerX * TILE_SIZE - TILE_SIZE / 2;
  const targetY = VIEWPORT_H / 2 - playerY * TILE_SIZE - TILE_SIZE / 2;

  // Fast lerp (~50ms feel with lerp factor)
  const lerpFactor = 1 - Math.pow(0.001, dt / 1000); // ~50ms response
  worldContainer.x += (targetX - worldContainer.x) * lerpFactor;
  worldContainer.y += (targetY - worldContainer.y) * lerpFactor;
}
```

**Viewport culling:** Before rebuilding the tilemap each FOV update, compute the visible tile range:
```typescript
function getVisibleTileRange(cameraX: number, cameraY: number) {
  const startX = Math.floor(-cameraX / TILE_SIZE) - 1;
  const startY = Math.floor(-cameraY / TILE_SIZE) - 1;
  const endX = startX + Math.ceil(VIEWPORT_W / TILE_SIZE) + 2;
  const endY = startY + Math.ceil(VIEWPORT_H / TILE_SIZE) + 2;
  return { startX, startY, endX, endY };
}
```

### Pattern 4: FOV Computation with rot-js

**What:** Use PreciseShadowcasting for 360° FOV with fractional visibility values.
**When to use:** After every player movement.

```typescript
import PreciseShadowcasting from 'rot-js/lib/fov/precise-shadowcasting';

const FOV_RADIUS = 8;

function computeFov(
  playerX: number,
  playerY: number,
  lightPasses: (x: number, y: number) => boolean,
  exploredSet: Set<string>,
): Set<string> {
  const visibleSet = new Set<string>();
  const fov = new PreciseShadowcasting(lightPasses);

  fov.compute(playerX, playerY, FOV_RADIUS, (x, y, r, visibility) => {
    if (visibility > 0) {
      const key = `${x},${y}`;
      visibleSet.add(key);
      exploredSet.add(key); // Mark as explored permanently
    }
  });

  return visibleSet;
}
```

**lightPasses callback:** Reads from grid terrain data — walls block light, floors pass:
```typescript
function lightPasses(x: number, y: number): boolean {
  const tile = grid.getTile(x, y);
  return tile !== undefined && tile.terrain !== TileType.Wall;
}
```

**Distance-based brightness:** The `r` parameter in the FOV callback is the distance. Use it for gradient:
```typescript
function computeFovAlpha(x: number, y: number, px: number, py: number, radius: number): number {
  const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
  // Full brightness at center, dimming toward edge
  return Math.max(0.5, 1.0 - (dist / radius) * 0.5);
}
```

### Pattern 5: EntityId→DisplayObject Tracking Map

**What:** Strict 1:1 mapping between ECS entities and PixiJS display objects.
**When to use:** Core rendering infrastructure — established before first sprite.

```typescript
const entitySprites = new Map<EntityId, Container>(); // Container to allow children (health bars, etc.)

// On ENTITY_CREATED (with Sprite component)
function onEntityCreated(entityId: EntityId, spriteKey: string): void {
  const texture = Assets.get(spriteKey); // From loaded spritesheet
  const sprite = new Sprite(texture);
  sprite.width = TILE_SIZE;
  sprite.height = TILE_SIZE;
  entityLayer.addChild(sprite);
  entitySprites.set(entityId, sprite);
}

// On ENTITY_DESTROYED
function onEntityDestroyed(entityId: EntityId): void {
  const sprite = entitySprites.get(entityId);
  if (!sprite) return;
  sprite.removeFromParent();
  sprite.destroy({ children: true });
  entitySprites.delete(entityId);
}
```

**Debug check:** After each turn, verify `world.query('sprite').length === entitySprites.size`. If they diverge, there's a sprite leak.

### Pattern 6: Ticker-Based Animation System

**What:** Simple animation state machine driven by PixiJS ticker for movement, attack, and death.
**When to use:** After state updates, to animate visual transitions.

```typescript
interface TweenAnimation {
  entityId: EntityId;
  type: 'move' | 'attack' | 'death';
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  elapsed: number;
  duration: number; // ms
  onComplete?: () => void;
}

const activeAnimations: TweenAnimation[] = [];

function tickAnimations(deltaMS: number): void {
  for (let i = activeAnimations.length - 1; i >= 0; i--) {
    const anim = activeAnimations[i];
    anim.elapsed += deltaMS;
    const t = Math.min(anim.elapsed / anim.duration, 1);

    const sprite = entitySprites.get(anim.entityId);
    if (!sprite) { activeAnimations.splice(i, 1); continue; }

    if (anim.type === 'move') {
      sprite.x = anim.startX + (anim.targetX - anim.startX) * t;
      sprite.y = anim.startY + (anim.targetY - anim.startY) * t;
    } else if (anim.type === 'death') {
      sprite.alpha = 1 - t;
    }

    if (t >= 1) {
      anim.onComplete?.();
      activeAnimations.splice(i, 1);
    }
  }
}

// Register with PixiJS ticker
app.ticker.add((ticker) => {
  tickAnimations(ticker.deltaMS);
  updateCamera(worldContainer, playerX, playerY, ticker.deltaMS);
});
```

**Attack animation pattern:** Lunge toward target + red tint:
```typescript
function playAttackAnimation(attackerId: EntityId, targetX: number, targetY: number): void {
  const sprite = entitySprites.get(attackerId);
  if (!sprite) return;

  const origX = sprite.x;
  const origY = sprite.y;
  const lungeX = origX + (targetX * TILE_SIZE - origX) * 0.3; // 30% lunge toward target
  const lungeY = origY + (targetY * TILE_SIZE - origY) * 0.3;

  // Lunge forward (first half)
  activeAnimations.push({
    entityId: attackerId, type: 'attack',
    startX: origX, startY: origY,
    targetX: lungeX, targetY: lungeY,
    elapsed: 0, duration: 75,
    onComplete: () => {
      // Snap back (second half)
      activeAnimations.push({
        entityId: attackerId, type: 'move',
        startX: lungeX, startY: lungeY,
        targetX: origX, targetY: origY,
        elapsed: 0, duration: 75,
      });
    },
  });
}

function playHitFlash(defenderId: EntityId): void {
  const sprite = entitySprites.get(defenderId);
  if (!sprite) return;
  sprite.tint = 0xFF0000; // Red tint
  setTimeout(() => { if (!sprite.destroyed) sprite.tint = 0xFFFFFF; }, 150);
}
```

### Anti-Patterns to Avoid

- **Rendering game through React reconciler:** Never use `@pixi/react` Stage/Container/Sprite for game scene. ECS owns the scene graph. React = DOM overlay only.
- **Creating Application in useEffect:** Application must be a singleton created outside React lifecycle. Guard against double-init for React Strict Mode.
- **Sprite-per-tile rendering:** Never create individual Sprite objects for terrain tiles. CompositeTilemap batches all tiles into 1-2 draw calls.
- **Polling for entity changes:** Subscribe to ECS lifecycle events (ENTITY_CREATED, ENTITY_DESTROYED). Don't diff entity lists each frame.
- **Moving individual tile positions for camera:** Move the worldContainer, not individual tiles. Camera = container position offset.
- **Rebuilding tilemap every frame:** Build once at generation. Only update tile alpha values for FOV changes (clear + rebuild the CompositeTilemap tiles with new alpha values when FOV changes).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FOV/shadowcasting | Custom raycasting algorithm | rot-js PreciseShadowcasting | Handles edge cases (corners, thin walls, diagonal visibility) correctly. Custom implementations invariably have artifacts. |
| Batched tile rendering | Individual Sprite objects per tile | @pixi/tilemap CompositeTilemap | GPU batching yields 100-1000x performance. Individual sprites create one draw call each. |
| Animation easing library | Full tween engine (gsap, animejs) | PixiJS Ticker + simple lerp | All animations are simple linear interpolations. A full tween library adds dependency for math that's 3 lines of code. |
| Texture/asset loading | Custom image loading | PixiJS Assets API | Handles spritesheet parsing, GPU upload, caching, retry. |

## Common Pitfalls

### Pitfall 1: React Strict Mode Double-Mount Creates Two PixiJS Applications
**What goes wrong:** In dev mode, React 19 runs effects twice. Two PixiJS Applications are created, exhausting WebGL contexts.
**Why it happens:** PixiJS init in useEffect without singleton guard.
**How to avoid:** Module-level singleton pattern with `if (app) return app;` guard. Application created outside React's render tree.
**Warning signs:** Two canvases visible, "CONTEXT_LOST_WEBGL" errors, game running at double speed.

### Pitfall 2: Display Object Leaks — Zombie Sprites After Entity Death
**What goes wrong:** ECS entity destroyed but PixiJS sprite remains in scene graph. GPU memory grows, dead sprites render.
**Why it happens:** No subscription to ENTITY_DESTROYED event in render system.
**How to avoid:** Strict `Map<EntityId, DisplayObject>` tracking. On ENTITY_DESTROYED: `removeFromParent()`, `destroy({ children: true })`, `map.delete(id)`. Add debug assertion comparing map size to ECS sprite query count.
**Warning signs:** Entity count doesn't match sprite count, memory grows over time.

### Pitfall 3: FOV Tilemap Rebuild Performance
**What goes wrong:** Rebuilding the full CompositeTilemap every turn (clear + re-tile entire dungeon) causes frame drops.
**Why it happens:** The dungeon may have 2000+ tiles but only 600 are visible.
**How to avoid:** Combine viewport culling with FOV: only submit tiles within the camera viewport range to CompositeTilemap. Hidden tiles (alpha=0) are skipped entirely. Typical submit count: 600-700 tiles vs 2000+.
**Warning signs:** Frame time spikes on player movement.

### Pitfall 4: Camera Lerp Causes Jitter at Fractional Pixel Positions
**What goes wrong:** Smooth camera lerp produces sub-pixel container positions, causing tile rendering artifacts (gaps between tiles, blurry edges).
**Why it happens:** CompositeTilemap renders at fractional pixel offsets.
**How to avoid:** Round worldContainer.x and worldContainer.y to nearest integer pixel after lerp calculation. `worldContainer.x = Math.round(lerpedX);`
**Warning signs:** Visible seams between tiles, slight blur on tile edges.

### Pitfall 5: FOV Explored Set Grows Unbounded Across Dungeons
**What goes wrong:** The explored tile Set persists across dungeon regeneration, causing tiles from the previous dungeon to show as "explored" in the new dungeon.
**Why it happens:** exploredSet not cleared on dungeon regeneration.
**How to avoid:** Clear exploredSet when a new dungeon is generated. Tie explored state to the dungeon lifecycle, not the game lifecycle.
**Warning signs:** Phantom explored tiles at positions that should be hidden in a new dungeon.

### Pitfall 6: Animation and State Update Ordering
**What goes wrong:** Animations reference stale entity positions because the render system reads position data before the movement system updates it, or vice versa.
**Why it happens:** System execution ordering not specified correctly.
**How to avoid:** System ordering: game systems (movement, combat) run first → render sync system reads final positions and queues animations → ticker ticks animations. The render system captures "previous position" before movement and "new position" after to create movement tweens.
**Warning signs:** Sprites teleport to new positions before animation plays, or animate to wrong positions.

## Code Examples

### Asset Loading with PixiJS Assets
```typescript
import { Assets } from 'pixi.js';

// In game's Loading state (FSM)
async function loadAssets(): Promise<void> {
  // Add spritesheet manifest
  Assets.add({ alias: 'tileset', src: 'assets/tileset.json' });

  // Load all assets
  await Assets.load('tileset');

  // Textures now accessible by frame name
  // e.g., Assets.get('floor.png'), Assets.get('wall.png')
}
```

### Spritesheet JSON Format
```json
{
  "frames": {
    "floor.png": { "frame": { "x": 0, "y": 0, "w": 32, "h": 32 } },
    "wall.png": { "frame": { "x": 32, "y": 0, "w": 32, "h": 32 } },
    "door.png": { "frame": { "x": 64, "y": 0, "w": 32, "h": 32 } },
    "player.png": { "frame": { "x": 0, "y": 32, "w": 32, "h": 32 } },
    "enemy_triangle.png": { "frame": { "x": 32, "y": 32, "w": 32, "h": 32 } },
    "item_potion.png": { "frame": { "x": 64, "y": 32, "w": 32, "h": 32 } }
  },
  "meta": {
    "image": "tileset.png",
    "size": { "w": 128, "h": 64 },
    "scale": 1
  }
}
```

### Full Render System Skeleton
```typescript
// rendering/render-system.ts — ECS render system (pure function)
export function createRenderSystem(deps: RenderDeps) {
  const { worldContainer, entitySprites, app } = deps;

  // Layer setup
  const terrainLayer = new CompositeTilemap();
  const itemLayer = new Container();
  const entityLayer = new Container();
  const effectsLayer = new Container();

  worldContainer.addChild(terrainLayer, itemLayer, entityLayer, effectsLayer);

  return function renderSystem(world: World): void {
    // 1. Sync entity sprites with ECS
    const spriteEntities = world.query('position', 'sprite');
    for (const entityId of spriteEntities) {
      const pos = world.getComponent<Position>(entityId, 'position');
      const spriteComp = world.getComponent<SpriteComponent>(entityId, 'sprite');

      let displayObj = entitySprites.get(entityId);
      if (!displayObj) {
        // Create new sprite
        displayObj = new Sprite(Assets.get(spriteComp.key));
        displayObj.width = TILE_SIZE;
        displayObj.height = TILE_SIZE;
        entityLayer.addChild(displayObj);
        entitySprites.set(entityId, displayObj);
      }

      // Update position (if not currently animating)
      if (!hasActiveAnimation(entityId)) {
        displayObj.x = pos.x * TILE_SIZE;
        displayObj.y = pos.y * TILE_SIZE;
      }

      // Visibility gating: entities only visible in current FOV
      const key = `${pos.x},${pos.y}`;
      const isItem = world.hasComponent(entityId, 'item');
      if (isItem) {
        displayObj.visible = currentFov.has(key) || exploredSet.has(key);
        displayObj.alpha = currentFov.has(key) ? 1.0 : 0.3;
      } else {
        displayObj.visible = currentFov.has(key); // Enemies only in current FOV
      }
    }
  };
}
```

### rot-js PreciseShadowcasting — Verified API
```typescript
// Source: rot-js v2.2.1 official manual + source code
import PreciseShadowcasting from 'rot-js/lib/fov/precise-shadowcasting';

// Constructor: new PreciseShadowcasting(lightPasses, options?)
// lightPasses: (x: number, y: number) => boolean
// compute(x, y, R, callback)
// callback: (x: number, y: number, r: number, visibility: number) => void
//   - r = distance from origin (concentric ring number)
//   - visibility = 0..1 (fractional, 0 = fully blocked, 1 = fully visible)
//   - origin tile always gets callback(x, y, 0, 1)
//   - if origin tile blocks light, only origin is reported
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PixiJS v7 constructor options | PixiJS v8 `new Application()` + `await app.init()` | v8.0.0 (2024) | Must use async init, cannot pass options to constructor |
| `app.view` | `app.canvas` | v8.0.0 (2024) | `.view` is deprecated, use `.canvas` for the HTML canvas element |
| `updateTransform()` per frame | `onRender` callback | v8.0.0 (2024) | v8 no longer calls updateTransform every frame; use onRender for per-frame updates |
| @pixi/tilemap v4.x | @pixi/tilemap v5.x | v5.0.0 (2024) | v5.x required for PixiJS v8 compatibility |
| `addFrame()` on tilemap | `.tile()` method | @pixi/tilemap v3 | addFrame deprecated, use tile() |

**Deprecated/outdated:**
- `Application` constructor with options — use `new Application()` then `await app.init(options)`
- `app.view` — use `app.canvas`
- `Loader` class — use `Assets` API (PixiJS v8)
- `@pixi/tilemap` `addFrame()` — use `tile()`

## Open Questions

1. **CompositeTilemap partial update vs full rebuild**
   - What we know: `clear()` + re-tile is the documented pattern. No per-tile update API exists.
   - What's unclear: Whether clearing and re-adding only viewport tiles each FOV change is performant enough at 600-700 tiles.
   - Recommendation: Implement clear+rebuild for viewport tiles only. Profile. If too slow, maintain two CompositeTilemaps (one for terrain, one for FOV overlay).

2. **Spritesheet creation workflow**
   - What we know: Static PNGs committed to repo, loaded via Assets.
   - What's unclear: Whether to use @assetpack/core for build-time spritesheet packing or hand-create a single PNG + JSON manifest.
   - Recommendation: Hand-create for v1 (< 20 sprites). AssetPack for when sprite count grows.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | None — see Wave 0 (not yet created, Phases 1-2 not executed) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RND-01 | PixiJS Application mounts independently to canvas | manual-only | N/A — requires browser WebGL context | ❌ Manual |
| RND-02 | CompositeTilemap batched rendering | manual-only | N/A — requires WebGL | ❌ Manual |
| RND-03 | Map<EntityId, DisplayObject> tracking maintained | unit | `npx vitest run tests/rendering/entity-sprite-map.test.ts -x` | ❌ Wave 0 |
| RND-04 | Entity destruction triggers cleanup | unit | `npx vitest run tests/rendering/sprite-cleanup.test.ts -x` | ❌ Wave 0 |
| RND-05 | Tilemap built once at generation | unit (logic only) | `npx vitest run tests/rendering/tilemap-build.test.ts -x` | ❌ Wave 0 |
| RND-06 | Layer ordering correct | unit (structure) | `npx vitest run tests/rendering/layer-ordering.test.ts -x` | ❌ Wave 0 |
| RND-07 | Camera centers on player | unit | `npx vitest run tests/rendering/camera.test.ts -x` | ❌ Wave 0 |
| RND-08 | Viewport culling computes correct range | unit | `npx vitest run tests/rendering/viewport-culling.test.ts -x` | ❌ Wave 0 |
| RND-09 | FOV three visibility states | unit | `npx vitest run tests/rendering/fov-visibility.test.ts -x` | ❌ Wave 0 |
| RND-10 | Entity visibility gated by FOV | unit | `npx vitest run tests/rendering/entity-fov-gating.test.ts -x` | ❌ Wave 0 |
| RND-11 | Movement tween interpolation | unit | `npx vitest run tests/rendering/move-tween.test.ts -x` | ❌ Wave 0 |
| RND-12 | Attack animation logic | unit | `npx vitest run tests/rendering/attack-anim.test.ts -x` | ❌ Wave 0 |
| RND-13 | Death fade animation | unit | `npx vitest run tests/rendering/death-anim.test.ts -x` | ❌ Wave 0 |
| RND-14 | Camera lerp smoothing | unit | `npx vitest run tests/rendering/camera-lerp.test.ts -x` | ❌ Wave 0 |

**Note:** PixiJS rendering tests (RND-01, RND-02) require WebGL context and cannot run in Vitest/happy-dom. Test the _logic_ (camera offset calculation, FOV computation, animation interpolation, sprite map tracking) in unit tests. Visual rendering verified manually or via smoke tests.

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Vitest config (depends on Phase 1 scaffolding)
- [ ] Test files for rendering logic (camera math, FOV computation, animation interpolation, sprite map tracking)
- [ ] Mock/stub pattern for PixiJS objects in unit tests (mock Container, Sprite as plain objects with position/alpha/visible/tint)

## Sources

### Primary (HIGH confidence)
- PixiJS v8 Application docs: https://pixijs.download/release/docs/app.Application.html — async init, canvas, ticker, destroy
- PixiJS v8 Container docs: https://pixijs.download/release/docs/scene.Container.html — position, alpha, tint, visible, addChild, destroy
- @pixi/tilemap source: https://github.com/pixijs/tilemap — CompositeTilemap API, tile() method, clear(), alpha option
- rot-js FOV manual: https://ondras.github.io/rot.js/manual/#fov — PreciseShadowcasting compute(x,y,R,callback), visibility 0..1
- rot-js PreciseShadowcasting source: https://github.com/ondras/rot.js/blob/master/src/fov/precise-shadowcasting.ts — lightPasses, compute, _checkVisibility

### Secondary (MEDIUM confidence)
- Project research docs (.planning/research/) — stack decisions, architecture patterns, pitfalls

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries pre-decided and version-locked in project research
- Architecture: HIGH — rendering patterns well-established in PixiJS ecosystem, validated against official docs
- Pitfalls: HIGH — sourced from project pitfalls doc + verified against PixiJS v8 API changes
- FOV implementation: HIGH — rot-js PreciseShadowcasting API verified from source code + official manual
- Animation patterns: HIGH — PixiJS ticker API straightforward, pattern is standard game loop with delta-time

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable — PixiJS v8 API settled, @pixi/tilemap v5 stable, rot-js feature-complete)
