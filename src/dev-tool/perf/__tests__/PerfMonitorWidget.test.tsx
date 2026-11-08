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
    const ghostBtn = screen.getByTitle(/Ghost/i);
    fireEvent.click(ghostBtn);
    expect(usePerfStore.getState().ghostMode).toBe(true);

    // Expand button
    const expandBtn = screen.getByTitle(/Expand to Standard/i);
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
});
