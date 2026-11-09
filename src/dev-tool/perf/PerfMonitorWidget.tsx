import React, { useEffect, useRef, useState, useTransition } from 'react';
import { usePerfStore, PerfDockPosition } from './perf-store';
import { perfCollector, HIST_SIZE } from './perf-collector';
import { WebGLProbe, WebGLFrameStats } from './webgl-probe';
import { GameContext } from '@/game/types';
import { createRenderSystem, DevRenderBisectionFlags } from '@/rendering/render-system';
import { getAudioEngine } from '@engine/audio';
import { AmbientEmitter } from '@shared/components';
import { PERF_TOOLTIPS, getPerfTooltipAttrs, PerfTooltipId, PerfTooltipEntry } from './perf-tooltips';
import styles from './PerfMonitorWidget.module.css';

export interface PerfMonitorWidgetProps {
  context?: GameContext | null;
  renderSystem?: ReturnType<typeof createRenderSystem> | null;
  probe?: WebGLProbe | null;
}

interface ScrubInspectData {
  frameIndex: number;
  frameTime: number;
  cpuTime: number;
  fov: number;
  tilemap: number;
  sprite: number;
  vfx: number;
  hover: number;
  webgl: number;
  drawCalls: number;
  timeAgo: string;
  isSpike: boolean;
  clientX: number;
  clientY: number;
}

