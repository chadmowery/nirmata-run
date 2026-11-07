import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AudioCueStudio } from '../AudioCueStudio';
import { useGamedataStore } from '../../store';
import { setAudioEngine, IAudioEngine, SoundCueDef, PlayCueOptions } from '@engine/audio';

const mockCue: SoundCueDef = {
  id: 'sfx_test_cue',
  bus: 'sfx',
  mode: 'synth',
  baseVolume: 0.75,
  cooldownMs: 40,
  pitchVariance: 0.05,
  loop: false,
  synth: {
    waveform: 'triangle',
    freqStart: 440,
    attack: 0.01,
    decay: 0.1,
    sustain: 0.3,
    hold: 0.05,
    release: 0.1,
  },
};

describe('AudioCueStudio Component', () => {
  let mockEngine: IAudioEngine;
  let playCueMock: ReturnType<typeof vi.fn<(cue: SoundCueDef, options?: PlayCueOptions) => void>>;
  let startHoldMock: ReturnType<typeof vi.fn<(cue: SoundCueDef) => string>>;
  let stopHoldMock: ReturnType<typeof vi.fn<(vid: string) => void>>;
  let setAmbianceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    playCueMock = vi.fn();
    startHoldMock = vi.fn(() => 'voice-123');
    stopHoldMock = vi.fn();
    setAmbianceMock = vi.fn();

    mockEngine = {
      init: vi.fn(),
      destroy: vi.fn(),
      playCue: playCueMock,
      startHoldRamp: startHoldMock,
      updateHoldRamp: vi.fn(),
      stopHoldRamp: stopHoldMock,
      setAmbianceState: setAmbianceMock,
      stopAmbiance: vi.fn(),
      updateSettings: vi.fn(),
      getSettings: vi.fn(() => ({
        muted: false,
        masterVolume: 1,
        ambianceVolume: 1,
        sfxVolume: 1,
        uiVolume: 1,
      })),
      isMuted: vi.fn(() => false),
    } as unknown as IAudioEngine;

    setAudioEngine(mockEngine);

    // Mock fetch for GET cue
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/dev/gamedata/audio-cues/sfx_test_cue')) {
        return {
          ok: true,
          json: async () => mockCue,
        } as Response;
      }
      if (urlStr.includes('/api/dev/gamedata/audio-cues')) {
        return {
          ok: true,
          json: async () => ({ success: true }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    setAudioEngine(null);
  });

  it('renders sound cue editor with basic specs, synth patch parameters, and preview suite', async () => {
    render(<AudioCueStudio name="sfx_test_cue" />);

    // Wait for fetch to load data
    await waitFor(() => {
      expect(screen.getByText(/AUDIO CUE \/\/ sfx_test_cue/i)).toBeDefined();
    });

    expect(screen.getByText(/1. CORE SPECIFICATIONS & BUS ROUTING/i)).toBeDefined();
    expect(screen.getByText(/2. OSCILLOSCOPE SYNTH PATCH PARAMETERS/i)).toBeDefined();
    expect(screen.getByText(/3. 2D SPATIAL & TACTILE AUDITION SUITE/i)).toBeDefined();
    expect(screen.getByText(/2D GRID SPATIAL PANNING & DISTANCE ATTENUATION/i)).toBeDefined();
    expect(screen.getByText(/2-SECOND HOLD-TO-CONFIRM PITCH RAMP AUDITION/i)).toBeDefined();
    expect(screen.getByText(/REACTIVE AMBIANCE ENVIRONMENT SIMULATOR/i)).toBeDefined();
  });

  it('auditions cue immediately when PLAY CUE button is clicked', async () => {
    render(<AudioCueStudio name="sfx_test_cue" />);

    await waitFor(() => {
      expect(screen.getByText(/AUDIO CUE \/\/ sfx_test_cue/i)).toBeDefined();
    });

    const playBtn = screen.getByRole('button', { name: /▶ PLAY CUE/i });
    fireEvent.click(playBtn);

    expect(playCueMock).toHaveBeenCalledTimes(1);
    expect(playCueMock.mock.calls[0][0].id).toBe('sfx_test_cue');
  });

  it('auditions spatial sound when PLAY SPATIAL SFX button is clicked', async () => {
    render(<AudioCueStudio name="sfx_test_cue" />);

    await waitFor(() => {
      expect(screen.getByText(/AUDIO CUE \/\/ sfx_test_cue/i)).toBeDefined();
    });

    const spatialBtn = screen.getByRole('button', { name: /▶ PLAY SPATIAL SFX/i });
    fireEvent.click(spatialBtn);

    expect(playCueMock).toHaveBeenCalledTimes(1);
    const options = playCueMock.mock.calls[0][1];
    expect(options?.spatial).toBeDefined();
    expect(options?.spatial?.sourceX).toBe(3);
    expect(options?.spatial?.sourceY).toBe(2);
  });

  it('starts and stops hold ramp auditioning', async () => {
    render(<AudioCueStudio name="sfx_test_cue" />);

    await waitFor(() => {
      expect(screen.getByText(/AUDIO CUE \/\/ sfx_test_cue/i)).toBeDefined();
    });

    const startHoldBtn = screen.getByRole('button', { name: /▶ START HOLD RAMP/i });
    fireEvent.click(startHoldBtn);

    expect(startHoldMock).toHaveBeenCalledTimes(1);

    const stopHoldBtn = screen.getByRole('button', { name: /■ STOP HOLD RAMP/i });
    fireEvent.click(stopHoldBtn);

    expect(stopHoldMock).toHaveBeenCalledTimes(1);
  });

  it('triggers ambiance simulation when SIMULATE AMBIANCE button is clicked', async () => {
    render(<AudioCueStudio name="sfx_test_cue" />);

    await waitFor(() => {
      expect(screen.getByText(/AUDIO CUE \/\/ sfx_test_cue/i)).toBeDefined();
    });

    const simBtn = screen.getByRole('button', { name: /SIMULATE AMBIANCE BUS MODULATION/i });
    fireEvent.click(simBtn);

    expect(setAmbianceMock).toHaveBeenCalledTimes(1);
  });

  it('marks store as dirty when slider changes and successfully saves', async () => {
    const onRefreshMock = vi.fn();
    render(<AudioCueStudio name="sfx_test_cue" onRefresh={onRefreshMock} />);

    await waitFor(() => {
      expect(screen.getByText(/AUDIO CUE \/\/ sfx_test_cue/i)).toBeDefined();
    });

    expect(useGamedataStore.getState().isDirty).toBe(false);

    // Adjust Cooldown MS input
    const cooldownInput = screen.getByDisplayValue('40');
    fireEvent.change(cooldownInput, { target: { value: '80' } });

    expect(useGamedataStore.getState().isDirty).toBe(true);

    // Save
    const saveBtn = screen.getByRole('button', { name: /SAVE \(CMD\+S\)/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(useGamedataStore.getState().isDirty).toBe(false);
    });
    expect(onRefreshMock).toHaveBeenCalledTimes(1);
  });
});
