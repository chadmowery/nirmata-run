# Deferred Lighting & Art Direction Alignment Evaluation

> **Status:** Pre-Implementation Impact & Reconciliation Analysis  
> **Source Research:** [`docs/wip/ART-DIRECTION-WORLD-BUILDING.md`](./ART-DIRECTION-WORLD-BUILDING.md)  
> **Target Specification:** [`docs/design/DEFERRED-LIGHTING-RENDERING.md`](../design/DEFERRED-LIGHTING-RENDERING.md)  

---

## Executive Summary

**Yes — the ongoing art direction research should be solidified and rolled into [`DEFERRED-LIGHTING-RENDERING.md`](../design/DEFERRED-LIGHTING-RENDERING.md) before starting implementation.**

[`ART-DIRECTION-WORLD-BUILDING.md`](./ART-DIRECTION-WORLD-BUILDING.md) is not merely a lore or color-palette document; its **Section 3**, **Section 5**, **Section 7**, and **Section 9** directly alter the PixiJS 8 scene graph (`src/rendering/layers.ts`), the Deferred Uber-Lighting shader equations, the procedural multi-plane atlas compiler (`LIGHT-02`), and canonical entity `LightSource` presets (`LIGHT-01`).

---

## 1. The Blocker Decision: Perspective Fork (3/4 Oblique vs. Strict 90° Top-Down)