export function PerfMonitorWidget({
  context: propsContext,
  renderSystem: propsRenderSystem,
  probe: propsProbe,
}: PerfMonitorWidgetProps) {
  const context = propsContext ?? perfCollector.getContext();
  const renderSystem = propsRenderSystem ?? perfCollector.getRenderSystem();
  const probe = propsProbe ?? perfCollector.getProbe();
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

  // Expanded Scrub State & Crosshair Ref
  const scrubPosRef = useRef<{ x: number; y: number } | null>(null);
  const [scrubData, setScrubData] = useState<ScrubInspectData | null>(null);

  // Floating Cyberpunk Tooltip State
  const [activeTooltip, setActiveTooltip] = useState<{
    id: PerfTooltipId;
    x: number;
    y: number;
  } | null>(null);

  // Clear tooltip when Ghost Mode is toggled or Escape key is pressed
  useEffect(() => {
    if (ghostMode) {
      setActiveTooltip(null);
    }
  }, [ghostMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTooltip(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleContainerPointerOver = (e: React.PointerEvent<HTMLDivElement>) => {
    if (ghostMode) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-perf-tooltip]');
    if (!target) return;
    const id = target.getAttribute('data-perf-tooltip') as PerfTooltipId | null;
    if (!id || !PERF_TOOLTIPS[id]) return;

    const rect = target.getBoundingClientRect();
    const tooltipWidth = 280;
    const tooltipHeight = 90;
    const margin = 10;

    let x = rect.left;
    let y = rect.bottom + 6;

    // Flip horizontally if overflowing right edge
    if (x + tooltipWidth > window.innerWidth - margin) {
      x = Math.max(margin, window.innerWidth - tooltipWidth - margin);
    }

    // Flip vertically if overflowing bottom edge
    if (y + tooltipHeight > window.innerHeight - margin) {
      y = Math.max(margin, rect.top - tooltipHeight - 6);
    }

    setActiveTooltip({ id, x, y });
  };

  const handleContainerPointerOut = (e: React.PointerEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !related.closest('[data-perf-tooltip]')) {
      setActiveTooltip(null);
    }
  };

  const renderFloatingTooltip = () => {
    if (!activeTooltip || !PERF_TOOLTIPS[activeTooltip.id]) return null;
    const item: PerfTooltipEntry = PERF_TOOLTIPS[activeTooltip.id];
    return (
      <div
        className={styles.perfTooltip}
        style={{ left: activeTooltip.x, top: activeTooltip.y }}
        role="tooltip"
      >
        <div className={styles.perfTooltipHeader}>
          <span className={styles.perfTooltipTag}>{item.tag}</span>
          <span className={styles.perfTooltipTitle}>{item.title}</span>
        </div>
        <div className={styles.perfTooltipDesc}>{item.desc}</div>
        {item.detail && <div className={styles.perfTooltipDetail}>{item.detail}</div>}
      </div>
    );
  };

  const renderScrubHoverCard = () => {
    if (!scrubData) return null;
    return (
      <div
        className={styles.scrubHoverCard}
        style={{
          left:
            scrubData.clientX > 195
              ? scrubData.clientX - 184 - 14
              : scrubData.clientX + 14,
          top: 6,
        }}
      >
        <div className={styles.scrubCardHeader}>
          <span className={styles.scrubFrameTag}>FRAME #{scrubData.frameIndex}</span>
          <span className={styles.scrubOffset}>(-{scrubData.timeAgo}s)</span>
          <span className={scrubData.isSpike ? styles.scrubBadgeSpike : styles.scrubBadgeOk}>
            {scrubData.isSpike ? 'SPIKE >16.7ms' : '60 FPS OK'}
          </span>
        </div>
        <div className={styles.scrubRow}>
          <span style={{ color: '#d8ff00' }}>TOTAL FRAME:</span>
          <strong style={{ color: '#d8ff00' }}>{scrubData.frameTime.toFixed(2)} ms</strong>
        </div>
        <div className={styles.scrubRow}>
          <span style={{ color: '#00f0ff' }}>CPU RENDER:</span>
          <strong style={{ color: '#00f0ff' }}>{scrubData.cpuTime.toFixed(2)} ms</strong>
        </div>
        <div className={styles.scrubSubBreakdown}>
          <span>FOV: {scrubData.fov.toFixed(2)}ms</span>
          <span>TILE: {scrubData.tilemap.toFixed(2)}ms</span>
          <span>SPRITE: {scrubData.sprite.toFixed(2)}ms</span>
          <span>VFX: {scrubData.vfx.toFixed(2)}ms</span>
          <span>HOVER: {scrubData.hover.toFixed(2)}ms</span>
          <span>GL: {scrubData.webgl.toFixed(2)}ms</span>
        </div>
        <div className={styles.scrubRow}>
          <span style={{ color: '#a0b0c0' }}>WEBGL DRAWS:</span>
          <strong>{scrubData.drawCalls} DC</strong>
        </div>
      </div>
    );
  };

  // Sync Bisection Flags with RenderSystem
  useEffect(() => {
    if (renderSystem?.setDevRenderFlags) {
      if (mode === 'OFF') {
        renderSystem.setDevRenderFlags({ measureTimings: false });
      } else {
        renderSystem.setDevRenderFlags(bisectionFlags);
      }
    }
  }, [bisectionFlags, renderSystem, mode]);

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

        const collectorWebgl = perfCollector.getLatestWebglStats();
        const probeWebgl = probe?.getFrameStats ? probe.getFrameStats() : null;
        const webglStats: WebGLFrameStats = {
          drawCalls: Math.max(collectorWebgl.drawCalls, probeWebgl?.drawCalls ?? 0),
          triangles: Math.max(collectorWebgl.triangles, probeWebgl?.triangles ?? 0),
          programSwitches: Math.max(collectorWebgl.programSwitches, probeWebgl?.programSwitches ?? 0),
          textureBinds: Math.max(collectorWebgl.textureBinds, probeWebgl?.textureBinds ?? 0),
          renderPassMs: Math.max(collectorWebgl.renderPassMs ?? 0, probeWebgl?.renderPassMs ?? 0),
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
          entitySpriteCount: renderTelemetry?.sprites?.totalSprites ?? 0,
          tilemapPoolSize: renderTelemetry?.tilemap?.poolSize ?? 0,
          activeFilterCount:
            (renderTelemetry?.filters?.totalPropFilters ?? 0) +
            (renderTelemetry?.filters?.totalEnemyFilters ?? 0) +
            (renderTelemetry?.filters?.activeDamageFilters ?? 0) +
            (renderTelemetry?.filters?.worldFiltersCount ?? 0),
          managedTextureCount: textureMemory.totalTextures,
          vramBytes: textureMemory.estimatedVramBytes,
          activeAudioVoiceCount: audioDiagnostics?.activeVoiceCount ?? 0,
          jsHeapBytes: gcTelemetry.heapUsedBytes,
        };

        const leakDiff = perfCollector.computeLeakDiff(currentCensus);
        const archetypeCensus = perfCollector.getArchetypeCensus();
        const eventBusTelemetry = perfCollector.getEventBusTelemetry();

        updateThrottledSnapshot({
          metrics,
          stageTimings,
          renderTelemetry,
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
          archetypeCensus,
          eventBusTelemetry,
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
      if (mode === 'STANDARD' && oscilloscopeRef.current) {
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

          // Draw Scrub Crosshair and Sample Dots if Hovered
          if (scrubPosRef.current !== null) {
            const sx = scrubPosRef.current.x;
            ctx.strokeStyle = '#ffffff';
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, h);
            ctx.stroke();
            ctx.setLineDash([]);

            // Reticle sample dots on the lines
            const frameOffset = Math.floor((sx / w) * framesToDraw);
            const clampedOffset = Math.max(0, Math.min(framesToDraw - 1, frameOffset));
            const targetIdx = (head - framesToDraw + clampedOffset + HIST_SIZE) % HIST_SIZE;

            const t = perfCollector.frameTimes[targetIdx] || 0;
            const cpu =
              perfCollector.fovTimes[targetIdx] +
              perfCollector.tilemapTimes[targetIdx] +
              perfCollector.spriteTimes[targetIdx] +
              perfCollector.vfxTimes[targetIdx] +
              perfCollector.hoverTimes[targetIdx];

            const yFrame = Math.max(2, Math.min(h - 2, h - (t / 40.0) * h));
            const yCpu = Math.max(2, Math.min(h - 2, h - (cpu / 40.0) * h));

            // Yellow dot on Frame Time line
            ctx.fillStyle = '#d8ff00';
            ctx.beginPath();
            ctx.arc(sx, yFrame, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Cyan dot on CPU Render line
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(sx, yCpu, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 3. Expanded Mode Oscilloscope (240 frames = 4.0s)
      if (mode === 'EXPANDED' && expandedOscilloscopeRef.current) {
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

          // Draw Scrub Crosshair and Sample Dots if Hovered
          if (scrubPosRef.current !== null) {
            const sx = scrubPosRef.current.x;
            ctx.strokeStyle = '#ffffff';
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, h);
            ctx.stroke();
            ctx.setLineDash([]);

            // Reticle sample dots on the lines
            const frameOffset = Math.floor((sx / w) * HIST_SIZE);
            const clampedOffset = Math.max(0, Math.min(HIST_SIZE - 1, frameOffset));
            const targetIdx = (head - HIST_SIZE + clampedOffset + HIST_SIZE) % HIST_SIZE;

            const t = perfCollector.frameTimes[targetIdx] || 0;
            const cpu =
              perfCollector.fovTimes[targetIdx] +
              perfCollector.tilemapTimes[targetIdx] +
              perfCollector.spriteTimes[targetIdx] +
              perfCollector.vfxTimes[targetIdx] +
              perfCollector.hoverTimes[targetIdx];

            const yFrame = Math.max(2, Math.min(h - 2, h - (t / 40.0) * h));
            const yCpu = Math.max(2, Math.min(h - 2, h - (cpu / 40.0) * h));

            // Yellow dot on Frame Time line
            ctx.fillStyle = '#d8ff00';
            ctx.beginPath();
            ctx.arc(sx, yFrame, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Cyan dot on CPU Render line
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(sx, yCpu, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      animId = requestAnimationFrame(renderWaveforms);
    };

    animId = requestAnimationFrame(renderWaveforms);
    return () => cancelAnimationFrame(animId);
  }, [mode, isPaused]);

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
  const webglPassMs = throttledData.webglStats.renderPassMs ?? 0;
  const totalStageMs = Math.max(
    0.01,
    stage.fovMs + stage.tilemapMs + stage.spriteSyncMs + stage.vfxMs + stage.hoverMs + webglPassMs,
  );

  const budgetPct = Math.min(100, Math.round((throttledData.metrics.frameTimeMs / 16.67) * 100));

  // Handler: Take Baseline Snapshot
  const handleTakeSnapshot = () => {
    const snap = perfCollector.captureCurrentSnapshot();
    perfCollector.takeBaselineSnapshot(snap);
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
  // Magnetic Corner Drag Handlers
  // --------------------------------------------------------------------------
  const dragStartRef = useRef<{ startX: number; startY: number } | null>(null);
  const isDraggingRef = useRef(false);

  const handleDragPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button') || target?.closest('input') || target?.closest('select')) {
      return;
    }
    dragStartRef.current = { startX: e.clientX, startY: e.clientY };
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleDragPointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = Math.abs(e.clientX - dragStartRef.current.startX);
    const dy = Math.abs(e.clientY - dragStartRef.current.startY);
    if (dx > 5 || dy > 5) {
      isDraggingRef.current = true;
    }
  };

  const handleDragPointerUp = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const wasDragging = isDraggingRef.current;
    dragStartRef.current = null;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    if (wasDragging) {
      const isTop = e.clientY < window.innerHeight / 2;
      const isLeft = e.clientX < window.innerWidth / 2;
      const nextCorner: PerfDockPosition = isTop
        ? isLeft
          ? 'TOP_LEFT'
          : 'TOP_RIGHT'
        : isLeft
        ? 'BOTTOM_LEFT'
        : 'BOTTOM_RIGHT';
      setDockPosition(nextCorner);
    }
  };

  // --------------------------------------------------------------------------
  // RENDER: MODE 1 (MINI PILL)
  // --------------------------------------------------------------------------
  if (mode === 'MINI') {
    return (
      <div
        className={`${styles.widgetContainer} ${posClass} ${ghostMode ? styles.ghostMode : ''}`}
        data-perf-monitor="true"
        onPointerOver={handleContainerPointerOver}
        onPointerOut={handleContainerPointerOut}
      >
        <div
          className={`${styles.panelCard} ${styles.miniPill} ${styles.draggableHeader}`}
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
        >
          <span className={styles.miniFps} style={{ color: fpsColor }} {...getPerfTooltipAttrs('miniFps')}>
            ⚡ {fps.toFixed(0)} FPS
          </span>
          <span className={styles.miniStat} {...getPerfTooltipAttrs('miniFrameTime')}>
            <strong>{throttledData.metrics.frameTimeMs.toFixed(1)}</strong>ms
          </span>

          <canvas
            ref={miniSparklineRef}
            width={48}
            height={14}
            className={styles.miniSparkline}
            {...getPerfTooltipAttrs('miniSparkline')}
          />

          <span className={styles.miniStat} {...getPerfTooltipAttrs('miniDc')}>
            <strong>{throttledData.webglStats.drawCalls}</strong> DC
          </span>
          <span className={styles.miniStat} {...getPerfTooltipAttrs('miniEnt')}>
            <strong>{throttledData.ecsDiagnostics?.entityCount ?? 0}</strong> ENT
          </span>
          <span className={styles.miniStat} {...getPerfTooltipAttrs('miniRtt')}>
            RTT <strong>{throttledData.latestTurn?.networkRttMs.toFixed(0) ?? 0}</strong>ms
          </span>
          <span className={styles.miniStat} {...getPerfTooltipAttrs('miniVram')}>
            <strong>{(throttledData.textureMemory.estimatedVramBytes / (1024 * 1024)).toFixed(1)}</strong>MB
          </span>

          <div className={styles.miniActions}>
            <button
              className={ghostMode ? styles.ghostRestoreBtn : styles.ctrlBtn}
              onClick={toggleGhost}
              {...getPerfTooltipAttrs('btnGhost')}
            >
              👻
            </button>
            <button
              className={styles.ctrlBtn}
              onClick={() => setMode('STANDARD')}
              {...getPerfTooltipAttrs('btnStandard')}
            >
              ⤢
            </button>
            <button
              className={styles.ctrlBtn}
              onClick={() => setMode('OFF')}
              {...getPerfTooltipAttrs('btnClose')}
            >
              ✕
            </button>

            <div className={styles.miniDockGroup} {...getPerfTooltipAttrs('dockPosition')}>
              <button
                className={`${styles.miniDockBtn} ${dockPosition === 'TOP_LEFT' ? styles.miniDockBtnActive : ''}`}
                onClick={() => setDockPosition('TOP_LEFT')}
                {...getPerfTooltipAttrs('dockTopLeft')}
              >
                TL
              </button>
              <button
                className={`${styles.miniDockBtn} ${dockPosition === 'TOP_RIGHT' ? styles.miniDockBtnActive : ''}`}
                onClick={() => setDockPosition('TOP_RIGHT')}
                {...getPerfTooltipAttrs('dockTopRight')}
              >
                TR
              </button>
              <button
                className={`${styles.miniDockBtn} ${dockPosition === 'BOTTOM_LEFT' ? styles.miniDockBtnActive : ''}`}
                onClick={() => setDockPosition('BOTTOM_LEFT')}
                {...getPerfTooltipAttrs('dockBottomLeft')}
              >
                BL
              </button>
              <button
                className={`${styles.miniDockBtn} ${dockPosition === 'BOTTOM_RIGHT' ? styles.miniDockBtnActive : ''}`}
                onClick={() => setDockPosition('BOTTOM_RIGHT')}
                {...getPerfTooltipAttrs('dockBottomRight')}
              >
                BR
              </button>
            </div>
          </div>
        </div>
        {renderFloatingTooltip()}
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
      onPointerOver={handleContainerPointerOver}
      onPointerOut={handleContainerPointerOut}
    >
      <div
        className={`${styles.panelCard} ${
          isExpanded ? styles.expandedWidget : styles.standardWidget
        }`}
      >
        {/* Inverted Ivory Placard Header */}
        <div
          className={`${styles.placardHeader} ${styles.draggableHeader}`}
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
        >
          <div className={styles.placardTitle} {...getPerfTooltipAttrs('headerTitle')}>
            <span>性能監視 // TK-PERF-900</span>
            <span className={styles.placardTag} {...getPerfTooltipAttrs('headerTag')}>開発計測</span>
          </div>

          <div className={styles.headerControls}>
            <button
              className={ghostMode ? styles.ghostRestoreBtn : styles.ctrlBtn}
              onClick={toggleGhost}
              {...getPerfTooltipAttrs('btnGhost')}
            >
              {ghostMode ? '👻 RESTORE' : '👻 GHOST'}
            </button>
            <button
              className={`${styles.ctrlBtn} ${isPaused ? styles.ctrlBtnActive : ''}`}
              onClick={togglePause}
              {...getPerfTooltipAttrs('btnPause')}
            >
              {isPaused ? '▶' : '⏸'}
            </button>
            <button
              className={styles.ctrlBtn}
              onClick={handleTakeSnapshot}
              {...getPerfTooltipAttrs('btnSnapshot')}
            >
              📸
            </button>
            <button
              className={styles.ctrlBtn}
              onClick={() => setMode('MINI')}
              {...getPerfTooltipAttrs('btnMini')}
            >
              ▬
            </button>
            <button
              className={styles.ctrlBtn}
              onClick={() => setMode(isExpanded ? 'STANDARD' : 'EXPANDED')}
              {...getPerfTooltipAttrs(isExpanded ? 'btnStandard' : 'btnExpanded')}
            >
              {isExpanded ? '⇤' : '⤢'}
            </button>
            <button
              className={styles.ctrlBtn}
              onClick={() => setMode('OFF')}
              {...getPerfTooltipAttrs('btnClose')}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Ghost Mode Active Recovery Banner */}
        {ghostMode && (
          <div
            className={styles.ghostBanner}
            onClick={toggleGhost}
            aria-label="Click to restore full mouse interaction to the performance monitor"
          >
            👻 GHOST MODE ACTIVE: BODY IS CLICK-THROUGH — CLICK TO RESTORE
          </div>
        )}

        {/* Spike Trap Forensics Card if Active */}
        {throttledData.spikeForensics && (() => {
          const card = throttledData.spikeForensics;
          const stages = [
            { name: 'FOV', ms: card.stageTimings.fovMs },
            { name: 'TILEMAP', ms: card.stageTimings.tilemapMs },
            { name: 'SPRITES', ms: card.stageTimings.spriteSyncMs },
            { name: 'VFX', ms: card.stageTimings.vfxMs },
            { name: 'HOVER', ms: card.stageTimings.hoverMs },
            { name: 'WEBGL', ms: card.webglStats.renderPassMs ?? 0 },
          ];
          let culprit = stages[0];
          for (let i = 1; i < stages.length; i++) {
            if (stages[i].ms > culprit.ms) {
              culprit = stages[i];
            }
          }

          return (
            <div className={styles.spikeCard}>
              <div className={styles.spikeCardHeader}>
                <div className={styles.spikeCardTitle}>
                  <span>⚡ SPIKE TRAP TRIPPED: {card.frameDurationMs.toFixed(2)}ms</span>
                  <span style={{ fontSize: 9, color: 'var(--c-text-dim, #79889e)' }}>
                    (THRESHOLD: {card.thresholdMs}ms)
                  </span>
                  <span className={styles.spikeCulpritBadge}>
                    CULPRIT: {culprit.name} ({culprit.ms.toFixed(2)}ms)
                  </span>
                </div>
                <button
                  className={styles.spikeClearBtn}
                  onClick={() => perfCollector.clearSpikeCard()}
                  aria-label="Resume from spike trap freeze"
                >
                  RESUME
                </button>
              </div>

              {/* Sub-Stage Breakdown */}
              <div className={styles.spikeStagesGrid}>
                <span>FOV: <strong>{card.stageTimings.fovMs.toFixed(2)}ms</strong></span>
                <span>TILE: <strong>{card.stageTimings.tilemapMs.toFixed(2)}ms</strong></span>
                <span>SPR: <strong>{card.stageTimings.spriteSyncMs.toFixed(2)}ms</strong></span>
                <span>VFX: <strong>{card.stageTimings.vfxMs.toFixed(2)}ms</strong></span>
                <span>HVR: <strong>{card.stageTimings.hoverMs.toFixed(2)}ms</strong></span>
                <span>GL: <strong>{(card.webglStats.renderPassMs ?? 0).toFixed(2)}ms</strong></span>
              </div>

              {/* WebGL and Emitted Events */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9 }}>
                <span>DRAWS: <strong>{card.webglStats.drawCalls} DC</strong> | TRIS: <strong>{card.webglStats.triangles}</strong></span>
                <span style={{ color: 'var(--c-text-dim, #79889e)' }}>SW: {card.webglStats.programSwitches} | TEX: {card.webglStats.textureBinds}</span>
              </div>

              <div className={styles.spikeEventsRow}>
                <span style={{ color: 'var(--c-text-dim, #79889e)' }}>EVENTS IN FRAME:</span>
                {card.recentEvents.length > 0 ? (
                  card.recentEvents.map((evt, idx) => (
                    <span key={idx} className={styles.spikeEventChip}>{evt}</span>
                  ))
                ) : (
                  <span style={{ color: 'var(--c-text-muted, #4a5668)', fontStyle: 'italic' }}>None</span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Summary Metrics Row */}
        <div className={styles.metricsRow}>
          <div className={styles.metricItem} {...getPerfTooltipAttrs('metricFps')}>
            FPS: <span className={styles.metricValue} style={{ color: fpsColor }}>{fps.toFixed(1)}</span>{' '}
            <span {...getPerfTooltipAttrs('metricFpsLow')}>
              (AVG: <span className={styles.metricValue}>{throttledData.metrics.fpsAvg.toFixed(1)}</span> | 1% LOW:{' '}
              <span className={styles.metricValue}>{throttledData.metrics.fpsOnePercentLow.toFixed(1)}</span>)
            </span>
          </div>
          <div className={styles.metricItem} {...getPerfTooltipAttrs('metricFrameTime')}>
            FRAME:{' '}
            <span className={styles.metricValue}>
              {throttledData.metrics.frameTimeMs.toFixed(2)} ms
            </span>{' '}
            <span {...getPerfTooltipAttrs('metricBudget')}>
              (σ: <span className={styles.metricValue}>{throttledData.metrics.frameTimeJitter.toFixed(2)}ms</span> | {budgetPct}% BUDGET)
            </span>
          </div>
          <div className={styles.metricItem} {...getPerfTooltipAttrs('metricDrawCalls')}>
            DC: <span className={styles.metricValue}>{throttledData.webglStats.drawCalls}</span>
          </div>
        </div>

        {/* Mode 2: Standard 1-Column Layout */}
        {!isExpanded && (
          <>
            {/* 1px Vector Oscilloscope (120 frames, 2.0s) */}
            <div className={styles.oscilloscopeSection}>
              <div className={styles.oscilloscopeHeader} {...getPerfTooltipAttrs('oscilloscopeCanvas')}>
                <span>1PX OSCILLOSCOPE // 120 FRAMES (2.0s)</span>
                <span>CYAN: 16.7ms | CRIMSON: 33.3ms</span>
              </div>

              <div className={styles.scrubCanvasContainer}>
                <canvas
                  ref={oscilloscopeRef}
                  width={360}
                  height={70}
                  className={styles.oscilloscopeCanvas}
                  onClick={() => togglePause()}
                  aria-label="Standard 2.0s oscilloscope waveform canvas. Click to pause or resume playback."
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const rawX = e.clientX - rect.left;
                    const rawY = e.clientY - rect.top;
                    const scaleX = 360 / (rect.width || 360);
                    const canvasX = Math.max(0, Math.min(360, rawX * scaleX));
                    scrubPosRef.current = { x: canvasX, y: rawY };

                    const frameOffset = Math.floor((canvasX / 360) * 120);
                    const clampedOffset = Math.max(0, Math.min(119, frameOffset));
                    const head = perfCollector.getHeadIndex();
                    const targetIdx = (head - 120 + clampedOffset + HIST_SIZE) % HIST_SIZE;

                    const frameTime = perfCollector.frameTimes[targetIdx] || 0;
                    const fov = perfCollector.fovTimes[targetIdx] || 0;
                    const tilemap = perfCollector.tilemapTimes[targetIdx] || 0;
                    const sprite = perfCollector.spriteTimes[targetIdx] || 0;
                    const vfx = perfCollector.vfxTimes[targetIdx] || 0;
                    const hover = perfCollector.hoverTimes[targetIdx] || 0;
                    const webgl = perfCollector.webglTimes[targetIdx] || 0;
                    const cpuTime = fov + tilemap + sprite + vfx + hover;
                    const drawCalls = perfCollector.drawCalls[targetIdx] || 0;
                    const framesAgo = 120 - 1 - clampedOffset;
                    const timeAgo = ((framesAgo * (1000 / 60)) / 1000).toFixed(2);

                    setScrubData({
                      frameIndex: targetIdx,
                      frameTime,
                      cpuTime,
                      fov,
                      tilemap,
                      sprite,
                      vfx,
                      hover,
                      webgl,
                      drawCalls,
                      timeAgo,
                      isSpike: frameTime > 16.67,
                      clientX: rawX,
                      clientY: rawY,
                    });
                  }}
                  onMouseLeave={() => {
                    scrubPosRef.current = null;
                    setScrubData(null);
                  }}
                  {...getPerfTooltipAttrs('oscilloscopeCanvas')}
                />
                {renderScrubHoverCard()}
              </div>

              {/* Stacked Frame Budget Breakdown */}
              <div className={styles.budgetBar} {...getPerfTooltipAttrs('budgetBar')}>
                <div
                  className={styles.budgetSegment}
                  style={{
                    width: `${(stage.fovMs / totalStageMs) * 100}%`,
                    background: '#00f0ff',
                  }}
                  {...getPerfTooltipAttrs('stageFov')}
                />
                <div
                  className={styles.budgetSegment}
                  style={{
                    width: `${(stage.tilemapMs / totalStageMs) * 100}%`,
                    background: '#d8ff00',
                  }}
                  {...getPerfTooltipAttrs('stageTilemap')}
                />
                <div
                  className={styles.budgetSegment}
                  style={{
                    width: `${(stage.spriteSyncMs / totalStageMs) * 100}%`,
                    background: '#ffaa00',
                  }}
                  {...getPerfTooltipAttrs('stageSpriteSync')}
                />
                <div
                  className={styles.budgetSegment}
                  style={{
                    width: `${(stage.vfxMs / totalStageMs) * 100}%`,
                    background: '#ff6600',
                  }}
                  {...getPerfTooltipAttrs('stageVfx')}
                />
                <div
                  className={styles.budgetSegment}
                  style={{
                    width: `${(stage.hoverMs / totalStageMs) * 100}%`,
                    background: '#bd00ff',
                  }}
                  {...getPerfTooltipAttrs('stageHover')}
                />
                <div
                  className={styles.budgetSegment}
                  style={{
                    width: `${(webglPassMs / totalStageMs) * 100}%`,
                    background: '#00ff66',
                  }}
                  {...getPerfTooltipAttrs('stageGl')}
                />
              </div>

              <div className={styles.budgetLabels}>
                <span className={styles.budgetLegendItem} {...getPerfTooltipAttrs('stageFov')}>
                  <span className={styles.budgetDot} style={{ background: '#00f0ff' }} /> FOV {stage.fovMs.toFixed(2)}m
                </span>
                <span className={styles.budgetLegendItem} {...getPerfTooltipAttrs('stageTilemap')}>
                  <span className={styles.budgetDot} style={{ background: '#d8ff00' }} /> TILE {stage.tilemapMs.toFixed(2)}m
                </span>
                <span className={styles.budgetLegendItem} {...getPerfTooltipAttrs('stageSpriteSync')}>
                  <span className={styles.budgetDot} style={{ background: '#ffaa00' }} /> SPR {stage.spriteSyncMs.toFixed(2)}m
                </span>
                <span className={styles.budgetLegendItem} {...getPerfTooltipAttrs('stageVfx')}>
                  <span className={styles.budgetDot} style={{ background: '#ff6600' }} /> VFX {stage.vfxMs.toFixed(2)}m
                </span>
                <span className={styles.budgetLegendItem} {...getPerfTooltipAttrs('stageHover')}>
                  <span className={styles.budgetDot} style={{ background: '#bd00ff' }} /> HVR {stage.hoverMs.toFixed(2)}m
                </span>
                <span className={styles.budgetLegendItem} {...getPerfTooltipAttrs('stageGl')}>
                  <span className={styles.budgetDot} style={{ background: '#00ff66' }} /> GL {webglPassMs.toFixed(2)}m
                </span>
              </div>
            </div>

            {/* Domain Tabs */}
            <div className={styles.tabBar}>
              <button
                className={`${styles.tabBtn} ${activeTab === 'GPU' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('GPU')}
                {...getPerfTooltipAttrs('tabGpu')}
              >
                描画 GPU
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === 'ECS' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('ECS')}
                {...getPerfTooltipAttrs('tabEcs')}
              >
                実体 ECS
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === 'TURN' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('TURN')}
                {...getPerfTooltipAttrs('tabTurn')}
              >
                同期 TURN
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === 'MEM' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('MEM')}
                {...getPerfTooltipAttrs('tabMem')}
              >
                記憶 MEM
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === 'AUDIT' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('AUDIT')}
                {...getPerfTooltipAttrs('tabAudit')}
              >
                監査 AUDIT {throttledData.leakDiff ? '●1' : ''}
              </button>
            </div>

            {/* Tab Body Content */}
            <div className={styles.tabContent}>
              {activeTab === 'GPU' && renderGpuTab(throttledData, bisectionFlags)}
              {activeTab === 'ECS' && renderEcsTab(throttledData)}
              {activeTab === 'TURN' && renderTurnTab(throttledData, context)}
              {activeTab === 'MEM' && renderMemTab(throttledData, context)}
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
              <div className={styles.sectionBox} style={{ position: 'relative' }}>
                <div className={styles.sectionTitle} {...getPerfTooltipAttrs('scrubInspector')}>
                  <span>4.0s WAVEFORM // SCRUB INSPECTOR</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {isPaused && (
                      <span style={{ color: '#ff2a4b', fontSize: 9, fontWeight: 700 }}>[PAUSED]</span>
                    )}
                    {scrubData !== null && (
                      <span style={{ color: '#00f0ff', fontSize: 9 }}>FRAME #{scrubData.frameIndex}</span>
                    )}
                  </div>
                </div>

                {/* Waveform Legend Chips */}
                <div className={styles.waveformLegend}>
                  <span className={styles.legendChip} style={{ color: '#d8ff00' }}>
                    <span className={styles.legendLine} style={{ background: '#d8ff00' }} />
                    FRAME TIME
                  </span>
                  <span className={styles.legendChip} style={{ color: '#00f0ff' }}>
                    <span className={styles.legendLine} style={{ background: '#00f0ff' }} />
                    CPU RENDER
                  </span>
                  <span className={styles.legendChip} style={{ color: 'rgba(0, 240, 255, 0.7)' }}>
                    <span className={styles.legendLineDashed} style={{ borderColor: '#00f0ff' }} />
                    16.7ms (60 FPS)
                  </span>
                  <span className={styles.legendChip} style={{ color: '#ff2a4b' }}>
                    <span className={styles.legendLineDashed} style={{ borderColor: '#ff2a4b' }} />
                    33.3ms (30 FPS)
                  </span>
                </div>

                <div className={styles.scrubCanvasContainer}>
                  <canvas
                    ref={expandedOscilloscopeRef}
                    width={340}
                    height={90}
                    className={styles.oscilloscopeCanvas}
                    onClick={() => togglePause()}
                    aria-label="Expanded 4.0s oscilloscope waveform canvas. Click to pause or resume playback."
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const rawX = e.clientX - rect.left;
                      const rawY = e.clientY - rect.top;
                      const scaleX = 340 / (rect.width || 340);
                      const canvasX = Math.max(0, Math.min(340, rawX * scaleX));
                      scrubPosRef.current = { x: canvasX, y: rawY };

                      const frameOffset = Math.floor((canvasX / 340) * HIST_SIZE);
                      const clampedOffset = Math.max(0, Math.min(HIST_SIZE - 1, frameOffset));
                      const head = perfCollector.getHeadIndex();
                      const targetIdx = (head - HIST_SIZE + clampedOffset + HIST_SIZE) % HIST_SIZE;

                      const frameTime = perfCollector.frameTimes[targetIdx] || 0;
                      const fov = perfCollector.fovTimes[targetIdx] || 0;
                      const tilemap = perfCollector.tilemapTimes[targetIdx] || 0;
                      const sprite = perfCollector.spriteTimes[targetIdx] || 0;
                      const vfx = perfCollector.vfxTimes[targetIdx] || 0;
                      const hover = perfCollector.hoverTimes[targetIdx] || 0;
                      const webgl = perfCollector.webglTimes[targetIdx] || 0;
                      const cpuTime = fov + tilemap + sprite + vfx + hover;
                      const drawCalls = perfCollector.drawCalls[targetIdx] || 0;
                      const framesAgo = HIST_SIZE - 1 - clampedOffset;
                      const timeAgo = ((framesAgo * (1000 / 60)) / 1000).toFixed(2);

                      setScrubData({
                        frameIndex: targetIdx,
                        frameTime,
                        cpuTime,
                        fov,
                        tilemap,
                        sprite,
                        vfx,
                        hover,
                        webgl,
                        drawCalls,
                        timeAgo,
                        isSpike: frameTime > 16.67,
                        clientX: rawX,
                        clientY: rawY,
                      });
                    }}
                    onMouseLeave={() => {
                      scrubPosRef.current = null;
                      setScrubData(null);
                    }}
                  />

                  {/* Floating Cyberpunk Scrub Tooltip Over Waveform */}
                  {renderScrubHoverCard()}
                </div>

                {/* Persistent Dock Bar Under Waveform */}
                <div className={styles.scrubDockBar}>
                  {scrubData ? (
                    <>
                      <span style={{ color: '#00f0ff' }}>
                        FRAME #{scrubData.frameIndex} (-{scrubData.timeAgo}s)
                      </span>
                      <span>
                        FRAME: <strong style={{ color: '#d8ff00' }}>{scrubData.frameTime.toFixed(2)}ms</strong> | CPU: <strong style={{ color: '#00f0ff' }}>{scrubData.cpuTime.toFixed(2)}ms</strong> | DC: {scrubData.drawCalls}
                      </span>
                    </>
                  ) : (
                    <span className={styles.scrubDockHint}>
                      {isPaused ? '⏸ PAUSED: HOVER TO INSPECT SAMPLES • CLICK TO RESUME' : 'HOVER TO SCRUB • CLICK CANVAS TO FREEZE'}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.sectionBox}>
                <div className={styles.sectionTitle} {...getPerfTooltipAttrs('tabGpu')}>描画 // GPU & RENDER PIPELINE</div>
                {renderGpuTab(throttledData, bisectionFlags)}
              </div>

              <div className={styles.sectionBox}>
                <div className={styles.sectionTitle} {...getPerfTooltipAttrs('tabMem')}>記憶 // MEMORY, VRAM & DSP</div>
                {renderMemTab(throttledData, context)}
              </div>
            </div>

            {/* Right Column: Turn Waterfall, ECS Census & Audit */}
            <div className={styles.column}>
              <div className={styles.sectionBox}>
                <div className={styles.sectionTitle} {...getPerfTooltipAttrs('tabTurn')}>同期 // TURN PIPELINE WATERFALL</div>
                {renderTurnTab(throttledData, context)}
              </div>

              <div className={styles.sectionBox}>
                <div className={styles.sectionTitle} {...getPerfTooltipAttrs('tabEcs')}>実体 // ECS & SPATIAL CENSUS</div>
                {renderEcsTab(throttledData)}
              </div>

              <div className={styles.sectionBox}>
                <div className={styles.sectionTitle} {...getPerfTooltipAttrs('tabAudit')}>監査 // AUDIT & BISECTION TOOLS</div>
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
          <div {...getPerfTooltipAttrs('spikeTrapSelect')}>
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

          <button
            className={styles.bottomActionBtn}
            onClick={handleTakeSnapshot}
            {...getPerfTooltipAttrs('btnSnapshot')}
          >
            📸 SNAPSHOT
          </button>

          <div {...getPerfTooltipAttrs('dockPosition')}>
            <span style={{ color: 'var(--c-text-muted, #4a5668)', marginRight: 6 }}>DOCK:</span>
            <button
              className={styles.cornerDockBtn}
              onClick={() => setDockPosition('TOP_LEFT')}
              {...getPerfTooltipAttrs('dockTopLeft')}
            >
              TL
            </button>
            <button
              className={styles.cornerDockBtn}
              onClick={() => setDockPosition('TOP_RIGHT')}
              {...getPerfTooltipAttrs('dockTopRight')}
            >
              TR
            </button>
            <button
              className={styles.cornerDockBtn}
              onClick={() => setDockPosition('BOTTOM_LEFT')}
              {...getPerfTooltipAttrs('dockBottomLeft')}
            >
              BL
            </button>
            <button
              className={styles.cornerDockBtn}
              onClick={() => setDockPosition('BOTTOM_RIGHT')}
              {...getPerfTooltipAttrs('dockBottomRight')}
            >
              BR
            </button>
          </div>

          <span style={{ color: 'var(--c-text-muted, #4a5668)' }} {...getPerfTooltipAttrs('hotkeyGuide')}>
            [F3 / Alt+P: HIDE]
          </span>
        </div>
      </div>
      {renderFloatingTooltip()}
    </div>
  );
}

// ----------------------------------------------------------------------------
// TAB CONTENT RENDERERS
// ----------------------------------------------------------------------------

function renderGpuTab(
  data: ReturnType<typeof usePerfStore.getState>['throttledData'],
  bisectionFlags: ReturnType<typeof usePerfStore.getState>['bisectionFlags'],
) {
  const filters = data.renderTelemetry?.filters;
  const tilemap = data.renderTelemetry?.tilemap;
  const particles = data.renderTelemetry?.particles;
  const sprites = data.renderTelemetry?.sprites;

  const propFilterCount = bisectionFlags.disableSpriteFilters
    ? 0
    : filters?.totalPropFilters ?? 0;
  const enemyFilterCount = bisectionFlags.disableSpriteFilters
    ? 0
    : filters?.totalEnemyFilters ?? 0;
  const damageFilterCount = filters?.activeDamageFilters ?? 0;
  const worldFilterCount = bisectionFlags.disableWorldFilters
    ? 0
    : filters?.worldFiltersCount ?? 0;
  const totalFilterCount =
    propFilterCount + enemyFilterCount + damageFilterCount + worldFilterCount;

  return (
    <>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('gpuDrawCalls')}>
        <span className={styles.dataLabel}>WEBGL DRAW CALLS</span>
        <span className={styles.dataVal}>
          {data.webglStats.drawCalls} DC{' '}
          <span className={styles.dataSub}>
            (<span {...getPerfTooltipAttrs('gpuTriangles')}>TRIS: {data.webglStats.triangles}</span> |{' '}
            <span {...getPerfTooltipAttrs('gpuPrograms')}>PROG: {data.webglStats.programSwitches}</span>)
          </span>
        </span>
      </div>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('gpuTextureBinds')}>
        <span className={styles.dataLabel}>TEXTURE BINDS</span>
        <span className={styles.dataVal}>{data.webglStats.textureBinds}</span>
      </div>
      <div className={styles.divider} />
      <div className={styles.dataRow} {...getPerfTooltipAttrs('gpuPixiFilters')}>
        <span className={styles.dataLabel}>ACTIVE PIXI FILTERS</span>
        <span className={styles.dataVal}>
          {totalFilterCount}{' '}
          <span className={styles.dataSub}>
            (PROP: {propFilterCount} | ENEMY: {enemyFilterCount} | WLD: {worldFilterCount})
          </span>
        </span>
      </div>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('gpuTerrainPool')}>
        <span className={styles.dataLabel}>TERRAIN SPRITE POOL</span>
        <span className={styles.dataVal}>
          {tilemap ? `${tilemap.visibleTiles} / ${tilemap.poolSize}` : '0 / 0'}{' '}
          <span className={styles.dataSub} {...getPerfTooltipAttrs('gpuAutotileSolves')}>
            (AUTOTILE SOLVES: {tilemap?.lastAutotileSolves ?? 0})
          </span>
        </span>
      </div>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('gpuEntitySprites')}>
        <span className={styles.dataLabel}>ENTITY SPRITE MAP</span>
        <span className={styles.dataVal}>
          {sprites ? `${sprites.visibleSprites} / ${sprites.totalSprites} VISIBLE` : '0 / 0 VISIBLE'}{' '}
          <span className={styles.dataSub}>
            (TWEENS: {data.renderTelemetry?.activeAnimations ?? 0})
          </span>
        </span>
      </div>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('gpuNeonParticles')}>
        <span className={styles.dataLabel}>NEON PARTICLES & TEXT</span>
        <span className={styles.dataVal}>
          {bisectionFlags.disableParticles ? 0 : (particles?.activeEmitters ?? 0)} EMITTERS (
          {bisectionFlags.disableParticles ? 0 : (particles?.totalParticles ?? 0)} PT){' '}
          <span className={styles.dataSub}>
            (TEXTS: {bisectionFlags.disableParticles ? 0 : (data.renderTelemetry?.activeDamageTexts ?? 0)})
          </span>
        </span>
      </div>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('gpuHoverInspector')}>
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
  const census = data.archetypeCensus;
  const evtBus = data.eventBusTelemetry;
  const render = data.renderTelemetry;

  // Top 6 component stores sorted descending by instance count
  const topStores = ecs?.storeSizes
    ? Object.entries(ecs.storeSizes)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
    : [];

  return (
    <>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('ecsLiveEntities')}>
        <span className={styles.dataLabel}>TOTAL LIVE ENTITIES</span>
        <span className={styles.dataVal}>{ecs?.entityCount ?? 0}</span>
      </div>

      {/* 1. Entity Archetype Census */}
      <div className={styles.sectionHeader} style={{ marginTop: 4, marginBottom: 2, fontSize: 9, color: 'var(--c-accent-secondary, #00f0ff)' }}>
        ARCHETYPE CENSUS
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>• ACTORS</span>
        <span className={styles.dataVal}>
          PLAYER: <strong>{census?.playerCount ?? 0}</strong>{' '}
          <span className={styles.dataSub}>
            (HOSTILE: {census?.hostileCount ?? 0} | DYING: {census?.dyingCount ?? 0})
          </span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>• PROPS</span>
        <span className={styles.dataVal}>
          TOTAL: <strong>{census?.totalProps ?? 0}</strong>{' '}
          <span className={styles.dataSub}>
            (LOCK: {census?.lockedProps ?? 0} | CORRUPT: {census?.corruptedProps ?? 0} | SEARCHED: {census?.searchedProps ?? 0})
          </span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>• ITEMS & GEAR</span>
        <span className={styles.dataVal}>
          GROUND: <strong>{census?.groundItems ?? 0}</strong>{' '}
          <span className={styles.dataSub}>(CHILD/INV: {census?.childItems ?? 0})</span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>• HAZARDS</span>
        <span className={styles.dataVal}>
          DEAD ZONE: <strong>{census?.deadZones ?? 0}</strong>{' '}
          <span className={styles.dataSub}>(CORRUPTION: {census?.corruptions ?? 0})</span>
        </span>
      </div>

      {/* 2. Component Stores & Top 6 */}
      <div className={styles.divider} />
      <div className={styles.dataRow} {...getPerfTooltipAttrs('ecsComponentStores')}>
        <span className={styles.dataLabel}>COMPONENT STORES</span>
        <span className={styles.dataVal}>
          {ecs?.storeCount ?? 0} <span className={styles.dataSub}>({ecs?.totalComponentInstances ?? 0} inst)</span>
        </span>
      </div>
      {topStores.length > 0 && (
        <div className={styles.dataRow}>
          <span className={styles.dataLabel}>• TOP 6 STORES</span>
          <span className={styles.dataVal} style={{ fontSize: 9, display: 'flex', flexWrap: 'wrap', gap: '3px 6px', justifyContent: 'flex-end' }}>
            {topStores.map(([name, size]) => (
              <span key={name} style={{ background: 'rgba(28,38,56,0.6)', padding: '0 3px', borderRadius: 2 }}>
                {name}: <strong style={{ color: '#00f0ff' }}>{size}</strong>
              </span>
            ))}
          </span>
        </div>
      )}

      {/* 3. Spatial Grid & FOV Coverage */}
      <div className={styles.divider} />
      <div className={styles.dataRow} {...getPerfTooltipAttrs('ecsSpatialGrid')}>
        <span className={styles.dataLabel}>SPATIAL GRID</span>
        <span className={styles.dataVal}>
          {grid?.width ?? 80} × {grid?.height ?? 45} ({(grid?.width ?? 80) * (grid?.height ?? 45)} TILES){' '}
          <span className={styles.dataSub}>
            (ENT: {grid?.occupiedEntityCells ?? 0} | ITEM: {grid?.groundItemCells ?? 0})
          </span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>FOV COVERAGE</span>
        <span className={styles.dataVal}>
          {render?.fovTiles ?? 0} ACTIVE / {render?.exploredTiles ?? 0} EXPLORED
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>FOG MEMORY CACHE</span>
        <span className={styles.dataVal}>
          PROPS: {render?.rememberedPropsCount ?? 0} | ITEMS: {render?.rememberedItemsCount ?? 0}
        </span>
      </div>

      {/* 4. EventBus Throughput */}
      <div className={styles.divider} />
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>EVENTBUS THROUGHPUT</span>
        <span className={styles.dataVal}>
          <strong style={{ color: '#d8ff00' }}>{evtBus?.eventsPerSec ?? 0} evt/s</strong>{' '}
          <span className={styles.dataSub}>
            (TOTAL: {evtBus?.totalEmissions ?? 0} | HANDLERS: {evtBus?.handlerCount ?? 0})
          </span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>• CHURN SEPARATION</span>
        <span className={styles.dataVal}>
          60Hz FOV: <strong>{evtBus?.fovEmissions ?? 0}</strong>{' '}
          <span className={styles.dataSub}>
            (DISCRETE: <strong style={{ color: '#00f0ff' }}>{evtBus?.discreteEmissions ?? 0}</strong>)
          </span>
        </span>
      </div>

      <div className={styles.dataRow} {...getPerfTooltipAttrs('ecsRegisteredSystems')}>
        <span className={styles.dataLabel}>REGISTERED SYSTEMS</span>
        <span className={styles.dataVal}>{ecs?.systemCount ?? 0}</span>
      </div>
    </>
  );
}

function renderTurnTab(
  data: ReturnType<typeof usePerfStore.getState>['throttledData'],
  context?: GameContext | null,
) {
  const turn = data.latestTurn;

  // RTT History across turnWaterfall
  const rttHistory = data.turnWaterfall.map((t) => t.networkRttMs);
  const rttAvg =
    rttHistory.length > 0
      ? (rttHistory.reduce((a, b) => a + b, 0) / rttHistory.length).toFixed(1)
      : '0.0';
  const rttMax =
    rttHistory.length > 0 ? Math.max(...rttHistory).toFixed(1) : '0.0';

  // Session cumulative wire payload KB
  const sessionBytes = data.turnWaterfall.reduce((acc, t) => acc + (t.payloadBytes || 0), 0);
  const sessionKb = (sessionBytes / 1024).toFixed(1);
  const lastTurnKb = ((turn?.payloadBytes ?? 0) / 1024).toFixed(2);

  // Turn Waterfall Bar percentages
  const predictMs = turn?.clientPredictionMs ?? 0;
  const rttMs = turn?.networkRttMs ?? 0;
  const srvMs = turn?.serverTurnMs ?? 0;
  const recMs = turn?.reconcileMs ?? 0;
  const totalTurnMs = Math.max(0.01, predictMs + rttMs + recMs);

  const predictPct = Math.max(4, Math.round((predictMs / totalTurnMs) * 100));
  const rttPct = Math.max(4, Math.round((rttMs / totalTurnMs) * 100));
  const recPct = Math.max(4, Math.round((recMs / totalTurnMs) * 100));

  // Top 5 server systems
  const top5Systems = turn?.serverTopSystems?.slice(0, 5) ?? [];

  // Phase timings
  const phases = turn?.serverPhaseTimings ? Object.entries(turn.serverPhaseTimings) : [];

  // Input Manager queue & lock status
  const inputQueueDepth = context ? context.inputManager.getQueueLength() : 0;
  const inputPending = context ? context.inputManager.getPendingStatus() : false;

  return (
    <>
      {/* 1. End-to-End Turn Waterfall Header & Bar */}
      <div
        className={styles.sectionHeader}
        style={{ fontSize: 9, color: 'var(--c-accent-secondary, #00f0ff)', marginBottom: 3 }}
      >
        END-TO-END TURN WATERFALL (TURN #{turn?.turnNumber ? String(turn.turnNumber).padStart(4, '0') : '0000'} — {turn?.actionType || 'IDLE'})
      </div>

      <div className={styles.turnWaterfallBar}>
        <div
          className={styles.waterfallSegment}
          style={{ width: `${predictPct}%`, background: '#00f0ff' }}
          title={`Client Predict: ${predictMs.toFixed(2)}ms`}
        />
        <div
          className={styles.waterfallSegment}
          style={{ width: `${rttPct}%`, background: '#ffaa00' }}
          title={`Network RTT: ${rttMs.toFixed(2)}ms (Server Sim: ${srvMs.toFixed(2)}ms)`}
        />
        <div
          className={styles.waterfallSegment}
          style={{ width: `${recPct}%`, background: '#bd00ff' }}
          title={`Client Reconcile: ${recMs.toFixed(2)}ms`}
        />
      </div>

      <div className={styles.turnWaterfallFlow}>
        <span style={{ color: '#00f0ff' }}>[Predict: {predictMs.toFixed(1)}ms]</span>
        <span style={{ color: '#4a5668' }}> ──► </span>
        <span style={{ color: '#ffaa00' }}>[RTT: {rttMs.toFixed(1)}ms (Srv: {srvMs.toFixed(1)}ms)]</span>
        <span style={{ color: '#4a5668' }}> ──► </span>
        <span style={{ color: '#bd00ff' }}>[Reconcile: {recMs.toFixed(1)}ms]</span>
      </div>

      {/* 2. Latency Metrics */}
      <div className={styles.divider} />
      <div className={styles.dataRow} {...getPerfTooltipAttrs('turnClientPrediction')}>
        <span className={styles.dataLabel}>CLIENT PREDICTION</span>
        <span className={styles.dataVal}>{turn?.clientPredictionMs.toFixed(2) ?? '0.00'} ms</span>
      </div>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('turnNetworkRtt')}>
        <span className={styles.dataLabel}>NETWORK RTT</span>
        <span className={styles.dataVal}>
          <strong>{turn?.networkRttMs.toFixed(2) ?? '0.00'} ms</strong>{' '}
          <span className={styles.dataSub}>
            (AVG: {rttAvg}ms | MAX: {rttMax}ms)
          </span>
        </span>
      </div>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('turnServerTime')}>
        <span className={styles.dataLabel}>SERVER TURN TIME</span>
        <span className={styles.dataVal}>
          {turn?.serverTurnMs ? turn.serverTurnMs.toFixed(2) : '0.00'} ms{' '}
          <span className={styles.dataSub} {...getPerfTooltipAttrs('turnSyncType')}>
            ({turn?.syncType ?? 'DELTA'})
          </span>
        </span>
      </div>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('turnClientReconcile')}>
        <span className={styles.dataLabel}>CLIENT RECONCILE</span>
        <span className={styles.dataVal}>{turn?.reconcileMs ? turn.reconcileMs.toFixed(2) : '0.00'} ms</span>
      </div>

      {/* 3. Server Phase Breakdown */}
      {phases.length > 0 && (
        <>
          <div className={styles.divider} />
          <div
            style={{ fontSize: 9, color: 'var(--c-text-muted, #4a5668)', marginBottom: 2 }}
          >
            SERVER PHASE BREAKDOWN:
          </div>
          <div className={styles.phaseBreakdownGrid}>
            {phases.map(([phaseName, duration]) => (
              <span key={phaseName} className={styles.phaseItem}>
                {phaseName}: <strong>{duration.toFixed(2)}ms</strong>
              </span>
            ))}
          </div>
        </>
      )}

      {/* 4. Top 5 Server Systems */}
      {top5Systems.length > 0 && (
        <>
          <div className={styles.divider} />
          <div
            style={{ fontSize: 9, color: 'var(--c-text-muted, #4a5668)', marginBottom: 2 }}
            {...getPerfTooltipAttrs('turnTopSystems')}
          >
            TOP 5 SERVER SYSTEMS:
          </div>
          {top5Systems.map((sys, idx) => (
            <div key={idx} className={styles.dataRow} {...getPerfTooltipAttrs('turnTopSystems')}>
              <span className={styles.dataLabel} style={{ fontSize: 9 }}>
                #{idx + 1} {sys.name} <span style={{ color: '#4a5668' }}>[{sys.phase}]</span>
              </span>
              <span className={styles.dataVal} style={{ fontSize: 9, color: idx === 0 ? '#ffaa00' : undefined }}>
                {sys.durationMs.toFixed(2)} ms
              </span>
            </div>
          ))}
        </>
      )}

      {/* 5. Enemy Sub-Ticks & Actors */}
      <div className={styles.divider} />
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>ENEMY SUB-TICKS</span>
        <span className={styles.dataVal}>
          <strong>{turn?.enemyTurnsProcessed ?? 0} ACTED</strong>{' '}
          <span className={styles.dataSub}>
            ({turn?.energySubTicks ?? 0} SUB-TICKS)
          </span>
        </span>
      </div>

      {/* 6. Sync Payload & Wire Delta */}
      <div className={styles.divider} />
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>SYNC PAYLOAD</span>
        <span className={styles.dataVal}>
          <strong>{lastTurnKb} KB</strong>{' '}
          <span className={styles.dataSub}>
            ({turn?.syncType ?? 'DELTA'} | SESSION: {sessionKb} KB)
          </span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>• WIRE DELTA</span>
        <span className={styles.dataVal} style={{ fontSize: 9 }}>
          +{turn?.deltaEntitiesAdded ?? 0} / -{turn?.deltaEntitiesRemoved ?? 0} ENT | SET {turn?.deltaComponentsSet ?? 0} / REM {turn?.deltaComponentsRemoved ?? 0} COMP | {turn?.deltaEventsCount ?? 0} EVT
        </span>
      </div>

      {/* 7. Input Buffer & Prediction Health */}
      <div className={styles.divider} />
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>INPUT BUFFER</span>
        <span className={styles.dataVal}>
          <strong>{inputQueueDepth} / 3</strong>{' '}
          <span className={styles.dataSub}>
            (LOCK: <strong style={{ color: inputPending ? '#ffaa00' : '#00ff88' }}>{inputPending ? 'PENDING' : 'READY'}</strong>)
          </span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>PREDICTION HEALTH</span>
        <span className={styles.dataVal}>
          <strong style={{ color: '#00ff88' }}>CONFIRMED</strong>{' '}
          <span className={styles.dataSub}>
            (ROLLBACKS: 0 | SAFEGUARDS: OK)
          </span>
        </span>
      </div>
    </>
  );
}

function renderMemTab(
  data: ReturnType<typeof usePerfStore.getState>['throttledData'],
  context?: GameContext | null,
) {
  const tex = data.textureMemory;
  const audio = data.audioDiagnostics;
  const gc = data.gcTelemetry;
  const render = data.renderTelemetry;

  const spatialEmitters = context?.world ? context.world.query(AmbientEmitter).length : 0;

  return (
    <>
      {/* 1. GPU Texture VRAM & Breakdown */}
      <div className={styles.dataRow} {...getPerfTooltipAttrs('memVram')}>
        <span className={styles.dataLabel}>GPU TEXTURE VRAM</span>
        <span className={styles.dataVal} style={{ color: '#d8ff00' }}>
          {(tex.estimatedVramBytes / (1024 * 1024)).toFixed(2)} MB
        </span>
      </div>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('memTextureCount')}>
        <span className={styles.dataLabel}>TEXTURE COUNT</span>
        <span className={styles.dataVal}>
          {tex.totalTextures}{' '}
          <span className={styles.dataSub}>
            (ATLAS: {tex.atlasTextures} | FBO: {tex.renderTextures} | CANVAS: {tex.textOrCanvasTextures})
          </span>
        </span>
      </div>

      {/* 2. Sprite & Tile Pool Utilization */}
      <div className={styles.divider} />
      <div
        className={styles.sectionHeader}
        style={{ fontSize: 9, color: 'var(--c-accent-secondary, #00f0ff)', marginBottom: 2 }}
      >
        POOL UTILIZATION
      </div>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('gpuTerrainPool')}>
        <span className={styles.dataLabel}>TERRAIN SPRITE POOL</span>
        <span className={styles.dataVal}>
          {render?.tilemap?.visibleTiles ?? 0} / {render?.tilemap?.poolSize ?? 0} VISIBLE{' '}
          <span className={styles.dataSub}>
            (AUTOTILE: {render?.tilemap?.lastAutotileSolves ?? 0})
          </span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>ENTITY SPRITE MAP</span>
        <span className={styles.dataVal}>
          {render?.sprites?.visibleSprites ?? 0} / {render?.sprites?.totalSprites ?? 0} VISIBLE{' '}
          <span className={styles.dataSub}>
            (TWEENS: {render?.activeAnimations ?? 0})
          </span>
        </span>
      </div>

      {/* 3. JS Heap Memory & Allocation Rate */}
      <div className={styles.divider} />
      <div className={styles.dataRow} {...getPerfTooltipAttrs('memJsHeap')}>
        <span className={styles.dataLabel}>JS HEAP MEMORY</span>
        <span className={styles.dataVal}>
          {gc.heapUsedBytes > 0
            ? `${(gc.heapUsedBytes / (1024 * 1024)).toFixed(1)} / ${(gc.heapTotalBytes / (1024 * 1024)).toFixed(1)} MB`
            : 'N/A (NON-CHROMIUM)'}
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>• ALLOCATION RATE</span>
        <span className={styles.dataVal}>
          {gc.heapUsedBytes > 0 ? (
            <>
              <strong>{gc.allocationRateMbPerSec.toFixed(2)} MB/s</strong>{' '}
              <span className={styles.dataSub}>
                (~{((gc.allocationRateMbPerSec * 1024) / 60).toFixed(1)} KB/frame)
              </span>
            </>
          ) : (
            'N/A'
          )}
        </span>
      </div>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('memGcSawtooth')}>
        <span className={styles.dataLabel}>GC SAWTOOTH EVENTS</span>
        <span className={styles.dataVal}>{gc.gcEvents}</span>
      </div>

      {/* 4. Audio Engine & DSP Readouts */}
      <div className={styles.divider} />
      <div className={styles.dataRow} {...getPerfTooltipAttrs('memAudioContext')}>
        <span className={styles.dataLabel}>AUDIO CONTEXT</span>
        <span className={styles.dataVal}>
          {audio?.contextState ?? 'suspended'}{' '}
          <span className={styles.dataSub}>({audio?.sampleRate ?? 44100} Hz)</span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>OUTPUT LATENCY</span>
        <span className={styles.dataVal}>
          <strong>{audio?.outputLatencyMs ? audio.outputLatencyMs.toFixed(1) : '0.0'} ms</strong>
        </span>
      </div>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('memAudioVoices')}>
        <span className={styles.dataLabel}>ACTIVE AUDIO VOICES</span>
        <span className={styles.dataVal}>
          <strong>{audio?.activeVoiceCount ?? 0} ONE-SHOT</strong>{' '}
          <span className={styles.dataSub}>(AMBIENT LOOPS: {audio?.ambientLoopCount ?? 0})</span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>AMBIANCE BIQUAD FILTER</span>
        <span className={styles.dataVal}>
          {audio?.ambianceCutoffHz ? Math.round(audio.ambianceCutoffHz) : 20000} Hz{' '}
          <span className={styles.dataSub}>
            (Q: {audio?.ambianceResonanceQ ? audio.ambianceResonanceQ.toFixed(2) : '1.00'})
          </span>
        </span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.dataLabel}>SPATIAL EMITTERS</span>
        <span className={styles.dataVal}>
          <strong>{spatialEmitters}</strong> ACTIVE
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

  const handleToggle = (key: keyof DevRenderBisectionFlags, val: boolean) => {
    setBisectionFlag(key, val);
  };

  return (
    <>
      <div className={styles.dataRow} {...getPerfTooltipAttrs('auditBaseline')}>
        <span className={styles.dataLabel}>BASELINE SNAPSHOT</span>
        <span className={styles.dataVal}>
          {data.baselineSnapshot ? `FLOOR #${data.baselineSnapshot.floor}` : 'NONE'}
        </span>
      </div>

      {diff ? (
        <table className={styles.perfTable} style={{ margin: '4px 0' }} {...getPerfTooltipAttrs('auditDiffTable')}>
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
              <td>Components</td>
              <td>{diff.deltaComponents >= 0 ? `+${diff.deltaComponents}` : diff.deltaComponents}</td>
              <td style={{ color: diff.deltaComponents > 25 ? '#ff2a4b' : '#10b981' }}>
                {diff.deltaComponents > 25 ? 'GROW' : 'OK'}
              </td>
            </tr>
            <tr>
              <td>Entity Sprites</td>
              <td>{diff.deltaSprites >= 0 ? `+${diff.deltaSprites}` : diff.deltaSprites}</td>
              <td style={{ color: diff.deltaSprites > 5 ? '#ff2a4b' : '#10b981' }}>
                {diff.deltaSprites > 5 ? 'LEAK?' : 'OK'}
              </td>
            </tr>
            <tr>
              <td>Tilemap Pool</td>
              <td>{diff.deltaTilemapPool >= 0 ? `+${diff.deltaTilemapPool}` : diff.deltaTilemapPool}</td>
              <td style={{ color: diff.deltaTilemapPool > 50 ? '#ff2a4b' : '#10b981' }}>
                {diff.deltaTilemapPool > 50 ? 'GROW' : 'OK'}
              </td>
            </tr>
            <tr>
              <td>Active Filters</td>
              <td>{diff.deltaFilters >= 0 ? `+${diff.deltaFilters}` : diff.deltaFilters}</td>
              <td style={{ color: diff.deltaFilters > 0 ? '#ff2a4b' : '#10b981' }}>
                {diff.deltaFilters > 0 ? 'LEAK?' : 'OK'}
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
              <td style={{ color: diff.deltaVramBytes / (1024 * 1024) > 5 ? '#ff2a4b' : '#10b981' }}>
                {diff.deltaVramBytes / (1024 * 1024) > 5 ? 'GROW' : 'OK'}
              </td>
            </tr>
            <tr>
              <td>Audio Voices</td>
              <td>{diff.deltaVoices >= 0 ? `+${diff.deltaVoices}` : diff.deltaVoices}</td>
              <td style={{ color: diff.deltaVoices > 2 ? '#ff2a4b' : '#10b981' }}>
                {diff.deltaVoices > 2 ? 'LEAK?' : 'OK'}
              </td>
            </tr>
            <tr>
              <td>JS Heap (MB)</td>
              <td>{(diff.deltaHeapBytes / (1024 * 1024)).toFixed(2)}</td>
              <td style={{ color: diff.deltaHeapBytes / (1024 * 1024) > 15 ? '#ff2a4b' : '#10b981' }}>
                {diff.deltaHeapBytes / (1024 * 1024) > 15 ? 'GROW' : 'OK'}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div style={{ fontSize: 9, color: 'var(--c-text-muted, #4a5668)', margin: '4px 0' }} {...getPerfTooltipAttrs('auditBaseline')}>
          No baseline snapshot recorded yet. Click SNAPSHOT to begin floor leak auditing.
        </div>
      )}

      {perfCollector.getFloorHistory().length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--c-text-muted, #4a5668)', marginBottom: 2 }}>
            FLOOR TRANSITION HISTORY ({perfCollector.getFloorHistory().length} FLOORS):
          </div>
          <table className={styles.perfTable} style={{ margin: '4px 0' }}>
            <thead>
              <tr>
                <th>FL</th>
                <th>ENT</th>
                <th>COMP</th>
                <th>SPR</th>
                <th>TEX</th>
                <th>VRAM</th>
              </tr>
            </thead>
            <tbody>
              {perfCollector.getFloorHistory().map((snap, i) => (
                <tr key={i}>
                  <td>F{String(snap.floor).padStart(2, '0')}</td>
                  <td>{snap.entityCount}</td>
                  <td>{snap.componentCount}</td>
                  <td>{snap.entitySpriteCount}</td>
                  <td>{snap.managedTextureCount}</td>
                  <td>{(snap.vramBytes / (1024 * 1024)).toFixed(1)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.divider} />
      <div style={{ fontSize: 9, color: 'var(--c-text-muted, #4a5668)', marginBottom: 2 }}>
        RENDER BISECTION (DEV-ONLY):
      </div>

      <label className={styles.bisectionItem} {...getPerfTooltipAttrs('bisectSpriteFilters')}>
        <input
          type="checkbox"
          checked={bisectionFlags.disableSpriteFilters}
          onChange={(e) => handleToggle('disableSpriteFilters', e.target.checked)}
        />
        <span>Disable Sprite Filters (Outline/Glitch)</span>
      </label>

      <label className={styles.bisectionItem} {...getPerfTooltipAttrs('bisectWorldFilters')}>
        <input
          type="checkbox"
          checked={bisectionFlags.disableWorldFilters}
          onChange={(e) => handleToggle('disableWorldFilters', e.target.checked)}
        />
        <span>Disable World Post-Process Filters</span>
      </label>

      <label className={styles.bisectionItem} {...getPerfTooltipAttrs('bisectParticles')}>
        <input
          type="checkbox"
          checked={bisectionFlags.disableParticles}
          onChange={(e) => handleToggle('disableParticles', e.target.checked)}
        />
        <span>Disable Particle Emitters</span>
      </label>

      <label className={styles.bisectionItem} {...getPerfTooltipAttrs('bisectCacheTilemap')}>
        <input
          type="checkbox"
          checked={bisectionFlags.cacheStaticTilemap}
          onChange={(e) => handleToggle('cacheStaticTilemap', e.target.checked)}
        />
        <span>Cache Static Tilemap (Dirty Check)</span>
      </label>

      <label className={styles.bisectionItem} {...getPerfTooltipAttrs('bisectCacheFov')}>
        <input
          type="checkbox"
          checked={bisectionFlags.cacheStaticFov}
          onChange={(e) => handleToggle('cacheStaticFov', e.target.checked)}
        />
        <span>Cache Static FOV (Position Check)</span>
      </label>

      <div className={styles.divider} />

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button
          className={styles.bottomActionBtn}
          style={{ flex: 1 }}
          onClick={handleTakeSnapshot}
          {...getPerfTooltipAttrs('btnNewSnapshot')}
        >
          📸 NEW SNAPSHOT
        </button>
        <button
          className={styles.bottomActionBtn}
          style={{ flex: 1 }}
          onClick={handleExportJson}
          {...getPerfTooltipAttrs('btnExportJson')}
        >
          ⬇ EXPORT JSON
        </button>
      </div>
    </>
  );
}
