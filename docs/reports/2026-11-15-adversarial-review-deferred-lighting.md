# Adversarial Architectural & Implementation Review: Per-Pixel / Deferred Lighting & Rendering System (`LIGHT-01` – `LIGHT-07`)

**Date:** 2026-11-15  
**Branch Reviewed:** `feature/deferred-lighting-rendering` (`main...HEAD`, 12 commits, 238 files changed, `+8,190 / -868`)  
**Target Specifications & Rulebooks:**
- [`docs/design/DEFERRED-LIGHTING-RENDERING.md`](../design/DEFERRED-LIGHTING-RENDERING.md)
- [`AGENTS.md`](../../AGENTS.md), [`src/rendering/AGENTS.md`](../../src/rendering/AGENTS.md), [`src/shared/AGENTS.md`](../../src/shared/AGENTS.md), [`src/client/AGENTS.md`](../../src/client/AGENTS.md), [`src/server/AGENTS.md`](../../src/server/AGENTS.md), [`src/dev-tool/AGENTS.md`](../../src/dev-tool/AGENTS.md)

---

## 1. Executive Summary

An adversarial code and architecture audit was conducted across the 12 commits on `feature/deferred-lighting-rendering` (`a6ee64ed..029cb444`) against [`docs/design/DEFERRED-LIGHTING-RENDERING.md`](../design/DEFERRED-LIGHTING-RENDERING.md) and the layer rulebooks in [`AGENTS.md`](../../AGENTS.md).

### Overall Health Assessment
- **Automated Verification Baseline**:
  - `npm run typecheck`: **PASS** (`0` errors)
  - `npm run lint`: **PASS** (`0` warnings/errors)
  - `npm test`: **PASS** (`248` test files, `1,662` tests passing)
