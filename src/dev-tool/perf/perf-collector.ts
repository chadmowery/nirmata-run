import { RenderStageTimings, RenderSystem } from '@rendering/render-system';
import { WebGLFrameStats, WebGLProbe } from './webgl-probe';
import { TurnTelemetryData } from '@/game/setup';
import { GameContext } from '@/game/types';

export const HIST_SIZE = 240;

export interface SpikeForensicsCard {
  frameDurationMs: number;
  thresholdMs: number;
  stageTimings: RenderStageTimings;
  webglStats: WebGLFrameStats;
  recentEvents: string[];
  timestamp: number;
}

export interface TurnWaterfallEntry extends TurnTelemetryData {
  timestamp: number;
}

export interface LeakBaselineSnapshot {
  floor: number;
  entityCount: number;
  componentCount: number;
  entitySpriteCount: number;
  tilemapPoolSize: number;
  activeFilterCount: number;
  managedTextureCount: number;
  vramBytes: number;
  activeAudioVoiceCount: number;
  jsHeapBytes: number;
  timestamp: number;
}

export interface LeakDiff {
  deltaEntities: number;
  deltaComponents: number;
  deltaSprites: number;
  deltaTilemapPool: number;
  deltaFilters: number;
  deltaTextures: number;
  deltaVramBytes: number;
  deltaVoices: number;
  deltaHeapBytes: number;
}

export interface RollingFrameMetrics {
  fpsCurrent: number;
  fpsAvg: number;
  fpsOnePercentLow: number;
  frameTimeMs: number;
  frameTimeJitter: number;
}

export class PerfCollector {
  // Circular Ring Buffers (Zero Allocation on Frame Tick)
  public readonly frameTimes = new Float32Array(HIST_SIZE);
  public readonly fovTimes = new Float32Array(HIST_SIZE);
  public readonly tilemapTimes = new Float32Array(HIST_SIZE);
  public readonly spriteTimes = new Float32Array(HIST_SIZE);
  public readonly vfxTimes = new Float32Array(HIST_SIZE);
  public readonly hoverTimes = new Float32Array(HIST_SIZE);
  public readonly webglTimes = new Float32Array(HIST_SIZE);
  public readonly drawCalls = new Uint16Array(HIST_SIZE);

  private head = 0;
  private totalRecorded = 0;
  private isFrozen = false;

  // Spike Trap Settings & Forensics
  private spikeTrapThresholdMs = 0; // 0 = OFF
  private activeSpikeCard: SpikeForensicsCard | null = null;
  private recentEventsRing: string[] = [];
  private readonly MAX_RECENT_EVENTS = 20;

  // Turn Telemetry Waterfall (Last 30 turns)
  private turnWaterfall: TurnWaterfallEntry[] = [];
  private readonly MAX_TURNS = 30;

  // Leak Baseline Snapshots & Diff Engine
  private baselineSnapshot: LeakBaselineSnapshot | null = null;
  private floorHistory: LeakBaselineSnapshot[] = [];

  // Memory & GC Sawtooth Tracker
  private lastHeapBytes = 0;
  private gcSawtoothCount = 0;

  // Subsystem References
  private probe: WebGLProbe | null = null;
  private context: GameContext | null = null;
  private renderSystem: RenderSystem | null = null;
  private latestWebglStats: WebGLFrameStats = {
    drawCalls: 0,
    triangles: 0,
    programSwitches: 0,
    textureBinds: 0,
    renderPassMs: 0,
  };

  constructor(probe?: WebGLProbe) {
    if (probe) {
      this.probe = probe;
    }
  }

  public setProbe(probe: WebGLProbe | null): void {
    this.probe = probe;
  }

  public getProbe(): WebGLProbe | null {
    return this.probe;
  }

  public setContext(context: GameContext | null): void {
    this.context = context;
  }

  public getContext(): GameContext | null {
    return this.context;
  }

  public setRenderSystem(renderSystem: RenderSystem | null): void {
    this.renderSystem = renderSystem;
  }

  public getRenderSystem(): RenderSystem | null {
    return this.renderSystem;
  }

  public getLatestWebglStats(): WebGLFrameStats {
    return { ...this.latestWebglStats };
  }

  public getHeadIndex(): number {
    return this.head;
  }

  public getTotalRecorded(): number {
    return this.totalRecorded;
  }

  public getBufferCount(): number {
    return Math.min(this.totalRecorded, HIST_SIZE);
  }

  public setSpikeTrapThreshold(ms: number): void {
    this.spikeTrapThresholdMs = ms;
  }

