import React from 'react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PerfMonitorWidget } from '../PerfMonitorWidget';
import { usePerfStore } from '../perf-store';
import { perfCollector } from '../perf-collector';

describe('PerfMonitorWidget', () => {
  beforeEach(() => {
    // Reset store state
    act(() => {
      usePerfStore.setState({
        mode: 'OFF',
        activeTab: 'GPU',
        ghostMode: false,
        dockPosition: 'TOP_LEFT',
        spikeTrapThreshold: 0,
        isPaused: false,
        bisectionFlags: {
          measureTimings: true,
          disableSpriteFilters: false,
          disableWorldFilters: false,
          disableParticles: false,
          cacheStaticTilemap: false,
          cacheStaticFov: false,
        },
      });
    });
    perfCollector.clearBaselineSnapshot();
    perfCollector.clearSpikeCard();
  });

  it('renders nothing when mode is OFF', () => {
    const { container } = render(<PerfMonitorWidget />);
    expect(container.firstChild).toBeNull();
  });

  it('renders MINI mode pill with sparkline and metrics', () => {
    act(() => {
      usePerfStore.setState({ mode: 'MINI' });
    });

    render(<PerfMonitorWidget />);

    expect(screen.getByText(/FPS/i)).toBeInTheDocument();
    expect(screen.getByText(/DC/i)).toBeInTheDocument();
    expect(screen.getByText(/ENT/i)).toBeInTheDocument();
    expect(screen.getByText(/RTT/i)).toBeInTheDocument();

    // Toggle ghost button
    const ghostBtn = screen.getByRole('button', { name: /👻/i });
    fireEvent.click(ghostBtn);
    expect(usePerfStore.getState().ghostMode).toBe(true);

    // Expand button
    const expandBtn = screen.getByRole('button', { name: /⤢/i });
    fireEvent.click(expandBtn);
    expect(usePerfStore.getState().mode).toBe('STANDARD');
  });

  it('renders STANDARD mode with placard header, oscilloscope, and tabs', () => {
    act(() => {
      usePerfStore.setState({ mode: 'STANDARD', activeTab: 'GPU' });
    });

    render(<PerfMonitorWidget />);

    expect(screen.getByText('性能監視 // TK-PERF-900')).toBeInTheDocument();
    expect(screen.getByText('開発計測')).toBeInTheDocument();
    expect(screen.getByText(/1PX OSCILLOSCOPE/i)).toBeInTheDocument();

    // Check tabs
    expect(screen.getByRole('button', { name: /GPU/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ECS/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /TURN/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MEM/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AUDIT/i })).toBeInTheDocument();

    // Default GPU tab content
    expect(screen.getByText('WEBGL DRAW CALLS')).toBeInTheDocument();
  });

  it('switches tabs and displays respective domain content', () => {
    act(() => {
      usePerfStore.setState({ mode: 'STANDARD' });
    });

    render(<PerfMonitorWidget />);

    // Switch to ECS tab
    fireEvent.click(screen.getByRole('button', { name: /ECS/i }));
    expect(usePerfStore.getState().activeTab).toBe('ECS');
    expect(screen.getByText('TOTAL LIVE ENTITIES')).toBeInTheDocument();

    // Switch to TURN tab
    fireEvent.click(screen.getByRole('button', { name: /TURN/i }));
    expect(usePerfStore.getState().activeTab).toBe('TURN');
    expect(screen.getByText('CLIENT PREDICTION')).toBeInTheDocument();

    // Switch to MEM tab
    fireEvent.click(screen.getByRole('button', { name: /MEM/i }));
    expect(usePerfStore.getState().activeTab).toBe('MEM');
    expect(screen.getByText('GPU TEXTURE VRAM')).toBeInTheDocument();

    // Switch to AUDIT tab
    fireEvent.click(screen.getByRole('button', { name: /AUDIT/i }));
    expect(usePerfStore.getState().activeTab).toBe('AUDIT');
    expect(screen.getByText('BASELINE SNAPSHOT')).toBeInTheDocument();
  });

  it('allows toggling render bisection checkboxes and snapshot diffing', () => {
    act(() => {
      usePerfStore.setState({ mode: 'STANDARD', activeTab: 'AUDIT' });
    });

    const mockRenderSystem = {
      setDevRenderFlags: vi.fn(),
    };

    render(<PerfMonitorWidget renderSystem={mockRenderSystem as never} />);

    // Toggle particle bisection
    const particleCheckbox = screen.getByLabelText(/Disable Particle Emitters/i);
    expect(particleCheckbox).not.toBeChecked();

    fireEvent.click(particleCheckbox);
    expect(usePerfStore.getState().bisectionFlags.disableParticles).toBe(true);
    expect(mockRenderSystem.setDevRenderFlags).toHaveBeenCalledWith(
      expect.objectContaining({ disableParticles: true }),
    );

    // Take snapshot
    const snapBtn = screen.getByRole('button', { name: /NEW SNAPSHOT/i });
    fireEvent.click(snapBtn);
    expect(perfCollector.getBaselineSnapshot()).not.toBeNull();
  });

  it('renders EXPANDED mode with 2-column workstation layout', () => {
    act(() => {
      usePerfStore.setState({ mode: 'EXPANDED' });
    });

    render(<PerfMonitorWidget />);

    expect(screen.getByText(/4.0s WAVEFORM/i)).toBeInTheDocument();
    expect(screen.getByText(/GPU & RENDER PIPELINE/i)).toBeInTheDocument();
    expect(screen.getByText(/TURN PIPELINE WATERFALL/i)).toBeInTheDocument();
    expect(screen.getByText(/ECS & SPATIAL CENSUS/i)).toBeInTheDocument();
    expect(screen.getByText(/AUDIT & BISECTION TOOLS/i)).toBeInTheDocument();
  });

  it('updates spike trap threshold via dropdown', () => {
    act(() => {
      usePerfStore.setState({ mode: 'STANDARD' });
    });

    render(<PerfMonitorWidget />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '25' } });

    expect(usePerfStore.getState().spikeTrapThreshold).toBe(25);
    expect(perfCollector.getSpikeTrapThreshold()).toBe(25);
  });

  it('displays rich floating tooltip on pointer hover and dismisses on pointer out or Escape', () => {
    act(() => {
      usePerfStore.setState({ mode: 'STANDARD', activeTab: 'GPU' });
    });

    const { container } = render(<PerfMonitorWidget />);

    // Initially no floating tooltip is mounted
    expect(screen.queryByRole('tooltip')).toBeNull();

    // Hover over WebGL Draw Calls row
    const drawCallsRow = container.querySelector('[data-perf-tooltip="gpuDrawCalls"]');
    expect(drawCallsRow).not.toBeNull();

    fireEvent.pointerOver(drawCallsRow!);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(/WebGL Draw Calls/i);
    expect(tooltip).toHaveTextContent(/GPU/i);
    expect(tooltip).toHaveTextContent(/Total drawElements and drawArrays calls/i);

    // Dismiss with Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();

    // Hover again
    fireEvent.pointerOver(drawCallsRow!);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    // Dismiss on pointer out to outside element
    fireEvent.pointerOut(drawCallsRow!, { relatedTarget: document.body });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('provides tooltips on Mini Pill items and switches context on hover', () => {
    act(() => {
      usePerfStore.setState({ mode: 'MINI' });
    });

    const { container } = render(<PerfMonitorWidget />);

    const miniFps = container.querySelector('[data-perf-tooltip="miniFps"]');
    expect(miniFps).not.toBeNull();
    // Verify native browser title attribute is strictly NOT set to avoid duplicate web tooltips
    expect(miniFps?.getAttribute('title')).toBeNull();

    fireEvent.pointerOver(miniFps!);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(/HUD/i);
    expect(tooltip).toHaveTextContent(/Current rendering frames per second/i);

    // Hover over mini draw calls
    const miniDc = container.querySelector('[data-perf-tooltip="miniDc"]');
    expect(miniDc).not.toBeNull();
    fireEvent.pointerOver(miniDc!);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/WebGL Draw Calls \(Mini HUD\)/i);
  });

  it('renders waveform legend chips, supports scrub inspection hover card, and pause click', () => {
    act(() => {
      usePerfStore.setState({ mode: 'EXPANDED', isPaused: false });
    });

    // Populate some dummy frame timings in perfCollector
    perfCollector.recordFrame(
      12.5,
      {
        fovMs: 1.2,
        tilemapMs: 2.3,
        spriteSyncMs: 3.1,
        vfxMs: 0.5,
        hoverMs: 0.2,
        totalCpuMs: 7.3,
      },
      {
        drawCalls: 30,
        triangles: 60,
        programSwitches: 2,
        textureBinds: 4,
      },
    );

    const { container } = render(<PerfMonitorWidget />);

    // 1. Verify Legend Chips exist
    expect(screen.getByText('FRAME TIME')).toBeInTheDocument();
    expect(screen.getByText('CPU RENDER')).toBeInTheDocument();
    expect(screen.getByText('16.7ms (60 FPS)')).toBeInTheDocument();
    expect(screen.getByText('33.3ms (30 FPS)')).toBeInTheDocument();

    // 2. Locate expanded canvas
    const canvas = container.querySelector('canvas[width="340"]');
    expect(canvas).not.toBeNull();

    // 3. Move mouse over canvas to trigger scrub inspector
    fireEvent.mouseMove(canvas!, {
      clientX: 100,
      clientY: 50,
    });

    // Scrub tooltip hover card should be visible
    expect(screen.getByText(/TOTAL FRAME:/i)).toBeInTheDocument();
    expect(screen.getByText(/CPU RENDER:/i)).toBeInTheDocument();
    expect(screen.getByText(/WEBGL DRAWS:/i)).toBeInTheDocument();

    // Verify anchor offset: at clientX=100, tooltip is placed 14px to the right (left = 114px), not centered
    const hoverCard = container.querySelector('[class*="scrubHoverCard"]') as HTMLElement;
    expect(hoverCard).not.toBeNull();
    expect(hoverCard.style.left).toBe('114px');

    // Move to right side of chart (clientX = 250)
    fireEvent.mouseMove(canvas!, {
      clientX: 250,
      clientY: 50,
    });
    // Tooltip flips to the left (250 - 184 - 14 = 52px), leaving the cursor unobstructed
    expect(hoverCard.style.left).toBe('52px');

    // 4. Click canvas to freeze / pause playback
    fireEvent.click(canvas!);
    expect(usePerfStore.getState().isPaused).toBe(true);

    // 5. Mouse leave clears scrub inspection
    fireEvent.mouseLeave(canvas!);
    expect(screen.queryByText(/WEBGL DRAWS:/i)).toBeNull();
  });

  it('displays persistent ghost restoration banner in EXPANDED mode and restores interaction on click', () => {
    act(() => {
      usePerfStore.setState({ mode: 'EXPANDED', ghostMode: true });
    });

    render(<PerfMonitorWidget />);

    // Ghost banner should be present
    const banner = screen.getByText(/GHOST MODE ACTIVE: BODY IS CLICK-THROUGH — CLICK TO RESTORE/i);
    expect(banner).toBeInTheDocument();

    // Restore button should say 👻 RESTORE
    const restoreBtn = screen.getByRole('button', { name: /👻 RESTORE/i });
    expect(restoreBtn).toBeInTheDocument();

    // Clicking the banner restores ghost mode
    fireEvent.click(banner);
    expect(usePerfStore.getState().ghostMode).toBe(false);
  });

  it('displays updated hotkey guide in footer status bar', () => {
    act(() => {
      usePerfStore.setState({ mode: 'STANDARD' });
    });

    render(<PerfMonitorWidget />);
    expect(screen.getByText('[F3 / Alt+P: HIDE]')).toBeInTheDocument();
  });

  it('displays rolling Avg FPS and Frame Jitter in summary metrics row and syncs pause state with collector', () => {
    act(() => {
      usePerfStore.setState({
        mode: 'STANDARD',
        throttledData: {
          ...usePerfStore.getState().throttledData,
          metrics: {
            fpsCurrent: 58.5,
            fpsAvg: 59.2,
            fpsOnePercentLow: 52.0,
            frameTimeMs: 17.1,
            frameTimeJitter: 0.85,
          },
        },
      });
    });

    render(<PerfMonitorWidget />);

    expect(screen.getByText(/\(AVG:/i)).toBeInTheDocument();
    expect(screen.getByText('59.2')).toBeInTheDocument();
    expect(screen.getByText(/\(σ:/i)).toBeInTheDocument();
    expect(screen.getByText('0.85ms')).toBeInTheDocument();

    // Pause toggle syncs with perfCollector
    const pauseBtn = screen.getByRole('button', { name: /⏸/i });
    fireEvent.click(pauseBtn);
    expect(usePerfStore.getState().isPaused).toBe(true);
    expect(perfCollector.getIsFrozen()).toBe(true);

    fireEvent.click(pauseBtn);
    expect(usePerfStore.getState().isPaused).toBe(false);
    expect(perfCollector.getIsFrozen()).toBe(false);
  });

  it('supports scrubbing on STANDARD mode oscilloscope canvas', () => {
    act(() => {
      usePerfStore.setState({ mode: 'STANDARD' });
    });

    const { container } = render(<PerfMonitorWidget />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    // Hover over canvas to scrub
    fireEvent.mouseMove(canvas!, { clientX: 180, clientY: 35 });
    expect(screen.getByText(/TOTAL FRAME:/i)).toBeInTheDocument();
    expect(screen.getByText(/CPU RENDER:/i)).toBeInTheDocument();

    // Mouse leave clears scrub hover card
    fireEvent.mouseLeave(canvas!);
    expect(screen.queryByText(/TOTAL FRAME:/i)).toBeNull();
  });

  it('renders rich Spike Forensics Card with sub-stage culprit badge, draw calls, and frame events', () => {
    act(() => {
      usePerfStore.setState({
        mode: 'STANDARD',
        throttledData: {
          ...usePerfStore.getState().throttledData,
          spikeForensics: {
            frameDurationMs: 34.5,
            thresholdMs: 20,
            stageTimings: {
              fovMs: 1.2,
              tilemapMs: 18.4,
              spriteSyncMs: 4.1,
              vfxMs: 1.0,
              hoverMs: 0.3,
              totalCpuMs: 25.0,
            },
            webglStats: {
              drawCalls: 48,
              triangles: 1400,
              programSwitches: 6,
              textureBinds: 12,
              renderPassMs: 3.2,
            },
            recentEvents: ['DAMAGE_DEALT', 'PROP_INTERACTED'],
            timestamp: Date.now(),
          },
        },
      });
    });

    render(<PerfMonitorWidget />);

    expect(screen.getByText(/⚡ SPIKE TRAP TRIPPED: 34.50ms/i)).toBeInTheDocument();
    expect(screen.getByText(/CULPRIT: TILEMAP \(18.40ms\)/i)).toBeInTheDocument();
    expect(screen.getByText('18.40ms')).toBeInTheDocument();
    expect(screen.getByText('48 DC')).toBeInTheDocument();
    expect(screen.getByText('DAMAGE_DEALT')).toBeInTheDocument();
    expect(screen.getByText('PROP_INTERACTED')).toBeInTheDocument();

    const resumeBtn = screen.getByRole('button', { name: /RESUME/i });
    expect(resumeBtn).toBeInTheDocument();
    fireEvent.click(resumeBtn);
  });

  it('renders Domain 2 ECS tab with Archetype Census, Top 6 Stores, FOV/Fog Memory, and EventBus throughput', () => {
    act(() => {
      usePerfStore.setState({
        mode: 'STANDARD',
        activeTab: 'ECS',
        throttledData: {
          ...usePerfStore.getState().throttledData,
          ecsDiagnostics: {
            entityCount: 142,
            nextId: 143,
            storeCount: 18,
            totalComponentInstances: 480,
            systemCount: 12,
            storeSizes: {
              position: 140,
              sprite: 85,
              prop: 24,
              item: 35,
              parent: 12,
              hostile: 8,
              actor: 9,
            },
          },
          archetypeCensus: {
            playerCount: 1,
            hostileCount: 8,
            dyingCount: 2,
            totalProps: 24,
            lockedProps: 5,
            corruptedProps: 3,
            searchedProps: 10,
            groundItems: 14,
            childItems: 12,
            deadZones: 4,
            corruptions: 1,
          },
          renderTelemetry: {
            stageTimings: { fovMs: 0, tilemapMs: 0, spriteSyncMs: 0, vfxMs: 0, hoverMs: 0, totalCpuMs: 0 },
            tilemap: { visibleTiles: 0, poolSize: 0, lastAutotileSolves: 0 },
            particles: { activeEmitters: 0, totalParticles: 0 },
            filters: {
              totalPropFilters: 0,
              totalEnemyFilters: 0,
              activePropFilterSprites: 0,
              activeEnemyFilterSprites: 0,
              activeDamageFilters: 0,
              worldFiltersCount: 0,
            },
            sprites: { visibleSprites: 0, totalSprites: 0 },
            activeAnimations: 0,
            activeDamageTexts: 0,
            fovTiles: 320,
            exploredTiles: 1200,
            rememberedPropsCount: 18,
            rememberedItemsCount: 7,
          },
          eventBusTelemetry: {
            eventsPerSec: 62.4,
            totalEmissions: 1850,
            discreteEmissions: 50,
            fovEmissions: 1800,
            handlerCount: 42,
            queueLength: 0,
          },
        },
      });
    });

    render(<PerfMonitorWidget />);

    expect(screen.getByText('ARCHETYPE CENSUS')).toBeInTheDocument();
    expect(screen.getByText(/HOSTILE: 8/i)).toBeInTheDocument();
    expect(screen.getByText(/DYING: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/LOCK: 5/i)).toBeInTheDocument();
    expect(screen.getByText(/CORRUPT: 3/i)).toBeInTheDocument();
    expect(screen.getByText(/SEARCHED: 10/i)).toBeInTheDocument();
    expect(screen.getByText(/CHILD\/INV: 12/i)).toBeInTheDocument();

    // Top 6 stores
    expect(screen.getByText('• TOP 6 STORES')).toBeInTheDocument();
    expect(screen.getByText('140')).toBeInTheDocument(); // position: 140

    // FOV & Fog memory
    expect(screen.getByText('320 ACTIVE / 1200 EXPLORED')).toBeInTheDocument();
    expect(screen.getByText('PROPS: 18 | ITEMS: 7')).toBeInTheDocument();

    // EventBus Throughput
    expect(screen.getByText('62.4 evt/s')).toBeInTheDocument();
    expect(screen.getByText('1800')).toBeInTheDocument(); // 60Hz FOV
    expect(screen.getByText('50')).toBeInTheDocument(); // Discrete
  });
});
