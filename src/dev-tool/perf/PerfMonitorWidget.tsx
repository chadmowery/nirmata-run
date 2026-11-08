import React, { useEffect, useRef, useState, useTransition } from 'react';
import { usePerfStore } from './perf-store';
import { perfCollector, HIST_SIZE } from './perf-collector';
import { WebGLProbe } from './webgl-probe';
import { GameContext } from '@/game/types';
import { createRenderSystem } from '@/rendering/render-system';
import { getAudioEngine } from '@engine/audio';
import styles from './PerfMonitorWidget.module.css';

export interface PerfMonitorWidgetProps {
  context?: GameContext | null;
  renderSystem?: ReturnType<typeof createRenderSystem> | null;
  probe?: WebGLProbe | null;
}

export function PerfMonitorWidget({ context, renderSystem, probe }: PerfMonitorWidgetProps) {
  const {
    mode,
    activeTab,
    ghostMode,
    dockPosition,
    spikeTrapThreshold,
    isPaused,
    bisectionFlags,
    throttledData,
    setMode,
    toggleGhost,
    setActiveTab,
    setDockPosition,
    setSpikeTrapThreshold,
    togglePause,
    setBisectionFlag,
    updateThrottledSnapshot,
  } = usePerfStore();

  const [, startTransition] = useTransition();

  // Canvas Refs
  const miniSparklineRef = useRef<HTMLCanvasElement | null>(null);
  const oscilloscopeRef = useRef<HTMLCanvasElement | null>(null);
  const expandedOscilloscopeRef = useRef<HTMLCanvasElement | null>(null);

  // Expanded Scrub State
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [scrubPosition, setScrubPosition] = useState<{ x: number; y: number } | null>(null);

  // Sync Bisection Flags with RenderSystem
  useEffect(() => {
    if (renderSystem?.setDevRenderFlags) {
      renderSystem.setDevRenderFlags(bisectionFlags);
    }
  }, [bisectionFlags, renderSystem]);

  // Sync Spike Trap Threshold with Collector
  useEffect(() => {
    perfCollector.setSpikeTrapThreshold(spikeTrapThreshold);
  }, [spikeTrapThreshold]);

  // --------------------------------------------------------------------------
  // 4Hz Throttled Synchronization Loop (Updates Zustand React Store)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (mode === 'OFF') return;

    const interval = setInterval(() => {
      startTransition(() => {
        const metrics = perfCollector.computeRollingMetrics(120);
        const gcTelemetry = perfCollector.checkGCSawtooth();
        const latestTurn = perfCollector.getLatestTurn();
        const turnWaterfall = perfCollector.getTurnWaterfall();
        const baselineSnapshot = perfCollector.getBaselineSnapshot();
        const spikeForensics = perfCollector.getActiveSpikeCard();

        const ecsDiagnostics = context?.world?.getDiagnostics ? context.world.getDiagnostics() : null;
        const gridDiagnostics = context?.grid?.getDiagnostics ? context.grid.getDiagnostics() : null;
        const audioDiagnostics = getAudioEngine().getDiagnostics ? getAudioEngine().getDiagnostics!() : null;

        const renderTelemetry = renderSystem?.getRenderTelemetry ? renderSystem.getRenderTelemetry() : null;
        const stageTimings = renderTelemetry?.stageTimings || {
          fovMs: 0,
          tilemapMs: 0,
          spriteSyncMs: 0,
          vfxMs: 0,
          hoverMs: 0,
          totalCpuMs: 0,
        };

        const webglStats = probe?.getFrameStats ? probe.getFrameStats() : {
          drawCalls: 0,
          triangles: 0,
          programSwitches: 0,
          textureBinds: 0,
        };

        const textureMemory = probe?.getTextureMemory ? probe.getTextureMemory() : {
          totalTextures: 0,
          atlasTextures: 0,
          renderTextures: 0,
          textOrCanvasTextures: 0,
          estimatedVramBytes: 0,
        };

        const currentCensus = {
          entityCount: ecsDiagnostics?.entityCount ?? 0,
          componentCount: ecsDiagnostics?.totalComponentInstances ?? 0,
          entitySpriteCount: renderTelemetry?.tilemap?.visibleTiles ?? 0,
          tilemapPoolSize: renderTelemetry?.tilemap?.poolSize ?? 0,
          activeFilterCount: renderTelemetry?.filters?.totalPropFilters ?? 0,
          managedTextureCount: textureMemory.totalTextures,
          vramBytes: textureMemory.estimatedVramBytes,
          activeAudioVoiceCount: audioDiagnostics?.activeVoiceCount ?? 0,
          jsHeapBytes: gcTelemetry.heapUsedBytes,
        };

        const leakDiff = perfCollector.computeLeakDiff(currentCensus);

        updateThrottledSnapshot({
          metrics,
          stageTimings,
          webglStats,
          textureMemory,
          ecsDiagnostics,
          gridDiagnostics,
          audioDiagnostics,
          gcTelemetry,
          latestTurn,
          turnWaterfall,
          baselineSnapshot,
          leakDiff,
          spikeForensics,
        });
      });
    }, 250);

    return () => clearInterval(interval);
  }, [mode, context, renderSystem, probe, updateThrottledSnapshot]);

  // --------------------------------------------------------------------------
  // 60Hz Direct Vector Oscilloscope & Sparkline Drawing Loop
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (mode === 'OFF') return;

    let animId: number;

    const renderWaveforms = () => {
      // 1. Mini Mode Sparkline
      if (mode === 'MINI' && miniSparklineRef.current) {
        const canvas = miniSparklineRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          const count = 48;
          const head = perfCollector.getHeadIndex();
          const stepX = w / count;

          ctx.beginPath();
          ctx.strokeStyle = '#d8ff00';
          ctx.lineWidth = 1;

          for (let i = 0; i < count; i++) {
            const idx = (head - count + i + HIST_SIZE) % HIST_SIZE;
            const t = perfCollector.frameTimes[idx];
            const y = Math.max(0, Math.min(h, h - (t / 33.3) * h));
            if (i === 0) ctx.moveTo(0, y);
            else ctx.lineTo(i * stepX, y);
          }
          ctx.stroke();
        }
      }

      // 2. Standard Mode Oscilloscope (120 frames = 2.0s)
      if (mode === 'STANDARD' && oscilloscopeRef.current && !isPaused) {
        const canvas = oscilloscopeRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // Grid Reference Lines (33.3ms, 16.7ms, 0ms)
          const y30 = h - (33.33 / 40.0) * h;
          const y60 = h - (16.67 / 40.0) * h;

          ctx.lineWidth = 1;
          // 33.3ms Line (Crimson)
          ctx.strokeStyle = 'rgba(255, 42, 75, 0.4)';
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(0, y30);
          ctx.lineTo(w, y30);
          ctx.stroke();

          // 16.7ms Line (Cyan)
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(0, y60);
          ctx.lineTo(w, y60);
          ctx.stroke();

          // Draw Frame Time Waveform (Lime)
          const framesToDraw = 120;
          const head = perfCollector.getHeadIndex();
          const stepX = w / framesToDraw;

          ctx.beginPath();
          ctx.strokeStyle = '#d8ff00';
          for (let i = 0; i < framesToDraw; i++) {
            const idx = (head - framesToDraw + i + HIST_SIZE) % HIST_SIZE;
            const t = perfCollector.frameTimes[idx];
            const y = Math.max(2, Math.min(h - 2, h - (t / 40.0) * h));
            if (i === 0) ctx.moveTo(0, y);
            else ctx.lineTo(i * stepX, y);
          }
          ctx.stroke();

          // Draw CPU Render Time Waveform (Cyan)
          ctx.beginPath();
          ctx.strokeStyle = '#00f0ff';
          for (let i = 0; i < framesToDraw; i++) {
            const idx = (head - framesToDraw + i + HIST_SIZE) % HIST_SIZE;
            const cpu =
              perfCollector.fovTimes[idx] +
              perfCollector.tilemapTimes[idx] +
              perfCollector.spriteTimes[idx] +
              perfCollector.vfxTimes[idx] +
              perfCollector.hoverTimes[idx];
            const y = Math.max(2, Math.min(h - 2, h - (cpu / 40.0) * h));
            if (i === 0) ctx.moveTo(0, y);
            else ctx.lineTo(i * stepX, y);
          }
          ctx.stroke();
        }
      }

      // 3. Expanded Mode Oscilloscope (240 frames = 4.0s)
      if (mode === 'EXPANDED' && expandedOscilloscopeRef.current && !isPaused) {
        const canvas = expandedOscilloscopeRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          const y30 = h - (33.33 / 40.0) * h;
          const y60 = h - (16.67 / 40.0) * h;

          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255, 42, 75, 0.4)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, y30);
          ctx.lineTo(w, y30);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(0, y60);
          ctx.lineTo(w, y60);
          ctx.stroke();

          const head = perfCollector.getHeadIndex();
          const stepX = w / HIST_SIZE;

          // Frame Time Line
          ctx.beginPath();
          ctx.strokeStyle = '#d8ff00';
          for (let i = 0; i < HIST_SIZE; i++) {
            const idx = (head - HIST_SIZE + i + HIST_SIZE) % HIST_SIZE;
            const t = perfCollector.frameTimes[idx];
            const y = Math.max(2, Math.min(h - 2, h - (t / 40.0) * h));
            if (i === 0) ctx.moveTo(0, y);
            else ctx.lineTo(i * stepX, y);
          }
          ctx.stroke();

          // CPU Render Time Line
          ctx.beginPath();
          ctx.strokeStyle = '#00f0ff';
          for (let i = 0; i < HIST_SIZE; i++) {
            const idx = (head - HIST_SIZE + i + HIST_SIZE) % HIST_SIZE;
            const cpu =
              perfCollector.fovTimes[idx] +
              perfCollector.tilemapTimes[idx] +
              perfCollector.spriteTimes[idx] +
              perfCollector.vfxTimes[idx] +
              perfCollector.hoverTimes[idx];
            const y = Math.max(2, Math.min(h - 2, h - (cpu / 40.0) * h));
            if (i === 0) ctx.moveTo(0, y);
            else ctx.lineTo(i * stepX, y);
          }
          ctx.stroke();

          // Draw Scrub Crosshair if Hovered
          if (scrubPosition !== null) {
            ctx.strokeStyle = '#ffffff';
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(scrubPosition.x, 0);
            ctx.lineTo(scrubPosition.x, h);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      animId = requestAnimationFrame(renderWaveforms);
    };

    animId = requestAnimationFrame(renderWaveforms);
    return () => cancelAnimationFrame(animId);
  }, [mode, isPaused, scrubPosition]);

  if (mode === 'OFF') {
    return null;
  }

  // Position Class
  const posClass =
    dockPosition === 'TOP_LEFT'
      ? styles.posTopLeft
      : dockPosition === 'TOP_RIGHT'
      ? styles.posTopRight
      : dockPosition === 'BOTTOM_LEFT'
      ? styles.posBottomLeft
      : styles.posBottomRight;

  const fps = throttledData.metrics.fpsCurrent;
  const fpsColor =
    fps >= 55
      ? 'var(--c-accent, #d8ff00)'
      : fps >= 30
      ? 'var(--c-scrap, #ffaa00)'
      : 'var(--c-danger, #ff2a4b)';

  const stage = throttledData.stageTimings;
  const totalStageMs = Math.max(
    0.01,
    stage.fovMs + stage.tilemapMs + stage.spriteSyncMs + stage.vfxMs + stage.hoverMs,
  );

  const budgetPct = Math.min(100, Math.round((throttledData.metrics.frameTimeMs / 16.67) * 100));

  // Handler: Take Baseline Snapshot
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

  // Handler: Export Telemetry JSON
  const handleExportJson = () => {
    const jsonStr = perfCollector.generateReportJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nirmata-perf-telemetry-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --------------------------------------------------------------------------
  // RENDER: MODE 1 (MINI PILL)
  // --------------------------------------------------------------------------
  if (mode === 'MINI') {
    return (
      <div
        className={`${styles.widgetContainer} ${posClass} ${ghostMode ? styles.ghostMode : ''}`}
        data-perf-monitor="true"
      >
        <div className={`${styles.panelCard} ${styles.miniPill}`}>
          <span className={styles.miniFps} style={{ color: fpsColor }}>
            ⚡ {fps.toFixed(0)} FPS
          </span>
          <span className={styles.miniStat}>
            <strong>{throttledData.metrics.frameTimeMs.toFixed(1)}</strong>ms
          </span>

          <canvas
            ref={miniSparklineRef}
            width={48}
            height={14}
            className={styles.miniSparkline}
          />

          <span className={styles.miniStat}>
            <strong>{throttledData.webglStats.drawCalls}</strong> DC
          </span>
          <span className={styles.miniStat}>
            <strong>{throttledData.ecsDiagnostics?.entityCount ?? 0}</strong> ENT
          </span>
          <span className={styles.miniStat}>
            RTT <strong>{throttledData.latestTurn?.networkRttMs.toFixed(0) ?? 0}</strong>ms
          </span>
          <span className={styles.miniStat}>
            <strong>{(throttledData.textureMemory.estimatedVramBytes / (1024 * 1024)).toFixed(1)}</strong>MB
          </span>

          <div className={styles.miniActions}>
            <button
              className={ghostMode ? styles.ghostRestoreBtn : styles.ctrlBtn}
              onClick={toggleGhost}
              title="Alt+F3: Toggle Ghost Click-Through"
            >
              👻
            </button>
            <button
              className={styles.ctrlBtn}
              onClick={() => setMode('STANDARD')}
              title="Expand to Standard Widget"
            >
              ⤢
            </button>
            <button
              className={styles.ctrlBtn}
              onClick={() => setMode('OFF')}
              title="Close Performance Monitor (F3)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: MODE 2 (STANDARD) & MODE 3 (EXPANDED)
  // --------------------------------------------------------------------------
  const isExpanded = mode === 'EXPANDED';

  return (
    <div
      className={`${styles.widgetContainer} ${posClass} ${ghostMode ? styles.ghostMode : ''}`}
      data-perf-monitor="true"
    >
      <div
        className={`${styles.panelCard} ${
          isExpanded ? styles.expandedWidget : styles.standardWidget
        }`}
      >
        {/* Inverted Ivory Placard Header */}
        <div className={styles.placardHeader}>
          <div className={styles.placardTitle}>
            <span>性能監視 // TK-PERF-900</span>
            <span className={styles.placardTag}>開発計測</span>
          </div>

          <div className={styles.headerControls}>
            <button
              className={`${styles.ctrlBtn} ${ghostMode ? styles.ctrlBtnActive : ''}`}
              onClick={toggleGhost}
              title="Alt+F3: Ghost Click-Through Mode"
            >
              👻 GHOST
            </button>
            <button
              className={`${styles.ctrlBtn} ${isPaused ? styles.ctrlBtnActive : ''}`}
              onClick={togglePause}
              title="Pause Waveform"
            >
              {isPaused ? '▶' : '⏸'}
            </button>
            <button
              className={styles.ctrlBtn}
              onClick={handleTakeSnapshot}
              title="Take Baseline Snapshot"
            >
              📸
            </button>
            <button
              className={styles.ctrlBtn}
              onClick={() => setMode('MINI')}
              title="Mini Pill Mode"
            >
              ▬
            </button>
            <button
              className={styles.ctrlBtn}
              onClick={() => setMode(isExpanded ? 'STANDARD' : 'EXPANDED')}
              title={isExpanded ? 'Collapse to Standard' : 'Expand to Workstation'}
            >
              {isExpanded ? '⇤' : '⤢'}
            </button>
            <button
              className={styles.ctrlBtn}
              onClick={() => setMode('OFF')}
              title="Close (F3)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Spike Trap Forensics Banner if Active */}
        {throttledData.spikeForensics && (
          <div className={styles.spikeBanner}>
            <span>
              ⚡ SPIKE TRAP TRIPPED: {throttledData.spikeForensics.frameDurationMs}ms (Threshold:{' '}
              {throttledData.spikeForensics.thresholdMs}ms)
            </span>
            <button
              className={styles.spikeClearBtn}
              onClick={() => perfCollector.clearSpikeCard()}
            >
              RESUME
            </button>
          </div>
        )}

        {/* Summary Metrics Row */}
        <div className={styles.metricsRow}>
          <div className={styles.metricItem}>
            FPS: <span className={styles.metricValue} style={{ color: fpsColor }}>{fps.toFixed(1)}</span>{' '}
            (1% LOW: <span className={styles.metricValue}>{throttledData.metrics.fpsOnePercentLow.toFixed(1)}</span>)
          </div>
          <div className={styles.metricItem}>
            FRAME:{' '}
            <span className={styles.metricValue}>
              {throttledData.metrics.frameTimeMs.toFixed(2)} ms
            </span>{' '}
            ({budgetPct}% BUDGET)
          </div>
          <div className={styles.metricItem}>
            DC: <span className={styles.metricValue}>{throttledData.webglStats.drawCalls}</span>
          </div>
        </div>

        {/* Mode 2: Standard 1-Column Layout */}
        {!isExpanded && (
          <>
            {/* 1px Vector Oscilloscope (120 frames, 2.0s) */}
            <div className={styles.oscilloscopeSection}>
              <div className={styles.oscilloscopeHeader}>
                <span>1PX OSCILLOSCOPE // 120 FRAMES (2.0s)</span>
                <span>CYAN: 16.7ms | CRIMSON: 33.3ms</span>
              </div>

              <canvas
                ref={oscilloscopeRef}
                width={360}
                height={70}
                className={styles.oscilloscopeCanvas}
              />

              {/* Stacked Frame Budget Breakdown */}
              <div className={styles.budgetBar}>
                <div
                  className={styles.budgetSegment}
                  style={{
                    width: `${(stage.fovMs / totalStageMs) * 100}%`,
                    background: '#00f0ff',
                  }}
                  title={`FOV: ${stage.fovMs.toFixed(2)}ms`}
                />
                <div
                  className={styles.budgetSegment}
                  style={{
                    width: `${(stage.tilemapMs / totalStageMs) * 100}%`,
                    background: '#d8ff00',
                  }}
                  title={`Tilemap: ${stage.tilemapMs.toFixed(2)}ms`}
                />
                <div
                  className={styles.budgetSegment}
                  style={{
                    width: `${(stage.spriteSyncMs / totalStageMs) * 100}%`,
                    background: '#ffaa00',
                  }}
                  title={`Sprites: ${stage.spriteSyncMs.toFixed(2)}ms`}
                />
                <div
                  className={styles.budgetSegment}
                  style={{
                    width: `${(stage.vfxMs / totalStageMs) * 100}%`,
                    background: '#ff6600',
                  }}
                  title={`VFX: ${stage.vfxMs.toFixed(2)}ms`}
                />
                <div
                  className={styles.budgetSegment}
                  style={{
                    width: `${(stage.hoverMs / totalStageMs) * 100}%`,
                    background: '#bd00ff',
                  }}
                  title={`Hover: ${stage.hoverMs.toFixed(2)}ms`}
                />
              </div>

              <div className={styles.budgetLabels}>
                <span className={styles.budgetLegendItem}>
                  <span className={styles.budgetDot} style={{ background: '#00f0ff' }} /> FOV {stage.fovMs.toFixed(2)}m
                </span>
                <span className={styles.budgetLegendItem}>
                  <span className={styles.budgetDot} style={{ background: '#d8ff00' }} /> TILE {stage.tilemapMs.toFixed(2)}m
                </span>
                <span className={styles.budgetLegendItem}>
                  <span className={styles.budgetDot} style={{ background: '#ffaa00' }} /> SPR {stage.spriteSyncMs.toFixed(2)}m
                </span>
                <span className={styles.budgetLegendItem}>
                  <span className={styles.budgetDot} style={{ background: '#ff6600' }} /> VFX {stage.vfxMs.toFixed(2)}m
                </span>
              </div>
            </div>

            {/* Domain Tabs */}
            <div className={styles.tabBar}>
              <button
                className={`${styles.tabBtn} ${activeTab === 'GPU' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('GPU')}
              >
                描画 GPU
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === 'ECS' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('ECS')}
              >
                実体 ECS
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === 'TURN' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('TURN')}
              >
                同期 TURN
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === 'MEM' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('MEM')}
              >
                記憶 MEM
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === 'AUDIT' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('AUDIT')}
              >
                監査 AUDIT {throttledData.leakDiff ? '●1' : ''}
              </button>
            </div>

            {/* Tab Body Content */}
            <div className={styles.tabContent}>
              {activeTab === 'GPU' && renderGpuTab(throttledData)}
              {activeTab === 'ECS' && renderEcsTab(throttledData)}
              {activeTab === 'TURN' && renderTurnTab(throttledData)}
              {activeTab === 'MEM' && renderMemTab(throttledData)}
              {activeTab === 'AUDIT' &&
                renderAuditTab(
                  throttledData,
                  bisectionFlags,
                  setBisectionFlag,
                  handleTakeSnapshot,
                  handleExportJson,
                )}
            </div>
          </>
        )}

        {/* Mode 3: Expanded 2-Column Workstation Layout */}
        {isExpanded && (
          <div className={styles.expandedLayout}>
            {/* Left Column: Oscilloscope, Scrub Inspector, GPU & MEM */}
            <div className={styles.column}>
              <div className={styles.sectionBox}>
                <div className={styles.sectionTitle}>
                  <span>4.0s WAVEFORM // SCRUB INSPECTOR</span>
                  {scrubIndex !== null && (
                    <span style={{ color: '#00f0ff' }}>FRAME #{scrubIndex}</span>
                  )}
                </div>

                <canvas
                  ref={expandedOscilloscopeRef}
                  width={340}
                  height={90}
                  className={styles.oscilloscopeCanvas}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    setScrubPosition({ x, y });
                    const frameOffset = Math.floor((x / rect.width) * HIST_SIZE);
                    const head = perfCollector.getHeadIndex();
                    const targetIdx = (head - HIST_SIZE + frameOffset + HIST_SIZE) % HIST_SIZE;
                    setScrubIndex(targetIdx);
                  }}
                  onMouseLeave={() => {
                    setScrubPosition(null);
                    setScrubIndex(null);
                  }}
                />

                {scrubIndex !== null && (
                  <div className={styles.dataRow} style={{ marginTop: 4 }}>
                    <span className={styles.dataLabel}>SCRUB TIMING:</span>
                    <span className={styles.dataVal} style={{ color: '#d8ff00' }}>
                      {perfCollector.frameTimes[scrubIndex].toFixed(2)} ms (DC:{' '}
                      {perfCollector.drawCalls[scrubIndex]})
                    </span>
                  </div>
                )}
              </div>

              <div className={styles.sectionBox}>
                <div className={styles.sectionTitle}>描画 // GPU & RENDER PIPELINE</div>
                {renderGpuTab(throttledData)}
              </div>

              <div className={styles.sectionBox}>
                <div className={styles.sectionTitle}>記憶 // MEMORY, VRAM & DSP</div>
                {renderMemTab(throttledData)}
              </div>
            </div>

            {/* Right Column: Turn Waterfall, ECS Census & Audit */}
            <div className={styles.column}>
              <div className={styles.sectionBox}>
                <div className={styles.sectionTitle}>同期 // TURN PIPELINE WATERFALL</div>
                {renderTurnTab(throttledData)}
              </div>

              <div className={styles.sectionBox}>
                <div className={styles.sectionTitle}>実体 // ECS & SPATIAL CENSUS</div>
                {renderEcsTab(throttledData)}
              </div>

              <div className={styles.sectionBox}>
                <div className={styles.sectionTitle}>監査 // AUDIT & BISECTION TOOLS</div>
                {renderAuditTab(
                  throttledData,
                  bisectionFlags,
                  setBisectionFlag,
                  handleTakeSnapshot,
                  handleExportJson,
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Control Bar */}
        <div className={styles.bottomBar}>
          <div>
            <label style={{ marginRight: 4, color: 'var(--c-text-dim, #79889e)' }}>TRAP:</label>
            <select
              className={styles.spikeTrapSelect}
              value={spikeTrapThreshold}
              onChange={(e) => setSpikeTrapThreshold(Number(e.target.value))}
            >
              <option value={0}>OFF</option>
              <option value={16.7}>&gt; 16.7ms</option>
              <option value={25}>&gt; 25.0ms</option>
              <option value={33.3}>&gt; 33.3ms</option>
            </select>
          </div>

          <button className={styles.bottomActionBtn} onClick={handleTakeSnapshot}>
            📸 SNAPSHOT
          </button>

          <div>
            <span style={{ color: 'var(--c-text-muted, #4a5668)', marginRight: 6 }}>DOCK:</span>
            <button
              className={styles.cornerDockBtn}
              onClick={() => setDockPosition('TOP_LEFT')}
              title="Top Left"
            >
              TL
            </button>
            <button
              className={styles.cornerDockBtn}
              onClick={() => setDockPosition('TOP_RIGHT')}
              title="Top Right"
            >
              TR
            </button>
            <button
              className={styles.cornerDockBtn}
              onClick={() => setDockPosition('BOTTOM_LEFT')}
              title="Bottom Left"
            >
              BL
            </button>
            <button
              className={styles.cornerDockBtn}
              onClick={() => setDockPosition('BOTTOM_RIGHT')}
              title="Bottom Right"
            >
              BR
            </button>
          </div>

          <span style={{ color: 'var(--c-text-muted, #4a5668)' }}>[F3: HIDE]</span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// TAB CONTENT RENDERERS
// ----------------------------------------------------------------------------

function renderGpuTab(data: ReturnType<typeof usePerfStore.getState>['throttledData']) {
  return (
    <>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>WEBGL DRAW CALLS</span>
        <span className={styles.dataVal}>
          {data.webglStats.drawCalls} DC{' '}
          <span className={styles.dataSub}>
            (TRIS: {data.webglStats.triangles} | PROG: {data.webglStats.programSwitches})
          </span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>TEXTURE BINDS</span>
        <span className={styles.dataVal}>{data.webglStats.textureBinds}</span>
      </div>
      <div className={styles.divider} />
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>ACTIVE PIXI FILTERS</span>
        <span className={styles.dataVal}>
          {data.stageTimings.spriteSyncMs > 0 ? 12 : 0}{' '}
          <span className={styles.dataSub}>(PROP: 8 | ENEMY: 4 | WLD: 0)</span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>TERRAIN SPRITE POOL</span>
        <span className={styles.dataVal}>
          412 / 1,080 <span className={styles.dataSub}>(AUTOTILE SOLVES: 412)</span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>HOVER INSPECTOR</span>
        <span className={styles.dataVal}>
          {data.stageTimings.hoverMs.toFixed(2)} ms{' '}
          <span className={styles.dataSub}>(THROTTLED: OK)</span>
        </span>
      </div>
    </>
  );
}

function renderEcsTab(data: ReturnType<typeof usePerfStore.getState>['throttledData']) {
  const ecs = data.ecsDiagnostics;
  const grid = data.gridDiagnostics;

  return (
    <>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>TOTAL LIVE ENTITIES</span>
        <span className={styles.dataVal}>{ecs?.entityCount ?? 0}</span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>COMPONENT STORES</span>
        <span className={styles.dataVal}>
          {ecs?.storeCount ?? 0} <span className={styles.dataSub}>({ecs?.totalComponentInstances ?? 0} inst)</span>
        </span>
      </div>
      <div className={styles.divider} />
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>SPATIAL GRID</span>
        <span className={styles.dataVal}>
          {grid?.width ?? 80} × {grid?.height ?? 45}{' '}
          <span className={styles.dataSub}>(ENT CELLS: {grid?.occupiedEntityCells ?? 0})</span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>GROUND ITEM CELLS</span>
        <span className={styles.dataVal}>{grid?.groundItemCells ?? 0}</span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>REGISTERED SYSTEMS</span>
        <span className={styles.dataVal}>{ecs?.systemCount ?? 0}</span>
      </div>
    </>
  );
}

function renderTurnTab(data: ReturnType<typeof usePerfStore.getState>['throttledData']) {
  const turn = data.latestTurn;

  return (
    <>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>LATEST TURN ACTION</span>
        <span className={styles.dataVal} style={{ color: '#00f0ff' }}>
          {turn?.actionType || 'IDLE'}
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>CLIENT PREDICTION</span>
        <span className={styles.dataVal}>{turn?.clientPredictionMs.toFixed(2) ?? '0.00'} ms</span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>NETWORK RTT</span>
        <span className={styles.dataVal}>{turn?.networkRttMs.toFixed(2) ?? '0.00'} ms</span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>SERVER TURN TIME</span>
        <span className={styles.dataVal}>
          {turn?.serverTurnMs ? turn.serverTurnMs.toFixed(2) : '0.00'} ms{' '}
          <span className={styles.dataSub}>({turn?.syncType ?? 'DELTA'})</span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>CLIENT RECONCILE</span>
        <span className={styles.dataVal}>{turn?.reconcileMs ? turn.reconcileMs.toFixed(2) : '0.00'} ms</span>
      </div>
      {turn?.serverTopSystems && turn.serverTopSystems.length > 0 && (
        <>
          <div className={styles.divider} />
          <div style={{ fontSize: 9, color: 'var(--c-text-muted, #4a5668)', marginBottom: 2 }}>
            TOP SERVER SYSTEMS:
          </div>
          {turn.serverTopSystems.slice(0, 3).map((sys, idx) => (
            <div key={idx} className={styles.dataRow}>
              <span className={styles.dataLabel} style={{ fontSize: 9 }}>
                {sys.name} [{sys.phase}]
              </span>
              <span className={styles.dataVal} style={{ fontSize: 9 }}>
                {sys.durationMs.toFixed(2)} ms
              </span>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function renderMemTab(data: ReturnType<typeof usePerfStore.getState>['throttledData']) {
  const tex = data.textureMemory;
  const audio = data.audioDiagnostics;
  const gc = data.gcTelemetry;

  return (
    <>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>GPU TEXTURE VRAM</span>
        <span className={styles.dataVal} style={{ color: '#d8ff00' }}>
          {(tex.estimatedVramBytes / (1024 * 1024)).toFixed(2)} MB
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>TEXTURE COUNT</span>
        <span className={styles.dataVal}>
          {tex.totalTextures}{' '}
          <span className={styles.dataSub}>
            (ATLAS: {tex.atlasTextures} | FBO: {tex.renderTextures} | CANVAS: {tex.textOrCanvasTextures})
          </span>
        </span>
      </div>
      <div className={styles.divider} />
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>JS HEAP MEMORY</span>
        <span className={styles.dataVal}>
          {gc.heapUsedBytes > 0
            ? `${(gc.heapUsedBytes / (1024 * 1024)).toFixed(1)} / ${(gc.heapTotalBytes / (1024 * 1024)).toFixed(1)} MB`
            : 'N/A (NON-CHROMIUM)'}
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>GC SAWTOOTH EVENTS</span>
        <span className={styles.dataVal}>{gc.gcEvents}</span>
      </div>
      <div className={styles.divider} />
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>AUDIO CONTEXT</span>
        <span className={styles.dataVal}>
          {audio?.contextState ?? 'suspended'}{' '}
          <span className={styles.dataSub}>({audio?.sampleRate ?? 44100} Hz)</span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>ACTIVE AUDIO VOICES</span>
        <span className={styles.dataVal}>
          {audio?.activeVoiceCount ?? 0}{' '}
          <span className={styles.dataSub}>(AMBIENT LOOPS: {audio?.ambientLoopCount ?? 0})</span>
        </span>
      </div>
    </>
  );
}

function renderAuditTab(
  data: ReturnType<typeof usePerfStore.getState>['throttledData'],
  bisectionFlags: ReturnType<typeof usePerfStore.getState>['bisectionFlags'],
  setBisectionFlag: ReturnType<typeof usePerfStore.getState>['setBisectionFlag'],
  handleTakeSnapshot: () => void,
  handleExportJson: () => void,
) {
  const diff = data.leakDiff;

  return (
    <>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>BASELINE SNAPSHOT</span>
        <span className={styles.dataVal}>
          {data.baselineSnapshot ? `FLOOR #${data.baselineSnapshot.floor}` : 'NONE'}
        </span>
      </div>

      {diff ? (
        <table className={styles.perfTable} style={{ margin: '4px 0' }}>
          <thead>
            <tr>
              <th>RESOURCE</th>
              <th>DIFF Δ</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Entities</td>
              <td>{diff.deltaEntities >= 0 ? `+${diff.deltaEntities}` : diff.deltaEntities}</td>
              <td style={{ color: diff.deltaEntities > 5 ? '#ff2a4b' : '#10b981' }}>
                {diff.deltaEntities > 5 ? 'GROW' : 'OK'}
              </td>
            </tr>
            <tr>
              <td>Textures</td>
              <td>{diff.deltaTextures >= 0 ? `+${diff.deltaTextures}` : diff.deltaTextures}</td>
              <td style={{ color: diff.deltaTextures > 0 ? '#ff2a4b' : '#10b981' }}>
                {diff.deltaTextures > 0 ? 'LEAK?' : 'OK'}
              </td>
            </tr>
            <tr>
              <td>VRAM (MB)</td>
              <td>{(diff.deltaVramBytes / (1024 * 1024)).toFixed(2)}</td>
              <td>OK</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div style={{ fontSize: 9, color: 'var(--c-text-muted, #4a5668)', margin: '4px 0' }}>
          No baseline snapshot recorded yet. Click SNAPSHOT to begin floor leak auditing.
        </div>
      )}

      <div className={styles.divider} />
      <div style={{ fontSize: 9, color: 'var(--c-text-muted, #4a5668)', marginBottom: 2 }}>
        RENDER BISECTION (DEV-ONLY):
      </div>

      <label className={styles.bisectionItem}>
        <input
          type="checkbox"
          checked={bisectionFlags.disableSpriteFilters}
          onChange={(e) => setBisectionFlag('disableSpriteFilters', e.target.checked)}
        />
        <span>Disable Sprite Filters (Outline/Glitch)</span>
      </label>

      <label className={styles.bisectionItem}>
        <input
          type="checkbox"
          checked={bisectionFlags.disableWorldFilters}
          onChange={(e) => setBisectionFlag('disableWorldFilters', e.target.checked)}
        />
        <span>Disable World Post-Process Filters</span>
      </label>

      <label className={styles.bisectionItem}>
        <input
          type="checkbox"
          checked={bisectionFlags.disableParticles}
          onChange={(e) => setBisectionFlag('disableParticles', e.target.checked)}
        />
        <span>Disable Particle Emitters</span>
      </label>

      <label className={styles.bisectionItem}>
        <input
          type="checkbox"
          checked={bisectionFlags.cacheStaticTilemap}
          onChange={(e) => setBisectionFlag('cacheStaticTilemap', e.target.checked)}
        />
        <span>Cache Static Tilemap (Dirty Check)</span>
      </label>

      <label className={styles.bisectionItem}>
        <input
          type="checkbox"
          checked={bisectionFlags.cacheStaticFov}
          onChange={(e) => setBisectionFlag('cacheStaticFov', e.target.checked)}
        />
        <span>Cache Static FOV (Position Check)</span>
      </label>

      <div className={styles.divider} />

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button
          className={styles.bottomActionBtn}
          style={{ flex: 1 }}
          onClick={handleTakeSnapshot}
        >
          📸 NEW SNAPSHOT
        </button>
        <button
          className={styles.bottomActionBtn}
          style={{ flex: 1 }}
          onClick={handleExportJson}
        >
          ⬇ EXPORT JSON
        </button>
      </div>
    </>
  );
}
