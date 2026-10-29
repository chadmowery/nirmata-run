# Nirmata Runner — Tilemap & Tileset Creation Guide

A practical guide for developers, artists, and AI agents creating new 2D tilemaps and spritesheet atlases for *Nirmata Runner*.

---

## 1. Architecture & Rendering Overview

*Nirmata Runner* uses a decoupled, server-authoritative engine with a client-side **PixiJS 8** renderer.

```
┌────────────────────────────────────────────────────────┐
│  Engine / Headless Grid (src/engine/grid/)            │
│  Tile.terrain: 'floor' | 'wall' | 'door'               │
│  Entity Component: SpriteComponent({ key: string })   │
└──────────────────────────┬─────────────────────────────┘
                           │ Sync Loop
┌──────────────────────────▼─────────────────────────────┐
│  PixiJS 8 Renderer (src/rendering/)                    │
│  ├── assets.ts      Loads atlas via Assets.load()      │
│  ├── tilemap.ts     Renders terrain via Sprite pool    │
│  └── sprite-map.ts  Renders dynamic ECS entity sprites │
└────────────────────────────────────────────────────────┘
```

### Key Technical Constants
- **Tile Dimensions**: `32 x 32` pixels (`TILE_SIZE = 32`).
- **Engine Viewport**: `960 x 640` pixels (`30` tiles wide × `20` tiles high).
- **Texture Atlas Format**: TexturePacker / PixiJS **JSON Hash** format (`RGBA8888` 32-bit PNG + `.json` manifest).
- **Texture Scale Mode**: Nearest-neighbor / pixel-art filtering (`scaleMode: 'nearest'`).
- **Active Asset Path**:
  - Atlas descriptor: [`public/assets/tileset.json`](../public/assets/tileset.json)
  - Atlas texture: [`public/assets/tileset.png`](../public/assets/tileset.png)

---

## 2. Spritesheet Schema & File Specifications

The atlas texture is a transparent PNG packed with 32×32 pixel sprite cells (standard baseline atlas is `256 x 256` px, an 8×8 grid of 32px cells).

### Atlas Manifest (`tileset.json`) Structure

```json
{
  "frames": {
    "frame_name": {
      "frame": { "x": 0, "y": 0, "w": 32, "h": 32 },
      "sourceSize": { "w": 32, "h": 32 },
      "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 32 }
    }
  },
  "meta": {
    "image": "tileset.png",
    "format": "RGBA8888",
    "size": { "w": 256, "h": 256 },
    "scale": 1
  }
}
```

> [!IMPORTANT]
> - All frame coordinates (`x`, `y`, `w`, `h`) must be integers aligned to grid boundaries.
> - The `"image"` property in `"meta"` must match the relative filename of the companion PNG texture.

---

## 3. Required Frame Dictionary

Every tileset must supply the standard set of frame names below. Dynamic entities in ECS JSON templates map directly to these frame keys via `SpriteComponent`.

### 3.1 Environment & Terrain Tiles
Rendered by [`src/rendering/tilemap.ts`](../src/rendering/tilemap.ts) onto `layers.terrainLayer`:

| Frame Key | Terrain Type | Description | Blocking / Opacity |
| :--- | :--- | :--- | :--- |
| `floor` | `'floor'` | Primary walkable dungeon floor | Walkable, transparent |
| `wall` | `'wall'` | Structural obstacle / boundary | Non-walkable, blocks LOS |
| `door` | `'door'` | Room entrance / transition portal | Walkable, transparent |

### 3.2 Interactive World Fixtures
Rendered onto `layers.itemLayer` or `layers.entityLayer`:

| Frame Key | Entity Template | Description |
| :--- | :--- | :--- |
| `staircase` | `staircase.json` | Floor exit down to next sub-level |
| `anchor` | `anchor.json` | Stability Anchor terminal / extraction site |

### 3.3 Player & Characters
Rendered onto `layers.entityLayer`:

| Frame Key | Entity Template | Description |
| :--- | :--- | :--- |
| `player` | `player.json` | Active runner operative chassis |

### 3.4 Enemies (Tiers 1–3)
Rendered onto `layers.entityLayer` (with glitch shaders & neon particle emitters attached in `render-system.ts`):

