import { RenderStageTimings, RenderSystem } from '@rendering/render-system';
import { WebGLFrameStats, WebGLProbe } from './webgl-probe';
import { TurnTelemetryData } from '@/game/setup';
import { GameContext } from '@/game/types';
import { FloorState } from '@shared/components/floor-state';
import { Hostile } from '@shared/components/hostile';
import { Dying } from '@shared/components/dying';
import { Prop, SecurityLock, CorruptedNode } from '@shared/components/environment';
import { Item } from '@shared/components/item';
import { CurrencyItem } from '@shared/components/currency-item';
import { Position } from '@shared/components/position';
import { Parent } from '@shared/components/parent';
import { DeadZone } from '@shared/components/dead-zone';
import { CorruptionState } from '@shared/components/corruption-state';
import { getAudioEngine } from '@engine/audio';

export const HIST_SIZE = 240;

export interface ArchetypeCensus {
  playerCount: number;
  hostileCount: number;
  dyingCount: number;
  totalProps: number;
  lockedProps: number;
  corruptedProps: number;
  searchedProps: number;
  groundItems: number;
  childItems: number;
  deadZones: number;
  corruptions: number;
}

export interface EventBusTelemetry {
  eventsPerSec: number;
  totalEmissions: number;
  discreteEmissions: number;
  fovEmissions: number;
  handlerCount: number;
  queueLength: number;
}

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
  private currentFrameEvents: string[] = [];
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

  private onFreezeCallback?: (frozen: boolean) => void;

  public setOnFreezeCallback(cb?: (frozen: boolean) => void): void {
    this.onFreezeCallback = cb;
  }

  public getActiveSpikeCard(): SpikeForensicsCard | null {
    return this.activeSpikeCard;
  }

  public clearSpikeCard(): void {
    this.activeSpikeCard = null;
    this.isFrozen = false;
    this.currentFrameEvents.length = 0;
    this.onFreezeCallback?.(false);
  }

  public setFrozen(frozen: boolean): void {
    this.isFrozen = frozen;
    if (!frozen) {
      this.activeSpikeCard = null;
      this.currentFrameEvents.length = 0;
    }
    this.onFreezeCallback?.(frozen);
  }

  public getIsFrozen(): boolean {
    return this.isFrozen;
  }

  public recordEventEmission(eventType: string): void {
    this.currentFrameEvents.push(eventType);
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
        webglStats: { ...webglStats, renderPassMs: webglPassMs },
        recentEvents:
          this.currentFrameEvents.length > 0
            ? [...this.currentFrameEvents]
            : [...this.recentEventsRing],
        timestamp: Date.now(),
      };
      this.onFreezeCallback?.(true);
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
    this.currentFrameEvents.length = 0;
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

  private lastEventBusEmissions = 0;
  private lastEventBusTimestamp = 0;

  public getArchetypeCensus(): ArchetypeCensus | null {
    if (!this.context) return null;
    const world = this.context.world;

    const playerCount = this.context.playerId !== undefined ? 1 : 0;
    const hostileCount = world.query(Hostile).length;
    const dyingCount = world.query(Dying).length;

    const propEntities = world.query(Prop);
    const totalProps = propEntities.length;
    let lockedProps = 0;
    let corruptedProps = 0;
    let searchedProps = 0;

    for (const id of propEntities) {
      const propData = world.getComponent(id, Prop);
      if (propData?.isSearched) searchedProps++;
      const lockData = world.getComponent(id, SecurityLock);
      if (lockData && lockData.isLocked !== false) lockedProps++;
      const corruptData = world.getComponent(id, CorruptedNode);
      if (corruptData && !corruptData.isDisarmed) corruptedProps++;
    }

    const groundItems =
      world.query(Position, Item).filter((id) => !world.hasComponent(id, Parent)).length +
      world.query(Position, CurrencyItem).filter((id) => !world.hasComponent(id, Parent)).length;
    const childItems = world.query(Parent).length;

    const deadZones = world.query(DeadZone).length;
    const corruptions = world.query(CorruptionState).length;

    return {
      playerCount,
      hostileCount,
      dyingCount,
      totalProps,
      lockedProps,
      corruptedProps,
      searchedProps,
      groundItems,
      childItems,
      deadZones,
      corruptions,
    };
  }

  public getEventBusTelemetry(): EventBusTelemetry | null {
    if (!this.context) return null;
    const diag = this.context.eventBus.getDiagnostics();
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let eventsPerSec = 0;

    if (this.lastEventBusTimestamp > 0) {
      const dt = (now - this.lastEventBusTimestamp) / 1000;
      if (dt > 0.05) {
        eventsPerSec = Math.max(0, (diag.totalEmissions - this.lastEventBusEmissions) / dt);
      }
    }
    this.lastEventBusEmissions = diag.totalEmissions;
    this.lastEventBusTimestamp = now;

    const fovEmissions = diag.emissionsByType['FOV_UPDATED'] ?? 0;
    const discreteEmissions = Math.max(0, diag.totalEmissions - fovEmissions);

    return {
      eventsPerSec: Math.round(eventsPerSec * 10) / 10,
      totalEmissions: diag.totalEmissions,
      discreteEmissions,
      fovEmissions,
      handlerCount: diag.handlerCount,
      queueLength: diag.queueLength,
    };
  }

  public captureCurrentSnapshot(): LeakBaselineSnapshot {
    let floor = 1;
    let entityCount = 0;
    let componentCount = 0;

    if (this.context) {
      if (this.context.playerId !== undefined) {
        const floorComp = this.context.world.getComponent(this.context.playerId, FloorState);
        floor = floorComp?.currentFloor ?? 1;
      }
      const diag = this.context.world.getDiagnostics();
      entityCount = diag.entityCount;
      componentCount = diag.totalComponentInstances;
    }

    const renderTelemetry = this.renderSystem?.getRenderTelemetry();
    const entitySpriteCount = renderTelemetry?.sprites?.totalSprites ?? 0;
    const tilemapPoolSize = renderTelemetry?.tilemap?.poolSize ?? 0;
    const activeFilterCount =
      (renderTelemetry?.filters?.totalPropFilters ?? 0) +
      (renderTelemetry?.filters?.totalEnemyFilters ?? 0) +
      (renderTelemetry?.filters?.activeDamageFilters ?? 0) +
      (renderTelemetry?.filters?.worldFiltersCount ?? 0);

    const textureMem = this.probe?.getTextureMemory() ?? {
      totalTextures: 0,
      atlasTextures: 0,
      renderTextures: 0,
      textOrCanvasTextures: 0,
      estimatedVramBytes: 0,
    };

    let activeAudioVoiceCount = 0;
    try {
      const audioDiag = getAudioEngine?.()?.getDiagnostics?.();
      activeAudioVoiceCount = audioDiag?.activeVoiceCount ?? 0;
    } catch {
      // Audio engine may not be running in testing
    }

    let jsHeapBytes = 0;
    if (
      typeof performance !== 'undefined' &&
      (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize
    ) {
      jsHeapBytes =
        (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize;
    }

    return {
      floor,
      entityCount,
      componentCount,
      entitySpriteCount,
      tilemapPoolSize,
      activeFilterCount,
      managedTextureCount: textureMem.totalTextures,
      vramBytes: textureMem.estimatedVramBytes,
      activeAudioVoiceCount,
      jsHeapBytes,
      timestamp: Date.now(),
    };
  }

  public takeBaselineSnapshot(stats?: Partial<LeakBaselineSnapshot>): LeakBaselineSnapshot {
    const current = this.captureCurrentSnapshot();
    this.baselineSnapshot = {
      ...current,
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
