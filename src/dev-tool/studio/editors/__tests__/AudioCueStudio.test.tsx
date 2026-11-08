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
  let stopCueMock: ReturnType<typeof vi.fn<(cueId: string, fadeDurationSec?: number) => void>>;
  let stopAllAudioMock: ReturnType<typeof vi.fn<(fadeDurationSec?: number) => void>>;
  let startHoldMock: ReturnType<typeof vi.fn<(cue: SoundCueDef) => string>>;
  let stopHoldMock: ReturnType<typeof vi.fn<(vid: string) => void>>;
  let playAmbianceMock: ReturnType<typeof vi.fn<(cue: SoundCueDef) => void>>;
  let setAmbianceMock: ReturnType<typeof vi.fn>;
  let stopAmbianceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    playCueMock = vi.fn();
    playAmbianceMock = vi.fn();
    stopCueMock = vi.fn();
    stopAllAudioMock = vi.fn();
    startHoldMock = vi.fn(() => 'voice-123');
    stopHoldMock = vi.fn();
    setAmbianceMock = vi.fn();
    stopAmbianceMock = vi.fn();

    mockEngine = {
      init: vi.fn(),
      destroy: vi.fn(),
      playCue: playCueMock,
      playAmbianceCue: playAmbianceMock,
      stopCue: stopCueMock,
      stopAllAudio: stopAllAudioMock,
      startHoldRamp: startHoldMock,
      updateHoldRamp: vi.fn(),
      stopHoldRamp: stopHoldMock,
      setAmbianceState: setAmbianceMock,
      getAmbianceState: vi.fn(() => ({
        depthBand: 'MAIN_MENU',
        sectorCondition: null,
        heatTier: 0,
        isAnchorDucked: false,
        isPaused: false,
      })),
      stopAmbiance: stopAmbianceMock,
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

  it('triggers ambiance simulation and real-time DSP modulation when SIMULATE AMBIANCE button is clicked', async () => {
    render(<AudioCueStudio name="sfx_test_cue" />);

    await waitFor(() => {
      expect(screen.getByText(/AUDIO CUE \/\/ sfx_test_cue/i)).toBeDefined();
    });

    const simBtn = screen.getByRole('button', { name: /SIMULATE AMBIANCE BUS MODULATION/i });
    fireEvent.click(simBtn);

    expect(playAmbianceMock).toHaveBeenCalledTimes(1);
    expect(setAmbianceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        depthBand: 'FLOORS 1–5 (CORRUPTED_DATA)',
        heatTier: 0,
        isAnchorDucked: false,
      }),
    );
    expect(screen.getByText(/AMBIANCE BUS DSP TELEMETRY/i)).toBeDefined();
    expect(screen.getByText(/● SIMULATING \(ACTIVE\)/i)).toBeDefined();
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

  it('stops cue audition when toggled to STOP CUE', async () => {
    render(<AudioCueStudio name="sfx_test_cue" />);

    await waitFor(() => {
      expect(screen.getByText(/AUDIO CUE \/\/ sfx_test_cue/i)).toBeDefined();
    });

    const playBtn = screen.getByRole('button', { name: /▶ PLAY CUE/i });
    fireEvent.click(playBtn);
    expect(playCueMock).toHaveBeenCalledTimes(1);

    // After clicking play, button toggles to ■ STOP CUE
    const stopBtn = screen.getByRole('button', { name: /■ STOP CUE/i });
    fireEvent.click(stopBtn);
    expect(stopCueMock).toHaveBeenCalledWith('sfx_test_cue');
  });

  it('stops all audio when STOP ALL button is clicked', async () => {
    render(<AudioCueStudio name="sfx_test_cue" />);

    await waitFor(() => {
      expect(screen.getByText(/AUDIO CUE \/\/ sfx_test_cue/i)).toBeDefined();
    });

    const stopAllBtn = screen.getByRole('button', { name: /■ STOP ALL/i });
    fireEvent.click(stopAllBtn);
    expect(stopAllAudioMock).toHaveBeenCalledTimes(1);
  });

  it('stops ambiance drone when STOP AMBIANCE DRONE is clicked', async () => {
    render(<AudioCueStudio name="sfx_test_cue" />);

    await waitFor(() => {
      expect(screen.getByText(/AUDIO CUE \/\/ sfx_test_cue/i)).toBeDefined();
    });

    const stopDroneBtn = screen.getByRole('button', { name: /■ STOP AMBIANCE DRONE/i });
    fireEvent.click(stopDroneBtn);
    expect(stopAmbianceMock).toHaveBeenCalledTimes(1);
  });

  it('terminates all playing audio on unmount', async () => {
    const { unmount } = render(<AudioCueStudio name="sfx_test_cue" />);

    await waitFor(() => {
      expect(screen.getByText(/AUDIO CUE \/\/ sfx_test_cue/i)).toBeDefined();
    });

    unmount();
    expect(stopAllAudioMock).toHaveBeenCalled();
  });

  it('clones active cue with _copy suffix and sets clone source', async () => {
    const store = useGamedataStore.getState();
    const selectSpy = vi.spyOn(store, 'selectItem');
    const setCloneSpy = vi.spyOn(store, 'setCloneSource');

    render(<AudioCueStudio name="sfx_test_cue" />);

    await waitFor(() => {
      expect(screen.getByText(/AUDIO CUE \/\/ sfx_test_cue/i)).toBeDefined();
    });

    const cloneBtn = screen.getByRole('button', { name: /^CLONE$/i });
    fireEvent.click(cloneBtn);

    expect(setCloneSpy).toHaveBeenCalledWith('sfx_test_cue');
    expect(selectSpy).toHaveBeenCalledWith('audioCues', '__new__');
  });

  it('selects matched ambiance depth band keys and OVERCLOCKED_GRID in simulator', async () => {
    render(<AudioCueStudio name="sfx_test_cue" />);

    await waitFor(() => {
      expect(screen.getByText(/AUDIO CUE \/\/ sfx_test_cue/i)).toBeDefined();
    });

    const depthSelect = screen.getByDisplayValue(/FLOORS 1–5 \(CORRUPTED_DATA\)/i) as HTMLSelectElement;
    fireEvent.change(depthSelect, { target: { value: 'FLOORS 6–10 (STATIC_HORRORS)' } });
    expect(depthSelect.value).toBe('FLOORS 6–10 (STATIC_HORRORS)');

    const conditionSelect = screen.getByDisplayValue(/NORMAL \(None\)/i) as HTMLSelectElement;
    fireEvent.change(conditionSelect, { target: { value: 'OVERCLOCKED_GRID' } });
    expect(conditionSelect.value).toBe('OVERCLOCKED_GRID');
  });
});
