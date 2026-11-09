import { create } from 'zustand';
import { RenderStageTimings, DevRenderBisectionFlags, RenderTelemetry } from '@rendering/render-system';
import { WebGLFrameStats, TextureMemoryBreakdown } from './webgl-probe';
import { WorldDiagnostics } from '@engine/ecs/world';
import { GridDiagnostics } from '@engine/grid/grid';
import { AudioDiagnostics } from '@engine/audio/types';
import {
  RollingFrameMetrics,
  TurnWaterfallEntry,
  LeakBaselineSnapshot,
  LeakDiff,
  SpikeForensicsCard,
} from './perf-collector';

export type PerfDisplayMode = 'OFF' | 'MINI' | 'STANDARD' | 'EXPANDED';
export type PerfDomainTab = 'GPU' | 'ECS' | 'TURN' | 'MEM' | 'AUDIT';
export type PerfDockPosition = 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';

export interface PerfThrottledData {
  metrics: RollingFrameMetrics;
  stageTimings: RenderStageTimings;
  renderTelemetry: RenderTelemetry | null;
  webglStats: WebGLFrameStats;
  textureMemory: TextureMemoryBreakdown;
  ecsDiagnostics: WorldDiagnostics | null;
  gridDiagnostics: GridDiagnostics | null;
  audioDiagnostics: AudioDiagnostics | null;
  gcTelemetry: { heapUsedBytes: number; heapTotalBytes: number; gcEvents: number };
  latestTurn: TurnWaterfallEntry | null;
  turnWaterfall: TurnWaterfallEntry[];
  baselineSnapshot: LeakBaselineSnapshot | null;
  leakDiff: LeakDiff | null;
  spikeForensics: SpikeForensicsCard | null;
}

export interface PerfStoreState {
  mode: PerfDisplayMode;
  lastActiveMode: Exclude<PerfDisplayMode, 'OFF'>;
  activeTab: PerfDomainTab;
  ghostMode: boolean;
  dockPosition: PerfDockPosition;
  spikeTrapThreshold: number;
  isPaused: boolean;
  bisectionFlags: DevRenderBisectionFlags;

  // Throttled Snapshot Data (Updated at 4Hz)
  throttledData: PerfThrottledData;

  // Actions
  setMode: (mode: PerfDisplayMode) => void;
  toggleMode: () => void;
  cycleMode: () => void;
  toggleGhost: () => void;
  setActiveTab: (tab: PerfDomainTab) => void;
  setDockPosition: (pos: PerfDockPosition) => void;
  setSpikeTrapThreshold: (threshold: number) => void;
  togglePause: () => void;
  setBisectionFlag: (key: keyof DevRenderBisectionFlags, value: boolean) => void;
  updateThrottledSnapshot: (data: Partial<PerfThrottledData>) => void;
}

const STORAGE_KEY = 'nirmata_dev_perf_settings';

function loadPersistedSettings(): {
  mode?: PerfDisplayMode;
  dockPosition?: PerfDockPosition;
  activeTab?: PerfDomainTab;
  spikeTrapThreshold?: number;
} {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore storage parse errors
  }
  return {};
}

function persistSettings(state: {
  mode: PerfDisplayMode;
  dockPosition: PerfDockPosition;
  activeTab: PerfDomainTab;
  spikeTrapThreshold: number;
}) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

const saved = loadPersistedSettings();

