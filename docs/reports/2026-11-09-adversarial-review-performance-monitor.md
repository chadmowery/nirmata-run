# Adversarial Architectural & Implementation Review: In-Game Performance & Telemetry Monitor (`TK-PERF-900` / `PERF-01` – `PERF-05`)

**Date:** 2026-11-09  
**Branch Reviewed:** `feature/tk-perf-900-monitor` (`main..HEAD`, 9 commits, 36 files changed, +5,700 / -56 lines)  
**Target Specs & Rulebooks:**
- [`docs/design/PERFORMANCE-MONITOR-SPEC.md`](../design/PERFORMANCE-MONITOR-SPEC.md)
- [`AGENTS.md`](../../AGENTS.md), [`src/engine/AGENTS.md`](../../src/engine/AGENTS.md), [`src/rendering/AGENTS.md`](../../src/rendering/AGENTS.md), [`src/dev-tool/AGENTS.md`](../../src/dev-tool/AGENTS.md)
- [`docs/design/UI-DESIGN-SYSTEM.md`](../design/UI-DESIGN-SYSTEM.md)

---

## 1. Executive Summary

An adversarial architectural, runtime, and specification compliance audit was conducted across the 9 commits on `feature/tk-perf-900-monitor` implementing Milestones `PERF-01` through `PERF-05` (`TK-PERF-900` Taikoku Telemetry Oscilloscope).

