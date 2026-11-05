# Branch Handoff: `directional-tilemaps`

> **Branch:** `directional-tilemaps`  
> **Base Commit:** `cd65dce9` (origin/main)  
> **Author / Agent:** Antigravity  
> **Date:** 2026-11-05  
> **Feature Spec:** [`docs/design/DIRECTIONAL-TILEMAPS.md`](../design/DIRECTIONAL-TILEMAPS.md)  
> **Status:** 🟢 Complete (All 5 Milestones Fully Implemented & Verified)

---

## 1. Executive Summary & Objective

The Directional Tilemaps & Themed Tileset feature branch delivers:
1. **Orientation-Aware Spatial Grid**: Engine-wide support for cardinal tile orientations (`NORTH`, `EAST`, `SOUTH`, `WEST`), rotation math, and directional vectors.
2. **Procedural Autotiling & Wall Cap Engine**: Deterministic 4-bit cardinal and 8-bit diagonal bitmask solver computing straight runs, outer/inner corners, T-junctions, cross-junctions, and outward-facing Wall Caps (`wall_cap_n`, `wall_cap_e`, `wall_cap_s`, `wall_cap_w`).
3. **Directional Props & Cover Mechanics**: Front-facing interaction footprints (`requiresFrontAccess === true`) with 0-turn-cost bump safeguards and directional cover mitigation vectors ($(P_{\text{attacker}} - P_{\text{target}}) \cdot N_{\text{cover}} > 0$).
4. **Themed Tileset Manifest Schema**: Formal Zod-validated `ThemedTilesetManifestSchema` supporting corporate faction themes and fallback frame resolution.
5. **PixiJS 8 Rendering Pipeline Integration**: Autotile frame lookup resolution, sprite matrix rotations around tile centers `(16, 16)`, and dynamic themed atlas loading.
6. **Gamedata Studio Tooling**: Interactive `PrefabEditor` supporting directional brush tools, 'R' key clockwise rotation cycling (`NORTH -> EAST -> SOUTH -> WEST`), directional arrow overlays (`↑`, `→`, `↓`, `←`), real-time autotile preview rendering, and tileset manifest dictionary validation.

---

## 2. Technical Milestones & Progress

| Milestone | Description | Status | Verification / Artifacts |
| :--- | :--- | :--- | :--- |
| **M1: Core Schemas & Types** | `TileOrientation`, `AutotileState`, `DirectionalProp` Zod schemas, `ThemedTilesetManifestSchema`, registration in `COMPONENTS_REGISTRY`. | 🟢 Complete | `src/shared/components/environment.ts`, `src/shared/tileset-types.ts`, `src/shared/components/__tests__/directional-environment.test.ts`, `src/shared/__tests__/tileset-types.test.ts` (8/8 pass) |
| **M2: Autotile & Wall Cap Solver** | `AutotileSolver` (4-bit cardinal + 8-bit corner bitmasks, wall cap inversion, door alignments), dungeon generator wiring. | 🟢 Complete | `src/game/generation/autotile-solver.ts`, `src/game/generation/__tests__/autotile-solver.test.ts` (15/15 pass), 750-floor sweep verified |
| **M3: Directional Props & Cover** | Front-facing access constraint in `MovementSystem` & `PropInteractionSystem`, dot product cover in `CombatSystem`, 18 entity templates. | 🟢 Complete | Systems updated, 18 directional entity templates registered, `src/game/systems/__tests__/directional-prop-cover.test.ts` (5/5 pass) |
| **M4: PixiJS 8 Rendering Layer** | `tilemap.ts` & `sprite-map.ts` sprite rotation and directional frame key lookups, themed faction asset loading. | 🟢 Complete | `tests/rendering/directional-render.test.ts` (10/10 pass), all 16 rendering test files pass (81/81 pass) |
| **M5: Gamedata Studio & Polish** | PrefabEditor directional controls, real-time preview, frame validator API, full regression test suite. | 🟢 Complete | `src/app/dev/gamedata/editors/PrefabEditor.tsx`, `src/app/api/dev/gamedata/tileset-validator.ts`, 182/182 test files pass (1115/1115 pass) |

---

## 3. Scoped Commits on Branch

1. `13c4f6b7` - `feat(ecs): define directional tile orientation, autotile state, and themed tileset schemas (M1)`
2. `e4f4bd6b` - `feat(procgen): implement autotile bitmask solver, wall cap orientation, and directional prop anchors (M2)`
3. `bf5b0e4d` - `feat(gameplay): implement directional prop interactions, threat cover math, and directional templates (M3)`
4. `d1ca69f3` - `feat(rendering): integrate autotile frame resolution, sprite matrix rotation, and themed asset loading (M4)`
5. `a8143f2c` - `feat(studio): add directional tile brush controls, preview overlays, and manifest validation (M5)`

---

## 4. Verification Results

- **Unit & Integration Tests**: `npm test` -> 182 test files passed (1,115 / 1,115 tests passing, 0 failures).
- **TypeScript Typecheck**: `npm run typecheck` (`tsc --noEmit`) -> 0 errors.
- **ESLint Code Hygiene**: `npm run lint` (`eslint src/`) -> 0 errors, 0 warnings.
- **Production Build**: `npm run build` (`next build`) -> Compiled 100% cleanly in Next.js 16 (Turbopack).