| Frame Key | Entity Template | Tier | Visual Identity |
| :--- | :--- | :--- | :--- |
| `enemy_null_pointer` | `null-pointer.json` | T1 | Fast corrupted glitch stalker |
| `enemy_buffer_overflow`| `buffer-overflow.json`| T1 | Armored heavy brute / tank |
| `enemy_fragmenter` | `fragmenter.json` | T2 | Segmented multi-node splitter |
| `enemy_logic_leaker` | `logic-leaker.json` | T2 | Corrosive acid / thermal hazard spreader |
| `enemy_seed_eater` | `seed-eater.json` | T3 | Aggressive biomechanical leech |
| `enemy_system_admin` | `system-admin.json` | T3 (Boss) | Monolithic security overseer / sentinel |

### 3.5 Items, Currency & Augments
Rendered onto `layers.itemLayer`:

| Frame Key | Entity Template | Description |
| :--- | :--- | :--- |
| `item_potion` | `health-potion.json` | Nanite repair syringe / health stimulus |
| `item_flux` | `flux.json` | Crystalline energetic currency node |
| `item_blueprint` | `blueprint-locked.json`| Encrypted schematic datapad |
| `item_auto_loader` | `auto-loader-*.json` | Kinetic chamber cycling firmware |
| `item_bleed` | `bleed-*.json` | Hemorrhage / nanite laceration software |
| `item_vampire` | `vampire-*.json` | Siphon drain firmware |
| `item_neural_spike` | `neural-spike.json` | High-frequency EMP disruptor |
| `item_phase_shift` | `phase-shift.json` | Displacement warp module |
| `item_extended_sight`| `extended-sight.json`| Optical sensor array booster |
| `item_displacement_venting` | `displacement-venting.json` | Heat dissipation valve |
| `item_static_siphon`| `static-siphon.json`| Electromagnetic capacitor |
| `item_neural_feedback`| `neural-feedback.json`| Synaptic backlash node |

---

## 4. Translating Mockup Themes to Tilesets

The showcase in [`docs/mocks/`](./mocks/README.md) defines 35 visual styles. Below are specific design recipes to guide an agent or artist when creating tilesets that visually harmonize with the mockups:

### Style 26: Taikoku Industrial Manifest (*Marathon* Constructivist)
- **Palette**: Deep graphite (`#121316`), signal caution yellow (`#ffd600`), safety orange (`#ff5500`), bone white (`#f0ece1`).
- **Floor**: Industrial stamped steel diamond-tread plates with stenciled numbers (`01`, `ZONE-C`) or Japanese industrial kanji (`危険`, `区画`) stamped in corners.
- **Wall**: Heavy concrete/cast-iron blast bulkheads with 45° yellow-and-black hazard warning stripes along top or bottom borders.
- **Doors**: Heavy pneumatic sliding hatch with yellow hazard border and mechanical center latch.
- **Enemies**: Yellow/black industrial construction chassis, hydraulic pistons, hazard warning badges.

### Style 27: Ghost-Dive Cyber-Brain (*Ghost in the Shell*)
- **Palette**: Deep cyber-navy (`#050e18`), phosphor cyan (`#00f0ff`), electric cobalt (`#0066ff`), optical white (`#ffffff`).
- **Floor**: Hexagonal or rectangular cybernetic bus grid with glowing cyan PCB micro-traces and fiber-optic ribbon conduits running between tiles.
- **Wall**: Glass server rack towers containing glowing cylindrical synaptic fluid tanks and vertical memory heat-sink fins.
- **Doors**: Holographic iris gate with pulsing cyan laser scanning bars.
- **Enemies**: Biomechanical wireframe androids, exposed ceramic skull plates, floating neural cable dreadlocks.

### Style 28: Seinen Manga Action Panels (*Akira* / *BLAME!*)
- **Palette**: Monochromatic high-contrast ink: Stark black (`#000000`), pure white (`#ffffff`), 50% dot-screen tone (`#888888`).
- **Floor**: Halftone stippled floor textures with dynamic comic speedlines or hatched drop shadows.
- **Wall**: Hand-inked crosshatching, brutalist mega-structure concrete layers, heavy ink line silhouettes.
- **Doors**: Angular mechanical blast hatch framed by hand-lettered katakana sound effects (`ゴゴゴ...`).
- **Enemies**: Heavy ink-washed biomechanical monstrosities, sharp angular silhouettes, screentone shading.