### What Went Right
- **Downward-Only Dependency Graph**: Foundation layers (`@engine`, `@rendering`, `@game`, `@server`) do not import from `@dev-tool/perf`; `npm run lint` (`eslint-plugin-import-x`) and `npm run typecheck` pass with zero boundary violations.
- **Engine Diagnostic Hooks (`PERF-01`)**: [`World.getDiagnostics()`](../../src/engine/ecs/world.ts#L272-L293), [`World.setSystemTimingHook()`](../../src/engine/ecs/world.ts#L265-L267), [`Grid.getDiagnostics()`](../../src/engine/grid/grid.ts#L155-L184), and [`AudioEngine.getDiagnostics()`](../../src/engine/audio/audio-engine.ts#L965-L985) are cleanly typed and isolated from external dependencies.
- **Server-Side `_devPerf` Production Guard**: [`src/app/api/action/route.ts`](../../src/app/api/action/route.ts#L95-L105) gates `world.setSystemTimingHook` and the `_devPerf` response envelope behind `process.env.NODE_ENV === 'development'`, verified by integration tests.
- **Custom Floating Tooltip System & Semantic Turn Action Derivation**: [`perf-tooltips.ts`](../../src/dev-tool/perf/perf-tooltips.ts) and [`deriveSemanticAction()`](../../src/game/setup.ts#L84-L152) provide clear contextual telemetry descriptions without triggering duplicate native browser `title` tooltips.

### Adversarial Findings Scorecard

Despite passing surface-level unit tests, the implementation contains **3 Critical (P0)**, **6 High (P1)**, **4 Medium (P2)**, and **2 Low (P3)** issues—including **hardcoded fake numbers in the Leak Auditor**, **always-on instrumentation when the monitor is `OFF`**, **broken WebGL pass timing (`0.00ms` hardcoded / tautological subtraction)**, **FBO textures misclassified as static atlases in PixiJS 8**, **pause/freeze state desynchronization**, and **whole sections of Domain 2 (`ECS`), Domain 3 (`TURN`), Domain 4 (`MEM`), and Domain 5 (`AUDIT`) omitted from the UI**.

| ID | Severity | Layer | Finding Summary |
| :--- | :--- | :--- | :--- |
| **`CRIT-01`** | **P0 (Critical)** | `@dev-tool` / `@app` | **RESOLVED** — `captureCurrentSnapshot()` gathers live engine census (entities, components, entity sprites, tilemap pool, filters, textures, VRAM, audio voices, JS heap) across UI, terminal, and debug API; auto-baselines on Floor 1 boot and audits floor transitions via `recordFloorTransitionSnapshot()`; expanded 9-row diff audit table with threshold alerts and floor history. |
| **`CRIT-02`** | **P0 (Critical)** | `@app` / `@rendering` / `@dev-tool` | **RESOLVED** — Zero-overhead when `OFF` via synchronized detachment and zero-allocation 60Hz tick via `getStageTimings()`, pre-allocated stats, and in-place collector updates. |
| **`CRIT-03`** | **P0 (Critical)** | `@dev-tool` / `@app` / `@rendering` | **RESOLVED** — Stage 6 `WebGL Render Pass (ms)` wrapped and measured via `renderer.render`, wired to budget bar/legend (`GL`), and scrub card reads `webglTimes`. |
| **`HIGH-01`** | **P1 (High)** | `@dev-tool` | **RESOLVED** — Synchronized `isPaused` and `perfCollector.setFrozen()` via bidirectional freeze callbacks; eliminated `!isPaused` guard from `renderWaveforms` allowing scrub crosshairs and reticle dots to render while paused without canvas stalling. |
| **`HIGH-02`** | **P1 (High)** | `@dev-tool` | **RESOLVED** — PixiJS 8 `WebGLProbe.getTextureMemory()` accurately categorizes `TextureSource` instances (FBOs with `resource: null` and `uploadMethodId: 'unknown'`) and calculates physical pixel VRAM on Retina displays. |
| **`HIGH-03`** | **P1 (High)** | `@rendering` / `@dev-tool` | **RESOLVED** — Full bisection state restoration (outlines, heat ghosting, world desaturation/heat tier), enemy persistent glitch tracking, and `ENTITY SPRITE MAP` row in `GPU` tab. |
| **`HIGH-04`** | **P1 (High)** | `@dev-tool` / `@rendering` / `@engine` | **Domain 2 (`ECS / WORLD`) Omits Entity Archetype Census, Top 6 Component Stores, FOV / Fog Memory Coverage, and EventBus Throughput (Spec §3.2)**: `renderEcsTab()` renders only 5 basic numbers, omitting Actor/Hostile/Condemned/Prop/Loot/Child/Hazard archetype counts, top 6 component stores from `ecsDiagnostics.storeSizes`, active FOV vs. explored tiles and `rememberedProps`/`rememberedTileItems` cache counts, and `EventBus` `evt/s` + `FOV_UPDATED` churn separation (`EventBus.getDiagnostics()` is never called). |
| **`HIGH-05`** | **P1 (High)** | `@app/api` / `@game` / `@dev-tool` | **Domain 3 (`TURN / SYNC`) Unaggregated Server `topSystems`, Missing Phase Breakdown, Missing Sub-Ticks, Missing Wire Delta & Input Buffer Health, and Uninstrumented Action Senders (Spec §3.3, §5.1.D)**: `/api/action` pushes per-system timings without aggregating across player + enemy sub-ticks (producing duplicate system rows); `renderTurnTab()` slices top 3 instead of Top 5, omits the visual waterfall bar, omits `serverPhaseTimings`, omits RTT Avg/Max, omits wire payload `KB` & delta mutation counts (`+Ent/-Ent`, `CompSet/CompRem`, `Events`), and omits `InputManager` queue depth & prediction accuracy. `TurnManager` does not report `enemyTurnsProcessed` or `energySubTicks`. 10 of 12 `sendActionToServer` call sites in `setup.ts` do not measure `clientPredictionMs`. |
| **`HIGH-06`** | **P1 (High)** | `@dev-tool` / `@engine` | **Domain 4 (`MEMORY / ASSETS`) Omits Sprite/Tile Pool Utilization, JS Heap Allocation Rate, Audio Output Latency, and Biquad Filter Readouts, and Double-Counts Ambient Audio Voices (Spec §3.4)**: `renderMemTab()` omits `Sprite & Tile Pool Utilization`, `Allocation Rate` (`MB/s` or `KB/frame`), `outputLatencyMs`, and `ambianceCutoffHz` / `ambianceResonanceQ` (despite `AudioEngine.getDiagnostics()` computing them). `AudioEngine.getDiagnostics()` adds `ambientLoops` onto `activeVoiceCount`. |
| **`MED-01`** | **P2 (Medium)** | `@dev-tool` / `@app` | **RESOLVED** — Full Spike Forensics Card displaying exact sub-stage breakdown, culprit stage analysis badge, draw calls/triangles, and per-frame discrete `EventBus.onAny` events (with teardown unsubscription and per-frame flush). |
| **`MED-02`** | **P2 (Medium)** | `@dev-tool` / `@app` | **Broken macOS `Alt+P` / `Shift+Alt+P` Hotkeys (`e.key === 'π'`), Top-Left HUD Occlusion, and Missing Drag-to-Corner Docking (Spec §2, §4.1, §5.3)**: `page.tsx` checks `e.key === 'p' || e.key === 'P'` under `e.altKey`, which fails on macOS where Option+P emits `e.key = 'π'` (`e.code = 'KeyP'`). Also `Ctrl+Shift+P` (`isCtrlShiftP`) toggles instead of cycling when `Shift` is held. `.posTopLeft` (`top: 12px; left: 12px`) overlaps the top HUD ribbon instead of docking below it, and magnetic drag-to-corner docking is unimplemented (`MINI` mode has no dock controls at all). |
| **`MED-03`** | **P2 (Medium)** | `@rendering` | **RESOLVED** — `cacheStaticFov` and `cacheStaticTilemap` invalidated upon `STATE_RECONCILED`, `PROP_INTERACTED`, `LOCK_UNLOCKED`, `ITEM_PICKED_UP`, and `DUNGEON_GENERATED`. |
| **`MED-04`** | **P2 (Medium)** | `@dev-tool` | **RESOLVED** — Rendered `Avg FPS` and `Jitter σ` in summary metrics row; wired click/drag scrubbing, scrub canvas container, and scrub hover cards to `STANDARD` mode oscilloscope canvas. |
| **`LOW-01`** | **P3 (Low)** | `@app` / `@engine` | **RESOLVED** — Production Bundle & Runtime Hygiene (`next/dynamic` ternary in `page.tsx` & `EventBus` diagnostic gating). |
| **`LOW-02`** | **P3 (Low)** | `@dev-tool` | **RESOLVED** — Removed duplicate `renderSystem.setDevRenderFlags` call in `handleToggle`, deferring to `useEffect`. |

---

## 2. Deep-Dive Root Cause Analysis

### `CRIT-01` (P0 Critical): [RESOLVED] Leak Auditor & Baseline Snapshots Use Hardcoded Fake Constants (`floor: 1`, `tilemapPoolSize: 1080`, `entitySpriteCount: 30`, `activeFilterCount: 0`) & All-Zero Snapshots in `DevTerminal` / `DebugAPI`

- **Locations**:
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:207-219`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L207-L219)
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:484-498`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L484-L498)
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:1343-1378`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L1343-L1378)
  - [`src/dev-tool/terminal/DevTerminal.tsx:333-346`](../../src/dev-tool/terminal/DevTerminal.tsx#L333-L346)
  - [`src/dev-tool/debug/debug-api.ts:237-251`](../../src/dev-tool/debug/debug-api.ts#L237-L251)
  - [`src/dev-tool/perf/perf-collector.ts:309-314`](../../src/dev-tool/perf/perf-collector.ts#L309-L314)
- **Spec Requirement**: [`docs/design/PERFORMANCE-MONITOR-SPEC.md` §3.5.1](../design/PERFORMANCE-MONITOR-SPEC.md#L157-L160) & [§5.3](../design/PERFORMANCE-MONITOR-SPEC.md#L390-L393):
  - Capture an accurate reference snapshot of `{ floor, entities, components, entitySprites, tilemapPool, activeFilters, managedTextures, vramMB, activeAudioVoices, jsHeapMB }` from live engine state across all 3 trigger surfaces (`[📸 SNAPSHOT]` UI button, `/perf snap` in `DevTerminal`, and `window.__DEBUG__.perf.snapshot()`).
  - Automatically capture a baseline on Floor 1 and record a floor-transition history entry on every `FLOOR_TRANSITION` event.
- **Root Cause**:
  1. In [`PerfMonitorWidget.tsx:484-498`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L484-L498), `handleTakeSnapshot()` hardcodes placeholder values instead of reading live telemetry:
     ```ts
     const handleTakeSnapshot = () => {
       const currentCensus = {
         floor: 1,
         entityCount: throttledData.ecsDiagnostics?.entityCount ?? 0,
         componentCount: throttledData.ecsDiagnostics?.totalComponentInstances ?? 0,
         entitySpriteCount: throttledData.stageTimings.spriteSyncMs > 0 ? 30 : 0,
         tilemapPoolSize: 1080,
         activeFilterCount: 0,
         managedTextureCount: throttledData.textureMemory.totalTextures,
         vramBytes: throttledData.textureMemory.estimatedVramBytes,
         activeAudioVoiceCount: throttledData.audioDiagnostics?.activeVoiceCount ?? 0,
         jsHeapBytes: throttledData.gcTelemetry.heapUsedBytes,
       };
       perfCollector.takeBaselineSnapshot(currentCensus);
     };
     ```
  2. In the 4Hz sync loop ([`PerfMonitorWidget.tsx:207-217`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L207-L217)), `currentCensus.entitySpriteCount` is populated with `renderTelemetry?.tilemap?.visibleTiles ?? 0` (**terrain tiles**, not `entitySprites`), which is then diffed against the hardcoded `30` from `handleTakeSnapshot()`.
  3. In [`DevTerminal.tsx:333-346`](../../src/dev-tool/terminal/DevTerminal.tsx#L333-L346), `/perf snap` passes literal `0` for every single field (`entityCount: 0`, `componentCount: 0`, `vramBytes: 0`, etc.).
  4. In [`debug-api.ts:237-251`](../../src/dev-tool/debug/debug-api.ts#L237-L251), `window.__DEBUG__.perf.snapshot()` passes `floor: 1` and literal `0` for `entitySpriteCount`, `tilemapPoolSize`, `activeFilterCount`, `managedTextureCount`, `vramBytes`, `activeAudioVoiceCount`, and `jsHeapBytes`.
  5. [`perfCollector.recordFloorTransitionSnapshot()`](../../src/dev-tool/perf/perf-collector.ts#L309-L314) is **100% dead code**—it is never called anywhere in the codebase, so automatic Floor 1 baselining and `FLOOR_TRANSITION` leak history auditing never occur.
  6. In [`renderAuditTab()`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L1343-L1374), the `DIFF Δ` table only renders 3 rows (`Entities`, `Textures`, `VRAM (MB)`), omitting `Components`, `Entity Sprites`, `Tilemap Pool`, `Active Filters`, `Audio Voices`, `JS Heap`, and the `Floor History` table, and hardcodes `<td>OK</td>` for `VRAM (MB)` regardless of delta magnitude.

---

### `CRIT-02` (P0 Critical): [RESOLVED] Violation of Zero-Overhead When `OFF` & Per-Frame Heap Allocations on 60Hz Ticker

- **Locations**:
  - [`src/app/page.tsx:152-199`](../../src/app/page.tsx#L152-L199)
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:150-154`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L150-L154)
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:453`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L453)
  - [`src/rendering/render-system.ts:1437-1446`](../../src/rendering/render-system.ts#L1437-L1446)
  - [`src/dev-tool/perf/perf-collector.ts:183`](../../src/dev-tool/perf/perf-collector.ts#L183)
- **Spec Requirement**:
  - [`docs/design/PERFORMANCE-MONITOR-SPEC.md` §1.1.3](../design/PERFORMANCE-MONITOR-SPEC.md#L27-L28): *"When toggled `OFF`, all WebGL method wrappers, ECS system timing hooks, and ticker listeners are completely detached (`0.00ms` runtime cost)."*
  - [`docs/design/PERFORMANCE-MONITOR-SPEC.md` §5.2.1](../design/PERFORMANCE-MONITOR-SPEC.md#L372): *"Zero objects or arrays are allocated on the 60Hz frame tick!"*
- **Root Cause**:
  1. **Always-On Instrumentation When `mode === 'OFF'`**:
     - In [`src/app/page.tsx:170-199`](../../src/app/page.tsx#L170-L199), `start()` unconditionally creates `WebGLProbe`, calls `probe.attach()` (wrapping 6 WebGL methods on every draw/bind call), sets `perfCollectorRef.current = perfCollector`, registers `setTurnTelemetryHook`, and attaches 4 `eventBus.on` listeners—even when `usePerfStore.getState().mode === 'OFF'`.
     - In [`PerfMonitorWidget.tsx:150-154`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L150-L154), `useEffect` syncs `bisectionFlags` (where `measureTimings: true` by default in `perf-store.ts:146`) to `renderSystem.setDevRenderFlags(bisectionFlags)` **before** the `if (mode === 'OFF') return null;` guard on line 453. Thus, `devFlags.measureTimings` is enabled even when the monitor is `OFF`, and switching `mode` to `'OFF'` never detaches `WebGLProbe` or sets `measureTimings: false`.
  2. **Multiple Object Allocations & Map Iterations on Every 60Hz Tick**:
     - In [`src/app/page.tsx:154-164`](../../src/app/page.tsx#L154-L164), `tickerCallback` calls `renderSystem.getRenderTelemetry()` and `webglProbeRef.current?.getFrameStats()` on every 60Hz frame.
     - `renderSystem.getRenderTelemetry()` ([`src/rendering/render-system.ts:1437-1446`](../../src/rendering/render-system.ts#L1437-L1446)) allocates 5 objects per frame (`{ ...latestStageTimings }`, `getTilemapTelemetry()`, `getParticleTelemetry()`, `getFilterTelemetry()`, and the outer `RenderTelemetry` wrapper) and loops over `activeSprites` and `activePropFilters` at 60Hz—even though `tilemap`, `particles`, and `filters` are only consumed by the 4Hz UI store timer!
     - `perfCollector.recordFrame()` ([`src/dev-tool/perf/perf-collector.ts:183`](../../src/dev-tool/perf/perf-collector.ts#L183)) also allocates `{ ...webglStats }` on every frame.

---

### `CRIT-03` (P0 Critical): [RESOLVED] Stage 6 `WebGL Render Pass (ms)` Is Never Measured (`0.00ms`) & Scrub Inspector Computes a Tautological Zero (`cpuTime - cpuTime === 0`)

- **Locations**:
  - [`src/app/page.tsx:152-166`](../../src/app/page.tsx#L152-L166)
  - [`src/dev-tool/perf/perf-collector.ts:177-208`](../../src/dev-tool/perf/perf-collector.ts#L177-L208)
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:720-778`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L720-L778)
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:897-964`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L897-L964)
- **Spec Requirement**:
  - [`docs/design/PERFORMANCE-MONITOR-SPEC.md` §3.1](../design/PERFORMANCE-MONITOR-SPEC.md#L92): **Stage 6: `WebGL Render Pass` (`ms`)** measures PixiJS `app.renderer.render(app.stage)` execution time (`≤ 2.50 ms` budget).
  - [`docs/design/PERFORMANCE-MONITOR-SPEC.md` §4.1 Mode 2](../design/PERFORMANCE-MONITOR-SPEC.md#L211-L212): Stacked Frame Budget Breakdown includes `[███ FOV][█████ TILE][███ SPR][██ VFX][███ GL]`.
- **Root Cause**:
  1. In [`src/app/page.tsx:162`](../../src/app/page.tsx#L162), `perfCollectorRef.current.recordFrame(app.ticker.deltaMS, telemetry.stageTimings, stats)` is called with only 3 arguments, leaving the 4th parameter `webglPassMs = 0` at its default `0` on every frame. `perfCollector.webglTimes` is filled exclusively with `0`s.
  2. Furthermore, `tickerCallback` in `page.tsx:166` is registered on `app.ticker` at default priority (`UPDATE_PRIORITY.NORMAL = 0`), whereas PixiJS `Application` executes `app.render()` at `UPDATE_PRIORITY.LOW = -25`. Because `WebGLProbe` does not wrap `app.renderer.render`, `webglPassMs` is never timed around the WebGL submission pass.
  3. In [`PerfMonitorWidget.tsx:720-778`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L720-L778) (`STANDARD` mode), the stacked frame budget bar and legend completely omit `GL` (`webglPassMs`), and `.budgetLabels` also omits `HOVER`.
  4. In [`PerfMonitorWidget.tsx:903, 963`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L903) (`EXPANDED` mode Scrub Hover Card):
     ```ts
     // Line 903:
     const cpuTime = fov + tilemap + sprite + vfx + hover;
     // ...
     // Line 963:
     <span>GL: {(Math.max(0, scrubData.cpuTime - (scrubData.fov + scrubData.tilemap + scrubData.sprite + scrubData.vfx + scrubData.hover))).toFixed(2)}ms</span>
     ```
     Because `scrubData.cpuTime` is literally `fov + tilemap + sprite + vfx + hover`, subtracting `(fov + tilemap + sprite + vfx + hover)` from `scrubData.cpuTime` is an algebraic tautology that evaluates to `0.00ms` on every frame instead of reading `perfCollector.webglTimes[targetIdx]`.

---

### `HIGH-01` (P1 High): [RESOLVED] Pause (`isPaused`) vs. Collector Freeze (`isFrozen`) Desync Corrupts Scrubbing & Suppresses Crosshair Rendering While Paused

- **Locations**:
  - [`src/dev-tool/perf/perf-store.ts:235-237`](../../src/dev-tool/perf/perf-store.ts#L235-L237)
  - [`src/dev-tool/perf/perf-collector.ts:184-198`](../../src/dev-tool/perf/perf-collector.ts#L184-L198)
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:281, 346, 405-443, 882-928`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L281)
- **Root Cause**:
  1. `usePerfStore.isPaused` and `perfCollector.isFrozen` are completely disconnected:
     - When the user clicks `[⏸]` or clicks the Expanded oscilloscope canvas (`togglePause()`), `usePerfStore.isPaused` becomes `true`, **but `perfCollector.setFrozen(true)` is never called**. `perfCollector.recordFrame()` continues overwriting all ring buffers (`frameTimes`, `fovTimes`, etc.) and advancing `head` at 60Hz in the background!
     - When the user scrubs the mouse over the "paused" canvas (`onMouseMove`, lines 884–923), `onMouseMove` indexes into `perfCollector` using the live, advancing `perfCollector.getHeadIndex()`, returning constantly mutating frame data that has no relation to the waveform frozen on the canvas.
  2. Conversely, when `renderWaveforms` runs while `isPaused === true` ([`PerfMonitorWidget.tsx:281, 346`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L346)):
     - `if (mode === 'EXPANDED' && expandedOscilloscopeRef.current && !isPaused)` skips all canvas drawing when paused.
     - Consequently, when the user pauses the waveform to scrub and inspect samples (as instructed by the UI hint `'⏸ PAUSED: HOVER TO INSPECT SAMPLES'`), **the white vertical crosshair and yellow/cyan sample reticle dots (lines 405–442) never draw on the canvas**!
     - Furthermore, switching modes (e.g., `STANDARD` $\to$ `EXPANDED`) while paused mounts a fresh `<canvas>` that remains completely blank until unpaused.
  3. When Spike Trap auto-freezes `perfCollector` (`this.isFrozen = true` in `perf-collector.ts:188`), `usePerfStore.isPaused` remains `false`, so the header `[⏸]` button and `[PAUSED]` badge do not reflect the frozen state, and clicking `[⏸]` does not resume from a Spike Trap freeze.

