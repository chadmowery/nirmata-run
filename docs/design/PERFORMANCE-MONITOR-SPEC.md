# In-Game Performance & Telemetry Monitor (`TK-PERF-900`) — Technical & Visual Specification

> **Status:** Proposed Design & Engineering Specification (v1.0)  
> **Target Engine:** Nirmata Runner (Next.js 16, React 19, PixiJS 8 WebGL2, TypeScript, Zustand, Zod ECS)  
> **Primary Layer:** `@dev-tool/perf` (`src/dev-tool/perf/`) with zero-overhead opt-in telemetry hooks in `@engine`, `@rendering`, `@game`, and `@server`  
> **Reference Guidelines:** [`AGENTS.md`](../../AGENTS.md), [`APPLICATION_SEPARATION_SPEC.md`](../architecture/APPLICATION_SEPARATION_SPEC.md), [`ENGINE_GUIDELINES.md`](../architecture/ENGINE_GUIDELINES.md), [`UI-DESIGN-SYSTEM.md`](./UI-DESIGN-SYSTEM.md)

---

## 1. Executive Summary & Design Thesis

Modern web browsers ship with general-purpose CPU flamecharts, network waterfalls, and V8 heap snapshots. However, generic browser DevTools have **zero semantic awareness** of *Nirmata Runner*'s architecture: they cannot distinguish an ECS `World` query from a React render, cannot tell how many PixiJS `OutlineFilter` or `GlitchFilter` `RenderTexture` framebuffers are allocated on the GPU, cannot separate client-side optimistic prediction latency from authoritative server 23-phase turn execution, and cannot audit whether sprites or terrain tile pools leaked across a floor transition.

The **Taikoku Telemetry Oscilloscope (`TK-PERF-900` / In-Game Performance Monitor)** is a purpose-built, development-only diagnostic widget designed specifically around *Nirmata Runner*'s hybrid real-time WebGL renderer and turn-based client-predicted/server-authoritative ECS engine.

### 1.1 Core Objectives

1. **Game-Specific Observability Over Browser Redundancy**: Focus exclusively on metrics that directly answer game engineering questions:
   - *Why did frame time spike during a Cryo-Vat / Capacitor Bank cascade?* (Sub-stage breakdown: `FOV` vs. `Tilemap Autotile` vs. `Sprite/Filter Sync` vs. `Particles/Tweens` vs. `WebGL Draw`).
   - *Why are WebGL draw calls climbing?* (Batch breaks from per-sprite `OutlineFilter` / `GlitchFilter` instances vs. particle `Graphics` nodes).
   - *Did descending from Floor 1 to Floor 5 leak GPU textures, sprites, or ECS child entities?* (Automated Floor-Transition Baseline Snapshot & Diff Auditor).
   - *Was a turn delay caused by client prediction, HTTP round-trip, server AI/Combat phase execution, or client delta reconciliation?* (End-to-End Turn Pipeline Waterfall).
2. **Strict Production Quarantine (`@dev-tool` Isolation)**:
   - Resides inside `src/dev-tool/perf/` and is dynamically imported (`next/dynamic` with `{ ssr: false }`) strictly when `process.env.NODE_ENV === 'development'`.
   - Zero bytes of the performance monitor UI, WebGL spies, or server `_devPerf` payloads are bundled or emitted in production builds.
3. **Zero-Overhead When Disabled & Self-Isolated When Active**:
   - When toggled `OFF`, all WebGL method wrappers, ECS system timing hooks, and ticker listeners are completely detached (`0.00ms` runtime cost).
   - When active, the high-frequency 60Hz oscilloscope waveform renders directly to a dedicated `<canvas>` backed by pre-allocated `Float32Array` circular buffers (**zero per-frame heap allocations**), while React tabular readouts update at a throttled **4 Hz (`250ms`)** cadence so the monitor never induces the React re-render overhead it is measuring.
4. **"Taikoku Vector Manifest" Visual Cohesion**:
   - Styled as an authentic piece of Taikoku Heavy Dynamics diagnostic hardware (`性能監視 // TK-PERF-900 OSCILLOSCOPE`), utilizing the canonical `--c-*` palette, `JetBrains Mono` tabular numerals, 1px vector oscilloscope waveforms, and `.panel-card` L-bracket framing defined in [`UI-DESIGN-SYSTEM.md`](./UI-DESIGN-SYSTEM.md).

---

## 2. Architectural Compliance & Layer Boundaries

To comply with [`AGENTS.md`](../../AGENTS.md) and the `import-x/no-restricted-paths` rules in [`eslint.config.js`](../../eslint.config.js), foundation layers (`@engine`, `@shared`, `@rendering`, `@client`, `@server`) **must never** import from `@dev-tool`. Instead, foundation layers expose lightweight, read-only introspection getters and optional callback hooks that `@dev-tool/perf` attaches to at runtime in development mode.

