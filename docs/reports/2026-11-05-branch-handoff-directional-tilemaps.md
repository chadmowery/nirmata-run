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
| **M2: Autotile & Wall Cap Solver** | `AutotileSolver` (4-bit cardinal + 8-bit corner bitmasks, wall cap inversion, door alignments), dungeon generator wiring. | 🟢 Complete | `src/game/generation/autotile-solver.ts`, `src/game/generation/__tests__/autotile-solver.test.ts` (14/14 pass), 750-floor sweep verified |
| **M3: Directional Props & Cover** | Front-facing access constraint in `MovementSystem` & `PropInteractionSystem`, dot product cover in `CombatSystem`, entity templates. | 🟢 Complete | Systems updated, 18 directional entity templates registered, `src/game/systems/__tests__/directional-prop-cover.test.ts` (5/5 pass) |
| **M4: PixiJS 8 Rendering Layer** | `tilemap.ts` & `sprite-map.ts` sprite rotation and directional frame key lookups, themed faction asset loading. | 🟡 In Progress | Rendering tests |
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
  - **Milestone 2 Complete**:
    - Implemented `AutotileSolver` in `src/game/generation/autotile-solver.ts` with 4-bit cardinal bitmask lookup (`CARDINAL_AUTOTILE_TABLE`), Pass 2 wall cap direction inversion, and Pass 3 8-bit diagonal corner refinement.
    - Added door alignment resolution (`resolveDoorTile`).
    - Wired pre-computed `autotiledWalls` and anchor orientation into `dungeon-generator.ts`.
    - Wired `TileOrientation` and `DirectionalProp` attachment to environmental props in `entity-placement.ts`.
    - Authored comprehensive test suite in `src/game/generation/__tests__/autotile-solver.test.ts` (14/14 tests pass).
    - Verified 750-floor generation sweep and full typecheck/lint.
  - **Milestone 3 Complete**:
    - Confirmed user alignment on vector signs, orthogonal bump access, multiple diagonal floor fallback (`wall_cross`), and manifest fallback frames.
    - Updated `AutotileSolver` Pass 3 to fallback to `wall_cross` when multiple diagonal neighbors are floor.
    - Updated `MovementSystem` and `PropInteractionSystem` to enforce front-facing access constraints on props with `requiresFrontAccess === true`, halting movement at 0 turn cost with `[NOTICE] <PROP> FRONT INTERFACE IS TO THE <DIRECTION>` and clearing input queues.
    - Updated `CombatSystem.checkDirectionalCover` to evaluate threat vector against cover normal $(P_{\text{attacker}} - P_{\text{target}}) \cdot N_{\text{cover}} > 0$, bypassing cover on flanks.
    - Authored 18 directional entity templates (`prop-workstation-{n,e,s,w}`, `prop-locker-{n,e,s,w}`, `prop-biocabinet-{n,e,s,w}`, `prop-vault-door-{n,e,s,w}`, `prop-crate-cover-{h,v}`) and registered them in `EntityRegistry`.
    - Added unit test suite in `src/game/systems/__tests__/directional-prop-cover.test.ts` (5/5 pass) and verified regression in `cover-and-hazards.test.ts` (13/13 pass).
