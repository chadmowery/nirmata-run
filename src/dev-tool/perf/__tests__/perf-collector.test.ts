import { describe, it, expect, beforeEach } from 'vitest';
import { PerfCollector, HIST_SIZE } from '../perf-collector';

describe('PerfCollector', () => {
  let collector: PerfCollector;

  beforeEach(() => {
    collector = new PerfCollector();
  });

  it('records frames in circular typed array ring buffers without exceeding HIST_SIZE', () => {
    for (let i = 0; i < HIST_SIZE + 50; i++) {
      collector.recordFrame(
        16.6,
        { fovMs: 0.3, tilemapMs: 0.5, spriteSyncMs: 0.4, vfxMs: 0.2, hoverMs: 0.1, totalCpuMs: 1.5 },
        { drawCalls: 12, triangles: 400, programSwitches: 3, textureBinds: 5 },
      );
    }

    expect(collector.getTotalRecorded()).toBe(HIST_SIZE + 50);
    expect(collector.getBufferCount()).toBe(HIST_SIZE);
  });

  it('computes rolling FPS, average, 1% low, and jitter metrics', () => {
    // Record stable 16.67ms frames (60 FPS)
    for (let i = 0; i < 60; i++) {
      collector.recordFrame(
        16.67,
        { fovMs: 0.3, tilemapMs: 0.5, spriteSyncMs: 0.4, vfxMs: 0.2, hoverMs: 0.1, totalCpuMs: 1.5 },
        { drawCalls: 10, triangles: 200, programSwitches: 2, textureBinds: 4 },
      );
    }

    const metrics = collector.computeRollingMetrics(60);
    expect(metrics.fpsCurrent).toBeCloseTo(60, 0);
    expect(metrics.fpsAvg).toBeCloseTo(60, 0);
    expect(metrics.fpsOnePercentLow).toBeCloseTo(60, 0);
    expect(metrics.frameTimeJitter).toBeCloseTo(0, 1);
  });

  it('triggers Spike Trap auto-freeze when frame time exceeds threshold', () => {
    collector.setSpikeTrapThreshold(20); // 20ms threshold
    collector.recordEventEmission('DAMAGE_DEALT');

    // Normal frame
    collector.recordFrame(
      15.0,
      { fovMs: 0.2, tilemapMs: 0.4, spriteSyncMs: 0.3, vfxMs: 0.1, hoverMs: 0.1, totalCpuMs: 1.1 },
      { drawCalls: 10, triangles: 100, programSwitches: 1, textureBinds: 2 },
    );
    expect(collector.getIsFrozen()).toBe(false);

    // Spike frame (35ms > 20ms)
    collector.recordFrame(
      35.0,
      { fovMs: 5.0, tilemapMs: 12.0, spriteSyncMs: 6.0, vfxMs: 2.0, hoverMs: 1.0, totalCpuMs: 26.0 },
      { drawCalls: 45, triangles: 1200, programSwitches: 8, textureBinds: 15 },
    );

    expect(collector.getIsFrozen()).toBe(true);
    const spike = collector.getActiveSpikeCard();
    expect(spike).toBeDefined();
    expect(spike?.frameDurationMs).toBe(35);
    expect(spike?.thresholdMs).toBe(20);
    expect(spike?.recentEvents).toContain('DAMAGE_DEALT');

    // Subsequent frame is ignored while frozen
    const prevRecorded = collector.getTotalRecorded();
    collector.recordFrame(
      16.0,
      { fovMs: 0.2, tilemapMs: 0.4, spriteSyncMs: 0.3, vfxMs: 0.1, hoverMs: 0.1, totalCpuMs: 1.1 },
      { drawCalls: 10, triangles: 100, programSwitches: 1, textureBinds: 2 },
    );
    expect(collector.getTotalRecorded()).toBe(prevRecorded);

    // Unfreeze
    collector.clearSpikeCard();
    expect(collector.getIsFrozen()).toBe(false);
  });

  it('computes leak diff against baseline snapshot', () => {
    collector.takeBaselineSnapshot({
      floor: 1,
      entityCount: 100,
      componentCount: 300,
      entitySpriteCount: 20,
      tilemapPoolSize: 500,
      activeFilterCount: 5,
      managedTextureCount: 4,
      vramBytes: 1000000,
      activeAudioVoiceCount: 2,
      jsHeapBytes: 20000000,
    });

    const diff = collector.computeLeakDiff({
      entityCount: 110, // +10
      componentCount: 330, // +30
      entitySpriteCount: 22, // +2
      tilemapPoolSize: 500, // 0
      activeFilterCount: 6, // +1
      managedTextureCount: 4, // 0
      vramBytes: 1000000, // 0
      activeAudioVoiceCount: 2, // 0
      jsHeapBytes: 22000000, // +2MB
    });

    expect(diff).toEqual({
      deltaEntities: 10,
      deltaComponents: 30,
      deltaSprites: 2,
      deltaTilemapPool: 0,
      deltaFilters: 1,
      deltaTextures: 0,
      deltaVramBytes: 0,
      deltaVoices: 0,
      deltaHeapBytes: 2000000,
    });
  });

  it('records turn waterfall history and exports report JSON', () => {
    collector.recordTurnTelemetry({
      turnNumber: 1,
      actionType: 'MOVE',
      clientPredictionMs: 0.4,
      networkRttMs: 14.2,
      serverTurnMs: 3.1,
      serverPhaseTimings: { action: 1.2, reaction: 1.5 },
      serverTopSystems: [{ name: 'MovementSystem', phase: 'action', durationMs: 1.0 }],
      reconcileMs: 0.9,
      syncType: 'DELTA',
      payloadBytes: 1240,
      deltaEntitiesAdded: 0,
      deltaEntitiesRemoved: 0,
      deltaComponentsSet: 2,
      deltaComponentsRemoved: 0,
      deltaEventsCount: 3,
    });

    const waterfall = collector.getTurnWaterfall();
    expect(waterfall).toHaveLength(1);
    expect(waterfall[0].actionType).toBe('MOVE');

    const jsonStr = collector.generateReportJson();
    const parsed = JSON.parse(jsonStr);
    expect(parsed).toHaveProperty('summary');
    expect(parsed.turnWaterfall).toHaveLength(1);
  });
});