```mermaid
flowchart TB
  subgraph Foundation["Foundation & Runtime Layers (Zero Upward Imports to @dev-tool)"]
    ENG["@engine (src/engine/)\n• World.getDiagnostics() & setSystemTimingHook()\n• EventBus.getDiagnostics()\n• Grid.getDiagnostics()\n• AudioEngine.getDiagnostics()"]
    RND["@rendering (src/rendering/)\n• RenderSystem.getTelemetry() & setStageTimingEnabled()\n• getTilemapStats() / getSpriteCount()\n• getParticleStats() / getFilterStats()"]
    SRV["@server & /api/action\n• Dev-only _devPerf turn timing envelope\n• Phase & per-system execution ms\n• Delta payload byte size"]
    SETUP["@game/setup.ts\n• Client Prediction ms\n• Network RTT ms\n• applyStateDelta Reconcile ms"]
  end

  subgraph DevTool["@dev-tool/perf (src/dev-tool/perf/) — Dev Builds Only"]
    PROBE["webgl-probe.ts\n• WebGL2 drawElements / drawArrays spy\n• Shader & Texture bind counters\n• PixiJS managedTextures VRAM calculator"]
    COLL["perf-collector.ts\n• Pre-allocated Float32Array Ring Buffers (240 frames)\n• Turn Waterfall Ring Buffer (30 turns)\n• Floor-Transition Leak Snapshot & Diff Engine\n• Spike Trap Auto-Freeze Detector"]
    STORE["perf-store.ts (Zustand — Throttled 4Hz UI Sync)\n• Mode: OFF | MINI | STANDARD | EXPANDED\n• Ghost Mode (click-through)\n• Render Layer Bisection Toggles"]
    WIDGET["PerfMonitorWidget.tsx\n• 60Hz 1px Vector Oscilloscope <canvas>\n• 5 Telemetry Tabs: GPU | ECS | TURN | MEM | AUDIT\n• Draggable / Magnetic Corner Dock"]
  end

  ENG --> COLL
  RND --> COLL
  SRV -.->|JSON _devPerf (dev only)| SETUP
  SETUP -.->|Dev Hook| COLL
  PROBE --> COLL
  COLL -->|60Hz Direct Ref| WIDGET
  COLL -->|4Hz Throttled Snapshot| STORE
  STORE --> WIDGET
```

### 2.1 Boundary & Quarantine Verification Matrix

| Layer | File(s) Touched | Allowed Imports Used | Production Impact |
| :--- | :--- | :--- | :--- |
| **`@engine`** | `src/engine/ecs/world.ts`, `src/engine/grid/grid.ts`, `src/engine/events/event-bus.ts`, `src/engine/audio/audio-engine.ts` | `@engine/*` only | Pure O(1) getter methods (`getDiagnostics()`) and nullable `systemTimingHook` reference (`null` in prod). |
| **`@rendering`** | `src/rendering/render-system.ts`, `src/rendering/tilemap.ts`, `src/rendering/sprite-map.ts`, `src/rendering/animations.ts`, `src/rendering/filters/*` | `@engine/*`, `@shared/*`, `@rendering/*` | Read-only pool counters and sub-stage timing accumulator when `telemetryEnabled === true`. |
| **`@server` / API** | `src/app/api/action/route.ts` | Existing imports | Attaches `_devPerf` to JSON response **only** when `process.env.NODE_ENV === 'development'`. |
| **`@dev-tool`** | `src/dev-tool/perf/*`, `src/dev-tool/terminal/DevTerminal.tsx`, `src/dev-tool/debug/debug-api.ts` | `@engine/*`, `@shared/*`, `@rendering/*`, `@dev-tool/*`, `@/game/*` | Dynamically imported in `src/app/page.tsx` behind `process.env.NODE_ENV === 'development'`. Completely tree-shaken in `next build`. |

---

## 3. Telemetry Metrics Taxonomy

Rather than duplicating generic browser profilers, `TK-PERF-900` organizes telemetry into **5 game-specific diagnostic domains**.

### 3.1 Domain 1: Frame Timing & Render Pipeline (`GPU / RENDER [描画]`)

Measures the 60Hz PixiJS `Ticker` loop and decomposes every frame into *Nirmata Runner*'s exact rendering stages in [`src/rendering/render-system.ts`](../../src/rendering/render-system.ts):

| Metric | Source / Formula | Target / Budget | Purpose |
| :--- | :--- | :--- | :--- |
| **`FPS` (Current / Avg / 1% Low)** | $1000 / \Delta t_{\text{frame}}$ over 120-frame rolling window | `60 FPS` (`1% Low ≥ 55`) | Detects both sustained framerate drops and micro-stutters. |
| **`Frame Time` (`ms` & Jitter $\sigma$)** | `performance.now()` delta between `app.ticker` ticks | `≤ 16.67 ms` (`σ < 1.5 ms`) | Primary indicator of frame pacing stability. |
| **Stage 1: `FOV & Memory` (`ms`)** | `computeFov()` + `snapshotVisibleMemory()` + `FOV_UPDATED` emit | `≤ 0.80 ms` | Detects shadowcasting and prop/item memory snapshot overhead. |
| **Stage 2: `Tilemap & Autotile` (`ms`)** | `buildTilemap()` + `AutotileSolver.resolveWallTile/DoorTile()` | `≤ 1.20 ms` | Highlights redundant per-frame autotile bitmask evaluations across the visible tile range. |
| **Stage 3: `Sprite & Outline Sync` (`ms`)** | `world.query(Sprite, Position)` + `resolvePropOutlineState()` + z-sort | `≤ 1.00 ms` | Tracks cost of iterating renderables, updating prop outlines, and `addChild` z-layering. |
| **Stage 4: `VFX, Tweens & Camera` (`ms`)** | `lerpCamera()` + `tickAnimations()` + `updateAllEmitters()` + `updateDamageTexts()` | `≤ 0.80 ms` | Measures particle `Graphics` updates, tween interpolations, and floating combat text. |
| **Stage 5: `Hover Inspector` (`ms`)** | `updateHoverInspection()` (`elementFromPoint` + `resolveTileInspection`) | `≤ 0.30 ms` | Verifies P2-R1 hover throttling remains effective during mouse movement. |
| **Stage 6: `WebGL Render Pass` (`ms`)** | PixiJS `app.renderer.render(app.stage)` execution time | `≤ 2.50 ms` | Measures actual WebGL command submission and post-process filter passes. |
| **`WebGL Draw Calls / Frame`** | `WebGLDrawCallProbe`: `gl.drawElements` + `gl.drawArrays` (+ instanced) | `≤ 35 DC` (Clean) / `≤ 80 DC` (Heavy Combat) | Directly exposes batch-breaking caused by per-sprite `OutlineFilter` / `GlitchFilter` FBOs and unbatched particle `Graphics`. |
| **`Triangles & Shader Switches`** | Sum of `count / 3` in `drawElements` + `gl.useProgram` & `gl.bindTexture` count | `≤ 40 program switches` | Identifies excessive filter ping-ponging on the GPU. |
| **`Active Pixi Filters`** | Breakdown: `Prop Filters` (`Outline`/`Glitch`) + `Enemy Glitch Filters` + `Damage Glitches` + `World Heat/Stability Filters` | `≤ 30 active filter instances` | Each active Pixi filter requires FBO render-target binding; critical for diagnosing GPU bottlenecks. |
| **`Active VFX Nodes`** | `Move/Attack/Death Tweens` \| `Particle Emitters (Total Particles)` \| `Damage Texts` | `≤ 150 particles` | Monitors visual effect saturation during multi-enemy encounters. |

