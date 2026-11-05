Technical Specification: Directional Tilemaps, Wall Caps & Themed Tileset Architecture

1. Executive Summary & Architectural Objectives

The Directional Tilemap & Themed Tileset System extends Nirmata Runner's environment generation and rendering architecture by establishing formal engine-wide support for directional tile orientation, autotiled wall geometry (including wall caps and junction fitting), directional interactive props, and standardized corporate faction tileset manifests.

Building upon the server-authoritative Entity-Component-System (ECS) engine and PixiJS 8 WebGL rendering layer, this system transitions Nirmata Runner from flat, isotropic 2D tile maps to a fully orientation-aware spatial grid. Walls automatically adjust their sprite frames to form seamless structural runs with clean end-caps; doors align naturally along corridor vectors; and interactive workstations, security lockers, and bio-containment units exhibit distinct front, back, and side orientations with directional interaction footprints and directional cover mechanics.

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          GAMEDATA STUDIO & LEVEL GENERATOR                              │
│  [Prefabs / BSP Rooms] ──> [Autotile Solver] ──> [Directional Prop Placement]           │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │ Instantiates ECS Entities
┌──────────────────────────────────────────▼──────────────────────────────────────────────┐
│                       SERVER-AUTHORITATIVE ECS SIMULATION                               │
│  - TileOrientationComponent: cardinal orientation (NORTH | EAST | SOUTH | WEST)         │
│  - AutotileComponent: 4-bit / 8-bit neighbor bitmasks + wall cap classification          │
│  - DirectionalPropComponent: front-facing interaction validation & 180° cover vectors    │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │ Syncs via ECS Delta / FULL Payload
┌──────────────────────────────────────────▼──────────────────────────────────────────────┐
│                        PIXIJS 8 CLIENT RENDERER & ATLAS                                 │
│  - Layer Mapping: Frame lookup (`wall_cap_n`) OR Texture Matrix Rotation (0°/90°/180°/270°)│
│  - Themed Atlas Manager: Hot-swappable Faction Atlases (`traxus`, `cyberacme`, etc.)    │
└─────────────────────────────────────────────────────────────────────────────────────────┘


Key Architectural Objectives

* Orientation-Aware Spatial Grid: Support cardinal rotation (0^\circ North, 90^\circ East, 180^\circ South, 270^\circ West) across terrain tiles, doors, wall runs, and interactive props without sacrificing grid-level spatial lookup performance.
* Procedural Autotiling & Wall Cap Solver: Implement a deterministic 4-bit cardinal and 8-bit corner bitmask solver that automatically assigns straight wall segments, inner/outer corners, T-junctions, cross-junctions, and clean Wall Caps (terminal end-points of wall runs).
* Directional Props & Tactical Cover: Introduce directional prop facing. Workstations and lockers require approaches from valid interaction angles, and low-cover props (InteractiveSurface) calculate directional damage mitigation based on the angle between incoming fire and the prop's orientation.
* Strict Themed Tileset Manifest Schema: Standardize tileset.json into a formal, Zod-validated ThemedTilesetManifest schema supporting hot-swappable corporate faction themes (Traxus Freight, CyberAcme Mainframe, Sekiguchi Gene-Labs, NuCaloric Storage) with complete frame dictionary enforcement.
* Zero-Glitched Backward Compatibility: Maintain full backwards compatibility with non-directional fallback frames, allowing legacy entity templates and simplified map scripts to render seamlessly.

2. Directional & Rotational Tile Architecture

2.1 Orientation Representation & Mathematics

Tile orientation is modeled as a 2-bit cardinal direction enum or 90-degree integer angle. The cardinal directions correspond to standard grid offsets and radian/degree rotations:

Orientation Enum	Cardinal Value	Angle (Degrees)	Angle (Radians)	Direction Vector (\Delta x, \Delta y)	Opposite Direction
NORTH	0	0^\circ	0.0	(0, -1)	SOUTH
EAST	1	90^\circ	\pi / 2 \approx 1.5708	(+1, 0)	WEST
SOUTH	2	180^\circ	\pi \approx 3.14159	(0, +1)	NORTH
WEST	3	270^\circ	3\pi / 2 \approx 4.71239	(-1, 0)	EAST

