# Branch Handoff: `directional-tilemaps`

> **Branch:** `directional-tilemaps`  
> **Base Commit:** `cd65dce9` (origin/main)  
> **Author / Agent:** Antigravity  
> **Date:** 2026-11-05  
> **Feature Spec:** [`docs/design/DIRECTIONAL-TILEMAPS.md`](../design/DIRECTIONAL-TILEMAPS.md)  
> **Status:** Work in Progress (Milestone 1 underway)

---

## 1. Executive Summary & Objective

The Directional Tilemaps & Themed Tileset feature branch implements:
1. **Orientation-Aware Spatial Grid**: Engine-wide support for cardinal tile orientations (`NORTH`, `EAST`, `SOUTH`, `WEST`), rotation math, and directional vectors.
2. **Procedural Autotiling & Wall Cap Engine**: Deterministic 4-bit cardinal and 8-bit diagonal bitmask solver computing straight runs, outer/inner corners, T-junctions, cross-junctions, and terminal Wall Caps (`wall_cap_n`, `wall_cap_e`, `wall_cap_s`, `wall_cap_w`).
3. **Directional Props & Cover Mechanics**: Front-facing interaction footprints (`requiresFrontAccess === true`) with 0-turn-cost bump safeguards and directional cover mitigation vectors ($V_{\text{attack}} \cdot N_{\text{cover}}$).
4. **Themed Tileset Manifest Schema**: Formal Zod-validated `ThemedTilesetManifestSchema` supporting corporate faction themes and fallback frame resolution.
5. **PixiJS 8 Rendering Pipeline Integration**: Frame lookup resolution and texture matrix rotations.
6. **Gamedata Studio Tooling**: Directional brush controls ('R' key rotation), visual direction overlays, and real-time autotile preview.

---

## 2. Technical Milestones & Progress

| Milestone | Description | Status | Verification / Artifacts |
| :--- | :--- | :--- | :--- |
| **M1: Core Schemas & Types** | `TileOrientation`, `AutotileState`, `DirectionalProp` Zod schemas, `ThemedTilesetManifestSchema`, registration in `COMPONENTS_REGISTRY`. | 🟢 Complete | `src/shared/components/environment.ts`, `src/shared/tileset-types.ts`, `src/shared/components/__tests__/directional-environment.test.ts`, `src/shared/__tests__/tileset-types.test.ts` (8/8 pass) |
| **M2: Autotile & Wall Cap Solver** | `AutotileSolver` (4-bit cardinal + 8-bit corner bitmasks, wall cap inversion, door alignments), dungeon generator wiring. | 🟡 In Progress | `src/game/generation/autotile-solver.ts`, unit tests |
| **M3: Directional Props & Cover** | Front-facing access constraint in `MovementSystem` & `PropInteractionSystem`, dot product cover in `CombatSystem`, entity templates. | ⚪ Pending | Systems, templates, unit tests |
| **M4: PixiJS 8 Rendering Layer** | `tilemap.ts` & `sprite-map.ts` sprite rotation and directional frame key lookups, themed faction asset loading. | ⚪ Pending | Rendering tests |
| **M5: Gamedata Studio & Polish** | PrefabEditor directional controls, real-time preview, frame validator API, regression test suite. | ⚪ Pending | Dev UI tests, typecheck, lint |

---

## 3. Pending Questions for User Alignment

1. **Inner Corner Priority for Bitmask 15**:
   When all 4 cardinal neighbors are walls and multiple diagonal neighbors are floor (e.g. NW and SE), should solver resolve the first matching inner corner in order (NW > NE > SE > SW) or fallback to `wall_cross`?
2. **Directional Prop Bump Interaction**:
   On the orthogonal grid, is bump-to-loot strictly valid from the single tile facing the front interface (`prop.pos + frontFacingVector`), halting movement from the 2 sides and rear with `[NOTICE] FRONT INTERFACE IS TO THE <DIRECTION>`?
3. **Tile Art Asset Fallbacks**:
   Should directional frames in manifests map to existing isotropic frames as `fallbackFrame` and use sprite matrix rotation where applicable until artist assets are produced?

---

## 4. Work Log

- **2026-11-05**:
  - Reviewed specification `docs/design/DIRECTIONAL-TILEMAPS.md`.
  - Created feature branch `directional-tilemaps`.
  - Verified baseline test suite, typecheck (`tsc --noEmit`), and lint (`eslint src/`).
  - Initialized handoff document `docs/reports/2026-11-05-branch-handoff-directional-tilemaps.md`.
  - **Milestone 1 Complete**:
    - Authored `TileOrientation`, `AutotileState`, `DirectionalProp` schemas and directional math utilities in `src/shared/components/environment.ts`.
    - Registered components in `COMPONENTS_REGISTRY` in `src/shared/components/index.ts`.
    - Authored `ThemedTilesetManifestSchema` in `src/shared/tileset-types.ts`.
    - Authored unit test suites verifying math, schema defaults, and ECS world serialization (`8/8` tests pass).
    - Verified clean typecheck and lint.