### Style 29: Zaibatsu Biotech Clinical Lab (Cleanroom / ICU)
- **Palette**: Sterile surgical white (`#f4f6f8`), clinical mint / emerald (`#10b981`), titanium chrome (`#cbd5e1`), danger crimson (`#ef4444`).
- **Floor**: Glossy anti-static white ceramic laboratory tiles with recessed mint-green LED track seams.
- **Wall**: Polished stainless steel / frosted glass cleanroom partitions with green sanitary seal strips.
- **Doors**: Hermetic airlock decontamination portal with red/green status indicator lights.
- **Enemies**: Escaped transgenic biological specimens, clear silicone exoskeletons, glowing emerald fluid vials.

### Style 30: Chiba Back-Alley Ripperdoc (*Neuromancer* Cyberpunk Slum)
- **Palette**: Slum pitch (`#0b0b0f`), neon hot pink (`#ff007f`), toxic acid lime (`#39ff14`), rusted iron (`#8b4513`).
- **Floor**: Corrugated steel decking patched with copper mesh, oily puddles reflecting neon, tangled floor cables.
- **Wall**: Riveted rusted iron plates, scrap metal sheets held by industrial bolts, torn faded paper posters.
- **Doors**: Flickering neon-bordered shutter gate secured with heavy manual padlocks.
- **Enemies**: Jury-rigged scrap cyborgs with mis-matched mechanical limbs and exposed spark plugs.

### Style 31: Neo-Tokyo Metro Transit (Subway / Rail)
- **Palette**: Polished granite grey (`#2a2d32`), safety yellow (`#ffcc00`), train line cyan (`#00bfff`), stainless steel (`#e2e8f0`).
- **Floor**: Non-slip subway platform pavers with yellow tactile paving bumps (Tenji blocks) and platform edge safety lines.
- **Wall**: Tiled ceramic subway tunnel walls with horizontal colored route stripes and emergency telephone boxes.
- **Doors**: Automatic stainless steel train sliding doors or turnstile gates.
- **Enemies**: Malfunctioning track maintenance drones, security ticket droids with scanning lasers.

### Style 32: NERV Hex-Canopy HUD (*Evangelion* GeoFront)
- **Palette**: Deep gunmetal (`#15181c`), warning crimson (`#ff1b2e`), amber alert (`#ff8c00`), command green (`#00ff66`).
- **Floor**: Interlocking hexagonal honeycomb carbon-fiber plates with amber caution seams.
- **Wall**: Angular bunker blast pylons with vertical Japanese emergency typography (`非常時`) and red warning strobe beacons.
- **Doors**: Retractable hexagonal blast seal door with three red interlock indicator nodes.
- **Enemies**: Monolithic geometric angel cores, pulsing orange AT-field polygons, biomechanical armor plating.

---

## 5. Tilemap Engine Implementation Details

Understanding how the code consumes tilesets prevents rendering artifacts:

### 5.1 Sprite Pooling & Performance ([`src/rendering/tilemap.ts`](../src/rendering/tilemap.ts))
- The engine uses an internal `spritePool` (`Map<string, Sprite>`).
- Only visible and explored tiles within the camera viewport (`getVisibleTileRange`) instantiate or update sprites.
- `tileTerrainToFrame(tile.terrain)` determines which texture frame to fetch:
  ```typescript
  function tileTerrainToFrame(terrain: string): string {
    switch (terrain) {
      case 'wall': return 'wall';
      case 'floor': return 'floor';
      case 'door': return 'door';
      default: return 'floor';
    }
  }
  ```

### 5.2 Dynamic FOV Alpha Shading
Tile sprites are shaded based on Field of View (FOV):
- **Inside Active FOV** (`fovSet.has(key)`): `alpha = 1.0`
- **Explored / Fog of War** (`exploredSet.has(key)`): `alpha = 0.3`
- **Unexplored Void**: `alpha = 0.0` (Sprite hidden)

> [!TIP]
> Ensure floor and wall tiles have clear visual readability when rendered at **30% opacity** in the explored fog-of-war state. High-contrast outlines on walls ensure explored dungeon architecture remains distinct.