---

### `HIGH-02` (P1 High): [RESOLVED] PixiJS 8 `WebGLProbe.getTextureMemory()` Misclassifies All Filter FBO / `RenderTexture` Sources as Static Atlases & Under-Reports High-DPI VRAM

- **Location**: [`src/dev-tool/perf/webgl-probe.ts:274-300`](../../src/dev-tool/perf/webgl-probe.ts#L274-L300)
- **Spec Requirement**: [`docs/design/PERFORMANCE-MONITOR-SPEC.md` §3.4 & §5.1.C](../design/PERFORMANCE-MONITOR-SPEC.md#L143-L146): Accurately categorize `TextureSource` instances in `app.renderer.texture.managedTextures` into `atlasTextures`, `renderTextures` (Filter FBOs / `RenderTexture`s), and `textOrCanvasTextures`, and compute GPU VRAM in bytes.
- **Root Cause**:
  1. In PixiJS 8 (`GlTextureSystem`), `renderer.texture.managedTextures` is an array of `TextureSource` objects (not `Texture` wrappers). When PixiJS 8 creates a `RenderTexture` or filter FBO pool texture (`RenderTexture.create` / `TexturePool`), it instantiates a base `TextureSource` where `source.resource === null` and `source.uploadMethodId === 'unknown'`—it does **not** set `tex.isRenderTexture = true` or put `'fbo'` in `tex.label`.
  2. Because [`webgl-probe.ts:287-299`](../../src/dev-tool/perf/webgl-probe.ts#L287-L299) only checks:
     ```ts
     const isFbo =
       Boolean(tex.isRenderTexture) ||
       label.includes('fbo') ||
       label.includes('render-texture') ||
       label.includes('filter');
     ```
     and defaults the `else` branch to `result.atlasTextures++`, every single live filter FBO / `RenderTexture` in PixiJS 8 is misclassified as an `atlasTexture`, leaving `FBO: 0` in the `MEM` tab!
  3. On line 275, `const w = tex.width || tex.pixelWidth || 0;` checks logical `tex.width` before physical `tex.pixelWidth`. For any texture with `resolution > 1` (such as high-DPI filter FBOs or text canvases where `pixelWidth = width * resolution`), using `width` instead of `pixelWidth` under-reports allocated GPU VRAM by $resolution^2$ (e.g., $4\times$ on `2x` DPI).

---

### `HIGH-03` (P1 High): [RESOLVED] Broken Render Bisection State Restoration & Missing Enemy / World / Entity-Sprite Telemetry in Domain 1 (`GPU`)

- **Locations**:
  - [`src/rendering/render-system.ts:1451-1489`](../../src/rendering/render-system.ts#L1451-L1489)
  - [`src/rendering/filters/glitch-effects.ts:12-24, 108-201`](../../src/rendering/filters/glitch-effects.ts#L12-L24)
  - [`src/rendering/tilemap.ts:129-186`](../../src/rendering/tilemap.ts#L129-L186)
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:1100-1170`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L1100-L1170)
- **Spec Requirement**: [`docs/design/PERFORMANCE-MONITOR-SPEC.md` §3.1, §3.5.3, §4.1 Mode 2](../design/PERFORMANCE-MONITOR-SPEC.md#L81-L97)
- **Root Cause**:
  1. **`disableSpriteFilters` Leak & Stale Telemetry**: In [`render-system.ts:1453-1460`](../../src/rendering/render-system.ts#L1453-L1460), setting `disableSpriteFilters: true` sets `sprite.filters = null` on each entity sprite, **without** calling `removePersistentGlitch(sprite)` or clearing `activePropFilters` and `lastPropOutlineState`. Thus, `getFilterTelemetry().totalPropFilters` continues reporting the old filter count after filters were disabled, and Heat Tier 2 player ghost sprites (`updateSpriteGhosting`) are not removed.
  2. **`disableWorldFilters` Never Restores World Filters When Unchecked**: In [`render-system.ts:1473-1475`](../../src/rendering/render-system.ts#L1473-L1475), enabling `disableWorldFilters: true` calls `removeFiltersFromContainer(layers.worldContainer)`. Unchecking it (`disableWorldFilters: false`) does **nothing**—neither `applyStabilityDesaturation` nor `applyHeatTierFilters` is re-applied from the player's current `Stability` and `Heat` components!
  3. **`cacheStaticTilemap` Stale `lastAutotileSolves`**: When `cacheStaticTilemap` is enabled and `lastTilemapKey === tilemapKey` ([`render-system.ts:1004`](../../src/rendering/render-system.ts#L1004)), `buildTilemap()` is not called, so `lastAutotileSolveCount` in `tilemap.ts` retains the count from the last rebuilt frame instead of resetting to `0` for cached frames.
  4. **Enemy Glitch Filters & World Filters Untracked / Hardcoded**:
     - `getFilterTelemetry()` in [`glitch-effects.ts:12-24`](../../src/rendering/filters/glitch-effects.ts#L12-L24) only counts `activePropFilters`, ignoring enemy persistent glitch filters (`applyPersistentGlitch`) and active damage glitch filters (`activeDamageFilters`).
     - In [`PerfMonitorWidget.tsx:1108-1114`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L1108-L1114), `propFilterCount` falls back to a magic number `8` (`filters?.totalPropFilters ?? (data.stageTimings.spriteSyncMs > 0 ? 8 : 0)`), `worldFilterCount` is hardcoded to `1` (`bisectionFlags.disableWorldFilters ? 0 : 1`) even when `layers.worldContainer.filters` is `null`, and the `ENEMY` filter breakdown required by Spec §3.1 & §4.1 (`(PROP: 9 | ENEMY: 4 | WLD: 1)`) is missing.
  5. **Missing `ENTITY SPRITE MAP` & `TWEENS` Row in `GPU` Tab**:
     - Spec §3.1 & §4.1 Mode 2 require `ENTITY SPRITE MAP ... 24 / 58 VISIBLE (TWEENS: 2)`. `sprite-map.ts` does not expose `getSpriteTelemetry()` (`visibleSprites` / `totalSprites`), and `renderGpuTab()` omits both entity sprite counts and `activeAnimations` (`TWEENS`).

---

### `HIGH-04` (P1 High): Domain 2 (`ECS / WORLD`) Omits Entity Archetype Census, Top 6 Component Stores, FOV / Fog Memory Coverage, and EventBus Throughput

- **Locations**:
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:1172-1206`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L1172-L1206)
  - [`src/rendering/render-system.ts:1437-1446`](../../src/rendering/render-system.ts#L1437-L1446)
- **Spec Requirement**: [`docs/design/PERFORMANCE-MONITOR-SPEC.md` §3.2](../design/PERFORMANCE-MONITOR-SPEC.md#L100-L112)
- **Root Cause**:
  [`renderEcsTab()`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L1172-L1206) only displays `TOTAL LIVE ENTITIES`, `COMPONENT STORES`, `SPATIAL GRID`, `GROUND ITEM CELLS`, and `REGISTERED SYSTEMS`. All four detailed diagnostic sections required by Spec §3.2 are missing:
  1. **Entity Archetype Census**: Actors (`Player`, `Hostiles`, `Condemned / Dying`), Interactive Props (`Total Prop`, `Locked`, `Corrupted`, `Searched`), Items & Gear (`Ground Loot` vs. `Inventory/Equipped Child Entities`), and Hazards (`DeadZone` + `CorruptionState`).
  2. **Top 6 Component Stores by Size**: `World.getDiagnostics().storeSizes` already returns a map of all store sizes, but `renderEcsTab()` never sorts or renders the top 6 stores.
  3. **FOV Coverage & Fog Memory Cache**: `RenderSystem.getRenderTelemetry()` does not expose `fovSet.size` (`Active FOV Tiles`), `exploredSet.size` (`Explored Tiles`), `rememberedProps.size`, or `rememberedTileItems.size`, and `renderEcsTab()` does not render them.
  4. **EventBus Throughput & Churn Indicator**: `EventBus.getDiagnostics()` was added to [`src/engine/events/event-bus.ts`](../../src/engine/events/event-bus.ts#L148-L165), but it is never queried by `PerfCollector` or `PerfMonitorWidget` to display `evt/s`, `events/turn`, and `FOV_UPDATED` 60Hz churn vs. discrete gameplay events.

---

### `HIGH-05` (P1 High): Domain 3 (`TURN / SYNC`) Unaggregated Server `topSystems`, Missing Phase Breakdown, Missing Sub-Ticks, Missing Wire Delta & Input Buffer Health, and Uninstrumented Action Senders

- **Locations**:
  - [`src/app/api/action/route.ts:95-105, 443-465`](../../src/app/api/action/route.ts#L95-L105)
  - [`src/engine/turn/turn-manager.ts:170-240`](../../src/engine/turn/turn-manager.ts#L170-L240)
  - [`src/game/setup.ts:314-458, 590-600, 643-648, 827-907`](../../src/game/setup.ts#L314-L458)
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:1208-1263`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L1208-L1263)
- **Spec Requirement**: [`docs/design/PERFORMANCE-MONITOR-SPEC.md` §3.3 & §5.1.D](../design/PERFORMANCE-MONITOR-SPEC.md#L114-L136)
- **Root Cause**:
  1. **Unaggregated `systemTimings` in `/api/action`**:
     In [`src/app/api/action/route.ts:97-104`](../../src/app/api/action/route.ts#L97-L104):
     ```ts
     world.setSystemTimingHook((phase, systemName, durationMs) => {
       phaseTimings[phase] = (phaseTimings[phase] ?? 0) + durationMs;
       systemTimings.push({ name: systemName, phase, durationMs });
     });
     ```
     Because [`TurnManager.processEnemyTurns()`](../../src/engine/turn/turn-manager.ts#L198) calls `this.executeActionSequence()` once for **every ready enemy**, each `GATHER_INTENT` / `ACTION` / `REACTION` / `CLEANUP` system executes $1 + N_{\text{enemies}}$ times per turn. Pushing raw entries into `systemTimings` without aggregating by `systemName` causes the same system to appear multiple times in `topSystems` while under-reporting its cumulative turn cost.
  2. **Missing `enemyTurnsProcessed` & `energySubTicks`**:
     [`TurnManager`](../../src/engine/turn/turn-manager.ts#L208-L240) does not track how many enemy turns and energy sub-ticks elapsed during `executeTurnCycle()` / `advanceUntilPlayerReady()`, and `ServerTurnDevPerf` omits `enemyTurnsProcessed` and `energySubTicks` (Spec §3.3).
  3. **Missing Visual Turn Waterfall, Phase Breakdown, Top 5 Systems, RTT Avg/Max, Wire Delta Stats, and Input Buffer Health in `renderTurnTab()`**:
     - `renderTurnTab()` ([`PerfMonitorWidget.tsx:1208-1263`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L1208-L1263)) slices `turn.serverTopSystems.slice(0, 3)` instead of **Top 5**.
     - `turn.serverPhaseTimings`, `turn.payloadBytes` (last turn KB & session cumulative KB), `turn.deltaEntitiesAdded`, `turn.deltaEntitiesRemoved`, `turn.deltaComponentsSet`, `turn.deltaComponentsRemoved`, and `turn.deltaEventsCount` are already present on `TurnTelemetryData` but **never rendered** in `renderTurnTab()`.
     - Visual End-to-End Turn Waterfall bar (`[Client Predict] ──► [Network RTT (Srv Sim)] ──► [Reconcile]`), Turn Number (`#0042`), RTT Avg/Max, `InputManager` queue depth (`getQueueLength()` / `getPendingStatus()`), and prediction accuracy counters (`Confirmed`, `Rolled Back`, `0-Cost Safeguard Halts`) are completely absent.
  4. **Uninstrumented Action Senders in `src/game/setup.ts`**:
     Only 2 of the 12 `sendActionToServer()` call sites in `src/game/setup.ts` measure `clientPredictionMs` (`handleConfirmedTarget` on line 468 and keyboard `handlePlayerInput` on line 840). UI/modal actions routed through `context.submitAction`, `[E]` prop interaction (`INTERACT_PROP`), direct single-item pickup (`PICKUP`), staircase/anchor descend, and equipment/burn listeners pass `clientPredictionMs = 0`.

---

### `HIGH-06` (P1 High): Domain 4 (`MEMORY / ASSETS`) Omits Sprite/Tile Pool Utilization, JS Heap Allocation Rate, Audio Output Latency, and Biquad Filter Readouts, and Double-Counts Ambient Audio Voices

- **Locations**:
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:1265-1317`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L1265-L1317)
  - [`src/dev-tool/perf/perf-collector.ts:346-371`](../../src/dev-tool/perf/perf-collector.ts#L346-L371)
  - [`src/engine/audio/audio-engine.ts:965-985`](../../src/engine/audio/audio-engine.ts#L965-L985)
- **Spec Requirement**: [`docs/design/PERFORMANCE-MONITOR-SPEC.md` §3.4](../design/PERFORMANCE-MONITOR-SPEC.md#L139-L150)
- **Root Cause**:
  1. `renderMemTab()` ([`PerfMonitorWidget.tsx:1265-1317`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L1265-L1317)) omits:
     - **Sprite & Tile Pool Utilization**: `tilemap.ts` `spritePool` (`Visible / Total Pooled`) and `sprite-map.ts` `entitySprites` (`Visible / Total Tracked`).
     - **JS Heap Allocation Rate**: `MB/s` or `KB/frame` delta between `checkGCSawtooth()` samples.
     - **Web Audio Output Latency & Biquad Filter**: `audio.outputLatencyMs`, `audio.ambianceCutoffHz`, and `audio.ambianceResonanceQ` are already returned by `AudioEngine.getDiagnostics()`, but `renderMemTab()` ignores them, as well as spatial `AmbientEmitter` entity counts.
  2. In [`AudioEngine.getDiagnostics()`](../../src/engine/audio/audio-engine.ts#L966-L980):
     `activeVoiceCount: activeVoices + ambientLoops` combines one-shot voices (`allActiveVoices + activeSampleSources + activeHoldVoices`) with `ambientLoops` instead of reporting one-shot voices separately from ambient loops as specified in §3.4 (`Active One-Shot Synth/Sample Voices` vs. `Ambient Loops`).

---

### `MED-01` (P2 Medium): [RESOLVED] Spike Trap Forensics Card Omits Sub-Stage Breakdown & Per-Frame Emitted Events

- **Locations**:
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:665-678`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L665-L678)
  - [`src/app/page.tsx:187-198`](../../src/app/page.tsx#L187-L198)
  - [`src/dev-tool/perf/perf-collector.ts:170-197`](../../src/dev-tool/perf/perf-collector.ts#L170-L197)
- **Spec Requirement**: [`docs/design/PERFORMANCE-MONITOR-SPEC.md` §3.5.2](../design/PERFORMANCE-MONITOR-SPEC.md#L161-L164): When Spike Trap trips, display a **Spike Forensics Card** detailing exact frame duration, which sub-stage (`FOV`, `Tilemap`, `Sprites`, `VFX`, `Hover`, `WebGL`) caused the spike, and which `EventBus` events fired during that frame.
- **Root Cause**:
  1. `PerfMonitorWidget.tsx:665-678` only renders a single-line text banner (`⚡ SPIKE TRAP TRIPPED: Xms (Threshold: Yms) [RESUME]`), completely omitting `spikeForensics.stageTimings`, `spikeForensics.webglStats`, and `spikeForensics.recentEvents`.
  2. `page.tsx:187-198` only subscribes to 4 hardcoded events (`ENTITY_CREATED`, `DAMAGE_DEALT`, `FLOOR_TRANSITION`, `STATE_RECONCILED`) instead of capturing non-`FOV_UPDATED` frame events via `eventBus.onAny`, and `perfCollector.recentEventsRing` is never flushed at frame boundaries (so it contains up to 20 historical events from earlier turns rather than the events emitted during the spiking frame).

---

### `MED-02` (P2 Medium): Broken macOS `Alt+P` / `Shift+Alt+P` Hotkeys (`e.key === 'π'`), Top-Left HUD Occlusion, and Missing Drag-to-Corner Docking

- **Locations**:
  - [`src/app/page.tsx:411-437`](../../src/app/page.tsx#L411-L437)
  - [`src/dev-tool/perf/PerfMonitorWidget.module.css:18-36`](../../src/dev-tool/perf/PerfMonitorWidget.module.css#L18-L36)
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:517-581, 601`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L517-L581)
- **Root Cause**:
  1. **macOS Option Key Character Substitution**: In [`src/app/page.tsx:422`](../../src/app/page.tsx#L422):
     ```ts
     const isAltP = e.altKey && (e.key === 'p' || e.key === 'P');
     ```
     On macOS, pressing `Option+P` (`Alt+P`) produces `e.key === 'π'` (and `Shift+Option+P` produces `e.key === '∏'`), while `e.code` is `'KeyP'`. Checking `e.key === 'p' || e.key === 'P'` causes `Alt+P` and `Shift+Alt+P` to fail completely on macOS!
  2. **Top-Left HUD Ribbon Occlusion**: Spec §4.1 Mode 1 specifies that `TOP_LEFT` docks *"inside the top-left of the Tactical Viewport Bay (below the top HUD ribbon)"*. However, `.posTopLeft` in `PerfMonitorWidget.module.css:18-21` sets `top: 12px; left: 12px;`, directly covering the top-left HUD bar.
  3. **Missing Magnetic Corner Dragging & `MINI` Mode Dock Controls**: Spec §2 & §4.1 specify magnetic corner dragging on the widget header/pill. Currently, no drag handlers exist, and `MINI` mode does not even render the `TL / TR / BL / BR` dock buttons.

---

### `MED-03` (P2 Medium): [RESOLVED] `cacheStaticFov` Bisection Flag Skips `snapshotVisibleMemory()` After Same-Tile World Mutations

- **Location**: [`src/rendering/render-system.ts:910-963`](../../src/rendering/render-system.ts#L910-L963)
- **Root Cause**:
  `fovKey` only hashes `${playerPos.x},${playerPos.y},${effectiveRadius},${floorState?.sectorCondition ?? ''},${isMapRevealed}`. If `cacheStaticFov` is enabled and the player interacts with an adjacent prop (unlocking a safe, searching a container), picks up or drops an item, or an enemy/cascade destroys a door/wall without the player changing tile coordinates, `lastFovKey === fovKey` remains true, skipping both `computeFov` (even if tile transparency changed) and `snapshotVisibleMemory(fovSet)` (leaving fog-of-war prop/item memory stale). Invalidating `lastFovKey = null` and `lastTilemapKey = null` on `STATE_RECONCILED`, `PROP_INTERACTED`, `LOCK_UNLOCKED`, `ITEM_PICKED_UP`, and `DUNGEON_GENERATED` resolves this cleanly while still caching 59 out of 60 frames between turns.

---

### `MED-04` (P2 Medium): [RESOLVED] Missing `Avg FPS` & `Frame Jitter (σ)` Readouts and Unwired `STANDARD` Mode Oscilloscope Scrubbing

- **Locations**:
  - [`src/dev-tool/perf/PerfMonitorWidget.tsx:681-700, 712-718`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L681-L718)
  - [`src/dev-tool/perf/perf-tooltips.ts:96-101`](../../src/dev-tool/perf/perf-tooltips.ts#L96-L101)
- **Root Cause**:
  1. Spec §3.1 requires displaying `FPS (Current / Avg / 1% Low)` and `Frame Time (ms & Jitter σ)`. `PerfCollector.computeRollingMetrics()` computes `fpsAvg` and `frameTimeJitter`, but `PerfMonitorWidget.tsx:681-700` never displays them.
  2. `PERF_TOOLTIPS.oscilloscopeCanvas` (`perf-tooltips.ts:100`, used on the `STANDARD` mode oscilloscope canvas) states: *"Click or drag cursor across waveform to scrub and inspect individual frames"*, but only the `EXPANDED` mode canvas (`PerfMonitorWidget.tsx:882-928`) has `onClick`, `onMouseMove`, and `onMouseLeave` handlers attached.

---

### `LOW-01` (P3 Low): [RESOLVED] Production Bundle & Runtime Hygiene (`next/dynamic` & `EventBus` Unbounded Map)

- **Locations**:
  - [`src/app/page.tsx:31-39`](../../src/app/page.tsx#L31-L39)
  - [`src/engine/events/event-bus.ts:68-71`](../../src/engine/events/event-bus.ts#L68-L71)
- **Root Cause**:
  1. In [`src/app/page.tsx:31-39`](../../src/app/page.tsx#L31-L39), `const DevTerminal = dynamic(...)` and `const PerfMonitorWidget = dynamic(...)` are declared unconditionally at module scope instead of `process.env.NODE_ENV === 'development' ? dynamic(...) : () => null`, causing Next.js production builds to emit dynamic client chunks for `@dev-tool` modules even though they are never mounted in production.
  2. In [`src/engine/events/event-bus.ts:68-71`](../../src/engine/events/event-bus.ts#L68-L71), `this.emissionsByType.set(typeStr, ...)` runs unconditionally in production on every event emission.

---

### `LOW-02` (P3 Low): [RESOLVED] Duplicate `setDevRenderFlags` Invocations on Bisection Toggle

- **Location**: [`src/dev-tool/perf/PerfMonitorWidget.tsx:150-154, 1329-1332`](../../src/dev-tool/perf/PerfMonitorWidget.tsx#L1329-L1332)
- **Root Cause**:
  `handleToggle` in `renderAuditTab` calls `setBisectionFlag(key, val)` AND `renderSystem?.setDevRenderFlags({ [key]: val })`, while the `useEffect` at lines 150–154 watches `[bisectionFlags, renderSystem]` and immediately invokes `renderSystem.setDevRenderFlags(bisectionFlags)` a second time.

---

## 3. Specification Compliance Matrix (`TK-PERF-900`)

| Spec Section | Requirement | Current Branch Status | Finding ID |
| :--- | :--- | :--- | :--- |
| **§1.1.2 / §2.1** | Strict `@dev-tool` quarantine; zero upward imports from foundation layers | **RESOLVED** — `dynamic()` in `page.tsx` guarded by `NODE_ENV` ternary | `LOW-01` |
| **§1.1.3 / §5.2** | `0.00ms` overhead when `OFF` (all probes/hooks detached); zero heap allocations on 60Hz tick | **RESOLVED** — Probe & `measureTimings` detach cleanly; 60Hz tick uses pre-allocated buffers | `CRIT-02` |
| **§3.1** | `FPS` (Current, Avg, 1% Low) & `Frame Time` (`ms` & Jitter $\sigma$) | **PARTIAL** — `Avg FPS` and `Jitter σ` computed but not displayed | `MED-04` |
| **§3.1 / §4.1** | Stage 1–6 timings including **Stage 6: `WebGL Render Pass` (`ms`)** in budget bar & scrub card | **RESOLVED** — Stage 6 measured around `renderer.render`; budget bar & scrub card display real `GL` | `CRIT-03` |
| **§3.1 / §4.1** | Active Pixi Filters (`Prop` \| `Enemy` \| `World`) & Entity Sprite Map (`Visible / Total` + `Tweens`) | **RESOLVED** — Full breakdown (`Prop` \| `Enemy` \| `World`), `ENTITY SPRITE MAP` & `TWEENS` displayed | `HIGH-03` |
| **§3.2** | Entity Archetype Census (Actors, Hostiles, Dying, Props, Ground/Child Items, Hazards) | **MISSING** — Not queried or rendered in `ECS` tab | `HIGH-04` |
| **§3.2** | Component Store Cardinality + Top 6 Stores by Size | **PARTIAL** — Total count shown; Top 6 stores from `storeSizes` not rendered | `HIGH-04` |
| **§3.2** | Spatial Grid, Active FOV vs. Explored Tiles, & Fog Memory Cache (`rememberedProps`/`Items`) | **PARTIAL** — Grid cells shown; FOV & Fog Memory cache counts missing | `HIGH-04` |
| **§3.2** | EventBus Throughput (`evt/s`, `evt/turn`, `FOV_UPDATED` 60Hz churn separation) | **MISSING** — `EventBus.getDiagnostics()` never called or rendered | `HIGH-04` |
| **§3.3 / §5.1.D** | End-to-End Turn Waterfall Bar, Server Phase Breakdown, & Aggregated Top 5 Server Systems | **PARTIAL** — Unaggregated systems (sliced to 3); Phase timings & Waterfall bar not rendered | `HIGH-05` |
| **§3.3** | Enemy Sub-Ticks & Actors (`enemyTurnsProcessed`, `energySubTicks`) | **MISSING** — Not tracked in `TurnManager` or `_devPerf` | `HIGH-05` |
| **§3.3** | Sync Payload (`KB` & Cumulative `KB`), Delta Mutation Counts, & Input Buffer / Prediction Health | **PARTIAL** — Delta counts collected in `setup.ts` but never rendered; Input queue & prediction health missing | `HIGH-05` |
| **§3.4 / §5.1.C** | GPU Texture VRAM & Texture Source Breakdown (`Atlas`, `FBO`, `Canvas`) | **RESOLVED** — PixiJS 8 FBOs identified accurately via `TextureSource` resource/method checks; physical pixel dimensions used | `HIGH-02` |
| **§3.4** | Sprite & Tile Pool Utilization, JS Heap Allocation Rate, Audio Latency & Biquad Filter (`Hz`/`Q`) | **MISSING** — Omitted from `MEM` tab; `activeVoiceCount` double-counts ambient loops | `HIGH-06` |
| **§3.5.1** | Floor-Transition Baseline Snapshot, Auto-Baseline on Floor 1, & `FLOOR_TRANSITION` History | **FAILED** — Hardcoded fake numbers (`1080`, `30`, `0`) in UI, all zeros in `/perf snap` & `DebugAPI`; `recordFloorTransitionSnapshot` never called | `CRIT-01` |
| **§3.5.2** | Spike Trap Auto-Freeze & Forensics Card (sub-stage culprit + frame `EventBus` events) | **FAILED** — Pause/Freeze desync corrupts scrubbing & hides crosshair when paused; Forensics card omits sub-stages & events | `HIGH-01`, `MED-01` |
| **§3.5.3** | Live Render Pass Bisection Toggles (5 non-destructive A/B toggles) | **RESOLVED** — Full state restoration for sprite and world filters; invalidation on world mutations | `HIGH-03`, `MED-03`, `LOW-02` |
| **§4.1 / §5.3** | 4 Modes (`MINI`, `STANDARD`, `EXPANDED`, `GHOST`), Magnetic Corner Dock, Hotkeys, `/perf` | **PARTIAL** — `Alt+P`/`Shift+Alt+P` broken on macOS (`e.key === 'π'`); `TOP_LEFT` overlaps HUD ribbon; drag-to-dock missing | `MED-02` |

---

## 4. Phased Remediation Plan

### Phase 1: Zero-Overhead Lifecycle, WebGL Pass Timing, & PixiJS 8 Texture/Filter Probes (`CRIT-02`, `CRIT-03`, `HIGH-02`, `HIGH-03`, `MED-03`, `LOW-01`, `LOW-02`)

1. **True Zero-Overhead Detachment When `mode === 'OFF'` (`CRIT-02`, `LOW-01`)**:
   - In [`src/app/page.tsx`](../../src/app/page.tsx), guard `DevTerminal` and `PerfMonitorWidget` `dynamic()` declarations behind `process.env.NODE_ENV === 'development' ? dynamic(...) : () => null`.
   - Subscribe to `usePerfStore` mode changes (or manage attachment inside `PerfCollector` / `PerfMonitorWidget`):
     - When `mode === 'OFF'`, call `webglProbe.detach()`, `renderSystem.setDevRenderFlags({ measureTimings: false })`, `setTurnTelemetryHook(null)`, and skip `perfCollector.recordFrame()` in the ticker callback.
     - When `mode !== 'OFF'`, call `webglProbe.attach()`, `renderSystem.setDevRenderFlags(bisectionFlags)`, and `setTurnTelemetryHook(...)`.
   - Eliminate all per-frame heap allocations on the 60Hz ticker:
     - Add `renderSystem.getStageTimings(): Readonly<RenderStageTimings>` returning the pre-allocated `latestStageTimings` reference for 60Hz reads, reserving `renderSystem.getRenderTelemetry()` (which queries pool/filter/emitter sizes) strictly for the 4Hz UI store sync and baseline snapshots.
     - Mutate `this.latestWebglStats` fields in-place inside `PerfCollector.recordFrame()` and `WebGLProbe`.

2. **Measure Stage 6 (`WebGL Render Pass ms`) & Fix Scrub Inspector `GL` Calculation (`CRIT-03`)**:
   - In [`src/dev-tool/perf/webgl-probe.ts`](../../src/dev-tool/perf/webgl-probe.ts), wrap `app.renderer.render` when attached (`origRender = renderer.render`):
     - Record `t0 = performance.now()` before `origRender.apply(renderer, args)` and `this.lastRenderPassMs = performance.now() - t0` after, capturing exact WebGL command submission + filter FBO pass duration and resetting per-frame draw counters at the start of `renderer.render`.
     - Restore `renderer.render = this.origRender` in `detach()`.
   - Pass `stats.renderPassMs` as `webglPassMs` into `perfCollector.recordFrame(...)`.
   - Include `webglMs` (`GL`) and `hoverMs` (`HVR`) in `PerfMonitorWidget.tsx`'s `STANDARD` mode stacked budget bar and legend (`FRAME BUDGET BREAKDOWN [X.XX ms / 16.67 ms]`), and read `perfCollector.webglTimes[targetIdx]` for `GL:` in the Scrub Hover Card instead of the tautological `cpuTime - cpuTime`.

3. **Fix PixiJS 8 `getTextureMemory()` FBO Classification & High-DPI VRAM Math (`HIGH-02`)**:
   - In [`src/dev-tool/perf/webgl-probe.ts`](../../src/dev-tool/perf/webgl-probe.ts):
     - Compute pixel dimensions using physical pixels first: `const w = tex.pixelWidth || (tex.width ? tex.width * (tex.resolution ?? 1) : 0);` and `const h = tex.pixelHeight || (tex.height ? tex.height * (tex.resolution ?? 1) : 0);`.
     - Classify a `TextureSource` as a RenderTexture / Filter FBO when `Boolean(tex.isRenderTexture) || (tex.resource == null && (w > 0 || h > 0)) || tex.uploadMethodId === 'unknown' || label.includes('fbo') || label.includes('render-texture') || label.includes('filter')`.

4. **Fix Render Bisection Toggles & Complete Filter / Sprite Map Telemetry (`HIGH-03`, `MED-03`, `LOW-02`)**:
   - In [`src/rendering/sprite-map.ts`](../../src/rendering/sprite-map.ts), add `getSpriteTelemetry(): { totalSprites: number; visibleSprites: number }` counting tracked `entitySprites` and those with `sprite.visible === true`.
   - In [`src/rendering/filters/glitch-effects.ts`](../../src/rendering/filters/glitch-effects.ts), track active enemy glitch filter sprites/instances (`activeEnemyFilters`) and active damage filter count (`activeDamageFilterCount`) so `getFilterTelemetry()` returns `{ activePropFilterSprites, totalPropFilters, activeEnemyFilterSprites, totalEnemyFilters, activeDamageFilters }`.
   - In [`src/rendering/render-system.ts`](../../src/rendering/render-system.ts):
     - Include `worldFiltersCount` (length of `layers.worldContainer.filters`), `sprites: getSpriteTelemetry()`, `fovTiles: currentFovSet.size`, `exploredTiles: exploredSet.size`, `rememberedPropsCount: rememberedProps.size`, and `rememberedItemsCount: rememberedTileItems.size` in `getRenderTelemetry()`.
     - When `setDevRenderFlags({ disableSpriteFilters: true })` is called, clean up `activePropFilters` / `lastPropOutlineState` via `removePersistentGlitch(sprite)` and clear player ghost sprites (`updateSpriteGhosting(playerSprite, 0, layers.entityLayer)`).
     - When `setDevRenderFlags({ disableWorldFilters: false })` is called, restore world filters from the player entity's current `Stability` and `Heat` components (`applyStabilityDesaturation` and `applyHeatTierFilters`).
     - When `cacheStaticTilemap` skips `buildTilemap()`, report `lastAutotileSolves: 0` for that frame.
     - Invalidate `lastFovKey = null` and `lastTilemapKey = null` on `STATE_RECONCILED`, `PROP_INTERACTED`, `LOCK_UNLOCKED`, `ITEM_PICKED_UP`, and `DUNGEON_GENERATED` (`MED-03`).
   - Remove the duplicate `renderSystem?.setDevRenderFlags` call in `PerfMonitorWidget.tsx`'s `handleToggle` (`LOW-02`).

---

### Phase 2: Accurate Leak Auditor, Pause/Freeze Synchronization, & Spike Forensics (`CRIT-01`, `HIGH-01`, `MED-01`)

1. **Unify Live Census Snapshot Helper & Wire Automatic `FLOOR_TRANSITION` Auditing (`CRIT-01`)**:
   - Add `perfCollector.captureCurrentSnapshot(): LeakBaselineSnapshot` in [`src/dev-tool/perf/perf-collector.ts`](../../src/dev-tool/perf/perf-collector.ts) that reads live telemetry directly from its bound `context`, `renderSystem`, `probe`, and `getAudioEngine()`:
     - `floor`: `world.getComponent(playerId, FloorState)?.currentFloor ?? gameStore.getState().currentFloor ?? 1`
     - `entityCount`: `ecs.entityCount`
     - `componentCount`: `ecs.totalComponentInstances`
     - `entitySpriteCount`: `renderTelemetry.sprites.totalSprites`
     - `tilemapPoolSize`: `renderTelemetry.tilemap.poolSize`
     - `activeFilterCount`: `renderTelemetry.filters.totalPropFilters + renderTelemetry.filters.totalEnemyFilters + renderTelemetry.filters.activeDamageFilters + renderTelemetry.filters.worldFiltersCount`
     - `managedTextureCount`: `textureMemory.totalTextures`
     - `vramBytes`: `textureMemory.estimatedVramBytes`
     - `activeAudioVoiceCount`: `audioDiagnostics.activeVoiceCount`
     - `jsHeapBytes`: `gcTelemetry.heapUsedBytes`
   - Call `perfCollector.captureCurrentSnapshot()` from all 3 snapshot entry points:
     1. `handleTakeSnapshot` in `PerfMonitorWidget.tsx`
     2. `/perf snap` in `DevTerminal.tsx`
     3. `window.__DEBUG__.perf.snapshot()` in `debug-api.ts`
   - Automatically capture the Floor 1 baseline when the run starts and invoke `perfCollector.recordFloorTransitionSnapshot(perfCollector.captureCurrentSnapshot())` on `FLOOR_TRANSITION` / `DUNGEON_GENERATED`.
   - Expand `renderAuditTab()` in `PerfMonitorWidget.tsx` to display all 9 diff rows (`Entities`, `Components`, `Entity Sprites`, `Tilemap Pool`, `Active Filters`, `Textures`, `VRAM (MB)`, `Audio Voices`, `JS Heap`) with proper status thresholds, plus the `Floor Transition History` log.

2. **Synchronize `isPaused` & `perfCollector.isFrozen` and Fix Paused Canvas Scrubbing (`HIGH-01`, `MED-04`)**:
   - In `usePerfStore` (`togglePause`, `setPaused`) and `PerfCollector` (`setFrozen`, `clearSpikeCard`), synchronize pause state so pausing in the UI calls `perfCollector.setFrozen(true)` (stopping ring buffer writes so historical frames stay locked to the displayed waveform) and tripping Spike Trap updates `isPaused: true` in the store.
   - Allow `renderWaveforms` to continue rendering the static buffer + live interactive scrub crosshair and yellow/cyan sample dots even when `isPaused` / `isFrozen` is `true` (since `perfCollector` ring buffers are frozen, redrawing on hover/mode-switch keeps the waveform stationary while enabling interactive crosshair scrubbing and preventing blank canvases when switching modes while paused).
   - Attach hover scrub handlers to the `STANDARD` mode oscilloscope canvas as well (`MED-04`).

3. **Complete Spike Trap Forensics Card & Per-Frame Event Tracking (`MED-01`)**:
   - Track per-frame discrete `EventBus` emissions (excluding `FOV_UPDATED`) via a single properly cleaned-up `eventBus.onAny` listener in `PerfCollector` that flushes into `frameEvents` on each frame tick.
   - Update the Spike Forensics Card in `PerfMonitorWidget.tsx` to display the sub-stage breakdown (`FOV`, `TILE`, `SPR`, `VFX`, `HVR`, `GL`), dominant culprit stage badge, draw calls, and emitted events during the spike frame.

---

### Phase 3: Complete Domain 2 (`ECS`), Domain 3 (`TURN`), Domain 4 (`MEM`), & Ergonomics (`HIGH-04`, `HIGH-05`, `HIGH-06`, `MED-02`)

1. **Complete Domain 2 (`ECS / WORLD`) Telemetry (`HIGH-04`)**:
   - Compute and display the **Entity Archetype Census** (`Actors: Player / Hostiles / Dying`, `Props: Total / Locked / Corrupted / Searched`, `Items: Ground / Equipped-Inventory Children`, `Hazards: DeadZone / Corruption`).
   - Render the **Top 6 Component Stores** sorted by instance count from `ecsDiagnostics.storeSizes`.
   - Render **FOV & Fog Memory Coverage** (`Active FOV / Explored Tiles`, `Remembered Props / Items`).
   - Compute and render **EventBus Throughput** (`evt/s`, `evt/turn`, and `FOV_UPDATED` 60Hz churn vs. discrete gameplay events) from `context.eventBus.getDiagnostics()`.

2. **Complete Domain 3 (`TURN / SYNC`) Telemetry & Server Aggregation (`HIGH-05`)**:
   - In [`src/app/api/action/route.ts`](../../src/app/api/action/route.ts), aggregate `systemTimings` by `${systemName}::${phase}` before sorting and slicing the **Top 5** server systems.
   - In [`src/engine/turn/turn-manager.ts`](../../src/engine/turn/turn-manager.ts), track `lastTurnEnemyCount` and `lastTurnSubTicks` during `executeTurnCycle()` / `advanceUntilPlayerReady()` and include `enemyTurnsProcessed` and `energySubTicks` in `_devPerf` (`ServerTurnDevPerf` and `TurnTelemetryData`).
   - Measure `clientPredictionMs` across all action submission paths in [`src/game/setup.ts`](../../src/game/setup.ts).
   - In `renderTurnTab()` (`PerfMonitorWidget.tsx`), render:
     - Visual End-to-End Turn Waterfall bar (`[Predict] ──► [Net RTT (Srv Sim)] ──► [Reconcile]`) with `TURN #XXXX`
     - Network RTT (`Current`, `Avg`, `Max`)
     - Server Phase Breakdown (`PRE_TURN`, `GATHER_INTENT`, `ACTION`, `REACTION`, `CLEANUP`, `POST_TURN`) & Top 5 Server Systems
     - Enemy Turns Processed & Energy Sub-Ticks
     - Sync Payload (`KB` & Session Cumulative `KB`) and Delta Mutation Counts (`+Ent / -Ent`, `CompSet / CompRem`, `Events`)
     - `InputManager` Queue Depth (`queueLength / maxQueueSize` & `PENDING` lock badge) and Prediction Health (`Confirmed` / `0-Cost Safeguard Halts`).

3. **Complete Domain 4 (`MEMORY / ASSETS`) & Audio Diagnostics (`HIGH-06`)**:
   - In [`src/engine/audio/audio-engine.ts`](../../src/engine/audio/audio-engine.ts), keep `activeVoiceCount` strictly to one-shot/hold voices (`allActiveVoices.size + activeSampleSources.size + activeHoldVoices.size`) separate from `ambientLoopCount`.
   - In `PerfCollector.checkGCSawtooth()`, compute `allocationRateMBPerSec` (`KB/frame`).
   - In `renderMemTab()` (`PerfMonitorWidget.tsx`), render:
     - `Sprite & Tile Pool Utilization` (`Terrain Pool: Visible / Total`, `Entity Sprites: Visible / Total`)
     - `JS Heap Allocation Rate` (`MB/s` / `KB/f`)
     - `Audio Output Latency` (`ms`), `Spatial Ambient Emitters`, and `Ambiance Biquad Filter` (`Cutoff Hz` / `Resonance Q`).

4. **Fix macOS Hotkeys, Top-Left HUD Offset, & Magnetic Corner Dragging (`MED-02`)**:
   - In [`src/app/page.tsx`](../../src/app/page.tsx), check `e.code === 'KeyP'` in addition to `e.key === 'p' || e.key === 'P'` so `Alt+P` and `Shift+Alt+P` work on macOS regardless of `Option` unicode composition (`π` / `∏`), and handle `Shift+Alt+P` (`e.altKey && e.shiftKey && isKeyP`) to cycle modes.
   - Offset `.posTopLeft` and `.posTopRight` in `PerfMonitorWidget.module.css` (`top: 54px`) so the widget docks cleanly below the top HUD ribbon without occluding player vitals.
   - Add pointer drag-to-corner snapping on `.placardHeader` and `.miniPill` so dragging and releasing snaps `dockPosition` to the nearest viewport quadrant (`TOP_LEFT`, `TOP_RIGHT`, `BOTTOM_LEFT`, `BOTTOM_RIGHT`).

---

## 5. Verification & Quality Gates Plan

1. **Unit & Component Tests**:
   - Update and expand [`src/dev-tool/perf/__tests__/webgl-probe.test.ts`](../../src/dev-tool/perf/__tests__/webgl-probe.test.ts) to test PixiJS 8 `TextureSource` FBO classification (`resource: null`), high-DPI `pixelWidth`/`pixelHeight` VRAM math, and `renderer.render` timing wrapper attach/detach.
   - Update and expand [`src/dev-tool/perf/__tests__/perf-collector.test.ts`](../../src/dev-tool/perf/__tests__/perf-collector.test.ts) to verify `captureCurrentSnapshot()`, automatic `FLOOR_TRANSITION` history recording, allocation rate calculation, and synchronized pause/freeze behavior.
   - Update and expand [`src/dev-tool/perf/__tests__/PerfMonitorWidget.test.tsx`](../../src/dev-tool/perf/__tests__/PerfMonitorWidget.test.tsx) to verify Stage 6 `GL` budget bar & scrub inspector accuracy, paused crosshair rendering, all 5 domain tab readouts (`GPU`, `ECS`, `TURN`, `MEM`, `AUDIT`), Spike Trap forensics card details, and magnetic corner drag snapping.
   - Update [`tests/rendering/render-telemetry.test.ts`](../../tests/rendering/render-telemetry.test.ts) to test disabling and **re-enabling** `disableSpriteFilters` and `disableWorldFilters` after frames have already rendered, and `cacheStaticFov` invalidation on prop/item state changes.
   - Update [`src/app/api/action/__tests__/action.test.ts`](../../src/app/api/action/__tests__/action.test.ts) to verify multi-enemy `topSystems` aggregation and `enemyTurnsProcessed` / `energySubTicks` reporting.
2. **Full Suite & Build Verification**:
   - Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` (`next build`) to confirm 100% test pass rate, zero type/lint errors, and clean production build output.