[`ART-DIRECTION-WORLD-BUILDING.md` (Section 9)](./ART-DIRECTION-WORLD-BUILDING.md#9-perspective-trade-off-evaluation-34-oblique-vs-strict-90-top-down) leaves an open architectural choice between **Candidate A (3/4 Oblique)** and **Candidate B (Strict 90° Overhead Top-Down)**. Meanwhile, [`DEFERRED-LIGHTING-RENDERING.md`](../design/DEFERRED-LIGHTING-RENDERING.md) currently straddles a middle ground (strict `32×32` tile bounds, but with a pseudo-3/4 south-facing wall facade in [Section 7.2](../design/DEFERRED-LIGHTING-RENDERING.md#72-automated-normal-specular-emissive--height-synthesis-rules)).

Whichever candidate is selected changes **Phases 1 & 2 (`LIGHT-02`, `LIGHT-03`)** of the lighting specification:

| Subsystem in `DEFERRED-LIGHTING-RENDERING.md` | Impact if **Candidate A (3/4 Oblique)** is chosen | Impact if **Candidate B (Strict 90° Top-Down)** is chosen |
| :--- | :--- | :--- |
| **Atlas Frame Schema & Sizes** ([Section 7.1](../design/DEFERRED-LIGHTING-RENDERING.md#71-companion-atlas-file-convention)) | Sprites break out of `32×32` into `32×48`, `48×64`, `48×72`, and `32×96` tall walls ([Art Section 3.1–3.2, 7.1](./ART-DIRECTION-WORLD-BUILDING.md#71-variable-height-atlas-frames-3248--3264-support)). Fixed `256×256` companion atlases (`_n.png`, `_m.png`) will need larger dimensions, bottom-center anchoring (`anchor.set(0.5, 1.0)`), and Y-sorted `sortableChildren`. | Keeps strict `32×32` frames and `256×256` atlases, **but** requires 4-directional cardinal sprite facings or rotated normal handling ([Art Section 8.5](./ART-DIRECTION-WORLD-BUILDING.md#85-concept-plate-10-3232-strict-top-down-4-directional-sprite-sheet-shells--constructs)). |
| **Wall & Prop Normal/Height Synthesis** ([Section 7.2](../design/DEFERRED-LIGHTING-RENDERING.md#72-automated-normal-specular-emissive--height-synthesis-rules)) | `SurfaceCompiler` must generate `64px–96px` south-facing bulkhead facades (`wall_front_tall`) with constructivist supergraphics and tall side-profile cylinders. | `SurfaceCompiler` must replace the current front-bulkhead wall ramp (`y: 8..23`) and side-view vats with **pure overhead wall caps** (with hazard chevrons) and **circular top-down vat footprints** ([Art Section 8 & 9](./ART-DIRECTION-WORLD-BUILDING.md#8-exact-3232px-pure-top-down-orthographic-projection-complete-5-concept-suite)). |
| **2.5D Height Raymarching & $Z$ Encoding** ([Section 2.1 & 3.3](../design/DEFERRED-LIGHTING-RENDERING.md#33-per-pixel-25d-height-field-shadow-raymarching)) | `materialHeightTexture.a` encodes $Z \in [0..32\text{px}]$. With `64px–96px` multi-tile walls and tall sprites overlapping North tiles (`y - 1`), screen-space Y mixes world $Y$ and elevation $Z$, requiring either a `0..96px` height range or base-Y offset compensation during raymarching so tall sprites don't self-shadow or clip rays on the tile behind them. | $Z \in [0..32\text{px}]$ encoding and 2D screen-space raymarching work out-of-the-box with zero occlusion ambiguity. |
| **Screen-Space Wet Floor Reflections** ([Art Section 7.3.1](./ART-DIRECTION-WORLD-BUILDING.md#73-wet-specular-floor-reflections--grazing-rim-term)) | Vertically mirrored screen-space lookup `(uv.x + ripple, uv.y - offset)` works naturally because tall vats/characters stand vertically above the floor tiles to their South. | Vertical `-uv.y` mirroring does **not** make physical sense in a 90° bird's-eye view (it would only reflect onto the South side of a vat). Top-down wet reflections must instead use radial/blurred emissive sheen or specular roughness modulation. |

---

## 2. Explicit Pipeline Upgrades in `ART-DIRECTION` (Section 7) Missing from `DEFERRED-LIGHTING`

Even after locking in a perspective, [`ART-DIRECTION-WORLD-BUILDING.md` (Section 7)](./ART-DIRECTION-WORLD-BUILDING.md#7-technical-rendering--asset-pipeline-evolution-pixijs-8) explicitly prescribes rendering upgrades to [`DEFERRED-LIGHTING-RENDERING.md`](../design/DEFERRED-LIGHTING-RENDERING.md) that are not in the lighting spec yet:

### 2.1 Multi-Plane Parallax & Scene Graph Expansion ([Art Section 3.3 & 7.2](./ART-DIRECTION-WORLD-BUILDING.md#72-multi-plane-parallax-containers-srcrenderinglayersts))
* **Current Lighting Spec ([Section 2 & 4.1](../design/DEFERRED-LIGHTING-RENDERING.md#41-replacing-uniform-sprite-alpha-dimming))**: Assumes the existing 4 flat containers in [`src/rendering/layers.ts`](../../src/rendering/layers.ts) (`terrainLayer`, `itemLayer`, `entityLayer`, `effectsLayer`) and renders non-walkable void areas as pure `#000000`.
* **Art Direction Upgrade**: Expands [`src/rendering/layers.ts`](../../src/rendering/layers.ts) with:
  1. **`abyssalVoidLayer` (Plane `-2`, `0.80x` parallax)** and **`subStructureLayer` (Plane `-1`, `0.92x` parallax + walkway edge aprons)** where `grid.getTile(x, y)` is empty void.
  2. **`groundFogLayer` (Plane `0.5`, `Height Z = 4px`)** — a continuous dual-scroll noise/vapor plane that samples `uLightData` in the deferred shader so cryo-mist and foundry steam glow in the exact color of nearby vats, anchors, and shells.
  3. **`foregroundParallaxLayer` (Plane `+1`, `1.18x` parallax)** — overhead steel trusses and hanging cable bundles rendered **after** the deferred lighting pass, auto-fading alpha when overlapping the player.
* **Why it matters before starting**: If void tiles show deep chasm parallax instead of `#000000`, `albedoTexture.a` and `fovMaskTexture` ([Section 4.1](../design/DEFERRED-LIGHTING-RENDERING.md#41-replacing-uniform-sprite-alpha-dimming)) cannot simply clamp `mask = 0.0` to `#000000` over abyssal catwalk edges.

### 2.2 Uber-Lighting Shader Additions ([Art Section 5.1 & 7.3](./ART-DIRECTION-WORLD-BUILDING.md#73-wet-specular-floor-reflections--grazing-rim-term))
* **Fresnel Grazing Rim-Light Term**: Adds
  $$I_{\text{rim}} = (1.0 - N_z)^2 \cdot \max(0.0, \vec{N}_{xy} \cdot \vec{L}_{xy})$$
  weighted by light intensity to the BRDF in [Section 3.2](../design/DEFERRED-LIGHTING-RENDERING.md#32-normal-mapped-diffuse--blinn-phong-specular-brdf) so silhouettes and bulkhead edges catch sharp 1px–2px specular rim highlights against dark backgrounds.
* **Wet Floor Specular Reflections**: High-specularity floor masks (`S = 0.70–0.95`, `Roughness = 0.12–0.35`) reflecting nearby emissive sources (`Emissive > 0`).
* **Volumetric Light Shafts / Ceiling Breaches**: [Art Section 5.1.5 & Concept Plates 3/8/10](./ART-DIRECTION-WORLD-BUILDING.md#51-the-graphic-chiaroscuro-lighting-formula) introduce angled volumetric spotlights/sunbeams cutting into dark rooms, whereas [`LightSource`](../design/DEFERRED-LIGHTING-RENDERING.md#51-zod-component-schema-srcsharedcomponentslight-sourcets) currently only models radial point lights.

---

## 3. Palette, Material & Entity Preset Drift (`LIGHT-01` & `LIGHT-02`)

Several concrete parameters and color scripts evolved in [`ART-DIRECTION-WORLD-BUILDING.md`](./ART-DIRECTION-WORLD-BUILDING.md) and now differ from the tables in [`DEFERRED-LIGHTING-RENDERING.md`](../design/DEFERRED-LIGHTING-RENDERING.md):

### 3.1 Ambient Darkness & Biome Profiles ([Art Section 5.2](./ART-DIRECTION-WORLD-BUILDING.md#52-corporate-sector-biome-matrix) vs. [Lighting Section 4.2](../design/DEFERRED-LIGHTING-RENDERING.md#42-faction-themes--sector-condition-lighting-profiles))
Art Direction pushes ambient intensity darker (`0.12–0.18`) to achieve the *Marathon* × *REPLACED* "Graphic Chiaroscuro" contrast:

| Faction Biome | `DEFERRED-LIGHTING-RENDERING.md` (Section 4.2) | `ART-DIRECTION-WORLD-BUILDING.md` (Section 5.2) |
| :--- | :--- | :--- |
| **CyberAcme Mainframe** | `#0c1428` (`Intensity: 0.18`) | `#050a18` (`Intensity: 0.12`), tempered glass floor channels (`S = 0.95`) |
| **Traxus Heavy Foundry** | `#1c100b` (`Intensity: 0.16`) | `#160d08` (`Intensity: 0.14`), oily puddles (`S = 0.85`) vs. matte steel (`S = 0.25`) |
| **Sekiguchi Gene-Labs** | `#071f22` (`Intensity: 0.20`), `S = 0.75` | `#061a1e` (`Intensity: 0.18`), mirror-wet surgical ceramic (`S = 0.90, Rg = 0.12`) |
| **NuCaloric Bio-Storage** | `#1a0d1e` (`Intensity: 0.18`) | `#14091a` (`Intensity: 0.16`), frosted polymer decking (`S = 0.55`) |

### 3.2 Per-Shell Visual & Emissive Signatures ([Art Section 4.2](./ART-DIRECTION-WORLD-BUILDING.md#42-runner-shell-visual-profiles) vs. [Lighting Section 5.2](../design/DEFERRED-LIGHTING-RENDERING.md#52-canonical-entity-template-light-presets))
* The lighting spec groups `VANGUARD`, `BASTION`, and `GHOST` under a single `player.json` preset (`#e0f7ff`).
* Art Direction differentiates their emissive and material accents:
  - **`VANGUARD-v1`**: Taikoku Acid Chartreuse (`#d8ff00`, `Emissive = 1.0`) visor and trim.
  - **`BASTION-v1`**: Signal Orange (`#ff5500`) blast collar + dual dorsal exhaust stacks that vent normal-mapped steam plumes.
  - **`GHOST-v1`**: Solaris Laser Cyan (`#00f0ff`) synaptic veins over porcelain-white skull faceplate.

### 3.3 Enemy Light & Elevation Presets ([Art Section 2.4](./ART-DIRECTION-WORLD-BUILDING.md#24-re-imagining-the-bestiary-from-software-bugs-to-physical-biomechanical-horrors) vs. [Lighting Section 3.3 & 5.2](../design/DEFERRED-LIGHTING-RENDERING.md#52-canonical-entity-template-light-presets))
* **`buffer-overflow`**: Shifted from cyan (`#00f0ff` `FLICKER`) to a pressurized `#ff6600` / `#ff0055` thermal thorax that **strobes faster** as 3+ units surround the player.
* **`logic-leaker`**: Shifted from `#ff0055` to a neon-green/magenta bioluminescent dorsal sac (`Emissive = 0.9`).
* **`seed-eater`**: Given an ultraviolet/crimson furnace core (instead of sharing `system-admin`'s `#ffffff`).
* **`system-admin`**: Elevated to `Height Z = 28px` (vs. `24px`) with a sweeping `#ffffff` / `#ff0055` spotlight beam.

---

## 4. Recommended Checklist Before Implementing `DEFERRED-LIGHTING-RENDERING.md`

- [ ] **1. Resolve Section 9 (Perspective Choice)**: Decide between **Candidate A (3/4 Oblique)**, **Candidate B (Strict 90° Top-Down)**, or keeping the current **Hybrid (32×32 footprints with 1-tile pseudo-3/4 south wall faces)**.
- [ ] **2. Decide Scope of Multi-Plane Parallax (Art Section 7.2)**: Decide whether `abyssalVoidLayer`, `subStructureLayer`, `groundFogLayer`, and `foregroundParallaxLayer` belong inside `DEFERRED-LIGHTING-RENDERING.md` (or as a separate companion spec) so the G-Buffer layer hierarchy in [`src/rendering/layers.ts`](../../src/rendering/layers.ts) is only refactored once.
- [ ] **3. Roll Finalized Values into `DEFERRED-LIGHTING-RENDERING.md`**: Sync the Fresnel rim term, wet floor reflection math, updated faction ambient/specular numbers, and updated enemy/Shell `LightSource` presets into [`DEFERRED-LIGHTING-RENDERING.md`](../design/DEFERRED-LIGHTING-RENDERING.md).