const initialThrottledData: PerfThrottledData = {
  metrics: {
    fpsCurrent: 60,
    fpsAvg: 60,
    fpsOnePercentLow: 60,
    frameTimeMs: 16.67,
    frameTimeJitter: 0,
  },
  stageTimings: {
    fovMs: 0,
    tilemapMs: 0,
    spriteSyncMs: 0,
    vfxMs: 0,
    hoverMs: 0,
    totalCpuMs: 0,
  },
  renderTelemetry: null,
  webglStats: {
    drawCalls: 0,
    triangles: 0,
    programSwitches: 0,
    textureBinds: 0,
    renderPassMs: 0,
  },
  textureMemory: {
    totalTextures: 0,
    atlasTextures: 0,
    renderTextures: 0,
    textOrCanvasTextures: 0,
    estimatedVramBytes: 0,
  },
  ecsDiagnostics: null,
  gridDiagnostics: null,
  audioDiagnostics: null,
  gcTelemetry: { heapUsedBytes: 0, heapTotalBytes: 0, gcEvents: 0 },
  latestTurn: null,
  turnWaterfall: [],
  baselineSnapshot: null,
  leakDiff: null,
  spikeForensics: null,
};

export const usePerfStore = create<PerfStoreState>((set, get) => ({
  mode: saved.mode ?? 'OFF',
  lastActiveMode: saved.mode && saved.mode !== 'OFF' ? saved.mode : 'STANDARD',
  activeTab: saved.activeTab ?? 'GPU',
  ghostMode: false,
  dockPosition: saved.dockPosition ?? 'TOP_LEFT',
  spikeTrapThreshold: saved.spikeTrapThreshold ?? 0,
  isPaused: false,
  bisectionFlags: {
    measureTimings: true,
    disableSpriteFilters: false,
    disableWorldFilters: false,
    disableParticles: false,
    cacheStaticTilemap: false,
    cacheStaticFov: false,
  },
  throttledData: initialThrottledData,

  setMode: (mode) => {
    set((state) => {
      const lastActive = mode !== 'OFF' ? mode : state.lastActiveMode;
      persistSettings({
        mode,
        dockPosition: state.dockPosition,
        activeTab: state.activeTab,
        spikeTrapThreshold: state.spikeTrapThreshold,
      });
      return { mode, lastActiveMode: lastActive };
    });
  },

  toggleMode: () => {
    const { mode, lastActiveMode } = get();
    const nextMode = mode === 'OFF' ? lastActiveMode : 'OFF';
    get().setMode(nextMode);
  },

  cycleMode: () => {
    const { mode } = get();
    let nextMode: PerfDisplayMode;
    switch (mode) {
      case 'OFF':
        nextMode = 'MINI';
        break;
      case 'MINI':
        nextMode = 'STANDARD';
        break;
      case 'STANDARD':
        nextMode = 'EXPANDED';
        break;
      case 'EXPANDED':
      default:
        nextMode = 'OFF';
        break;
    }
    get().setMode(nextMode);
  },

  toggleGhost: () => {
    set((state) => ({ ghostMode: !state.ghostMode }));
  },

  setActiveTab: (tab) => {
    set((state) => {
      persistSettings({
        mode: state.mode,
        dockPosition: state.dockPosition,
        activeTab: tab,
        spikeTrapThreshold: state.spikeTrapThreshold,
      });
      return { activeTab: tab };
    });
  },

  setDockPosition: (pos) => {
    set((state) => {
      persistSettings({
        mode: state.mode,
        dockPosition: pos,
        activeTab: state.activeTab,
        spikeTrapThreshold: state.spikeTrapThreshold,
      });
      return { dockPosition: pos };
    });
  },

  setSpikeTrapThreshold: (threshold) => {
    set((state) => {
      persistSettings({
        mode: state.mode,
        dockPosition: state.dockPosition,
        activeTab: state.activeTab,
        spikeTrapThreshold: threshold,
      });
      return { spikeTrapThreshold: threshold };
    });
  },

  togglePause: () => {
    set((state) => ({ isPaused: !state.isPaused }));
  },

  setBisectionFlag: (key, value) => {
    set((state) => ({
      bisectionFlags: {
        ...state.bisectionFlags,
        [key]: value,
      },
    }));
  },

  updateThrottledSnapshot: (data) => {
    set((state) => ({
      throttledData: {
        ...state.throttledData,
        ...data,
      },
    }));
  },
}));