---

### 3.2 Domain 2: ECS World, Spatial Grid & EventBus (`ECS / WORLD [実体]`)

Introspects the live client [`World`](../../src/engine/ecs/world.ts), [`Grid`](../../src/engine/grid/grid.ts), and [`EventBus`](../../src/engine/events/event-bus.ts):

| Metric | Source / Formula | Purpose |
| :--- | :--- | :--- |
| **`Total Live Entities`** | `world.getDiagnostics().entityCount` (`world.entities.size`) | Tracks total entity population on the current floor. |
| **`Entity Archetype Census`** | Categorized counts:<br>• **Actors**: Player (`1`) + Hostiles (`world.query(Hostile).length`) + Condemned (`world.query(Dying).length`)<br>• **Interactive Props**: Total `Prop` (`Locked` / `Corrupted` / `Searched`)<br>• **Items & Gear**: Ground Loot (`Position + Item/CurrencyItem`) vs. Equipped/Inventory Child Entities (`Parent`)<br>• **Hazards**: `DeadZone` + `CorruptionState` entities | Immediately reveals if condemned (`Dying`) entities failed to be reaped by `GravediggerSystem` or if child item entities are orphaned. |
| **`Component Store Cardinality`** | Total active stores (`world.stores.size`), total component instances ($\sum \text{store.size}$), and top 6 stores by size (e.g., `position`, `sprite`, `item`, `prop`, `children`) | Detects component bloat or lingering transient Intent/Tag components (`MoveIntent`, `PropInteractedThisTurn`, etc.). |
| **`Spatial Grid & FOV Coverage`** | • Grid Size (`80 × 45 = 3,600 tiles`)<br>• Occupied Entity Cells & Ground Item Cells<br>• Active FOV Tiles (`currentFovSet.size`) vs. Explored Tiles (`exploredSet.size`)<br>• Fog Memory Cache (`rememberedProps.size` / `rememberedTileItems.size`) | Verifies spatial hash index integrity and fog-of-war memory cache footprint. |
| **`EventBus Throughput`** | • Events/sec (`evt/s`) & Events/turn<br>• **High-Frequency Churn Indicator**: Separates per-frame `FOV_UPDATED` emissions (`~60/s`) from discrete gameplay/engine events | Alerts developers when an event is accidentally emitted on the 60Hz render ticker instead of per-turn. |

---

### 3.3 Domain 3: Turn Lifecycle, Prediction & Server Authority (`TURN / SYNC [同期]`)

*Nirmata Runner* splits simulation between **Client Prediction (9 systems)** and **Server Authority (23 systems)** via `/api/action`. This tab visualizes the complete turn lifecycle:

```
┌─ END-TO-END TURN WATERFALL (TURN #0042 — MOVE_EAST) ─────────────────────────────────┐
│ [Client Predict: 0.4ms] ──► [Network RTT: 14.2ms (Srv Sim: 3.1ms)] ──► [Reconcile: 0.9ms] │
│ ████                        ██████████████████████████████████████     ██████        │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

| Metric | Source / Formula | Purpose |
| :--- | :--- | :--- |
| **`Client Prediction Time` (`ms`)** | Duration of `turnManager.submitAction(action)` on client (`isClient: true`) | Measures the responsiveness of local optimistic movement/firmware prediction. |
| **`Network Action RTT` (`ms`)** | Total `fetch('/api/action')` round-trip latency (Current, Avg, Max) | Tracks API responsiveness and local/dev server latency. |
| **`Server Turn Execution` (`ms`)** | `_devPerf.serverTurnMs` measured around `processAction()` + `turnManager.submitAction()` in `/api/action` | Measures how long the authoritative 23-system server loop takes per turn. |
| **`Server Phase Breakdown` (`ms`)** | `_devPerf.phaseTimingsMs`: `PRE_TURN`, `GATHER_INTENT`, `ACTION`, `REACTION`, `CLEANUP`, `POST_TURN`, `ENEMY_TURNS` | Pinpoints which ECS phase dominates server turn time. |
| **`Top 5 Server Systems` (`ms`)** | `_devPerf.topSystems`: Ranked per-system timings (e.g., `AISystem`, `CombatSystem`, `PropInteractionSystem`, `StabilitySystem`, `TileCorruptionSystem`) | Identifies expensive AI pathfinding (Dijkstra/A*), cascade loops, or prop interaction bottlenecks. |
| **`Enemy Sub-Ticks & Actors`** | `_devPerf.enemyTurnsProcessed` & `_devPerf.energySubTicks` in `advanceUntilPlayerReady()` | Detects high sub-tick loops caused by speed modifiers (`MOVEMENT_SLOW`) or large enemy packs. |
| **`Client Reconciliation` (`ms`)** | Duration of `applyStateDelta()` + `renderSystem.reconcileSprites()` | Measures the client cost of applying world/grid diffs and syncing the PixiJS sprite map. |
| **`Sync Payload & Wire Delta`** | • Sync Mode: `DELTA` vs. `FULL`<br>• Payload Size: `KB` (Last turn & Session cumulative `KB`)<br>• Delta Mutation Counts: `+Ent / -Ent`, `CompSet / CompRem`, `Events` | Verifies delta compression efficiency and flags unexpected `FULL` state fallbacks or oversized deltas. |
| **`Input Buffer & Prediction Health`** | • `InputManager` Queue Depth (`0/2`, `1/2`, `2/2`) & `requestPending` lock state<br>• Prediction Accuracy: `Confirmed` vs. `Mispredicted / Rolled Back` vs. `0-Cost Safeguard Halts` | Diagnoses input drops, session lock contention (`HTTP 409`), or prediction desyncs. |

---

### 3.4 Domain 4: Memory, Textures & Audio DSP (`MEMORY / ASSETS [記憶]`)

Tracks GPU VRAM, sprite/tile pooling, Web Audio synthesis nodes, and JS heap health:

| Metric | Source / Formula | Purpose |
| :--- | :--- | :--- |
| **`Estimated GPU Texture VRAM` (`MB`)** | Sum of $\text{width} \times \text{height} \times 4 \times (\text{mipmaps} ? 1.33 : 1)$ across `app.renderer.texture.managedTextures` | Quantifies actual GPU texture memory footprint. |
| **`Texture Source Breakdown`** | Categorized count of live `TextureSource` instances:<br>• **Static Atlases**: Base `tileset` (`512×512`) + Faction Theme Atlas (`traxus`, `sekiguchi`, `dark_subnet`)<br>• **Filter FBOs / RenderTextures**: Temporary textures allocated by `OutlineFilter`, `GlitchFilter`, etc.<br>• **Dynamic Canvas/Text**: PixiJS `Text` textures from damage numbers | Immediately catches WebGL `RenderTexture` leaks (e.g., filters not calling `.destroy()` when removed from sprites). |
| **`Sprite & Tile Pool Utilization`** | • `tilemap.ts` `spritePool`: `Visible Tiles / Total Pooled Sprites` (e.g., `480 / 1,240`)<br>• `sprite-map.ts` `entitySprites`: `Visible Sprites / Total Tracked Sprites` (e.g., `18 / 64`) | Verifies viewport culling efficiency and confirms `clearTilemap()` / `purgeOrphanedSprites()` clean up properly. |
| **`JS Heap & GC Telemetry`** | Via `performance.memory` (Chromium) or graceful `N/A` badge (Firefox/Safari):<br>• `Used Heap / Total Allocated Heap` (`MB`)<br>• `Allocation Rate` (`MB/s` or `KB/frame`)<br>• `GC Pause / Sawtooth Counter` (counts negative heap deltas $> 2\text{ MB}$) | Reveals garbage collection churn caused by per-frame object/Set/array allocations. |
| **`Web Audio & Synth Voices`** | `getAudioEngine().getDiagnostics()`:<br>• `AudioContext` State (`running`/`suspended`), Sample Rate, Output Latency (`ms`)<br>• Active One-Shot Synth/Sample Voices (`activeVoices.size`)<br>• Active `AmbientEmitter` Spatial Loops<br>• Ambiance Biquad Filter (`Cutoff Hz` / `Resonance Q`) | Ensures procedural synth oscillators and spatial ambient loops disconnect cleanly on completion or floor descent. |

---

### 3.5 Domain 5: Leak Auditor, Anomaly Watchdog & Render Bisection (`AUDIT / TOOLS [監査]`)

Provides interactive diagnostic tools tailored to *Nirmata Runner*'s lifecycle:

1. **Floor-Transition Baseline Snapshot & Leak Diff (`[📸 SNAPSHOT]` / `Auto-Baseline on Floor 1`)**:
   - Captures a reference snapshot of `{ floor, entities, components, entitySprites, tilemapPool, activeFilters, managedTextures, vramMB, activeAudioVoices, jsHeapMB }`.
   - Displays a live `Δ DIFF` column comparing current state against the snapshot.
   - Automatically records a history entry on every `FLOOR_TRANSITION` so developers can verify that descending 10 floors in a row does not monotonically grow `managedTextures`, `activePropFilters`, or orphaned sprites.
2. **Spike Trap (`[⚡ TRAP >20ms]` Auto-Freeze)**:
   - When armed, if any frame exceeds the threshold (`16.7ms`, `25ms`, or `33.3ms`), the monitor automatically freezes the oscilloscope waveform and captures a **Spike Forensics Card** detailing:
     - Exact frame duration and which sub-stage (`FOV`, `Tilemap`, `Sprites`, `VFX`, `Hover`, `WebGL`) caused the spike.
     - Which `EventBus` events fired during that frame (e.g., `DAMAGE_DEALT`, `PROP_INTERACTED`, `DUNGEON_GENERATED`, `STATE_RECONCILED`).
3. **Live Render Pass Bisection Toggles (Dev-Only A/B Profiling)**:
   - Interactive checkboxes that let developers non-destructively toggle rendering subsystems in real time to measure their exact FPS / draw-call impact:
     - `[✓] Per-Sprite Prop & Enemy Filters` (`OutlineFilter`, `GlitchFilter`, `RGBSplitFilter`)
     - `[✓] World Post-Process Filters` (Heat Tier & Stability Desaturation filters)
     - `[✓] Neon Particle Emitters & Damage Texts`
     - `[✓] Dynamic Tilemap Rebuild (Cache Static View)` (skips per-frame `buildTilemap` when camera, zoom, and FOV are unchanged — demonstrating the exact frame-time savings of dirty-flagging the tilemap!)
     - `[✓] Per-Frame FOV Recalculation (Cache Static FOV)` (skips per-frame `computeFov` and `FOV_UPDATED` emission when player position and vision state haven't changed!)

---

## 4. Visual Design Specification ("Taikoku Vector Manifest")

The widget adheres strictly to the **Taikoku Vector Manifest** style guide ([`docs/design/UI-DESIGN-SYSTEM.md`](./UI-DESIGN-SYSTEM.md)):
- **Surfaces & Framing**: Deep carbon-void (`--c-bg: #040609` at `92%` opacity with `backdrop-filter: blur(6px)`), `.panel-card` dual-color 6px corner L-brackets (`--c-accent` `#d8ff00` top-left, `--c-accent-secondary` `#00f0ff` bottom-right), and crisp `1px solid var(--c-border)` (`#1c2638`) internal dividers (`border-radius: 2px`).
- **Typography**: `Space Grotesk` + `Noto Sans JP` (`--font-display`) for uppercase headers and bilingual tags; `JetBrains Mono` (`--font-mono`, `font-variant-numeric: tabular-nums`) for all numeric readouts so digits never jitter.
- **Z-Index & Pointer Isolation**: Renders at `z-index: 2800` (above HUD and modals, below BSOD crash screen) with `[data-perf-monitor="true"]` so `render-system.ts` suppresses tile hover tooltips when the cursor is over the widget (unless **Ghost Mode** is active).