- **What Went Right**:
  - **Lossless Non-Premultiplied Companion Atlases**: [`scripts/lib/surface-compiler.cjs`](../../scripts/lib/surface-compiler.cjs) encodes `512 × 512` `_n.png` and `_m.png` atlases via a custom raw `zlib` PNG encoder (bypassing Cairo/node-canvas alpha premultiplication), and [`src/rendering/assets.ts`](../../src/rendering/assets.ts) decodes them via `createImageBitmap(blob, { premultiplyAlpha: 'none' })` with `alphaMode: 'no-premultiply-alpha'`.
  - **Theme Transition BindGroup Safety**: [`GBufferPass.capture()`](../../src/rendering/lighting/gbuffer-pass.ts#L545-L554) unbinds transient sector atlas sources back to `PIXI.Texture.EMPTY.source` in a `finally` block so unloading previous themed atlases does not corrupt WebGL `BindGroup` listeners.
  - **Zero-Allocation Pooled Particle & Micro-Light Clustering**: [`ParticlePool`](../../src/rendering/particles/particle-pool.ts) pre-allocates 512 particle slots and 128 cluster buckets, spatially hashing emissive particles into `12 × 12 px` cells capped to `MAX_MICRO_LIGHTS = 64` without per-frame heap allocations.
  - **Strict Layer Import Hygiene**: `@shared`, `@rendering`, `@client`, `@server`, and `@dev-tool` respect all import boundaries in [`AGENTS.md`](../../AGENTS.md).
- **Verdict**: **ALL 11 FINDINGS RESOLVED** (Remediation verified on branch `fix/deferred-lighting-issues`: `249` test files / `1,677` tests passing, `npm run typecheck` `0` errors, `npm run lint` `0` errors/warnings). Initially, the audit uncovered **2 Critical (`P0`) blockers**, **3 High (`P1`) architectural/spec violations**, **5 Medium (`P2`) spec/shader gaps**, and **1 Low (`P3`) minor issue**, all of which (along with the two residual `P3` notes in Section 5.3) have now been resolved and verified.

### Adversarial Findings Scorecard

| ID | Severity | Layer | Finding Summary | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`CRIT-01`** | **P0 (Critical)** | `@dev-tool` | **`InspectorLitTilePreview.tsx` Swaps Material Channels (`B` vs `A`, `A` vs `G`), Corrupts `_n.png`/`_m.png` via Premultiplied 2D Canvas `drawImage`, and Inverts `ny`**: Reads elevation height $Z$ from channel `B` (Roughness) instead of `A` (Height) and shadow opacity from `A` instead of `G`; uses `ctx.drawImage` + `getImageData` which zeroes RGB wherever `A = 0` (`floor` tiles); and negates `ny` in Y-down screen coordinates. | **RESOLVED** |
| **`CRIT-02`** | **P0 (Critical)** | `@rendering` | **G-Buffer Opaque Particle Overwrite (`blend = false`) Erases Underlying Wall, Prop, and Actor Height $Z$, Shadow Opacity, and Normals**: `GBufferPass` appends `emissive` (`shadowOpacity = 0`) and `normal_lit` (`heightZ = 8px, shadowOpacity = 0.15`) particles after `terrainLayer`/`entityLayer` in a single `blend = false` mesh pass, punching light-leaking holes through solid 32px walls and entity shadow silhouettes. | **RESOLVED** |
| **`HIGH-01`** | **P1 (High)** | `@rendering` | **`RenderSystem` Directly Mutates ECS `LightSource` Components via `world.patchComponent`, Corrupts Baseline Lights Across Floors, and Starves `MAX_PRIMARY_LIGHTS` with Explored Out-of-FOV Props**: Violates [`src/rendering/AGENTS.md` §2.1](../../src/rendering/AGENTS.md#L10-L13) read-only mandate; snapshots already-mutated player `LightSource` on floor transitions; reads live prop state outside FOV; and lets explored out-of-FOV props consume the 64-light budget before active FOV/transient lights. | **RESOLVED** |
| **`HIGH-02`** | **P1 (High)** | `@rendering` / `@dev-tool` | **`LightSource.offsetX` / `offsetY`, `RADAR_SWEEP` Angular Beam Modulation, and `secondaryColor` on `FLICKER` / `STROBE` / `RADAR_SWEEP` Are Unimplemented**: `LightingSystem.update()` ignores `offsetX`/`offsetY` and `angleOffsetRad`; `DEFERRED_LIGHT_FRAG` has no angular sweep beam; and `evaluateLightAnimation()` ignores `secondaryColor` on all modes except `PULSE`. | **RESOLVED** |
| **`HIGH-03`** | **P1 (High)** | `@rendering` | **Player Shell & Prop Dynamic Light Modulation Diverges from Spec §5.3**: Missing `Heat >= 100%` `#ff0055`/`#a855f7` `14 Hz` Corruption Zone state; `Heat 61–99%` uses stepped `FLICKER` instead of smooth `#ff9500` `3 Hz` `PULSE`; `Extended_Sight.sys` adds `+48px` instead of `visionRadius * TILE_SIZE` (`384px`) and omits `height = 28px`; `GHOST_PULSE.exe` uses `256px / 1200ms` instead of expanding `320px / 650ms`; and corrupted props omit `!corrupted.triggered`. | **RESOLVED** |
| **`MED-01`** | **P2 (Medium)** | `@rendering` | **`MicroLightDescriptor.radiusPx` Is Multiplied by `cameraZoom` Twice (`cameraZoom²` Scaling Bug)**: `ParticlePool.collectRenderDescriptors()` multiplies `maxRadiusPx * cameraZoom`, and `DEFERRED_LIGHT_FRAG` multiplies `m0.z * uCameraZoom` again, scaling micro-light radii by `cameraZoom²`. | **RESOLVED** |
| **`MED-02`** | **P2 (Medium)** | `@rendering` | **`SelectiveBloomFilter` Does Not Downsample (`480×320 → 240×160`) and Ignores Faction / Sector Condition Bloom Multipliers (Spec §2, §4.2)**: Allocates full-res `960×640` pooled textures for a single Kawase pass and never invokes `setIntensity()` with the Spec §4.2 theme/condition bloom multipliers (`1.0x`–`1.50x`). | **RESOLVED** |
| **`MED-03`** | **P2 (Medium)** | `@rendering` | **`OVERCLOCKED_GRID` Harmonic Light Jitter (`jitter: 0.25`) Is Dead Code & `NuCaloric` Ambient Color Mismatch (Spec §4.2)**: `SECTOR_CONDITION_VISUAL_PROFILES.OVERCLOCKED_GRID.jitter` is defined but never read; `NUCALORIC_PROFILE` uses `#101b24` instead of `#1a0d1e`. | **RESOLVED** |
| **`MED-04`** | **P2 (Medium)** | `@rendering` | **Unused `rtAlbedo` (`960×640` RenderTexture) VRAM Allocation, Enemy `GlitchFilter` Slice Desync (Spec §2.3), and Heat Ghost Shadow Casting**: `GBufferPass` allocates an unused `960×640` `rtAlbedo` texture (~2.45 MB VRAM), does not displace enemy G-Buffer quads during `GlitchFilter` tears, and renders translucent player heat-ghost trails (`alpha = 0.35`) as solid shadow casters. | **RESOLVED** |
| **`MED-05`** | **P2 (Medium)** | `scripts/` | **Surface Compiler Elevation Heights ($Z$) for Walls (`18–28px` vs `32px`), Closed Laser Doors, and Box Props & Legacy Master Sheets Diverge from Spec §3.3 & §7.2**: Wall skirts (`18px`) sit below `22–26px` lights; closed laser doors (`door`) block light across the transparent laser beam (`shadowOpacity = 255`); `prop_dead_drop` shares `18px` height with tall lockers/safes; and `780×410` themed master sheets were not updated to the 4-view diagnostic layout. | **RESOLVED** |
| **`LOW-01`** | **P3 (Low)** | `@rendering` | **Unseeded `Math.random()` in `ParticleSystem` & Incomplete `disposeAllEmitters()` Cleanup in Legacy Wrapper**: `ParticleSystem` uses `Math.random()` rather than a deterministic PRNG, and `src/rendering/filters/particle-emitters.ts` leaves `sharedParticleSystem` allocated on `disposeAllEmitters()`. | **RESOLVED** |

---

## 2. Scope, Methodology & Regression Provenance

- **Branch Diff Inspected**: `git diff main...HEAD` (`feature/deferred-lighting-rendering`, commits `a6ee64ed` through `029cb444`).
- **Subsystems Audited**:
  1. **ECS Schema & Templates (`LIGHT-01`)**: [`src/shared/components/light-source.ts`](../../src/shared/components/light-source.ts), [`src/shared/components/floor-state.ts`](../../src/shared/components/floor-state.ts), [`src/shared/components/index.ts`](../../src/shared/components/index.ts), [`src/game/entities/templates/*.json`](../../src/game/entities/templates/), [`src/game/shells/shared/templates/*.json`](../../src/game/shells/shared/templates/).
  2. **Multi-Plane Surface Compiler & Asset Loader (`LIGHT-02`)**: [`scripts/lib/surface-compiler.cjs`](../../scripts/lib/surface-compiler.cjs), [`scripts/compile-lighting-atlases.cjs`](../../scripts/compile-lighting-atlases.cjs), [`scripts/build-environment-tiles.cjs`](../../scripts/build-environment-tiles.cjs), [`scripts/build-shell-tiles.cjs`](../../scripts/build-shell-tiles.cjs), [`scripts/generate-themed-tilesets.cjs`](../../scripts/generate-themed-tilesets.cjs), [`src/rendering/assets.ts`](../../src/rendering/assets.ts), [`src/rendering/sprite-map.ts`](../../src/rendering/sprite-map.ts).
  3. **Deferred G-Buffer, Raymarcher & Bloom Shaders (`LIGHT-03`)**: [`src/rendering/lighting/types.ts`](../../src/rendering/lighting/types.ts), [`src/rendering/lighting/gbuffer-pass.ts`](../../src/rendering/lighting/gbuffer-pass.ts), [`src/rendering/lighting/deferred-light-filter.ts`](../../src/rendering/lighting/deferred-light-filter.ts), [`src/rendering/lighting/bloom-filter.ts`](../../src/rendering/lighting/bloom-filter.ts), [`src/rendering/lighting/lighting-system.ts`](../../src/rendering/lighting/lighting-system.ts).
  4. **FOV Mask & Dynamic Telemetry Wiring (`LIGHT-04`)**: [`src/rendering/render-system.ts`](../../src/rendering/render-system.ts), [`src/rendering/tilemap.ts`](../../src/rendering/tilemap.ts), [`src/rendering/fov.ts`](../../src/rendering/fov.ts).
  5. **Pooled Dual-Mode Lit Particle & Micro-Light System (`LIGHT-05`)**: [`src/rendering/particles/presets.ts`](../../src/rendering/particles/presets.ts), [`src/rendering/particles/particle-pool.ts`](../../src/rendering/particles/particle-pool.ts), [`src/rendering/particles/particle-system.ts`](../../src/rendering/particles/particle-system.ts), [`src/rendering/filters/particle-emitters.ts`](../../src/rendering/filters/particle-emitters.ts).
  6. **Gamedata Studio Authoring & 3×3 Lit Preview (`LIGHT-06`)**: [`src/dev-tool/studio/editors/subeditors/LightSourceSubEditor.tsx`](../../src/dev-tool/studio/editors/subeditors/LightSourceSubEditor.tsx), [`src/dev-tool/studio/shared/InspectorLitTilePreview.tsx`](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx), [`src/dev-tool/studio/shared/ResolvedPreviewPanel.tsx`](../../src/dev-tool/studio/shared/ResolvedPreviewPanel.tsx), [`src/dev-tool/studio/editors/ShellEditor.tsx`](../../src/dev-tool/studio/editors/ShellEditor.tsx), [`src/dev-tool/studio/editors/shared/ComponentFieldGroup.tsx`](../../src/dev-tool/studio/editors/shared/ComponentFieldGroup.tsx).
  7. **Unit & Integration Test Suite (`LIGHT-07`)**: [`tests/rendering/lighting-component-and-atlases.test.ts`](../../tests/rendering/lighting-component-and-atlases.test.ts), [`tests/rendering/companion-assets.test.ts`](../../tests/rendering/companion-assets.test.ts), [`tests/rendering/lighting-system.test.ts`](../../tests/rendering/lighting-system.test.ts), [`tests/rendering/particle-lighting.test.ts`](../../tests/rendering/particle-lighting.test.ts).

### 2.1 Regression Provenance & Commit Attribution (Important for Remediating Agent)

Five post-implementation bug-fix commits were landed on the branch (`6940f63a`, `68e144f2`, `1dc7f2f2`, `dfae0ef4`, `029cb444`). **When remediating the findings below, preserve the invariants established by those 5 commits while fixing their side effects:**

1. **Directly Introduced as Side Effects of Recent Bug Fixes (3 Findings)**:
   - **`CRIT-02` (Particles erasing wall/actor Height $Z$ and Shadow Opacity in the G-Buffer)** — *Introduced by `1dc7f2f2`* (`fix(rendering): prevent normal/material premultiplication and G-Buffer blending bias`):
     - `1dc7f2f2` set `opaqueState.blendMode = 'none'` and `normalMesh.blendMode = 'none'` / `materialMesh.blendMode = 'none'` in [`gbuffer-pass.ts`](../../src/rendering/lighting/gbuffer-pass.ts#L353-L370) so sprite alpha would not bias normal vectors or material channels.
     - **Guardrail**: Do **not** revert `normalMesh` / `materialMesh` back to standard alpha blending for terrain/entity sprites. Instead, prevent particle quads (`mode > 0.5`) from overwriting higher/more-opaque solid geometry in `rtMaterialHeight` (e.g., pack particles before `terrainLayer`/`entityLayer` or only over floor texels).
   - **`MED-02` (Part 1: `SelectiveBloomFilter` running at `1×` full resolution instead of `480×320 → 240×160`)** — *Introduced by `6940f63a`* (`fix(lighting): resolve GLSL ES shader errors, filterArea bounds, and theme cache lookups`):
     - Originally in `51519fed` (`LIGHT-03`), [`bloom-filter.ts`](../../src/rendering/lighting/bloom-filter.ts#L190-L211) downsampled `1/2 → 1/4` resolution using `uBloomUvScale`. Commit `6940f63a` fixed a UV/filterArea scaling bug by replacing the pyramid with `PIXI.TexturePool.getSameSizeTexture(input)` (`960×640`).
     - **Guardrail**: If restoring `480×320 → 240×160` downsampling, ensure `vTextureCoord` / `uInputSize` / `uOutputFrame` mapping remains aligned with `worldContainer.filterArea` set in `6940f63a`.
   - **`MED-04` (Part 1: Unused `rtAlbedo` `960×640` RenderTexture sitting in VRAM)** — *Introduced by `6940f63a`*:
     - Commit `6940f63a` removed `renderer.render({ container: worldContainer, target: this.rtAlbedo })` from [`gbuffer-pass.ts`](../../src/rendering/lighting/gbuffer-pass.ts#L456-L555) because `DeferredLightFilter` already receives `uTexture` from PixiJS `FilterSystem`, but left `this.rtAlbedo = PIXI.RenderTexture.create(...)` allocated in the constructor.

2. **Incomplete / Partial Bug Fixes That Missed a Parallel Codepath (2 Findings)**:
   - **`CRIT-01` (Part 2: Premultiplied alpha corruption of `_n.png` / `_m.png` in Gamedata Studio)** — *Missed by `1dc7f2f2`*:
     - `1dc7f2f2` fixed browser alpha premultiplication of `_n.png` and `_m.png` in [`src/rendering/assets.ts`](../../src/rendering/assets.ts#L71-L96) via `createImageBitmap(blob, { premultiplyAlpha: 'none' })`, but `readAtlasPixels()` in [`src/dev-tool/studio/shared/InspectorLitTilePreview.tsx`](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx#L31-L40) still uses `ctx.drawImage(img, 0, 0)` + `ctx.getImageData()`.
   - **`HIGH-01` (Part 4: Out-of-FOV explored props consuming `MAX_PRIMARY_LIGHTS` slots)** — *Partially fixed by `68e144f2` & `dfae0ef4`*:
     - `68e144f2` added `if (sprite && sprite.visible === false) continue;` in [`lighting-system.ts`](../../src/rendering/lighting/lighting-system.ts#L223) to cull hidden out-of-FOV lights. That gated out-of-FOV *enemies* (`visible: false`), but because explored *props* remain `visible: true` in Fog-of-War ([`fov.ts:125`](../../src/rendering/fov.ts#L125)), explored out-of-FOV props still bypass `sprite.visible === false` and consume slots in the 64-light buffer even though the shader gates their light to `0.0`.

3. **Original Implementation Bugs / Spec Gaps from `LIGHT-01`–`LIGHT-06` (6 Findings)**:
   - **`CRIT-01` (Parts 1 & 3)**: Swapped `_m.png` channels (`B` Roughness read as Height $Z$, `A` Height $Z$ read as Shadow Opacity) and negated `ny` in [`InspectorLitTilePreview.tsx`](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx#L274-L306) (`fc590633` / `LIGHT-06`).
   - **`HIGH-01` (Parts 1–3)**: Mutating ECS `LightSource` via `world.patchComponent` inside [`render-system.ts`](../../src/rendering/render-system.ts#L308-L418) and clearing `baseLightByEntity` on floor transition without restoring the base component (`0e8607df` / `LIGHT-04`).
   - **`HIGH-02`**: Ignoring `offsetX`/`offsetY`, `RADAR_SWEEP` angular beam modulation, and `secondaryColor` on `FLICKER`/`STROBE`/`RADAR_SWEEP` (`51519fed` / `LIGHT-03`).
   - **`HIGH-03`**: Non-spec Heat/Stability/`Extended_Sight.sys`/`GHOST_PULSE.exe` curves and missing `!corrupted.triggered` check in [`render-system.ts`](../../src/rendering/render-system.ts#L332-L402) (`0e8607df` / `LIGHT-04`).
   - **`MED-01`**: Multiplying `MicroLightDescriptor.radiusPx` by `cameraZoom` in both [`particle-pool.ts`](../../src/rendering/particles/particle-pool.ts#L436) and [`deferred-light-filter.ts`](../../src/rendering/lighting/deferred-light-filter.ts#L196) (`ff06602e` / `LIGHT-05`).
   - **`MED-02` (Part 2), `MED-03`, `MED-04` (Parts 2–3), `MED-05`, `LOW-01`**: Unwired bloom multipliers, unused `OVERCLOCKED_GRID` `jitter`, `surface-compiler.cjs` height/door constants, and `Math.random()` in `ParticleSystem`.

---

## 3. Detailed Findings by Category

### Category A: Critical / Blocker (`P0`)

#### `CRIT-01`: `InspectorLitTilePreview.tsx` Swaps G-Buffer Material Channels (`B` vs `A`, `A` vs `G`), Corrupts `_n.png`/`_m.png` via Premultiplied 2D Canvas `drawImage`, and Inverts `ny`
- **Locations**:
  - [`src/dev-tool/studio/shared/InspectorLitTilePreview.tsx:31-40`](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx#L31-L40)
  - [`src/dev-tool/studio/shared/InspectorLitTilePreview.tsx:118-121`](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx#L118-L121)
  - [`src/dev-tool/studio/shared/InspectorLitTilePreview.tsx:273-283`](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx#L273-L283)
  - [`src/dev-tool/studio/shared/InspectorLitTilePreview.tsx:304-309`](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx#L304-L309)
- **Spec Reference**: [`DEFERRED-LIGHTING-RENDERING.md` §2.1 & §8.2](../design/DEFERRED-LIGHTING-RENDERING.md#L71-L85)
- **Description & Root Cause**:
  1. **Swapped Material Channels (`B` vs `A` and `A` vs `G`)**:
     - Spec §2.1 and [`scripts/lib/surface-compiler.cjs:157-164`](../../scripts/lib/surface-compiler.cjs#L157-L164) encode `materialHeightTexture` (`_m.png`) as:
       - `R` (`index + 0`): Emissive ($E$)
       - `G` (`index + 1`): Shadow-caster opacity ($O$)
       - `B` (`index + 2`): Surface roughness ($R_g$)
       - `A` (`index + 3`): Elevation Height $Z$ ($Z = A \times 32.0\text{px}$)
     - In [`InspectorLitTilePreview.tsx`](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx#L278-L279), line 279 reads pixel height `pz` from `material[i + 2]` (channel `B` = **Roughness**) and scales by `48` instead of `32`:
       ```ts
       const emissive = material[i] / 255;
       const pz = (material[i + 2] / 255) * 48;
       ```
     - Similarly, in the 8-step shadow raymarcher ([lines 305–306](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx#L305-L306)), `occZ` is read from `material[si + 2]` (Roughness) and `occOp` is read from `material[si + 3]` (Height $Z$):
       ```ts
       const occZ = (material[si + 2] / 255) * 48;
       const occOp = material[si + 3] / 255;
       ```
     - Because `floor` tiles have high matte roughness (`B = 210` in `surface-compiler.cjs:424`), `InspectorLitTilePreview` evaluates every floor pixel at height `pz = (210 / 255) * 48 = 39.5px` — higher than the default light source (`lz = 22px`), causing `dz = lz - pz = -17.5px` (`ndotl` clamped to `0` on flat floors!) and completely broken shadow raymarching.
  2. **Premultiplied Alpha Corruption of `_n.png` and `_m.png` via HTML5 2D Canvas**:
     - [`readAtlasPixels()`](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx#L31-L40) decodes `/assets/tileset_n.png` and `/assets/tileset_m.png` by drawing an `HTMLImageElement` onto a 2D `<canvas>` (`ctx.drawImage(img, 0, 0)`) and calling `ctx.getImageData(0, 0, img.width, img.height)`.
     - HTML5 2D Canvas backing stores are premultiplied by alpha. Wherever `_n.png` has `Specular = 0` (`A = 0`) or `_m.png` has `Height Z = 0` (`A = 0`, which is true for all `floor` and `staircase` tiles), `drawImage` multiplies `R, G, B` by `0`, destroying the normal and material channels before `blitFrame` ever reads them.
  3. **Inverted Vertical Normal Component (`ny`)**:
     - [Line 274](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx#L274) negates `ny`: `const ny = -((normal[i + 1] / 255) * 2 - 1);`, while `dy = ly - py` ([line 282](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx#L282)) is in screen space (`+Y` pointing South/Down).
     - In [`surface-compiler.cjs`](../../scripts/lib/surface-compiler.cjs#L200) and [`deferred-light-filter.ts`](../../src/rendering/lighting/deferred-light-filter.ts#L106), South-facing bevels and wall skirts encode $+N_y > 0$ (`G > 128`). Negating `ny` inverts vertical relief shading so South-facing wall faces are darkened when the orbiting light is to the South and illuminated when the light is behind the wall to the North.
  4. **Ignored `offsetX` / `offsetY` & Roughness Shininess**:
     - `effectiveLight.offsetX` and `offsetY` ([lines 207–208](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx#L207-L208)) are never added to `lx, ly`, and Blinn-Phong specular uses a hardcoded exponent `24` ([line 324](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx#L324)) instead of `mix(48.0, 6.0, roughness)` from `material[i + 2]`.
- **Required Fix**:
  - Decode `_n.png` and `_m.png` in `InspectorLitTilePreview.tsx` without alpha premultiplication (e.g., via raw PNG chunk inflate or `createImageBitmap(blob, { premultiplyAlpha: 'none' })` into a WebGL texture readback / un-premultiplied PNG buffer parser).
  - Fix channel indexing: `emissive = material[i] / 255`, `shadowOp = material[i + 1] / 255`, `roughness = material[i + 2] / 255`, `pz = (material[i + 3] / 255) * 32`, and in the shadow loop `occOp = material[si + 1] / 255`, `occZ = (material[si + 3] / 255) * 32`.
  - Remove the erroneous minus sign on `ny` (`const ny = (normal[i + 1] / 255) * 2 - 1;`) and normalize `(nx, ny, nz)`.
  - Apply `effectiveLight.offsetX` / `offsetY` and roughness-driven shininess.

---

#### `CRIT-02`: G-Buffer Opaque Particle Overwrite (`blend = false`) Erases Underlying Wall, Prop, and Actor Height $Z$, Shadow Opacity, and Normals
- **Locations**:
  - [`src/rendering/lighting/gbuffer-pass.ts:73-91`](../../src/rendering/lighting/gbuffer-pass.ts#L73-L91)
  - [`src/rendering/lighting/gbuffer-pass.ts:138-159`](../../src/rendering/lighting/gbuffer-pass.ts#L138-L159)
  - [`src/rendering/lighting/gbuffer-pass.ts:353-370`](../../src/rendering/lighting/gbuffer-pass.ts#L353-L370)
  - [`src/rendering/lighting/gbuffer-pass.ts:688-726`](../../src/rendering/lighting/gbuffer-pass.ts#L688-L726)
  - [`src/rendering/particles/particle-pool.ts:174-197, 240-255`](../../src/rendering/particles/particle-pool.ts#L174-L255)
- **Spec Reference**: [`DEFERRED-LIGHTING-RENDERING.md` §2.1, §3.3 & §6.1](../design/DEFERRED-LIGHTING-RENDERING.md#L71-L85)
- **Description & Root Cause**:
  1. In [`GBufferPass`](../../src/rendering/lighting/gbuffer-pass.ts#L353-L370), `normalMesh` and `materialMesh` are rendered with `opaqueState.blend = false; blendMode = 'none'` so sprite quads overwrite background clear values without premultiplied alpha blending.
  2. [`packQuads()`](../../src/rendering/lighting/gbuffer-pass.ts#L688-L726) appends all active particles (`mode = 1.0` for `EMISSIVE_LIGHT`, `mode = 2.0` for `NORMAL_LIT`) **after** `terrainLayer`, `itemLayer`, and `entityLayer` into that same `blend = false` mesh draw call.
  3. In [`GBUFFER_MATERIAL_FRAG`](../../src/rendering/lighting/gbuffer-pass.ts#L138-L159):
     - **Mode 1 (`emissive`)** writes `finalColor = vec4(clamp(core * 1.15, 0.0, 1.0), 0.0, 0.15, vMeta.z)` — setting **Shadow Opacity (`G`) = `0.0`**!
     - **Mode 2 (`normal_lit`)** writes `finalColor = vec4(0.0, vMeta.w * puffAlpha, 0.85, vMeta.z * nz)` — setting **Shadow Opacity (`G`) $\le 0.15$** and **Height $Z$ (`A`) = `8..12px`**.
  4. Because `blend = false`, any particle overlapping a structural wall (`Z = 28..32px, O = 1.0`), closed door, tall prop (`Z = 20..26px, O = 0.8..1.0`), or actor (`Z = 18px, O = 0.7`) **completely overwrites and erases** the underlying solid object's Height $Z$ and Shadow Opacity in `rtMaterialHeight` (as well as its normal in `rtNormalSpec`).
  5. Every enemy (`NULL_POINTER`, `BUFFER_OVERFLOW`, `FRAGMENTER`, `LOGIC_LEAKER`, `SYSTEM_ADMIN`, `SEED_EATER`) and key props (`prop_capacitor_bank`, `anchor`, `prop_stabilizer`, `prop_cooling_vent_ready`) have **persistent particle emitters** spawning directly over their own sprites ([`render-system.ts:673-682`](../../src/rendering/render-system.ts#L673-L682)). Those particles continuously punch `shadowOpacity = 0` holes into the entity's own shadow-casting silhouette, and whenever mist puffs (`size = 7..12px`) or sparks drift across a wall, they punch `Z = 8px, O = 0..0.15` holes right through the wall in `rtMaterialHeight`, causing corridor lights to leak rays through solid walls.
  6. Furthermore, in [`ParticlePool`](../../src/rendering/particles/particle-pool.ts#L176-L196), each particle sprite in `effectsLayer` uses `PIXI.Texture.WHITE` (an unclipped square quad), whereas `GBUFFER_NORMAL_FRAG` and `GBUFFER_MATERIAL_FRAG` `discard` outside `d > 1.0` (a circle), leaving unlit square corners in `uTexture` (Albedo) outside the circular G-Buffer footprint.
- **Required Fix**:
  - Do not allow translucent/emissive particles to overwrite taller or more opaque solid geometry in `rtMaterialHeight` (or render particles into the G-Buffer only over floor pixels / use `MAX` blending for material channels `R` (emissive), `G` (shadowOpacity), `A` (heightZ), or render `NORMAL_LIT` vapor particles in `terrainLayer`/`itemLayer` below walls and tall actors so walls/actors at higher elevation overwrite floor-level mist).
  - Provide a soft circular radial texture for `ParticlePool` sprites so `effectsLayer` albedo particles match the circular G-Buffer footprint.

---

### Category B: High / Architectural & Spec Violations (`P1`)

#### `HIGH-01`: `RenderSystem` Directly Mutates ECS `LightSource` Components via `world.patchComponent`, Corrupts Baseline Lights Across Floors, and Starves `MAX_PRIMARY_LIGHTS` with Explored Out-of-FOV Props
- **Locations**:
  - [`src/rendering/render-system.ts:308-418, 1726`](../../src/rendering/render-system.ts#L308-L418)
  - [`src/rendering/lighting/lighting-system.ts:210-288`](../../src/rendering/lighting/lighting-system.ts#L210-L288)
  - [`src/rendering/AGENTS.md` §2.1](../../src/rendering/AGENTS.md#L10-L13)
- **Architectural & Spec Reference**:
  - [`src/rendering/AGENTS.md` §2.1](../../src/rendering/AGENTS.md#L10-L13): *"1. Simulation Decoupling (Read-Only Representation): The renderer is purely a visual subscriber. It reads components from `World` and `Grid` and listens to `EventBus` signals. Never mutate game state... from within rendering systems."*
  - [`DEFERRED-LIGHTING-RENDERING.md` §1.1 (#5, #6), §4.1 & §5.3](../design/DEFERRED-LIGHTING-RENDERING.md#L21-L24)
- **Description & Root Cause**:
  1. **Direct ECS World Mutation in `renderSystem.ts`**:
     - [`syncDynamicEntityLights()`](../../src/rendering/render-system.ts#L363-L369) calls `world.patchComponent(playerEntity, LightSource, ...)` and [line 410](../../src/rendering/render-system.ts#L410-L416) calls `world.patchComponent(propId, LightSource, ...)` during the render pass.
  2. **Player Light Baseline Corruption Across Floor Transitions**:
     - When descending to a new floor, [`FloorManagerSystem`](../../src/game/systems/floor-manager.ts#L72) preserves `playerId` and its components, and [`RenderSystem.onDungeonGenerated()`](../../src/rendering/render-system.ts#L1726) calls `baseLightByEntity.clear()`.
     - If the player descends while `Heat >= 51` or `Stability < 50` or `Extended_Sight.sys` is active, the player's `LightSource` component in `world` still holds the mutated color (`#ff4500` / `#ffb020`), mutated intensity (`1.25x`), and mutated radius (`1.25x` or `+48px`).
     - On the first frame of the new floor, `!baseLightByEntity.has(playerEntity)` ([line 315](../../src/rendering/render-system.ts#L315)) snapshots that **already-mutated** `LightSource` as the new baseline! When the player later vents heat back to `0`, their light remains permanently stuck at `#ff4500`, and overheating again compounds the multiplier (`1.25 * 1.25 = 1.56x`).
  3. **Anti-Cheat Fog-of-War Prop State Read (`U1` Invariant)**:
     - In [`syncDynamicEntityLights()`](../../src/rendering/render-system.ts#L374-L417), every entity with `(Prop, LightSource)` is inspected using live ECS components (`prop.isSearched`, `corrupted.revealed`, `secLock.isLocked`) even when the prop is outside `currentFovSet` (in Explored Fog-of-War), instead of using client-remembered state (`rememberedProps`).
  4. **Primary Light Budget (`MAX_PRIMARY_LIGHTS = 64`) Starvation**:
     - Because [`isEntityVisible()`](../../src/rendering/fov.ts#L125) returns `visible: true` for props (`entityType === 'item'`) in `exploredSet`, explored out-of-FOV props have `sprite.visible === true`.
     - [`LightingSystem.update()`](../../src/rendering/lighting/lighting-system.ts#L210-L258) gathers `world.query(Position, LightSource)` in arbitrary entity ID order up to `MAX_PRIMARY_LIGHTS` (64), checking only `sprite.visible === false` and viewport frustum bounds.
     - Explored out-of-FOV props (whose direct light is zeroed in the fragment shader by `lightFovGate = smoothstep(0.25, 0.60, 0.25) = 0`) consume primary light slots. If 64 entity lights are gathered first, active in-FOV lights with higher entity IDs, all transient lights ([lines 261–277](../../src/rendering/lighting/lighting-system.ts#L261-L277)), and all `DARK_SUBNET` beacon pings ([lines 280–288](../../src/rendering/lighting/lighting-system.ts#L280-L288)) are dropped!
- **Required Fix**:
  - Compute dynamic light overrides (player Heat/Stability/Extended_Sight modulation and prop state overrides) as **render-time descriptors** inside the rendering layer without calling `world.patchComponent(id, LightSource, ...)` on `World`.
  - In `LightingSystem.update()`, skip non-beacon entity lights whose tile is outside `fovSet` (or whose `fovMask` at the light's tile is `< 0.25` and no rays reach into `fovSet`), and prioritize player + in-FOV lights + transient lights within `MAX_PRIMARY_LIGHTS` (sorting by priority/distance if candidate lights exceed 64).

---

#### `HIGH-02`: `LightSource.offsetX` / `offsetY`, `RADAR_SWEEP` Angular Beam Modulation, and `secondaryColor` on `FLICKER` / `STROBE` / `RADAR_SWEEP` Are Unimplemented
- **Locations**:
  - [`src/rendering/lighting/lighting-system.ts:217-257`](../../src/rendering/lighting/lighting-system.ts#L217-L257)
  - [`src/rendering/lighting/types.ts:28-38, 194-250`](../../src/rendering/lighting/types.ts#L194-L250)
  - [`src/rendering/lighting/deferred-light-filter.ts:134-186, 403-423`](../../src/rendering/lighting/deferred-light-filter.ts#L134-L186)
  - [`src/dev-tool/studio/editors/subeditors/LightSourceSubEditor.tsx:144-416`](../../src/dev-tool/studio/editors/subeditors/LightSourceSubEditor.tsx#L144-L416)
- **Spec Reference**: [`DEFERRED-LIGHTING-RENDERING.md` §1.1 (#7), §5.1, §5.2 & §8.1](../design/DEFERRED-LIGHTING-RENDERING.md#L204-L282)
- **Description & Root Cause**:
  1. **`offsetX` and `offsetY` Ignored at Runtime & Missing in `LightSourceSubEditor`**:
     - [`LightSourceSchema`](../../src/shared/components/light-source.ts#L47-L50) defines `offsetX` and `offsetY` (`-32..+32 px`).
     - In [`LightingSystem.update()`](../../src/rendering/lighting/lighting-system.ts#L226-L234), `worldX` and `worldY` are computed strictly from `sprite.x` / `pos.x` without adding `light.offsetX` and `light.offsetY`:
       ```ts
       const worldX = (sprite ? sprite.x + (pivotX === 0 ? TILE_SIZE * 0.5 : 0) : pos.x * TILE_SIZE + TILE_SIZE * 0.5) + (light.offsetX ?? 0);
       ```
     - In [`LightSourceSubEditor.tsx`](../../src/dev-tool/studio/editors/subeditors/LightSourceSubEditor.tsx), there are no inputs for `offsetX` or `offsetY`, making them completely uneditable in `ShellEditor.tsx` and awkwardly split outside the sub-editor in `ComponentFieldGroup.tsx`.
  2. **`RADAR_SWEEP` Does Not Project an Angular Rotating Beam**:
     - Spec §1.1 (#7) & §5.1 define `RADAR_SWEEP` as *"Rotating angular beam modulation around the entity's center"* (used by `prop-subnet-console.json`).
     - [`evaluateLightAnimation()`](../../src/rendering/lighting/types.ts#L245-L250) computes `angleOffsetRad: angle`, but [`LightingSystem.update()`](../../src/rendering/lighting/lighting-system.ts#L247-L257) discards `evalResult.angleOffsetRad`. `RenderLightDescriptor` has no sweep angle field, `uLightDataTex` row 2 channel `W` (`lb[o2 + 3] = 0.0` at [`deferred-light-filter.ts:422`](../../src/rendering/lighting/deferred-light-filter.ts#L422)) is left unused, and `DEFERRED_LIGHT_FRAG` performs no angular beam attenuation (`cos(atan(delta.y, delta.x) - sweepAngle)`).
  3. **`secondaryColor` Ignored on `FLICKER`, `STROBE`, and `RADAR_SWEEP`**:
     - In [`evaluateLightAnimation()`](../../src/rendering/lighting/types.ts#L210-L250), **only** `if (type === 'PULSE')` checks `if (anim.secondaryColor)`.
     - `FLICKER` ([lines 228–237](../../src/rendering/lighting/types.ts#L228-L237)), `STROBE` ([lines 239–243](../../src/rendering/lighting/types.ts#L239-L243)), and `RADAR_SWEEP` ([lines 245–250](../../src/rendering/lighting/types.ts#L245-L250)) unconditionally return `colorRgb: baseRgb`.
     - This breaks `secondaryColor` across [`prop-vault-door.json`](../../src/game/entities/templates/prop-vault-door.json) (`STROBE`, `secondaryColor: '#ef4444'`), [`prop-capacitor-bank.json`](../../src/game/entities/templates/prop-capacitor-bank.json) (`FLICKER`, `secondaryColor: '#818cf8'`), [`prop-subnet-console.json`](../../src/game/entities/templates/prop-subnet-console.json) (`RADAR_SWEEP`, `secondaryColor: '#00f0ff'`), [`system-admin.json`](../../src/game/entities/templates/system-admin.json) / [`seed-eater.json`](../../src/game/entities/templates/seed-eater.json) (`FLICKER`, `secondaryColor: '#ff0055'`), and dynamic player/prop overrides.
- **Required Fix**:
  - Add `light.offsetX` and `light.offsetY` to `worldX` and `worldY` in `LightingSystem.update()`, and add `offsetX` / `offsetY` controls to `LightSourceSubEditor.tsx`.
  - Pass `sweepAngleRad` (e.g., via `p2.w` in `uLightDataTex`, using a sentinel `< 0` when inactive) into `DEFERRED_LIGHT_FRAG` so `RADAR_SWEEP` modulates angular beam intensity around the light center.
  - Blend `anim.secondaryColor` in `evaluateLightAnimation()` for `STROBE` (alternating primary and secondary color on flash troughs/peaks), `FLICKER` (blending secondary arc color on noise spikes/dips), and `RADAR_SWEEP`.

---

#### `HIGH-03`: Player Shell & Prop Dynamic Light Modulation Diverges from Canonical Spec §5.3 Rules
- **Locations**:
  - [`src/rendering/render-system.ts:308-417`](../../src/rendering/render-system.ts#L308-L417)
  - [`src/rendering/render-system.ts:996-1006`](../../src/rendering/render-system.ts#L996-L1006)
- **Spec Reference**: [`DEFERRED-LIGHTING-RENDERING.md` §1.1 (#8) & §5.3](../design/DEFERRED-LIGHTING-RENDERING.md#L283-L302)
- **Description & Root Cause**:
  1. **Player Neural Heat Shift (`Spec §5.3.A.1`)**:
     - **Spec**:
       - `Heat 0–60%`: Nominal (`#e0f7ff` or shell baseline), `STATIC`.
       - `Heat 61–99%`: Smoothly interpolates color toward Safety Amber (`#ff9500`) with a `3 Hz` `PULSE` (`amplitude: 0.15`).
       - `Heat >= 100%` (Corruption Zone / Kernel Panic Risk): Shifts to Electric Crimson/Pink (`#ff0055`) with erratic `14 Hz` `FLICKER` (`amplitude: 0.45`) and secondary ultraviolet flashes (`#a855f7`).
     - **Implementation ([`render-system.ts:336-345`](../../src/rendering/render-system.ts#L336-L345))**:
       - Uses non-spec thresholds (`>= 81` and `>= 51`), never reaches `#ff0055` or `#a855f7` at `Heat >= 100%`, uses `8.0 Hz` instead of `14.0 Hz`, and uses stepped `FLICKER` (`4.0 Hz, amplitude: 0.25`) instead of smooth color interpolation + `3.0 Hz` `PULSE` (`amplitude: 0.15`) in the warning band.
  2. **Player Reality Stability Drain (`Spec §1.1 #8 & §5.3.A.2`)**:
     - **Spec**: Below `50%` Stability, effective light radius contracts by up to `25%` ($\text{radius} \times \text{mix}(0.75, 1.0, \text{stability} / 50)$) and injects a low-frequency ultraviolet (`#a855f7`) phase-distortion pulse.
     - **Implementation ([`render-system.ts:347-353`](../../src/rendering/render-system.ts#L347-L353))**: Uses `0.78 + 0.17 * Math.max(0.25, stabVal / 50)` (which jumps to `0.95x` at `stabVal = 49.9` and clamps to `0.8225x` at `stabVal = 0` instead of `mix(0.75, 1.0, stability / 50)`), and sets `FLICKER` (`5.5 Hz`) with `secondaryColor: nextColor` instead of an ultraviolet (`#a855f7`) phase pulse.
  3. **`Extended_Sight.sys` Vision Firmware (`Spec §5.3.A.3`)**:
     - **Spec**: Expands player's light radius to match `abilityDef.visionRadius * TILE_SIZE` (`12 * 32 = 384px`) and boosts height $L_z$ from `22px` to `28px`.
     - **Implementation ([`render-system.ts:332-334`](../../src/rendering/render-system.ts#L332-L334))**: Adds a hardcoded `+ 48` to `nextRadius` (`192 + 48 = 240px`) and never boosts `height` ($L_z$) to `28px`.
  4. **`GHOST_PULSE.exe` Transient Wave (`Spec §5.3.A.3`)**:
     - **Spec**: Spawns a transient expanding radial light wave (`radius: 320px`, duration `650ms`).
     - **Implementation ([`render-system.ts:996-1006`](../../src/rendering/render-system.ts#L996-L1006))**: Spawns a static-radius light with `radiusPx: 256` and `durationMs: 1200`.
  5. **Interactive Prop State Synchronization (`Spec §5.3.B`)**:
     - **Spec**: `corrupted` (`revealed && !isDisarmed && !triggered`) overrides color to `#ff0055` and sets animation to `FLICKER` (`speed: 12.0, amplitude: 0.4`).
     - **Implementation ([`render-system.ts:396-398`](../../src/rendering/render-system.ts#L396-L398))**: Omits `!corrupted.triggered` (so already-detonated traps continue flashing) and sets `STROBE` (`speed: 4.5, amplitude: 0.65`) instead of `FLICKER` (`speed: 12.0, amplitude: 0.4`).
- **Required Fix**:
  - Align player Heat (`0–60%`, `61–99%` smooth lerp toward `#ff9500` + `3 Hz` `PULSE`, `>= 100%` `#ff0055` + `14 Hz` `FLICKER` with `#a855f7` secondary), Stability (`< 50%` `mix(0.75, 1.0, stability / 50)` + `#a855f7` pulse), `Extended_Sight.sys` (`Math.max(nextRadius, visionRadius * TILE_SIZE)` and `height: Math.max(base.height, 28)`), `GHOST_PULSE.exe` (`radiusPx: 320, durationMs: 650` with expanding radius), and corrupted prop (`!corrupted.triggered`, `FLICKER` `12.0 Hz`, `amplitude: 0.4`) with Spec §5.3.

---

### Category C: Medium / Spec Gaps & Shader Bugs (`P2`)

#### `MED-01`: `MicroLightDescriptor.radiusPx` Is Multiplied by `cameraZoom` Twice (`cameraZoom²` Scaling Bug)
- **Locations**:
  - [`src/rendering/particles/particle-pool.ts:433-439`](../../src/rendering/particles/particle-pool.ts#L433-L439)
  - [`src/rendering/lighting/deferred-light-filter.ts:196, 203`](../../src/rendering/lighting/deferred-light-filter.ts#L196-L203)
- **Description & Root Cause**:
  - In [`ParticlePool.collectRenderDescriptors()`](../../src/rendering/particles/particle-pool.ts#L436), `MicroLightDescriptor.radiusPx` is pre-multiplied by `cameraZoom`:
    ```ts
    radiusPx: cluster.maxRadiusPx * cameraZoom,
    ```
  - However, [`DEFERRED_LIGHT_FRAG`](../../src/rendering/lighting/deferred-light-filter.ts#L196-L203) treats `m0.z` (`radiusPx`) as a **world-space** radius (just like `p0.z` for primary lights) and multiplies by `uCameraZoom` a second time:
    ```glsl
    float radiusPx = m0.z * uCameraZoom;
    ...
    float dNorm = (dist / max(0.05, uCameraZoom)) / max(1.0, m0.z);
    ```
  - When `cameraZoom != 1.0`, micro-light screen radii scale by `cameraZoom²` (`2.25x` at `1.5x` zoom; `0.5625x` at `0.75x` zoom).
- **Required Fix**:
  - Store unscaled world-space `radiusPx: cluster.maxRadiusPx` in `ParticlePool.collectRenderDescriptors()` so `m0.z` and `p0.z` share the exact same world-pixel unit convention in `DEFERRED_LIGHT_FRAG`.

---

#### `MED-02`: `SelectiveBloomFilter` Does Not Downsample (`480×320 → 240×160`) and Ignores Faction / Sector Condition Bloom Multipliers (`Spec §2, §4.2`)
- **Locations**:
  - [`src/rendering/lighting/bloom-filter.ts:186-211`](../../src/rendering/lighting/bloom-filter.ts#L186-L211)
  - [`src/rendering/lighting/lighting-system.ts:310-344`](../../src/rendering/lighting/lighting-system.ts#L310-L344)
  - [`src/rendering/lighting/types.ts:11-26, 104-181`](../../src/rendering/lighting/types.ts#L104-L181)
- **Spec Reference**: [`DEFERRED-LIGHTING-RENDERING.md` §2 (Stage 3) & §4.2](../design/DEFERRED-LIGHTING-RENDERING.md#L55-L58)
- **Description & Root Cause**:
  1. Spec §2 Stage 3 specifies a Dual-Kawase downsample/upsample pyramid (`480×320 → 240×160 Upsample`). [`SelectiveBloomFilter.apply()`](../../src/rendering/lighting/bloom-filter.ts#L196-L203) instead requests two `960×640` full-resolution textures via `PIXI.TexturePool.getSameSizeTexture(input)` and performs only a single down/up pass at `1x` resolution.
  2. Spec §4.2 defines Emissive / Bloom Multipliers per Faction Theme and Sector Condition (`CyberAcme: 1.0x`, `Traxus: 1.15x`, `Sekiguchi: 1.10x`, `NuCaloric: 1.10x`, `THERMAL_SURGE: 1.35x`, `DARK_SUBNET: 1.50x`, `OVERCLOCKED_GRID: 1.40x`). Although [`SelectiveBloomFilter.setIntensity()`](../../src/rendering/lighting/bloom-filter.ts#L186-L188) exists, it is never called anywhere in `LightingSystem.update()`.
- **Required Fix**:
  - Add `bloomMultiplier` to `FactionAmbientProfile` and `SectorConditionVisualProfile` in `src/rendering/lighting/types.ts`, and update `this.bloomFilter?.setIntensity(baseBloomIntensity * factionProfile.bloomMultiplier * (condProfile?.bloomMultiplier ?? 1.0))` in `LightingSystem.update()`.
  - Perform a multi-stage Dual-Kawase pyramid (or half/quarter-res `RenderTexture` targets with linear filtering) in `SelectiveBloomFilter`.

---

#### `MED-03`: `OVERCLOCKED_GRID` Harmonic Light Jitter (`jitter: 0.25`) Is Dead Code & `NuCaloric` Ambient Color Mismatch (`Spec §4.2`)
- **Locations**:
  - [`src/rendering/lighting/types.ts:25, 128-132, 173-180`](../../src/rendering/lighting/types.ts#L128-L180)
  - [`src/rendering/lighting/lighting-system.ts:210-258, 310-330`](../../src/rendering/lighting/lighting-system.ts#L210-L330)
- **Spec Reference**: [`DEFERRED-LIGHTING-RENDERING.md` §4.2](../design/DEFERRED-LIGHTING-RENDERING.md#L180-L191)
- **Description & Root Cause**:
  1. Spec §4.2 states that under `OVERCLOCKED_GRID`, *"all room lights exhibit subtle high-frequency harmonic jitter"*. `SECTOR_CONDITION_VISUAL_PROFILES.OVERCLOCKED_GRID` defines `jitter: 0.25` ([`types.ts:179`](../../src/rendering/lighting/types.ts#L179)), but `jitter` is never referenced in `LightingSystem` or `DeferredLightFilter`.
  2. Spec §4.2 specifies `NuCaloric Storage` base ambient color as `#1a0d1e` (magenta/slate ambient), whereas `NUCALORIC_PROFILE` ([`types.ts:128-132`](../../src/rendering/lighting/types.ts#L128-L132)) uses `#101b24`.
- **Required Fix**:
  - Apply `condProfile.jitter` in `LightingSystem.update()` (modulating room light intensities with a high-frequency harmonic wave when `jitter > 0`).
  - Update `NUCALORIC_PROFILE.colorHex` to `#1a0d1e`.

---

#### `MED-04`: Unused `rtAlbedo` (`960×640` RenderTexture) VRAM Allocation, Enemy `GlitchFilter` Slice Desync (`Spec §2.3`), and Heat Ghost Shadow Casting
- **Locations**:
  - [`src/rendering/lighting/gbuffer-pass.ts:197, 261-267, 577-685`](../../src/rendering/lighting/gbuffer-pass.ts#L197-L267)
  - [`src/rendering/filters/heat-visual-effects.ts`](../../src/rendering/filters/heat-visual-effects.ts)
- **Spec Reference**: [`DEFERRED-LIGHTING-RENDERING.md` §2.1 & §2.3](../design/DEFERRED-LIGHTING-RENDERING.md#L71-L99)
- **Description & Root Cause**:
  1. **Unused `rtAlbedo` Allocation**: `GBufferPass` allocates `this.rtAlbedo = PIXI.RenderTexture.create({ width: 960, height: 640, ... })` (~2.45 MB VRAM) in its constructor ([lines 261–267](../../src/rendering/lighting/gbuffer-pass.ts#L261-L267)), but never renders into it or binds it to any shader because `DeferredLightFilter` reads `uTexture` directly from the PixiJS filter pipeline.
  2. **Heat Ghost Clones Cast Solid Shadows**: `updateSpriteGhosting` attaches translucent ghost sprites (`alpha = 0.35`) to `layers.entityLayer`. Because `packQuads()` ([line 579](../../src/rendering/lighting/gbuffer-pass.ts#L579)) accepts all sprites in `entityLayer` with `alpha > 0.01` and `GBUFFER_MATERIAL_FRAG` Mode 0 ignores `vColor.a` ([line 180](../../src/rendering/lighting/gbuffer-pass.ts#L180)), faded ghost afterimages write full actor height (`17px`) and full shadow opacity (`175/255`) into `rtMaterialHeight`.
  3. **Enemy Per-Sprite `GlitchFilter` Tear Desync**: Spec §2.3 states that enemy per-sprite glitch filters displace both Albedo and Normal/Emissive channels in lockstep. `packQuads()` reads static sprite quad transforms (`sprite.x, sprite.y`) without applying `GlitchFilter` horizontal slice offsets.
- **Required Fix**:
  - Either remove the unused `rtAlbedo` allocation or use it explicitly if needed; scale Mode 0 `shadowOpacity` by `vColor.a` (or skip non-entity ghost sprites with `sprite.alpha < 0.5`) so translucent afterimages andsearched/fading sprites do not cast full-opacity shadows; and apply horizontal slice offset jitter in `packQuads()` / `GBUFFER_VERT` for sprites carrying an active `GlitchFilter`.

---

#### `MED-05`: Surface Compiler Elevation Heights ($Z$) for Walls, Closed Laser Doors, and Box Props & Master Inspection Sheets Diverge from Spec §3.3 & §7.2
- **Locations**:
  - [`scripts/lib/surface-compiler.cjs:321-323, 480-495, 533-544, 669-679`](../../scripts/lib/surface-compiler.cjs#L480-L544)
  - [`scripts/generate-themed-tilesets.cjs:639-764`](../../scripts/generate-themed-tilesets.cjs#L639-L764)
- **Spec Reference**: [`DEFERRED-LIGHTING-RENDERING.md` §3.3 (Canonical Elevation Heights) & §7.2](../design/DEFERRED-LIGHTING-RENDERING.md#L149-L160)
- **Description & Root Cause**:
  1. **Wall Height $Z < 32\text{px}$ (`surface-compiler.cjs:480-495`)**: Spec §3.3 requires structural walls to have `Height Z = 32px` (`Shadow Opacity = 1.00`) so interior lights ($L_z < 32\text{px}$) are completely blocked. `surface-compiler.cjs` sets wall top height to `28px` and non-full-wall front skirts (`ly >= 22`) to `18px` — which is lower than the player (`22px`), `anchor` (`26px`), and `system-admin` (`24px`) lights, allowing rays near the south face of a wall to clear the `18px` skirt.
  2. **Closed Laser Door (`door`, `Spec §7.2.2`)**: Spec §7.2.2 specifies that `door` (`64, 0`) has side jambs (`x: 0..6`, `x: 25..31`) at $Z = 32\text{px}$, while the central laser barrier beam (`y: 14..18`) sets `Emissive = 1.0`, `Height Z = 16px`, and `Shadow Opacity = 0.0` (so laser doors transmit light while glowing). `surface-compiler.cjs:533-544` instead compiles `door_closed` as a solid opaque box (`shadowOpacity = 255, heightPx = 24`) across the entire doorway.
  3. **Box Prop Elevations (`Spec §3.3`)**: `surface-compiler.cjs:321, 669` groups `prop_dead_drop` (Spec: Low-Cover `12–15px`), `prop_locker` (Spec: Tall Prop `22–26px`), and `prop_safe_locked` (Spec: Tall Prop `22–26px`) into a single `box_prop` category with `heightPx = 18`.
  4. **Master Review Sheets (`780×410`, `Spec §7.2.4`)**: `generateThemedMasterSheet` in `scripts/generate-themed-tilesets.cjs` still outputs the legacy 2-panel unlit sheet with the outdated caption `"Alpha Verification: Dimmed to 30% under Fog-of-War"`.
- **Required Fix**:
  - Update `surface-compiler.cjs` so solid wall texels encode `heightPx = 32` (`shadowOpacity = 255`), laser `door` frames encode side jambs at `Z = 32px, O = 255` and central laser beam (`y: 14..18`) at `Emissive = 255, Z = 16px, O = 0`, `prop_dead_drop` encodes `heightPx = 14`, and `prop_locker` / `prop_safe_locked` encode `heightPx = 24`, then re-run `compile-lighting-atlases.cjs`.
  - Update `generateThemedMasterSheet` in `scripts/generate-themed-tilesets.cjs` to include the diagnostic normal/material/lit preview and updated caption.

---

### Category D: Low / Code Quality & Minor (`P3`)

#### `LOW-01`: Unseeded `Math.random()` in `ParticleSystem` & Incomplete `disposeAllEmitters()` Cleanup in Legacy Wrapper
- **Locations**:
  - [`src/rendering/particles/particle-system.ts:153-181, 220-234`](../../src/rendering/particles/particle-system.ts#L153-L234)
  - [`src/rendering/filters/particle-emitters.ts:59-64`](../../src/rendering/filters/particle-emitters.ts#L59-L64)
- **Description & Root Cause**:
  1. `ParticleSystem` uses `Math.random()` for particle spawn angles, speeds, and lifetimes. Replacing `Math.random()` with a fast deterministic sequence (e.g. a seeded mulberry32/LCG state on `ParticleSystem`) makes particle trajectories 100% deterministic in tests.
  2. In `src/rendering/filters/particle-emitters.ts`, `disposeAllEmitters()` calls `sharedParticleSystem.disposeAllEmitters()` without calling `sharedParticleSystem.destroy()` and resetting `sharedParticleSystem = null`.
- **Required Fix**:
  - Use a deterministic PRNG helper inside `ParticleSystem` and destroy/null out `sharedParticleSystem` in `particle-emitters.ts:disposeAllEmitters()`.

---

## 4. Actionable Remediation Plan

Prioritized checklist to resolve all findings before merging `feature/deferred-lighting-rendering` to `main`:

- [x] **1. Fix Gamedata Studio 3×3 Lit Preview (`CRIT-01` — [`src/dev-tool/studio/shared/InspectorLitTilePreview.tsx`](../../src/dev-tool/studio/shared/InspectorLitTilePreview.tsx))**
  - Decode `/assets/tileset_n.png` and `/assets/tileset_m.png` without 2D Canvas alpha premultiplication so `A = 0` pixels preserve `R, G, B` normal and material data.
  - Fix `_m.png` channel mapping: `emissive = material[i] / 255`, `shadowOpacity = material[i + 1] / 255`, `roughness = material[i + 2] / 255`, and `heightZ = (material[i + 3] / 255) * 32`.
  - Remove the Y-normal negation (`ny = (normal[i + 1] / 255) * 2 - 1`), apply `offsetX` / `offsetY`, and use roughness-based Blinn-Phong shininess.
- [x] **2. Prevent G-Buffer Particle Overwrite of Solid Occluders (`CRIT-02` — [`src/rendering/lighting/gbuffer-pass.ts`](../../src/rendering/lighting/gbuffer-pass.ts), [`src/rendering/particles/particle-pool.ts`](../../src/rendering/particles/particle-pool.ts))**
  - Prevent `EMISSIVE_LIGHT` and `NORMAL_LIT` particle quads from overwriting solid wall/prop/actor `Height Z` and `Shadow Opacity` in `rtMaterialHeight` (e.g., render particle quads before solid entities/walls or preserve underlying occluder height/opacity).
  - Use a circular radial alpha texture for `ParticlePool` sprites so `effectsLayer` particles match the circular G-Buffer shader disc.
- [x] **3. Decouple Dynamic Light Modulation from ECS `World` Mutations & Prioritize Active FOV Lights (`HIGH-01` — [`src/rendering/render-system.ts`](../../src/rendering/render-system.ts), [`src/rendering/lighting/lighting-system.ts`](../../src/rendering/lighting/lighting-system.ts))**
  - Remove `world.patchComponent(..., LightSource, ...)` calls from `render-system.ts`; pass non-mutating runtime light overrides into `LightingSystem` so `World` remains strictly read-only in `@rendering` and player baseline lights never corrupt across floor transitions.
  - Gate out-of-FOV prop state modulation behind `rememberedProps` (`U1` anti-cheat invariant) and prioritize in-FOV entity lights and transient lights ahead of explored out-of-FOV props within `MAX_PRIMARY_LIGHTS` (`64`).
- [x] **4. Implement `offsetX`/`offsetY`, `RADAR_SWEEP` Angular Beam, and `secondaryColor` Waveforms (`HIGH-02` — [`src/rendering/lighting/lighting-system.ts`](../../src/rendering/lighting/lighting-system.ts), [`src/rendering/lighting/deferred-light-filter.ts`](../../src/rendering/lighting/deferred-light-filter.ts), [`src/rendering/lighting/types.ts`](../../src/rendering/lighting/types.ts), [`src/dev-tool/studio/editors/subeditors/LightSourceSubEditor.tsx`](../../src/dev-tool/studio/editors/subeditors/LightSourceSubEditor.tsx))**
  - Apply `light.offsetX` and `light.offsetY` to world light coordinates in `LightingSystem.update()` and add `offsetX` / `offsetY` controls to `LightSourceSubEditor.tsx`.
  - Upload `angleOffsetRad` into `uLightDataTex` (`p2.w`) and modulate `RADAR_SWEEP` angular beam intensity in `DEFERRED_LIGHT_FRAG`.
  - Support `anim.secondaryColor` blending in `evaluateLightAnimation()` for `STROBE`, `FLICKER`, and `RADAR_SWEEP`.
- [x] **5. Align Dynamic Player & Prop Light Telemetry with Spec §5.3 (`HIGH-03` — [`src/rendering/render-system.ts`](../../src/rendering/render-system.ts))**
  - Implement Spec §5.3.A Heat tiers (`0–60%` Nominal, `61–99%` smooth lerp to `#ff9500` with `3 Hz` `PULSE`, `>= 100%` `#ff0055` with `14 Hz` `FLICKER` and `#a855f7` secondary).
  - Implement Spec §5.3.A Stability drain (`< 50%` `radius * mix(0.75, 1.0, stability / 50)` + `#a855f7` pulse), `Extended_Sight.sys` (`visionRadius * TILE_SIZE` radius + `height = 28px`), and `GHOST_PULSE.exe` (`radiusPx: 320, durationMs: 650` expanding wave).
  - Check `!corrupted.triggered` and use `FLICKER` (`speed: 12.0, amplitude: 0.4`) for revealed corrupted props (`Spec §5.3.B`).
- [x] **6. Fix Micro-Light Zoom Scaling, Bloom Pyramid/Multipliers, `OVERCLOCKED_GRID` Jitter, and G-Buffer Polish (`MED-01`..`MED-05`, `LOW-01`)**
  - Pass unscaled world `maxRadiusPx` in `ParticlePool.collectRenderDescriptors()` (`MED-01`).
  - Wire Faction Theme and Sector Condition bloom multipliers into `SelectiveBloomFilter.setIntensity()` and downsample bloom buffers (`MED-02`).
  - Apply `OVERCLOCKED_GRID` harmonic jitter (`jitter: 0.25`) and set `NUCALORIC_PROFILE` to `#1a0d1e` (`MED-03`).
  - Remove unused `rtAlbedo` allocation, scale Mode 0 shadow opacity by `vColor.a` (or exclude heat ghost sprites), and sync `GlitchFilter` horizontal slice offsets (`MED-04`).
  - Update `surface-compiler.cjs` heights (`wall = 32px`, `door` laser beam `O = 0, Z = 16px, E = 255`, `prop_dead_drop = 14px`, `prop_locker` / `prop_safe_locked = 24px`), recompile `_n.png` / `_m.png` atlases, and update master preview sheets (`MED-05`).
  - Replace `Math.random()` in `ParticleSystem` with a deterministic PRNG and destroy `sharedParticleSystem` on `disposeAllEmitters()` (`LOW-01`).
- [x] **7. Expand Regression Tests & Re-verify (`LIGHT-07`)**
  - Add unit tests covering `offsetX`/`offsetY`, `STROBE`/`FLICKER`/`RADAR_SWEEP` `secondaryColor` and angular sweep, floor-transition player light baseline preservation, `Extended_Sight.sys` `visionRadius * TILE_SIZE` + `height = 28`, `Heat >= 100%` `#ff0055` modulation, unscaled `MicroLightDescriptor.radiusPx` under zoom, and `InspectorLitTilePreview` channel decoding.
  - Run `npm test`, `npm run typecheck`, and `npm run lint`.

---

## 5. Adversarial Re-Review of Remediation (`fix/deferred-lighting-issues`, `6d8a80d1..b7c579d0`)

An adversarial follow-up review was performed across the 12 remediation commits (`6d8a80d1..b7c579d0` on `fix/deferred-lighting-issues`, `28` files changed, `+1,277 / -325`) to verify that every finding in Section 3 was resolved without introducing new regressions or breaking the 5 prior bug-fix commits (`6940f63a..029cb444`).

### 5.1 Automated Verification Gate Results
- **`npm run typecheck`**: **PASS** (`0` errors)
- **`npm run lint`**: **PASS** (`0` warnings/errors)
- **`npm test -- --run`**: **PASS** (`249` test files, `1,677` tests passing — `+1` new test file [`tests/dev-tool/lit-preview.test.ts`](../../tests/dev-tool/lit-preview.test.ts) and `+15` new tests/assertions across rendering & studio test suites)

### 5.2 Finding-by-Finding Verification Matrix

| ID | Commit | Verification Verdict & Evidence |
| :--- | :--- | :--- |
| **`CRIT-01`** | `6d8a80d1` | **VERIFIED RESOLVED**. [`src/dev-tool/studio/shared/png-decode.ts`](../../src/dev-tool/studio/shared/png-decode.ts) parses raw PNG `IHDR`/`IDAT` chunks and unfilters 8-bit RGBA/RGB scanlines directly in memory, preserving un-premultiplied `R, G, B` wherever `A = 0`. [`src/dev-tool/studio/shared/lit-preview-math.ts`](../../src/dev-tool/studio/shared/lit-preview-math.ts) reads `R=emissive`, `G=shadowOpacity`, `B=roughness`, `A=heightZ*32`, removes the `ny` negation, applies `offsetX`/`offsetY` and roughness-driven shininess (`mix(48, 6, roughness)`), and evaluates `RADAR_SWEEP` angular beams. Covered by [`tests/dev-tool/lit-preview.test.ts`](../../tests/dev-tool/lit-preview.test.ts). |
| **`CRIT-02`** | `39b31376` | **VERIFIED RESOLVED**. [`src/rendering/lighting/gbuffer-pass.ts`](../../src/rendering/lighting/gbuffer-pass.ts) splits particle quads into dedicated `particleMaterialMesh` and `particleNormalMesh` passes while keeping solid terrain/item/entity meshes at `blendMode = 'none'` (preserving `1dc7f2f2`). `particleMaterialMesh` renders with `blendMode = 'max'` (`GL_MAX`) so particles never reduce solid wall/prop/actor `Height Z` (`A`) or `Shadow Opacity` (`G`). `GBUFFER_PARTICLE_NORMAL_FRAG` discards emissive particles (`mode < 1.5`) and Z-clips `normal_lit` puffs against `uMaterialHeight` (`existingZ > max(vMeta.z, 0.12) + 0.03`). [`src/rendering/particles/particle-pool.ts`](../../src/rendering/particles/particle-pool.ts) binds a `16×16` radial circular alpha texture (`createCircularParticleTexture()`). |
| **`HIGH-01`** | `28191e4f` | **VERIFIED RESOLVED**. Removed all `world.patchComponent(id, LightSource, ...)` calls from [`src/rendering/render-system.ts`](../../src/rendering/render-system.ts#L310-L430); dynamic player and prop light modulations are stored in a renderer-local `dynamicLightOverrides` map (`cleared` on `onDungeonGenerated` and `destroy`, and `deleted` on `ENTITY_DESTROYED`). Out-of-FOV prop overrides read `rememberedProps` (`U1` anti-cheat invariant). [`src/rendering/lighting/lighting-system.ts`](../../src/rendering/lighting/lighting-system.ts#L204-L361) culls non-beacon entity lights outside `fovSet` and prioritizes `player -> transient lights -> closest in-FOV entity lights -> DARK_SUBNET beacons` within `MAX_PRIMARY_LIGHTS` (`64`). |
| **`HIGH-02`** | `4d562d67` | **VERIFIED RESOLVED**. [`lighting-system.ts`](../../src/rendering/lighting/lighting-system.ts#L261-L263) adds `light.offsetX` and `light.offsetY` to `worldX`/`worldY` and forwards `sweepAngleRad` into `uLightDataTex` row 2 channel `W` (`p2.w`, sentinel `-1.0` when inactive). [`deferred-light-filter.ts`](../../src/rendering/lighting/deferred-light-filter.ts#L168-L176) modulates `RADAR_SWEEP` angular beam intensity (`0.22 + 0.78 * pow(beam, 2.2)`). [`types.ts`](../../src/rendering/lighting/types.ts#L244-L286) blends `secondaryColor` across `PULSE`, `FLICKER`, `STROBE`, and `RADAR_SWEEP`. [`LightSourceSubEditor.tsx`](../../src/dev-tool/studio/editors/subeditors/LightSourceSubEditor.tsx#L304-L353) exposes `offsetX` / `offsetY` sliders and numeric inputs. |
| **`HIGH-03`** | `6cc33de8` | **VERIFIED RESOLVED**. [`render-system.ts`](../../src/rendering/render-system.ts#L310-L426) implements Spec §5.3: Heat `0–60%` nominal, `61–99%` smooth `lerpHexColor` toward `#ff9500` with `3.0 Hz` `PULSE` (`amplitude: 0.15`), `>= 100%` `#ff0055` with `14.0 Hz` `FLICKER` (`amplitude: 0.45`, `secondaryColor: '#a855f7'`); Stability `< 50%` contracts radius by `0.75 + 0.25 * (stabVal / 50)` with `#a855f7` pulse; `Extended_Sight.sys` expands radius to `Math.max(nextRadius, visionRadius * TILE_SIZE)` and height to `28px`; `GHOST_PULSE.exe` spawns an expanding `startRadiusPx: 32 -> radiusPx: 320` wave over `650ms`; and revealed corrupted props gate on `!corrupted.triggered` with `12.0 Hz` `FLICKER` (`amplitude: 0.4`). |
| **`MED-01`** | `284a36e2` | **VERIFIED RESOLVED**. [`particle-pool.ts`](../../src/rendering/particles/particle-pool.ts#L478) passes unscaled world-space `radiusPx: cluster.maxRadiusPx` so `DEFERRED_LIGHT_FRAG` scales micro-light radii by `uCameraZoom` exactly once. |
| **`MED-02`** | `3c23309d` | **VERIFIED RESOLVED**. [`bloom-filter.ts`](../../src/rendering/lighting/bloom-filter.ts#L204-L223) downsamples via `PIXI.TexturePool.getOptimalTexture(input.width, input.height, 0.5 / 0.25, false)` and scales `uBloomUvScale` by `input.source.width / halfTex.source.width`. [`types.ts`](../../src/rendering/lighting/types.ts) and [`lighting-system.ts`](../../src/rendering/lighting/lighting-system.ts#L397-L399) wire Spec §4.2 faction (`1.0x–1.15x`) and sector condition (`1.35x–1.50x`) bloom multipliers into `bloomFilter.setIntensity(...)`. *(See `RES-01` below for a non-blocking `P3` note on `uInputPixel.zw` vs `uInputSize.zw` inside the Kawase blur shaders.)* |
| **`MED-03`** | `64b5b3fa` | **VERIFIED RESOLVED**. [`types.ts`](../../src/rendering/lighting/types.ts#L139) updates `NUCALORIC_PROFILE.colorHex` to `#1a0d1e`, and [`lighting-system.ts`](../../src/rendering/lighting/lighting-system.ts#L283-L291) applies high-frequency dual-sinusoid harmonic jitter (`condProfile.jitter`) under `OVERCLOCKED_GRID`. |
| **`MED-04`** | `09d0be65` | **VERIFIED RESOLVED**. Removed the unused `rtAlbedo` (`960×640`) allocation from [`gbuffer-pass.ts`](../../src/rendering/lighting/gbuffer-pass.ts), labeled player heat-ghost sprites (`ghost.label = 'heatGhost'`) in [`heat-visual-effects.ts`](../../src/rendering/filters/heat-visual-effects.ts#L113), skipped `heatGhost` / `alpha < 0.5` sprites and scaled Mode 0 shadow opacity by `mat.g * vColor.a`, and added `applyGlitchSliceUV` in `GBUFFER_NORMAL_FRAG` & `GBUFFER_MATERIAL_FRAG` for sprites with an active `GlitchFilter`. |
| **`MED-05`** | `512c5659` | **VERIFIED RESOLVED**. [`scripts/lib/surface-compiler.cjs`](../../scripts/lib/surface-compiler.cjs) encodes `wall` height at `32px` (including south skirts), `door_closed` side jambs at `Z=32px, O=255` with central laser beam at `E=255, Z=16px, O=0`, `prop_dead_drop` at `14px`, and `prop_locker`/`prop_safe_locked` at `24px`. Recompiled all `_n.png` and `_m.png` atlases and upgraded [`scripts/generate-themed-tilesets.cjs`](../../scripts/generate-themed-tilesets.cjs) master sheets (`780×410`) to the 4-view diagnostic layout. |
| **`LOW-01`** | `248101c1` | **VERIFIED RESOLVED**. [`src/rendering/particles/particle-system.ts`](../../src/rendering/particles/particle-system.ts#L28-L41) replaces `Math.random()` with a deterministic seeded Mulberry32 PRNG (`nextRandom()`), and [`src/rendering/filters/particle-emitters.ts`](../../src/rendering/filters/particle-emitters.ts#L60-L65) calls `sharedParticleSystem.destroy()` and resets `sharedParticleSystem = null`. |

### 5.3 Residual Low-Severity (`P3`) Polish Notes (Non-Blocking)

No `P0`, `P1`, or `P2` issues remain. Both minor `P3` observations noted during re-inspection have now been resolved and regression-tested:

1. **`RES-01` (`P3` Low — `@rendering` [`src/rendering/lighting/bloom-filter.ts:41-45, 64-68`](../../src/rendering/lighting/bloom-filter.ts#L41-L68)): `KAWASE_DOWN_FRAG` and `KAWASE_UP_FRAG` Step by Logical `uInputSize.zw` Instead of Physical `uInputPixel.zw` — RESOLVED**
   - In PixiJS 8, `PIXI.TexturePool.getOptimalTexture(960, 640, resolution, false)` allocates a physical texture of size `pixelWidth = nextPow2(ceil(960 * resolution))` (`512×512` at `0.5x`, `256×256` at `0.25x`), but sets logical `source.width = pixelWidth / resolution = 1024`.
   - `FilterSystem` populates `uInputSize.zw` with `1 / source.width` (`1 / 1024` for both `halfTex` and `quarterTex`) and `uInputPixel.zw` with `1 / source.pixelWidth` (`1 / 512` for `halfTex`, `1 / 256` for `quarterTex`).
   - Because `KAWASE_DOWN_FRAG` and `KAWASE_UP_FRAG` used `uInputSize.zw` instead of `uInputPixel.zw`, the Kawase sample offset stepped by `0.75` physical texels in `halfTex` and `0.5` physical texels in `quarterTex` rather than `1.5` and `2.0` physical texels. (Note: `uBloomUvScale` and `uOutputFrame` remain 100% aligned, so there was no UV offset bug—only a tighter bloom blur radius.)
   - **Resolution**: Updated `KAWASE_DOWN_FRAG` and `KAWASE_UP_FRAG` in [`src/rendering/lighting/bloom-filter.ts`](../../src/rendering/lighting/bloom-filter.ts#L41-L68) to use `uInputPixel.zw` and added regression assertions in [`tests/rendering/lighting-system.test.ts`](../../tests/rendering/lighting-system.test.ts#L1049-L1057).
2. **`RES-02` (`P3` Low — `@dev-tool` [`src/dev-tool/studio/shared/png-decode.ts:36-37`](../../src/dev-tool/studio/shared/png-decode.ts#L36-L37)): Uncaught Floating Promises on `writer.write` / `writer.close` Fallback — RESOLVED**
   - In `inflateZlib()`, `void writer.write(copy); void writer.close();` are invoked without `.catch(() => {})`. If `DecompressionStream('deflate-raw')` rejects on `writer.write` or `writer.close` before falling back to `'deflate'`, the detached writer promises could trigger an `unhandledrejection` warning in the console.
   - **Resolution**: Verified [`src/dev-tool/studio/shared/png-decode.ts:34-37`](../../src/dev-tool/studio/shared/png-decode.ts#L34-L37) uses `new DecompressionStream('deflate')` directly and already attaches `.catch(() => {})` to both `writer.write(copy)` and `writer.close()`. Added a regression test in [`tests/dev-tool/lit-preview.test.ts`](../../tests/dev-tool/lit-preview.test.ts#L156-L190) confirming corrupt `IDAT` zlib payloads reject cleanly without `unhandledRejection` events.