### 5.3 Layer Hierarchy ([`src/rendering/layers.ts`](../src/rendering/layers.ts))
PixiJS renders child containers in strict order:
1. `terrainLayer` (Floors, walls, doors)
2. `itemLayer` (Dropped loot, potions, blueprints, firmware chips, anchors, stairs)
3. `entityLayer` (Player operative, enemies)
4. `effectsLayer` (Targeting reticles, neon particle emitters, damage numbers)

Ensure items and entities use transparent backgrounds (`alpha = 0`) outside their sprite silhouettes so they composite cleanly over terrain.

---

## 6. How to Build & Package a New Tileset

### Option A: Using TexturePacker (GUI or CLI)
1. Export individual 32×32 PNG sprites into a staging folder (e.g., `assets/sprites/`).
2. Run TexturePacker with JSON Hash output:
   ```bash
   TexturePacker assets/sprites/ \
     --format pixijs4 \
     --data public/assets/tileset.json \
     --sheet public/assets/tileset.png \
     --algorithm MaxRects \
     --opt RGBA8888 \
     --trim-mode None \
     --size-constraints POT
   ```

### Option B: Scripted Generation via Node.js Canvas / Sharp
For procedural pixel art or automated theme generation:
1. Create a script in `scripts/generate-tileset.cjs`.
2. Draw 32×32 tiles onto a `256 x 256` canvas at grid coordinates:
   - Row 0: `floor` (0,0), `wall` (32,0), `door` (64,0), `enemy_logic_leaker` (96,0)
   - Row 1: `player` (0,32), `enemy_fragmenter` (96,32)
   - Row 2: `item_potion` (0,64), `staircase` (64,64), `anchor` (96,64)
   - Row 3: `enemy_null_pointer` (0,96), `enemy_buffer_overflow` (32,96), `enemy_seed_eater` (64,96), `enemy_system_admin` (96,96)
   - Row 4+: Augments and item drops (`item_auto_loader`, `item_bleed`, etc.)
3. Export the PNG and write the matching `tileset.json` frame definitions.

---

## 7. Registering & Hot-Swapping Themed Tilesets

Currently, [`src/rendering/assets.ts`](../src/rendering/assets.ts) registers the default tileset:

```typescript
Assets.add({
  alias: 'tileset',
  src: 'assets/tileset.json',
});
```

### Supporting Multiple Themes
To allow dynamic theme switching (e.g. per floor, biome, or user setting):

1. **Store Themed Atlases**:
   ```
   public/assets/themes/
   ├── default/
   │   ├── tileset.png
   │   └── tileset.json
   ├── taikoku/
   │   ├── tileset.png
   │   └── tileset.json
   └── ghost-dive/
       ├── tileset.png
       └── tileset.json
   ```

2. **Load Theme in `assets.ts`**:
   ```typescript
   export async function loadThemedAssets(themeName: string = 'default'): Promise<void> {
     const src = `assets/themes/${themeName}/tileset.json`;
     Assets.add({
       alias: `tileset-${themeName}`,
       src,
     });
     await Assets.load(`tileset-${themeName}`);
   }
   ```

3. **Purge Old Textures on Switch**:
   When switching tilesets at runtime:
   - Call `clearTilemap(layers.terrainLayer)` to remove old terrain sprites.
   - Call `clearAllSprites()` in `sprite-map.ts` to invalidate entity sprites.

---

## 8. Verification Checklist for Agents

Before completing work on a new tileset, verify:

- [ ] **Atlas Dimensions**: Power-of-two PNG texture (256×256, 512×512, etc.).
- [ ] **Grid Alignment**: Every frame is exactly 32×32 px with zero offset bleeding (`w: 32, h: 32`).
- [ ] **Frame Completeness**: All required keys exist (`floor`, `wall`, `door`, `player`, `staircase`, `anchor`, all 6 enemies, all items).
- [ ] **Alpha Transparency**: Background pixels outside wall/entity geometry are fully transparent (`#00000000`).
- [ ] **Typecheck**: `npm run typecheck` passes with zero errors.
- [ ] **Tests**: `npm test` passes without breaking existing suites.
- [ ] **In-Game Verification**: Launch `npm run dev` and navigate to `http://localhost:3000` to confirm tiles render seamlessly with FOV lighting and player movement.