Directional math utilities convert between vector displacement and cardinal orientation:

\text{Orientation}(\Delta x, \Delta y) = \begin{cases} \text{NORTH} & \text{if } \Delta y < 0 \text{ and } |\Delta y| \ge |\Delta x| \\ \text{EAST} & \text{if } \Delta x > 0 \text{ and } |\Delta x| > |\Delta y| \\ \text{SOUTH} & \text{if } \Delta y > 0 \text{ and } |\Delta y| \ge |\Delta x| \\ \text{WEST} & \text{if } \Delta x < 0 \text{ and } |\Delta x| > |\Delta y| \end{cases}

2.2 Dual Rendering Pipelines: Explicit Frames vs. Transform Rotation

To optimize texture memory while giving artists full creative control over asymmetrical lighting and directional shadows, the PixiJS 8 rendering pipeline supports two complementary tile orientation strategies:

Strategy A: Explicit Directional Frame Keys (Preferred for Asymmetrical Props & Caps)

The atlas contains distinct, pre-rendered frame keys for each orientation (e.g., wall_cap_north, wall_cap_east, wall_cap_south, wall_cap_west, or prop_desk_n, prop_desk_e, prop_desk_s, prop_desk_w).

* Pros: Supports hand-crafted directional shadows, asymmetrical terminal displays, and custom perspective depth per angle.
* Usage: Primary method for wall caps, complex faction workstations, and security lockers.

Strategy B: Dynamic Matrix Rotation & Mirroring (Preferred for Symmetric Terrain & Fences)

The atlas contains a single canonical frame (e.g., wall_straight, pipe_run), and RenderSystem applies a PixiJS transformation matrix or sprite pivot rotation:

\begin{bmatrix} x' \\ y' \end{bmatrix} = \begin{bmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{bmatrix} \begin{bmatrix} x - x_c \\ y - y_c \end{bmatrix} + \begin{bmatrix} x_c \\ y_c \end{bmatrix}

For a standard 32 \times 32 tile (pivot x_c = 16, y_c = 16):

* NORTH (0^\circ): sprite.rotation = 0
* EAST (90^\circ): sprite.rotation = Math.PI / 2
* SOUTH (180^\circ): sprite.rotation = Math.PI
* WEST (270^\circ): sprite.rotation = (3 * Math.PI) / 2

3. Autotiling & Wall Cap Engine

3.1 4-Bit Cardinal & 8-Bit Extended Bitmasking

The autotile engine automatically calculates the correct structural wall frame based on orthogonal and diagonal wall neighbors.

During dungeon generation (EnvironmentInitSystem) or runtime terrain mutation (TileCorruptionSystem, wall breaches), the solver evaluates neighboring tiles using a 4-bit cardinal bitmask:

\text{Bitmask} = (N \cdot 1) + (E \cdot 2) + (S \cdot 4) + (W \cdot 8)

where N, E, S, W \in \{0, 1\} represent the presence of an adjacent solid wall tile.

       [N: +1]
          │
[W: +8] ──┼── [E: +2]
          │
       [S: +4]


3.2 Canonical Bitmask Lookup & Wall Cap Classification

Bitmask Value	Binary	Orthogonal Neighbors Present	Structural Tile Classification	Frame Key Suffix / Orientation
0	0000	None	Isolated Pillar	wall_pillar
1	0001	North	Wall Cap (South Terminal)	wall_cap_s (Cap pointing South)
2	0010	East	Wall Cap (West Terminal)	wall_cap_w (Cap pointing West)
3	0011	North, East	Outer Corner (South-West)	wall_corner_outer_sw
4	0100	South	Wall Cap (North Terminal)	wall_cap_n (Cap pointing North)
5	0101	North, South	Vertical Straight Run	wall_straight_v
6	0110	South, East	Outer Corner (North-West)	wall_corner_outer_nw
7	0111	North, South, East	T-Junction (West Facing)	wall_tjunction_w
8	1000	West	Wall Cap (East Terminal)	wall_cap_e (Cap pointing East)
9	1001	North, West	Outer Corner (South-East)	wall_corner_outer_se
10	1010	East, West	Horizontal Straight Run	wall_straight_h
11	1011	North, East, West	T-Junction (South Facing)	wall_tjunction_s
12	1100	South, West	Outer Corner (North-East)	wall_corner_outer_ne
13	1101	North, South, West	T-Junction (East Facing)	wall_tjunction_e
14	1110	South, East, West	T-Junction (North Facing)	wall_tjunction_n
15	1111	North, South, East, West	Cross-Junction / Inner Fill	wall_cross / wall_inner_fill

3.3 Wall Cap Solver Logic & Edge-Cases

A Wall Cap occurs whenever a wall run terminates into open space (bitmasks 1, 2, 4, and 8). Wall caps prevent raw, untextured internal wall geometries from being exposed to the camera.

Solver Algorithm:

1. Pass 1 (Cardinal Bitmasking): Compute 4-bit mask for each wall tile on the grid.
2. Pass 2 (Wall Cap Direction Inversion):
  * If bitmask is 1 (neighbor strictly to North), the wall ends at the South face \rightarrow assign wall_cap_s (or wall_cap with orientation: SOUTH).
  * If bitmask is 2 (neighbor strictly to East), the wall ends at the West face \rightarrow assign wall_cap_w (or wall_cap with orientation: WEST).
  * If bitmask is 4 (neighbor strictly to South), the wall ends at the North face \rightarrow assign wall_cap_n (or wall_cap with orientation: NORTH).
  * If bitmask is 8 (neighbor strictly to West), the wall ends at the East face \rightarrow assign wall_cap_e (or wall_cap with orientation: EAST).
3. Pass 3 (8-Bit Corner Refinement): For full cross-junctions (bitmask === 15), inspect diagonal neighbors (NW, NE, SE, SW). If a diagonal is walkable floor while its orthogonal parents are walls, replace the cross tile with an Inner Corner frame (wall_corner_inner_nw, etc.).

4. Directional Props, Interaction Footprints & Cover Mechanics

4.1 Directional Furniture & Interaction Footprints

Props such as Terminal Workstations, Security Lockers, and Subnet Consoles possess a physical front face.

   [WALL]
┌──────────┐
│ WORKSTN  │  <-- Back face (against wall)
│  (NORTH) │
├──────────┤
│▲ FRONT ▲ │  <-- Active Interaction Zone (Tile Directly South)
└──────────┘
     │
 [PLAYER]


* Front-Facing Access Constraint: To search or hack a directional prop (requiresFrontAccess === true), the player must occupy the tile directly facing the prop's front panel, or be positioned within a 180^\circ forward arc.
* Bump-to-Loot Validation: Bumping into a prop from the sides or rear when requiresFrontAccess === true halts movement and displays a contextual prompt: [NOTICE] WORKSTATION FRONT INTERFACE IS TO THE SOUTH.

4.2 Directional Cover Calculations (InteractiveSurface)

Low-cover props (worktables, cargo crates, server consoles) provide directional cover mitigation against incoming ranged attacks.

Attacker (Logic-Leaker)
       │  (Line of Sight Vector)
       ▼
 ┌──────────┐
 │ COVER    │  <-- Facing NORTH
 └──────────┘
       │  (Protected Arc: 180° behind cover)
       ▼
 Defender (Player)


1. Ranged Attack Vector: Calculate incoming threat vector \vec{V}_{\text{attack}} = \mathbf{P}_{\text{target}} - \mathbf{P}_{\text{attacker}}.
2. Cover Normal Vector: Obtain cover prop's forward vector \vec{N}_{\text{cover}} from its TileOrientation.
3. Dot Product Evaluation: Calculate \cos\theta = \frac{\vec{V}_{\text{attack}} \cdot \vec{N}_{\text{cover}}}{\|\vec{V}_{\text{attack}}\| \|\vec{N}_{\text{cover}}\|}.
4. Mitigation Trigger:
  * If \cos\theta > 0 (attacker is firing into the front/side of the cover, and the defender is behind it), cover mitigation applies: \text{Final Damage} = \text{Raw Damage} \times (1.0 - \text{coverDamageReduction}) where coverDamageReduction is 0.25 (25\%) base, or 0.35 (35\%) for the BASTION-v1 Shell.
  * If \cos\theta \le 0 (attacker flanked the cover and is firing directly into the defender's unprotected side), cover is bypassed (0\% mitigation).

5. Themed Tileset Schema & Complete Frame Dictionary

5.1 ThemedTilesetManifest JSON Schema (public/assets/tileset.json)

import { z } from 'zod';

export const RectSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

export const FrameDefSchema = z.object({
  frame: RectSchema,
  sourceSize: z.object({ w: z.number().int(), h: z.number().int() }),
  spriteSourceSize: RectSchema,
  /** Optional orientation metadata for directional frames */
  orientation: z.enum(['NORTH', 'EAST', 'SOUTH', 'WEST']).optional(),
  /** Canonical fallback frame key if this directional frame is missing */
  fallbackFrame: z.string().optional(),
});

export const ThemedTilesetManifestSchema = z.object({
  frames: z.record(z.string(), FrameDefSchema),
  meta: z.object({
    themeId: z.enum(['default', 'traxus', 'cyberacme', 'sekiguchi', 'nucaloric']),
    themeName: z.string(),
    image: z.string(),
    format: z.string().default('RGBA8888'),
    size: z.object({ w: z.number().int(), h: z.number().int() }),
    scale: z.number().default(1),
    tileSize: z.number().int().default(32),
  }),
});

export type ThemedTilesetManifest = z.infer<typeof ThemedTilesetManifestSchema>;


5.2 Required Frame Dictionary for Full Faction Theme Compliance

Every corporate faction tileset (traxus, cyberacme, sekiguchi, nucaloric) must supply the following canonical frame keys:

A. Terrain & Autotile Wall Sets

* floor: Base walkable floor tile.
* wall_straight_h, wall_straight_v: Horizontal and vertical straight wall runs.
* wall_corner_outer_nw, wall_corner_outer_ne, wall_corner_outer_sw, wall_corner_outer_se: Outer corners.
* wall_corner_inner_nw, wall_corner_inner_ne, wall_corner_inner_sw, wall_corner_inner_se: Inner corners.
* wall_tjunction_n, wall_tjunction_e, wall_tjunction_s, wall_tjunction_w: T-Junctions.
* wall_cross: 4-Way Cross Junction.
* wall_cap_n, wall_cap_e, wall_cap_s, wall_cap_w: Wall Caps (Terminals facing North, East, South, West).
* wall_pillar: Single isolated wall column.

B. Directional Doors & Portals

* door_h_closed, door_h_open: Horizontal sliding doorway.
* door_v_closed, door_v_open: Vertical sliding doorway.
* vault_door_locked_n, vault_door_locked_e, vault_door_locked_s, vault_door_locked_w: Directional Encrypted Vault Blast Doors.
* vault_door_open: Unlocked vault door frame.

C. Directional Interactive Props & Fixtures

* prop_workstation_n, prop_workstation_e, prop_workstation_s, prop_workstation_w: Directional CyberAcme terminal desks.
* prop_locker_n, prop_locker_e, prop_locker_s, prop_locker_w: Directional Traxus security lockers.
* prop_biocabinet_n, prop_biocabinet_e, prop_biocabinet_s, prop_biocabinet_w: Directional Sekiguchi containment units.
* prop_safe_locked, prop_safe_open: Encrypted Core Safe.
* prop_crate_cover_h, prop_crate_cover_v: Directional low-cover cargo crates.
* prop_cooling_vent, prop_dead_drop, prop_stabilizer: Utility terminals.

6. Server-Authoritative ECS Schemas & Phase Integration

6.1 Component Definitions (src/shared/components/environment.ts)

import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

export const OrientationSchema = z.enum(['NORTH', 'EAST', 'SOUTH', 'WEST']);
export type Orientation = z.infer<typeof OrientationSchema>;

export const TileOrientation = defineComponent(
  'tileOrientation',
  z.object({
    facing: OrientationSchema.default('NORTH'),
    /** Degrees rotation for client renderer fallback (0, 90, 180, 270) */
    angleDegrees: z.number().int().min(0).max(270).default(0),
    /** Allow dynamic rotation by player or abilities */
    isRotatable: z.boolean().default(false),
  }),
);
export type TileOrientationData = z.infer<typeof TileOrientation.schema>;

export const AutotileState = defineComponent(
  'autotileState',
  z.object({
    bitmask: z.number().int().min(0).max(15).default(0),
    tileClass: z.enum([
      'pillar',
      'cap',
      'straight',
      'corner_outer',
      'corner_inner',
      'tjunction',
      'cross',
    ]).default('pillar'),
    resolvedFrameKey: z.string().default('wall_pillar'),
  }),
);
export type AutotileStateData = z.infer<typeof AutotileState.schema>;

export const DirectionalProp = defineComponent(
  'directionalProp',
  z.object({
    requiresFrontAccess: z.boolean().default(true),
    frontFacingVector: z.object({
      x: z.number().int().min(-1).max(1),
      y: z.number().int().min(-1).max(1),
    }).default({ x: 0, y: 1 }), // Default facing South (+Y)
    hasDirectionalCover: z.boolean().default(true),
    coverArcDegrees: z.number().default(180), // 180 degree forward cover arc
  }),
);
export type DirectionalPropData = z.infer<typeof DirectionalProp.schema>;


6.2 Engine Phase Execution Sequence

┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Phase.INIT (Floor Launch / Descent)                                                    │
│ 1. DungeonGenerator carves BSP rooms & stamps prefabs.                                 │
│ 2. AutotileSystem computes 4-bit/8-bit bitmasks & attaches AutotileState + Caps.       │
│ 3. EntityPlacementSystem seeds DirectionalProps with TileOrientation matching walls.   │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
┌──────────────────────────────────────────▼─────────────────────────────────────────────┐
│ Phase.ACTION (Turn Cycle - Player Movement & Interaction)                              │
│ 1. MovementSystem evaluates MoveIntent into DirectionalProp.                           │
│ 2. PropInteractionSystem validates front-facing vector if requiresFrontAccess === true.│
│    - If valid: executes search/hack.                                                   │
│    - If invalid: halts move at 0 turn cost, emitting directional access warning.       │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
┌──────────────────────────────────────────▼─────────────────────────────────────────────┐
│ Phase.REACTION (Combat & Environmental Hazards)                                        │
│ 1. CombatSystem evaluates ranged AttackIntent.                                         │
│ 2. Intersecting InteractiveSurface props query TileOrientation & DirectionalProp.      │
│ 3. Calculates dot product between threat vector & cover normal:                        │
│    - Frontal/Side hit: Applies 25% / 35% damage mitigation.                           │
│    - Rear Flank hit: Bypasses cover (0% mitigation).                                   │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
┌──────────────────────────────────────────▼─────────────────────────────────────────────┐
│ Phase.RENDER (Client Viewport Update)                                                  │
│ 1. RenderSystem reads TileOrientation & AutotileState.                                 │
│ 2. Selects frame key (`wall_cap_s`) OR sets `sprite.rotation = angleDegrees * rad`.     │
└────────────────────────────────────────────────────────────────────────────────────────┘


7. Gamedata Studio (/dev/gamedata) Tooling & Authoring Workflows

The Gamedata Authoring Studio (/dev/gamedata) is updated to give designers visual controls for directional tile painting, orientation toggling, and autotile verification:

7.1 Prefab Painter Enhancements (prefabs)

* Directional Tile Brush: Designers select tile orientation (NORTH, EAST, SOUTH, WEST) or press the R key while hovering over the 2D ASCII grid canvas to cycle tile facing clockwise.
* Visual Direction Indicators: Overlays directional arrows (\uparrow, \rightarrow, \downarrow, \leftarrow) on directional prop tiles (PROP_DESK_CORNER, PROP_LOCKER_WALL, CONTAINER_RARE).
* Wall Cap Auto-Preview: Toggling "Autotile Preview" in the canvas toolbar executes the autotile bitmask solver in real time, rendering exact wall caps and corner frames within the editor.

┌─────────────────────────────────────────────────────────────────────────────┐
│  PREFAB EDITOR: freight-bay.json                       [AUTOTILE PREVIEW ✓] │
├─────────────────────────────────────────────────────────────────────────────┤
│  BRUSH TOOLKIT:                                                             │
│  [# WALL] [. FLOOR] [+ DOOR] [V VAULT] [PROP WORKSTATION] [ROTATION: 90° ↻] │
├─────────────────────────────────────────────────────────────────────────────┤
│  GRID CANVAS (12 x 12):                                                     │
│   #  #  #  #  #  #  #  #  #  #  #  #                                        │
│   #  .  .  .  .  .  .  .  .  .  .  #                                        │
│   #  .  [T→] .  .  .  .  [L↓] .  .  #   <-- [T→] Terminal Facing East         │
│   #  .  .  .  .  .  .  .  .  .  .  #   <-- [L↓] Locker Facing South          │
│   #  #  #  [C↓] #  #  #  #  #  #  #   <-- [C↓] Wall Cap Facing South        │
└─────────────────────────────────────────────────────────────────────────────┘


7.2 Themed Tileset Inspector (componentSchemas / tileset)

* Frame Dictionary Validator: Scans selected theme directory (public/assets/themes/<theme_id>/tileset.json) against ThemedTilesetManifestSchema, flagging missing directional frames or unaligned frame dimensions.
* Directional Frame Preview: Renders 32×32 pixel canvas previews for all 4 cardinal orientations of any selected prop or wall cap template.

8. Implementation Roadmap & Technical Milestones

Milestone 1: Schemas & Types ──> Milestone 2: Autotile Engine ──> Milestone 3: Directional Props
                                                                            │
Milestone 5: Gamedata Studio <── Milestone 4: PixiJS Shaders <──────────────┘


Milestone 1: Core Schemas & Orientation Types

* Implement TileOrientation, AutotileState, and DirectionalProp Zod components in src/shared/components/environment.ts.
* Register components in COMPONENTS_REGISTRY (src/shared/components/index.ts).
* Update ThemedTilesetManifestSchema in src/shared/tileset-types.ts.

Milestone 2: Autotile & Wall Cap Solver

* Implement AutotileSolver utility in src/game/generation/autotile-solver.ts supporting 4-bit cardinal and 8-bit corner bitmasks.
* Wire autotile calculation into dungeon-generator.ts and entity-placement.ts during floor initialization.
* Add unit tests in src/game/generation/__tests__/autotile-solver.test.ts verifying all 16 bitmask edge cases and wall cap assignments.

Milestone 3: Directional Prop Interaction & Cover Mechanics

* Update MovementSystem and PropInteractionSystem (src/game/systems/prop-interaction.ts) to validate front-facing access vectors (requiresFrontAccess === true).
* Update CombatSystem (src/game/systems/combat.ts) to compute directional cover mitigation vectors.
* Author directional entity templates (prop-workstation-n.json, prop-locker-s.json, etc.).

Milestone 4: PixiJS 8 Render Layer & Themed Atlas Support

* Update src/rendering/tilemap.ts and src/rendering/sprite-map.ts to support sprite matrix rotations (angleDegrees) and directional frame key fallbacks (wall_cap_s).
* Extend src/rendering/assets.ts to support loading themed faction manifests (loadThemedAssets('traxus')).

Milestone 5: Gamedata Authoring Studio Integration & Validation

* Add R key tile rotation, directional arrow overlays, and real-time autotile previews to src/app/dev/gamedata/editors/PrefabEditor.tsx.
* Add tileset frame dictionary validation to /api/dev/gamedata/.
* Execute full regression test suite (npm test, npm run typecheck, npm run lint).