---

## 5. Tile Inventory Deliverable: New Tile Designs Required for Pixel Artists

Per specification §2, §3, and §5 in `docs/design/DIRECTIONAL-TILEMAPS.md`, the following new 32×32 pixel art tiles must be illustrated by pixel artists to replace procedural texture rotation fallbacks with bespoke artwork:

### A. Wall Autotile Frames (16 Tiles)
All wall tiles are 32×32 pixels, rendered in top-down isometric/orthographic perspective matching current dungeon walls.
1. `wall_single` — Freestanding 1×1 wall pillar with all four sides exposed to floor.
2. `wall_cap_n` — Dead-end wall endcap terminating to the North (outward-facing cap facing open floor to North).
3. `wall_cap_e` — Dead-end wall endcap terminating to the East (outward-facing cap facing open floor to East).
4. `wall_cap_s` — Dead-end wall endcap terminating to the South (outward-facing cap facing open floor to South).
5. `wall_cap_w` — Dead-end wall endcap terminating to the West (outward-facing cap facing open floor to West).
6. `wall_straight_h` — Continuous horizontal wall segment connecting East and West.
7. `wall_straight_v` — Continuous vertical wall segment connecting North and South.
8. `wall_corner_ne` — Outer corner turning from North to East (South and West are floor).
9. `wall_corner_se` — Outer corner turning from South to East (North and West are floor).
10. `wall_corner_sw` — Outer corner turning from South to West (North and East are floor).
11. `wall_corner_nw` — Outer corner turning from North to West (South and East are floor).
12. `wall_t_n` — T-junction branching East, West, and North (South is floor).
13. `wall_t_e` — T-junction branching North, South, and East (West is floor).
14. `wall_t_s` — T-junction branching East, West, and South (North is floor).
15. `wall_t_w` — T-junction branching North, South, and West (East is floor).
16. `wall_cross` — 4-way intersection branching North, East, South, and West.

*(Optional 4 inner corner tiles for 8-bit diagonal refinement: `wall_corner_ne_inner`, `wall_corner_se_inner`, `wall_corner_sw_inner`, `wall_corner_nw_inner`)*.

---

### B. Directional Door Frames (4 Tiles)
1. `door_h_closed` — Closed blast door embedded horizontally between East and West walls.
2. `door_v_closed` — Closed blast door embedded vertically between North and South walls.
3. `door_h_open` — Open / retracted blast door embedded horizontally.
4. `door_v_open` — Open / retracted blast door embedded vertically.

---

### C. Directional Environmental Props (18 Tiles)
Bespoke cardinal perspectives showing front terminals, keypads, vents, and heavy armored plating:
1. **Workstations** (`requiresFrontAccess: true`):
   - `prop_workstation_n` — CRT terminal facing North (monitors/keyboards on North side, rear cables South).
   - `prop_workstation_e` — CRT terminal facing East (monitors/keyboards on East side, rear cables West).
   - `prop_workstation_s` — CRT terminal facing South (monitors/keyboards on South side, rear cables North).
   - `prop_workstation_w` — CRT terminal facing West (monitors/keyboards on West side, rear cables East).
2. **Lockers** (`requiresFrontAccess: true`):
   - `prop_locker_n` — Secured equipment locker with latch doors facing North.
   - `prop_locker_e` — Secured equipment locker with latch doors facing East.
   - `prop_locker_s` — Secured equipment locker with latch doors facing South.
   - `prop_locker_w` — Secured equipment locker with latch doors facing West.
3. **Biocabinets** (`requiresFrontAccess: true`):
   - `prop_biocabinet_n` — Cryo-reagent specimen cabinet with glass containment interface facing North.
   - `prop_biocabinet_e` — Cryo-reagent specimen cabinet with glass containment interface facing East.
   - `prop_biocabinet_s` — Cryo-reagent specimen cabinet with glass containment interface facing South.
   - `prop_biocabinet_w` — Cryo-reagent specimen cabinet with glass containment interface facing West.
4. **Encrypted Vault Doors** (`requiresFrontAccess: true`):
   - `prop_vault_door_n` — High-security biometric vault door with reinforced hatch facing North.
   - `prop_vault_door_e` — High-security biometric vault door with reinforced hatch facing East.
   - `prop_vault_door_s` — High-security biometric vault door with reinforced hatch facing South.
   - `prop_vault_door_w` — High-security biometric vault door with reinforced hatch facing West.
5. **Reinforced Crate Cover** (`isHalfCover: true`):
   - `prop_crate_cover_h` — Horizontal barricade pallet providing North/South directional cover.
   - `prop_crate_cover_v` — Vertical barricade pallet providing East/West directional cover.

---

### D. Themed Corporate Faction Palettes (3 Tileset Skins)
Each faction requires the above 38 tiles adapted into their corporate visual identity:
1. **Traxus Heavy Industry (`traxus_foundry`)**: Heavy industrial steel, rust-red plates, incandescent yellow hazard stripes, thermal coolant steam pipes.
2. **Sekiguchi Gene-Labs (`sekiguchi_biolabs`)**: Sterile surgical white tiles, cyan bio-luminescent tubes, tempered frost glass, cryo-condensation.
3. **Dark Subnet (`dark_subnet`)**: Overclocked obsidian carbon composite, neon magenta circuit traces, flickering glitch conduits.