### 4.1 Four Operational Modes

Users can cycle or select between 4 modes via **`F3`** (toggle on/off), **`Shift+F3`** (cycle `MINI -> STANDARD -> EXPANDED`), **`Alt+F3`** (toggle Ghost click-through mode), or `/perf` in `DevTerminal`:

#### Mode 1: `MINI` (Compact Telemetry Pill — `390px × 30px`)
Docks cleanly inside the top-left of the Tactical Viewport Bay (below the top HUD ribbon) or snaps to any screen corner when dragged:

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ⚡ 60 FPS │ 1.4ms [▁▂▁▃▂▁▁▂] │ 16 DC │ 142 ENT │ RTT 11ms │ 4.2MB │ [👻][⤢][✕] │
└───────────────────────────────────────────────────────────────────────────────┘
```
* Color-codes the FPS indicator: `--c-accent` (`#d8ff00`) for `≥ 55 FPS`, `--c-scrap` (`#ffaa00`) for `30–54 FPS`, `--c-danger` (`#ff2a4b`) for `< 30 FPS`.
* Includes a tiny `48px × 14px` live `<canvas>` sparkline of frame times.

#### Mode 2: `STANDARD` (Tactical Oscilloscope Widget — `380px` Width)
The default view when enabled. Features the inverted stark ivory `.taikoku-placard` micro-banner, the dual-trace 1px vector oscilloscope canvas, the stacked frame budget bar, and 5 switchable domain tabs:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 性能監視 // TK-PERF-900             [開発計測]  [👻 GHOST] [⏸] [📸] [▬] [⤢] [✕] │ ← Inverted Ivory/Dark Header
├──────────────────────────────────────────────────────────────────────────────┤
│ FPS: 60.0 (1% LOW: 57.2)          FRAME: 1.84 ms (11% BUDGET)    DC: 18     │
│ ┌─ 1PX OSCILLOSCOPE // 120 FRAMES (2.0s) ──────────────────────────────────┐ │
│ │ 33.3ms (30Hz) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ [CRIMSON]│ │
│ │ 16.7ms (60Hz) ───────────────────────────────────────────────── [CYAN]   │ │
│ │               _/\_____/\________/\___                           [LIME]   │ │
│ │ 0.0ms  ══════╝   ╚═══╝  ╚══════╝  ╚═════════════════════════════════════ │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ FRAME BUDGET BREAKDOWN [1.84 ms / 16.67 ms]:                                 │
│ [███ FOV 0.3m][█████ TILE 0.6m][███ SPR 0.4m][██ VFX 0.2m][███ GL 0.3m]      │
├──────────────────────────────────────────────────────────────────────────────┤
│ [ 描画 GPU ]  [ 実体 ECS ]  [ 同期 TURN ]  [ 記憶 MEM ]  [ 監査 AUDIT ●1 ]    │ ← Tab Bar
├──────────────────────────────────────────────────────────────────────────────┤
│ WEBGL DRAW CALLS ...................... 18 DC  (TRIS: 1,420 | PROG: 6)       │
│ ACTIVE PIXI FILTERS ................... 14     (PROP: 9 | ENEMY: 4 | WLD: 1) │
│ TERRAIN SPRITE POOL ................... 412 / 1,080 VISIBLE (AUTOTILE: 412)  │
│ ENTITY SPRITE MAP ..................... 24 / 58 VISIBLE     (TWEENS: 2)      │
│ NEON PARTICLES & TEXT ................. 4 EMITTERS (38 PT)  (TEXTS: 0)       │
│ HOVER INSPECTOR ....................... 0.04 ms             (THROTTLED: OK)  │
├──────────────────────────────────────────────────────────────────────────────┤
│ [⚡ SPIKE TRAP: OFF]               [📸 SNAPSHOT: F01]          [F3: HIDE]     │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Mode 3: `EXPANDED` (Deep-Dive Diagnostics Workstation — `720px` Width)
Displays a 2-column constructivist dashboard showing:
- **Left Column**: Full 240-frame (`4.0s`) Interactive Oscilloscope (with mouse-hover scrub cursor to inspect any historical frame's exact sub-stage timings and emitted events), plus `GPU / RENDER` and `MEMORY / ASSETS` readouts.
- **Right Column**: `TURN / SYNC` End-to-End Waterfall + Server Top-5 Systems table, `ECS / WORLD` Entity & Component Store Census, and `AUDIT / TOOLS` (Floor-Transition Leak Diff table + Live Render Pass Bisection checkboxes + `[⬇ EXPORT PERF JSON]`).

#### Ghost / Click-Through Mode (`[👻 GHOST]` / `Alt+F3`)
- Sets `pointer-events: none` on the widget body (keeping only a tiny `24×24px` `[👻]` restore button interactive in the corner) and reduces background alpha to `0.60`.
- Allows the developer to click, pan, zoom, and hover-inspect dungeon tiles directly through the performance monitor during combat testing.

---

## 5. Detailed Technical Design & Code Contracts

### 5.1 Foundation Layer Introspection Contracts

#### A. `@engine/ecs/world.ts` Additions
Add zero-dependency diagnostic introspection and an optional system timing hook to `World`:

```ts
export interface WorldDiagnostics {
  entityCount: number;
  nextId: number;
  storeCount: number;
  totalComponentInstances: number;
  storeSizes: Record<string, number>;
  systemCount: number;
}

export type SystemTimingHook = (
  phase: Phase,
  systemName: string,
  durationMs: number,
) => void;
```
- In `World.executeSystems(phase)`:
  ```ts
  if (this.systemTimingHook) {
    const t0 = performance.now();
    system(this);
    this.systemTimingHook(phase, systemName, performance.now() - t0);
  } else {
    system(this);
  }
  ```
  When `this.systemTimingHook === null` (always in production, and when the monitor is `OFF` in dev), not even `performance.now()` is invoked.

#### B. `@rendering` Telemetry Contract (`src/rendering/render-system.ts` & Submodules)
Expose lightweight counters from rendering submodules:
- [`src/rendering/tilemap.ts`](../../src/rendering/tilemap.ts):
  ```ts
  export interface TilemapTelemetry {
    poolSize: number;
    visibleTiles: number;
    lastAutotileSolves: number;
  }
  export function getTilemapTelemetry(): TilemapTelemetry;
  ```
- [`src/rendering/filters/particle-emitters.ts`](../../src/rendering/filters/particle-emitters.ts):
  ```ts
  export function getParticleTelemetry(): { activeEmitters: number; totalParticles: number };
  ```
- [`src/rendering/filters/glitch-effects.ts`](../../src/rendering/filters/glitch-effects.ts):
  ```ts
  export function getFilterTelemetry(): {
    activePropFilterSprites: number;
    totalPropFilters: number;
  };
  ```
- [`src/rendering/animations.ts`](../../src/rendering/animations.ts) & [`src/rendering/filters/damage-text.ts`](../../src/rendering/filters/damage-text.ts):
  ```ts
  export function getActiveAnimationCount(): number;
  export function getActiveDamageTextCount(): number;
  ```
- [`src/rendering/render-system.ts`](../../src/rendering/render-system.ts):
  Adds `getRenderTelemetry()` and `setDevRenderFlags(flags)` to the returned `RenderSystem` controller:
  ```ts
  export interface RenderStageTimings {
    fovMs: number;
    tilemapMs: number;
    spriteSyncMs: number;
    vfxMs: number;
    hoverMs: number;
    totalCpuMs: number;
  }

  export interface DevRenderBisectionFlags {
    measureTimings: boolean;
    disableSpriteFilters: boolean;
    disableWorldFilters: boolean;
    disableParticles: boolean;
    cacheStaticTilemap: boolean;
    cacheStaticFov: boolean;
  }
  ```

#### C. WebGL2 Draw Call & VRAM Probe (`src/dev-tool/perf/webgl-probe.ts`)
- Attaches to `(app.renderer as WebGLRenderer).gl` when the monitor is enabled in development mode.
- Wraps `gl.drawElements`, `gl.drawArrays`, `gl.drawElementsInstanced`, `gl.drawArraysInstanced`, `gl.useProgram`, and `gl.bindTexture`, incrementing integer counters per frame and forwarding immediately to the bound native methods.
- Exposes `detach()` to restore original native methods on the `WebGL2RenderingContext` instance when the monitor is closed or unmounted.
- Computes Texture VRAM by inspecting `app.renderer.texture?.managedTextures` (with safe optional chaining for unit test mocks):
  ```ts
  export interface TextureMemoryBreakdown {
    totalTextures: number;
    atlasTextures: number;
    renderTextures: number;
    textOrCanvasTextures: number;
    estimatedVramBytes: number;
  }
  ```

#### D. Authoritative Server Turn Telemetry (`src/app/api/action/route.ts`)
When `process.env.NODE_ENV === 'development'`, `/api/action` attaches a `systemTimingHook` to the session's `world` during turn execution and includes `_devPerf` on the response JSON:

```ts
export interface ServerTurnDevPerf {
  serverTurnMs: number;
  phaseTimingsMs: Record<string, number>;
  topSystems: Array<{ name: string; phase: string; durationMs: number }>;
  payloadBytes: number;
  syncType: 'FULL' | 'DELTA';
  entitiesAdded: number;
  entitiesRemoved: number;
  componentsSet: number;
  componentsRemoved: number;
  eventsEmitted: number;
}
```
- **Security & Production Invariant**: In `src/app/api/action/route.ts`, `_devPerf` is computed and attached **strictly inside `if (process.env.NODE_ENV === 'development')`**. Production responses remain 100% unchanged.

---

### 5.2 High-Frequency Collector vs. Throttled UI Store (`src/dev-tool/perf/`)

To guarantee the Performance Monitor itself never degrades game performance:

1. **Pre-Allocated Ring Buffers (`perf-collector.ts`)**:
   - Uses fixed-size typed arrays (`HIST_SIZE = 240` frames = 4 seconds at 60Hz):
     - `frameTimes = new Float32Array(240)`
     - `fovTimes = new Float32Array(240)`
     - `tilemapTimes = new Float32Array(240)`
     - `spriteTimes = new Float32Array(240)`
     - `vfxTimes = new Float32Array(240)`
     - `hoverTimes = new Float32Array(240)`
     - `webglTimes = new Float32Array(240)`
     - `drawCalls = new Uint16Array(240)`
   - Zero objects or arrays are allocated on the 60Hz frame tick!
2. **Direct `<canvas>` Oscilloscope Rendering**:
   - The oscilloscope `<canvas>` in `PerfMonitorWidget.tsx` reads directly from `perfCollector`'s typed arrays in its `requestAnimationFrame` loop and draws crisp 1px lines (`#d8ff00`, `#00f0ff`, `#ff2a4b`) without triggering React state updates.
3. **4Hz Throttled React State Synchronization (`perf-store.ts`)**:
   - Every `250ms`, `perfCollector` aggregates summary metrics (FPS Avg, 1% Low, Min/Max, ECS Entity Census, Texture VRAM, Audio Voices, Anomaly Alerts) and updates `usePerfStore`.

---

### 5.3 Developer Ergonomics: Hotkeys, `DevTerminal` & Persistence

1. **Keyboard Shortcuts (Development Mode Only)**:
   - **`F3`**: Toggle Performance Monitor visibility (`OFF` $\leftrightarrow$ last active mode `MINI` / `STANDARD` / `EXPANDED`).
   - **`Shift + F3`**: Cycle display mode (`MINI` $\to$ `STANDARD` $\to$ `EXPANDED` $\to$ `OFF`).
   - **`Alt + F3`**: Toggle **Ghost Mode** (`pointer-events: none` click-through overlay).
2. **`DevTerminal` (`src/dev-tool/terminal/DevTerminal.tsx`) Commands**:
   - `/perf` or `/perf toggle`: Toggles the performance monitor widget.
   - `/perf mini` | `/perf standard` | `/perf full` | `/perf off`: Sets explicit display mode.
   - `/perf ghost`: Toggles Ghost click-through mode.
   - `/perf snap` (or `/perf snapshot`): Captures a memory/entity baseline snapshot for leak comparison.
   - `/perf export`: Downloads a timestamped `nirmata-perf-telemetry.json` report containing frame statistics, turn waterfalls, entity/component census, and floor-transition leak diffs.
3. **`window.__DEBUG__.perf` Console API (`src/dev-tool/debug/debug-api.ts`)**:
   - Exposes `window.__DEBUG__.perf.toggle()`, `.setMode(mode)`, `.snapshot()`, `.getReport()` for automated Playwright / Vitest benchmarking scripts.
4. **`localStorage` Persistence**:
   - Persists widget mode (`OFF` by default so existing tests and clean boots are unaffected unless enabled), docked corner position, active tab, and Spike Trap threshold under `'nirmata_dev_perf_settings'`.

---

## 6. Implementation Plan & Milestones

### Milestone 1 (`PERF-01`): Foundation Layer Zero-Overhead Introspection Hooks
- **Files**:
  - [`src/engine/ecs/world.ts`](../../src/engine/ecs/world.ts): Add `getDiagnostics()` and `setSystemTimingHook()`.
  - [`src/engine/grid/grid.ts`](../../src/engine/grid/grid.ts): Add `getDiagnostics()` (occupied entity cells, ground item cells).
  - [`src/engine/events/event-bus.ts`](../../src/engine/events/event-bus.ts): Add lightweight emission counters (`getDiagnostics()`, `resetCounters()`).
  - [`src/engine/audio/audio-engine.ts`](../../src/engine/audio/audio-engine.ts) & [`src/engine/audio/types.ts`](../../src/engine/audio/types.ts): Add `getDiagnostics()` reporting active voice count, ambient loop count, AudioContext state, sample rate, and latency.
- **Verification**: Unit tests in `src/engine/ecs/world.test.ts` verifying `getDiagnostics()` accuracy and `setSystemTimingHook()` invocation and zero-overhead detachment.

### Milestone 2 (`PERF-02`): Rendering & Authoritative Server Turn Telemetry
- **Files**:
  - [`src/rendering/tilemap.ts`](../../src/rendering/tilemap.ts), [`src/rendering/filters/particle-emitters.ts`](../../src/rendering/filters/particle-emitters.ts), [`src/rendering/filters/glitch-effects.ts`](../../src/rendering/filters/glitch-effects.ts), [`src/rendering/animations.ts`](../../src/rendering/animations.ts), [`src/rendering/filters/damage-text.ts`](../../src/rendering/filters/damage-text.ts): Expose read-only pool/filter telemetry getters.
  - [`src/rendering/render-system.ts`](../../src/rendering/render-system.ts): Add sub-stage timing measurements (`fovMs`, `tilemapMs`, `spriteSyncMs`, `vfxMs`, `hoverMs`), `getRenderTelemetry()`, `setDevRenderFlags()` for live render bisection toggles, and `[data-perf-monitor]` hover suppression.
  - [`src/app/api/action/route.ts`](../../src/app/api/action/route.ts) & [`src/game/setup.ts`](../../src/game/setup.ts): Measure client prediction `ms`, network RTT `ms`, server `_devPerf` turn/phase/system timings (dev-only), and client reconciliation `ms`.
- **Verification**: Unit tests verifying sub-stage telemetry getters, render bisection flags, and confirming `/api/action` omits `_devPerf` when `NODE_ENV === 'production'`.

### Milestone 3 (`PERF-03`): `@dev-tool/perf` Collector, WebGL2 Probe & Leak Auditor
- **Files**:
  - `src/dev-tool/perf/webgl-probe.ts`: WebGL2 draw-call, triangle, shader-switch, texture-bind spy + PixiJS 8 `managedTextures` VRAM estimator with clean `attach()` / `detach()`.
  - `src/dev-tool/perf/perf-collector.ts`: Pre-allocated `Float32Array` circular buffers, 1% low FPS & jitter math, JS Heap & GC sawtooth tracker, Spike Trap detector, and Floor-Transition Baseline Snapshot & Diff engine.
  - `src/dev-tool/perf/perf-store.ts`: Zustand store managing widget display mode (`OFF`, `MINI`, `STANDARD`, `EXPANDED`), active tab, Ghost mode, docked position, `localStorage` sync, and 4Hz throttled UI snapshots.
- **Verification**: Unit tests in `src/dev-tool/perf/__tests__/perf-collector.test.ts` and `webgl-probe.test.ts` covering ring buffer math, WebGL spy attach/detach restoration, spike trap triggering, and snapshot diffs.

### Milestone 4 (`PERF-04`): Taikoku Telemetry Oscilloscope UI Widget (`PerfMonitorWidget.tsx`)
- **Files**:
  - `src/dev-tool/perf/PerfMonitorWidget.tsx` & `src/dev-tool/perf/PerfMonitorWidget.module.css`:
    - `MINI` pill with inline sparkline.
    - `STANDARD` 380px widget with 1px dual-trace oscilloscope `<canvas>`, stacked frame budget bar, and 5 domain tabs (`GPU`, `ECS`, `TURN`, `MEM`, `AUDIT`).
    - `EXPANDED` 720px 2-column workstation with interactive 240-frame scrub inspector, server system profiler table, and live render bisection checkboxes.
    - Ghost click-through mode and magnetic corner docking.
- **Verification**: Component tests in `src/dev-tool/perf/__tests__/PerfMonitorWidget.test.tsx` testing mode switching (`MINI`/`STANDARD`/`EXPANDED`), tab navigation, Ghost mode, Snapshot diffing, and Render Bisection toggles.

### Milestone 5 (`PERF-05`): App Integration, Hotkeys, `DevTerminal` Commands & Quality Gates
- **Files**:
  - [`src/app/page.tsx`](../../src/app/page.tsx): Dynamically mount `<PerfMonitorWidget />` behind `process.env.NODE_ENV === 'development'` and bind collector to active `GameContext` and `RenderSystem`.
  - [`src/dev-tool/terminal/DevTerminal.tsx`](../../src/dev-tool/terminal/DevTerminal.tsx) & [`src/dev-tool/debug/debug-api.ts`](../../src/dev-tool/debug/debug-api.ts): Add `/perf` commands (`/perf`, `/perf mini`, `/perf full`, `/perf ghost`, `/perf snap`, `/perf export`) and `window.__DEBUG__.perf`.
  - [`src/dev-tool/AGENTS.md`](../../src/dev-tool/AGENTS.md) & [`docs/TRACKING.md`](../TRACKING.md): Update documentation and tracking checklist.
- **Verification**: Run full quality gate suite (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`) verifying 0 lint boundary violations, 0 type errors, and clean production build isolation.
