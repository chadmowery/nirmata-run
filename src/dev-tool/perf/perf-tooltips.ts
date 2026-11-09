/**
 * Tooltip definitions and contextual help for Taikoku Telemetry Oscilloscope (TK-PERF-900).
 * Provides clear, actionable explanations of engine metrics, render stages, memory, and bisection tools.
 */

export interface PerfTooltipEntry {
  tag: string;
  title: string;
  desc: string;
  detail?: string;
}

export const PERF_TOOLTIPS = {
  // Global / Header Placard
  headerTitle: {
    tag: 'TK-PERF',
    title: '性能監視 // TK-PERF-900',
    desc: 'Taikoku Telemetry Oscilloscope: real-time in-engine performance monitor & diagnostics workstation.',
    detail: 'Hotkeys: F3 (toggle) | Shift+F3 (cycle mode) | Alt+F3 (ghost overlay)',
  },
  headerTag: {
    tag: 'STATUS',
    title: '開発計測 // DEV TELEMETRY',
    desc: 'Engine instrumentation suite active in development mode. Zero overhead in production builds.',
  },
  btnGhost: {
    tag: 'OVERLAY',
    title: 'Ghost Click-Through Mode',
    desc: 'Makes the monitor completely click-through (pointer-events: none) so you can continue playing uninterrupted.',
    detail: 'Hotkey: Alt+F3 to toggle at any time',
  },
  btnPause: {
    tag: 'CAPTURE',
    title: 'Pause / Freeze Waveform',
    desc: 'Freezes real-time ring buffer updates and frame captures so you can inspect spikes and metrics statically.',
  },
  btnSnapshot: {
    tag: 'AUDIT',
    title: 'Take Baseline Snapshot',
    desc: 'Captures current live entities, components, textures, and VRAM as a baseline to detect floor transition leaks.',
  },
  btnMini: {
    tag: 'MODE',
    title: 'Mini Pill Mode',
    desc: 'Collapses monitor into a slim 30px floating HUD bar showing core FPS, frame time, draw calls, and entity count.',
  },
  btnStandard: {
    tag: 'MODE',
    title: 'Expand to Standard Widget',
    desc: 'Single-column 380px diagnostic display with 120-frame vector oscilloscope, frame budget bar, and tabbed inspectors.',
  },
  btnExpanded: {
    tag: 'MODE',
    title: 'Expanded Workstation Mode',
    desc: 'Dual-column 720px workstation with 240-frame scrub inspector, live pipeline waterfall, census, and render bisection tools.',
  },
  btnClose: {
    tag: 'WINDOW',
    title: 'Close Performance Monitor',
    desc: 'Hides the performance monitor overlay. Press F3 to reopen.',
  },

  // Summary Metrics Row
  metricFps: {
    tag: 'METRIC',
    title: 'Frames Per Second (FPS)',
    desc: 'Rolling average frame rate calculated across the last 120 frames.',
    detail: 'Target: >= 58 FPS (Green), 30-57 FPS (Yellow), < 30 FPS (Red)',
  },
  metricFpsLow: {
    tag: 'METRIC',
    title: '1% Low FPS',
    desc: '99th percentile slowest frame rate. Highlights intermittent stutter, GC hitches, and sub-frame spikes.',
    detail: 'Ideal: within 15% of average FPS',
  },
  metricFrameTime: {
    tag: 'METRIC',
    title: 'Frame CPU/GPU Duration',
    desc: 'Total elapsed time for the current frame tick in milliseconds.',
    detail: 'Budget: 16.67ms for 60 FPS (33.33ms for 30 FPS)',
  },
  metricBudget: {
    tag: 'METRIC',
    title: 'Frame Budget Utilization',
    desc: 'Percentage of the 16.67ms (60 FPS) frame budget consumed by this frame.',
    detail: 'Values exceeding 100% result in dropped frames',
  },
  metricDrawCalls: {
    tag: 'METRIC',
    title: 'WebGL Draw Calls',
    desc: 'Number of gl.drawElements and gl.drawArrays calls dispatched to the GPU this frame.',
    detail: 'Target: < 50 DC for optimal web performance',
  },

  // Oscilloscope & Frame Budget
  oscilloscopeCanvas: {
    tag: 'WAVEFORM',
    title: '1px Vector Oscilloscope',
    desc: 'Rolling 120-frame waveform of frame durations. Cyan line = 16.7ms (60 FPS); Crimson line = 33.3ms (30 FPS).',
    detail: 'Click or drag cursor across waveform to scrub and inspect individual frames',
  },
  scrubInspector: {
    tag: 'SCRUBBER',
    title: '4.0s Scrub Inspector',
    desc: 'Historical 240-frame timeline. Scrub cursor to freeze and inspect exact sub-stage timings and draw calls for past spikes.',
  },
  budgetBar: {
    tag: 'BUDGET',
    title: 'Sub-Stage Frame Budget',
    desc: 'Breakdown of CPU render stages: FOV raycasting, tilemap, sprite sync, VFX particles, hover inspect, and GPU pass.',
  },
  stageFov: {
    tag: 'STAGE',
    title: 'FOV Raycasting Stage',
    desc: 'CPU time spent calculating field-of-view visibility polygons and shadowcasting across dungeon tiles.',
    detail: 'Budget: < 2.0ms per frame',
  },
  stageTilemap: {
    tag: 'STAGE',
    title: 'Tilemap Render Stage',
    desc: 'CPU time spent evaluating autotile bitmasks, chunk updates, and static terrain sprite batching.',
    detail: 'Can be cached using Render Bisection when stationary',
  },
  stageSpriteSync: {
    tag: 'STAGE',
    title: 'Sprite Sync Stage',
    desc: 'CPU time spent synchronizing ECS entity positions, directional orientations, and z-sorting with PixiJS display objects.',
    detail: 'Budget: < 3.0ms per frame',
  },
  stageVfx: {
    tag: 'STAGE',
    title: 'VFX & Particles Stage',
    desc: 'CPU time updating neon spark particles, floating damage numbers, and transient visual effects.',
    detail: 'Budget: < 1.5ms per frame',
  },
  stageHover: {
    tag: 'STAGE',
    title: 'Hover Inspector Stage',
    desc: 'CPU time querying spatial hash grid and entity components under the mouse cursor.',
    detail: 'Throttled to 60ms to eliminate cursor hitching',
  },
  stageGl: {
    tag: 'STAGE',
    title: 'GPU WebGL Pass',
    desc: 'Time spent executing WebGL draw commands and flushing display pipelines to the screen.',
  },

  // Domain Tabs
  tabGpu: {
    tag: 'TAB',
    title: 'GPU & Render Pipeline Tab',
    desc: 'Detailed breakdown of WebGL draw calls, triangle rasterization, shader programs, texture binds, and sprite pools.',
  },
  tabEcs: {
    tag: 'TAB',
    title: 'ECS & Spatial Census Tab',
    desc: 'Live entity census, component store counts, spatial hash grid cell occupancy, and registered engine systems.',
  },
  tabTurn: {
    tag: 'TAB',
    title: 'Turn Pipeline Waterfall Tab',
    desc: 'Client prediction, server turn execution latency, network RTT, delta reconciliation, and top server ECS systems.',
  },
  tabMem: {
    tag: 'TAB',
    title: 'Memory, VRAM & DSP Tab',
    desc: 'Estimated GPU texture VRAM, managed texture breakdown, JS heap usage, GC sawtooth tracking, and Web Audio voices.',
  },
  tabAudit: {
    tag: 'TAB',
    title: 'Audit & Bisection Tools Tab',
    desc: 'Floor leak comparison table and runtime dev flags to disable individual render passes for bottleneck isolation.',
  },

  // GPU Tab Data Rows
  gpuDrawCalls: {
    tag: 'GPU',
    title: 'WebGL Draw Calls',
    desc: 'Total drawElements and drawArrays calls issued to WebGL. Lower numbers mean higher sprite batching efficiency.',
    detail: 'Target: < 50 DC on typical dungeon scenes',
  },
  gpuTriangles: {
    tag: 'GPU',
    title: 'Rasterized Triangles (TRIS)',
    desc: 'Estimated triangle count drawn this frame (2 triangles per quad sprite or UI slice).',
  },
  gpuPrograms: {
    tag: 'GPU',
    title: 'Shader Programs (PROG)',
    desc: 'Number of gl.useProgram shader switches this frame. High program switches break sprite batching.',
  },
  gpuTextureBinds: {
    tag: 'GPU',
    title: 'Texture Bindings',
    desc: 'gl.bindTexture state transitions this frame. Texture atlasing keeps this value minimal.',
    detail: 'Target: < 10 binds per frame',
  },
  gpuPixiFilters: {
    tag: 'GPU',
    title: 'Active PixiJS Filters',
    desc: 'Custom WebGL fragment shaders active on sprites and containers (prop outlines, enemy glitch shaders, CRT world filter).',
    detail: 'Filters require extra render target passes and increase GPU fill rate',
  },
  gpuTerrainPool: {
    tag: 'RENDER',
    title: 'Terrain Sprite Pool',
    desc: 'Visible terrain sprites rendered in the viewport versus total pooled sprite objects allocated in memory.',
    detail: 'Culls offscreen tiles outside the camera frustum',
  },
  gpuEntitySprites: {
    tag: 'RENDER',
    title: 'Entity Sprite Map & Tweens',
    desc: 'Count of active entity sprites culled in viewport vs. total tracked, and running movement/attack tweens.',
  },
  gpuAutotileSolves: {
    tag: 'RENDER',
    title: 'Autotile Solves',
    desc: 'Number of 8-neighbor bitmask calculations evaluated to determine correct wall and floor edge tiles.',
  },
  gpuNeonParticles: {
    tag: 'RENDER',
    title: 'Neon Particles & Floating Text',
    desc: 'Count of active particle emitters, live particles, and floating damage numbers rendered in the effects layer.',
  },
  gpuHoverInspector: {
    tag: 'RENDER',
    title: 'Hover Inspector Latency',
    desc: 'CPU time spent querying spatial grid entities and tile properties under the cursor (throttled to 60ms).',
  },

  // ECS Tab Data Rows
  ecsLiveEntities: {
    tag: 'ECS',
    title: 'Total Live Entities',
    desc: 'Count of active entity IDs allocated in the engine ECS World (sparse set storage).',
    detail: 'Normal: 50-600 entities depending on floor size and monster count',
  },
  ecsComponentStores: {
    tag: 'ECS',
    title: 'Component Stores & Instances',
    desc: 'Number of distinct component types registered in the world and total instantiated component records across all entities.',
  },
  ecsSpatialGrid: {
    tag: 'GRID',
    title: 'Spatial Hash Grid Dimensions & Occupancy',
    desc: 'Dungeon spatial partition grid size (cells) and number of cells currently occupied by live entities.',
    detail: 'Accelerates entity queries from O(N) to O(1)',
  },
  ecsGroundItemCells: {
    tag: 'GRID',
    title: 'Ground Item Cells',
    desc: 'Spatial grid cells containing dropped scrap, weapons, software, or items waiting for pickup.',
  },
  ecsRegisteredSystems: {
    tag: 'ECS',
    title: 'Registered Engine Systems',
    desc: 'Total ECS execution systems registered in the turn and prediction pipelines.',
  },

  // Turn Tab Data Rows
  turnActionType: {
    tag: 'TURN',
    title: 'Latest Turn Action',
    desc: 'The action intent executed in the most recent turn (MOVE, ATTACK, WAIT, RELOAD, USE_ITEM, etc.).',
  },
  turnClientPrediction: {
    tag: 'TURN',
    title: 'Client Prediction Latency',
    desc: 'Client simulation duration predicting movement and animations locally before awaiting server confirmation.',
    detail: 'Target: < 5.0ms for zero input perceived lag',
  },
  turnNetworkRtt: {
    tag: 'NET',
    title: 'Network Round-Trip Time (RTT)',
    desc: 'Time from client turn dispatch via HTTP POST /api/action to receiving authoritative server response.',
    detail: 'Target: < 80ms on broadband connections',
  },
  turnServerTime: {
    tag: 'SERVER',
    title: 'Server Turn Time',
    desc: 'Authoritative server execution duration processing all 23 pipeline phases, enemy AI, hazards, and loot tables.',
    detail: 'Target: < 50ms server processing time',
  },
  turnSyncType: {
    tag: 'SERVER',
    title: 'State Sync Payload Type',
    desc: 'DELTA: compressed bitmask containing only modified components. FULL: complete uncompressed floor state snapshot.',
  },
  turnClientReconcile: {
    tag: 'CLIENT',
    title: 'Client Reconcile Time',
    desc: 'Time spent applying server state delta, verifying client prediction, and correcting any rollbacks.',
    detail: 'Target: < 3.0ms reconcile time',
  },
  turnTopSystems: {
    tag: 'SERVER',
    title: 'Top Server Systems',
    desc: 'The 3 server-side ECS systems that consumed the highest CPU time during the authoritative turn calculation.',
  },

  // Memory Tab Data Rows
  memVram: {
    tag: 'VRAM',
    title: 'GPU Texture VRAM',
    desc: 'Estimated video memory (VRAM) occupied by active WebGL texture objects including mipmaps.',
    detail: 'Target: < 80 MB on web/desktop target',
  },
  memTextureCount: {
    tag: 'TEXTURES',
    title: 'Texture Count Breakdown',
    desc: 'Total textures managed by PixiJS texture GC, split into ATLAS (spritesheets), FBO (render targets), and CANVAS (text).',
  },
  memJsHeap: {
    tag: 'MEMORY',
    title: 'JavaScript Heap Memory',
    desc: 'V8 heap memory currently used vs total heap allocated (Chromium browsers via window.performance.memory).',
    detail: 'Values that constantly climb without dropping indicate JS memory leaks',
  },
  memGcSawtooth: {
    tag: 'MEMORY',
    title: 'GC Sawtooth Events',
    desc: 'Count of detected garbage collection events where heap usage dropped significantly.',
    detail: 'Frequent spikes indicate excessive object allocation in 60 FPS tick loops',
  },
  memAudioContext: {
    tag: 'AUDIO',
    title: 'Web Audio Context State',
    desc: 'State of Web Audio API AudioContext (running or suspended) and the hardware output sample rate in Hz.',
  },
  memAudioVoices: {
    tag: 'AUDIO',
    title: 'Active Audio Voices & Loops',
    desc: 'Number of concurrent sound effect nodes currently playing and active ambient loop streams.',
    detail: 'Target: < 32 simultaneous voices to avoid DSP throttling',
  },

  // Audit Tab Items
  auditBaseline: {
    tag: 'AUDIT',
    title: 'Floor Baseline Snapshot',
    desc: 'Reference resource census captured at floor entrance or via manual snapshot for leak detection.',
  },
  auditDiffTable: {
    tag: 'AUDIT',
    title: 'Resource Leak Diff Table',
    desc: 'Compares live entities, textures, and VRAM against the baseline snapshot. Green = OK; Red = resource growth/leak.',
  },
  bisectSpriteFilters: {
    tag: 'BISECTION',
    title: 'Bisection: Disable Sprite Filters',
    desc: 'Bypasses outline and glitch fragment shaders on all prop and enemy sprites to isolate GPU fragment fill-rate cost.',
  },
  bisectWorldFilters: {
    tag: 'BISECTION',
    title: 'Bisection: Disable World Filters',
    desc: 'Disables fullscreen CRT and post-process filter passes on the world container to isolate composite overhead.',
  },
  bisectParticles: {
    tag: 'BISECTION',
    title: 'Bisection: Disable Particle Emitters',
    desc: 'Hides the effects layer and halts particle emitter updates to test particle CPU/GPU overhead.',
  },
  bisectCacheTilemap: {
    tag: 'BISECTION',
    title: 'Bisection: Cache Static Tilemap',
    desc: 'Caches the rendered static terrain layer between player moves instead of rebuilding tiles each frame.',
  },
  bisectCacheFov: {
    tag: 'BISECTION',
    title: 'Bisection: Cache Static FOV',
    desc: 'Reuses raycasted FOV visibility polygon when the player entity has not changed tile coordinates.',
  },
  btnNewSnapshot: {
    tag: 'AUDIT',
    title: 'Capture Baseline Snapshot',
    desc: 'Records current live entities, component stores, textures, and VRAM as the new audit baseline.',
  },
  btnExportJson: {
    tag: 'AUDIT',
    title: 'Export Telemetry JSON',
    desc: 'Downloads a comprehensive JSON report containing all circular ring buffers, turn waterfall, and memory stats.',
  },

  // Bottom Status Bar
  spikeTrapSelect: {
    tag: 'TRAP',
    title: 'Spike Trap Auto-Freeze',
    desc: 'Automatically pauses the waveform and records a forensic card whenever any single frame exceeds this duration.',
    detail: 'Options: OFF, > 16.7ms (hitch below 60fps), > 25.0ms, > 33.3ms (hitch below 30fps)',
  },
  dockPosition: {
    tag: 'DOCK',
    title: 'Dock Widget Position',
    desc: 'Snaps the monitor widget to Top-Left (TL), Top-Right (TR), Bottom-Left (BL), or Bottom-Right (BR) corner.',
  },
  dockTopLeft: {
    tag: 'DOCK',
    title: 'Top Left',
    desc: 'Dock performance monitor in the top-left viewport corner.',
  },
  dockTopRight: {
    tag: 'DOCK',
    title: 'Top Right',
    desc: 'Dock performance monitor in the top-right viewport corner.',
  },
  dockBottomLeft: {
    tag: 'DOCK',
    title: 'Bottom Left',
    desc: 'Dock performance monitor in the bottom-left viewport corner.',
  },
  dockBottomRight: {
    tag: 'DOCK',
    title: 'Bottom Right',
    desc: 'Dock performance monitor in the bottom-right viewport corner.',
  },
  hotkeyGuide: {
    tag: 'KEYS',
    title: 'Monitor Keyboard Shortcuts',
    desc: 'F3 or Alt+P: Toggle Visibility | Shift+F3 or Shift+Alt+P: Cycle Mini/Standard/Expanded | Alt+F3: Toggle Ghost Mode | /perf in DevTerminal (` key)',
  },

  // Mini Mode Items
  miniFps: {
    tag: 'HUD',
    title: 'Frames Per Second (FPS) [Mini HUD]',
    desc: 'Current rendering frames per second. Green >= 58 FPS, Yellow >= 30 FPS, Red < 30 FPS.',
  },
  miniFrameTime: {
    tag: 'HUD',
    title: 'Frame Time (Mini HUD)',
    desc: 'Total CPU/GPU frame duration in milliseconds. 16.7ms = 60 FPS target.',
  },
  miniSparkline: {
    tag: 'HUD',
    title: 'Mini Sparkline Waveform',
    desc: 'Real-time 48-frame vector sparkline of recent frame times. Spikes represent dropped frames.',
  },
  miniDc: {
    tag: 'HUD',
    title: 'WebGL Draw Calls (Mini HUD)',
    desc: 'Draw calls dispatched to the GPU this frame. Lower indicates better sprite batching.',
  },
  miniEnt: {
    tag: 'HUD',
    title: 'Live Entities (Mini HUD)',
    desc: 'Active entity count currently alive in the engine ECS world.',
  },
  miniRtt: {
    tag: 'HUD',
    title: 'Network RTT (Mini HUD)',
    desc: 'Round-trip HTTP latency between client and authoritative turn server (/api/action).',
  },
  miniVram: {
    tag: 'HUD',
    title: 'GPU Texture VRAM (Mini HUD)',
    desc: 'Estimated video memory occupied by loaded spritesheets, tilesets, and render targets.',
  },
} as const satisfies Record<string, PerfTooltipEntry>;

export type PerfTooltipId = keyof typeof PERF_TOOLTIPS;

/**
 * Helper generating data attributes for a perf monitor item.
 * Strictly omits the native 'title' attribute so browsers only render the
 * custom in-game cyberpunk floating tooltip, eliminating duplicate native tooltips.
 */
export function getPerfTooltipAttrs(id: PerfTooltipId): {
  'data-perf-tooltip': string;
} {
  return {
    'data-perf-tooltip': id,
  };
}