  public getSpikeTrapThreshold(): number {
    return this.spikeTrapThresholdMs;
  }

  public getActiveSpikeCard(): SpikeForensicsCard | null {
    return this.activeSpikeCard;
  }

  public clearSpikeCard(): void {
    this.activeSpikeCard = null;
    this.isFrozen = false;
  }

  public setFrozen(frozen: boolean): void {
    this.isFrozen = frozen;
  }

  public getIsFrozen(): boolean {
    return this.isFrozen;
  }

  public recordEventEmission(eventType: string): void {
    if (this.recentEventsRing.length >= this.MAX_RECENT_EVENTS) {
      this.recentEventsRing.shift();
    }
    this.recentEventsRing.push(eventType);
  }

  public recordFrame(
    frameDeltaMs: number,
    stageTimings: RenderStageTimings,
    webglStats: WebGLFrameStats,
    webglPassMs = 0,
  ): void {
    this.latestWebglStats.drawCalls = webglStats.drawCalls;
    this.latestWebglStats.triangles = webglStats.triangles;
    this.latestWebglStats.programSwitches = webglStats.programSwitches;
    this.latestWebglStats.textureBinds = webglStats.textureBinds;
    this.latestWebglStats.renderPassMs = webglPassMs;
    if (this.isFrozen) return;

    // Spike Trap Auto-Freeze Trigger
    if (this.spikeTrapThresholdMs > 0 && frameDeltaMs >= this.spikeTrapThresholdMs) {
      this.isFrozen = true;
      this.activeSpikeCard = {
        frameDurationMs: Math.round(frameDeltaMs * 100) / 100,
        thresholdMs: this.spikeTrapThresholdMs,
        stageTimings: { ...stageTimings },
        webglStats: { ...webglStats },
        recentEvents: [...this.recentEventsRing],
        timestamp: Date.now(),
      };
    }

    const idx = this.head;
    this.frameTimes[idx] = frameDeltaMs;
    this.fovTimes[idx] = stageTimings.fovMs;
    this.tilemapTimes[idx] = stageTimings.tilemapMs;
    this.spriteTimes[idx] = stageTimings.spriteSyncMs;
    this.vfxTimes[idx] = stageTimings.vfxMs;
    this.hoverTimes[idx] = stageTimings.hoverMs;
    this.webglTimes[idx] = webglPassMs;
    this.drawCalls[idx] = webglStats.drawCalls;

    this.head = (this.head + 1) % HIST_SIZE;
    this.totalRecorded++;
  }

  public computeRollingMetrics(windowSize = 120): RollingFrameMetrics {
    const count = Math.min(this.totalRecorded, windowSize, HIST_SIZE);
    if (count === 0) {
      return {
        fpsCurrent: 60,
        fpsAvg: 60,
        fpsOnePercentLow: 60,
        frameTimeMs: 16.67,
        frameTimeJitter: 0,
      };
    }

    let sum = 0;
    const windowSlice: number[] = new Array(count);

    for (let i = 0; i < count; i++) {
      // Walk backwards from latest recorded head
      const idx = (this.head - 1 - i + HIST_SIZE) % HIST_SIZE;
      const t = this.frameTimes[idx];
      windowSlice[i] = t;
      sum += t;
    }

    const latestFrame = windowSlice[0] > 0 ? windowSlice[0] : 16.67;
    const mean = sum / count;
    const fpsCurrent = Math.round((1000 / latestFrame) * 10) / 10;
    const fpsAvg = Math.round((1000 / (mean > 0 ? mean : 16.67)) * 10) / 10;

    // Variance and Jitter Standard Deviation
    let varianceSum = 0;
    for (let i = 0; i < count; i++) {
      const diff = windowSlice[i] - mean;
      varianceSum += diff * diff;
    }
    const frameTimeJitter = Math.round(Math.sqrt(varianceSum / count) * 100) / 100;

    // 1% Low FPS (99th percentile frame time)
    windowSlice.sort((a, b) => a - b);
    const p99Index = Math.min(count - 1, Math.floor(count * 0.99));
    const p99Time = windowSlice[p99Index] > 0 ? windowSlice[p99Index] : 16.67;
    const fpsOnePercentLow = Math.round((1000 / p99Time) * 10) / 10;

    return {
      fpsCurrent,
      fpsAvg,
      fpsOnePercentLow,
      frameTimeMs: Math.round(latestFrame * 100) / 100,
      frameTimeJitter,
    };
  }

  public recordTurnTelemetry(telemetry: TurnTelemetryData): void {
    if (this.turnWaterfall.length >= this.MAX_TURNS) {
      this.turnWaterfall.shift();
    }
    this.turnWaterfall.push({
      ...telemetry,
      timestamp: Date.now(),
    });
  }

  public getTurnWaterfall(): TurnWaterfallEntry[] {
    return [...this.turnWaterfall];
  }

  public getLatestTurn(): TurnWaterfallEntry | null {
    return this.turnWaterfall.length > 0 ? this.turnWaterfall[this.turnWaterfall.length - 1] : null;
  }

  public takeBaselineSnapshot(stats: {
    floor: number;
    entityCount: number;
    componentCount: number;
    entitySpriteCount: number;
    tilemapPoolSize: number;
    activeFilterCount: number;
    managedTextureCount: number;
    vramBytes: number;
    activeAudioVoiceCount: number;
    jsHeapBytes: number;
  }): LeakBaselineSnapshot {
    this.baselineSnapshot = {
      ...stats,
      timestamp: Date.now(),
    };
    return this.baselineSnapshot;
  }

  public getBaselineSnapshot(): LeakBaselineSnapshot | null {
    return this.baselineSnapshot;
  }

  public clearBaselineSnapshot(): void {
    this.baselineSnapshot = null;
  }

  public recordFloorTransitionSnapshot(snapshot: LeakBaselineSnapshot): void {
    this.floorHistory.push(snapshot);
    if (!this.baselineSnapshot) {
      this.baselineSnapshot = snapshot;
    }
  }

  public getFloorHistory(): LeakBaselineSnapshot[] {
    return [...this.floorHistory];
  }

  public computeLeakDiff(current: {
    entityCount: number;
    componentCount: number;
    entitySpriteCount: number;
    tilemapPoolSize: number;
    activeFilterCount: number;
    managedTextureCount: number;
    vramBytes: number;
    activeAudioVoiceCount: number;
    jsHeapBytes: number;
  }): LeakDiff | null {
    if (!this.baselineSnapshot) return null;

    return {
      deltaEntities: current.entityCount - this.baselineSnapshot.entityCount,
      deltaComponents: current.componentCount - this.baselineSnapshot.componentCount,
      deltaSprites: current.entitySpriteCount - this.baselineSnapshot.entitySpriteCount,
      deltaTilemapPool: current.tilemapPoolSize - this.baselineSnapshot.tilemapPoolSize,
      deltaFilters: current.activeFilterCount - this.baselineSnapshot.activeFilterCount,
      deltaTextures: current.managedTextureCount - this.baselineSnapshot.managedTextureCount,
      deltaVramBytes: current.vramBytes - this.baselineSnapshot.vramBytes,
      deltaVoices: current.activeAudioVoiceCount - this.baselineSnapshot.activeAudioVoiceCount,
      deltaHeapBytes: current.jsHeapBytes - this.baselineSnapshot.jsHeapBytes,
    };
  }

  public checkGCSawtooth(): { heapUsedBytes: number; heapTotalBytes: number; gcEvents: number } {
    let heapUsed = 0;
    let heapTotal = 0;

    const perf =
      typeof window !== 'undefined'
        ? (window.performance as unknown as {
            memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number };
          })
        : null;
    if (perf?.memory) {
      heapUsed = perf.memory.usedJSHeapSize ?? 0;
      heapTotal = perf.memory.totalJSHeapSize ?? 0;

      if (this.lastHeapBytes > 0 && this.lastHeapBytes - heapUsed > 2 * 1024 * 1024) {
        this.gcSawtoothCount++;
      }
      this.lastHeapBytes = heapUsed;
    }

    return {
      heapUsedBytes: heapUsed,
      heapTotalBytes: heapTotal,
      gcEvents: this.gcSawtoothCount,
    };
  }

  public generateReportJson(): string {
    const metrics = this.computeRollingMetrics(120);
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        fps: metrics.fpsCurrent,
        fpsAvg: metrics.fpsAvg,
        fpsOnePercentLow: metrics.fpsOnePercentLow,
        frameTimeMs: metrics.frameTimeMs,
        frameTimeJitterMs: metrics.frameTimeJitter,
      },
      turnWaterfall: this.turnWaterfall,
      baselineSnapshot: this.baselineSnapshot,
      floorHistory: this.floorHistory,
      activeSpikeCard: this.activeSpikeCard,
      recentEvents: this.recentEventsRing,
      gcEventsCount: this.gcSawtoothCount,
    };

    return JSON.stringify(report, null, 2);
  }
}

export const perfCollector = new PerfCollector();
