import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AudioCuePicker } from '../AudioCuePicker';
import { FormField } from '../../editors/shared/FormField';
import { setAudioEngine, IAudioEngine, SoundCueDef, PlayCueOptions } from '@engine/audio';

describe('AudioCuePicker & AudioProfile Dropdown Support', () => {
  let mockEngine: IAudioEngine;
  let playCueMock: ReturnType<typeof vi.fn<(cue: SoundCueDef, options?: PlayCueOptions) => void>>;
  let stopCueMock: ReturnType<typeof vi.fn<(cueId: string, fadeDurationSec?: number) => void>>;

  beforeEach(() => {
    vi.clearAllMocks();
    playCueMock = vi.fn();
    stopCueMock = vi.fn();

    mockEngine = {
      init: vi.fn(),
      destroy: vi.fn(),
      playCue: playCueMock,
      stopCue: stopCueMock,
      stopAllAudio: vi.fn(),
      startHoldRamp: vi.fn(),
      updateHoldRamp: vi.fn(),
      stopHoldRamp: vi.fn(),
      setAmbianceState: vi.fn(),
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

    // Mock fetch to simulate /api/dev/gamedata/audio-cues
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/dev/gamedata/audio-cues')) {
        return {
          ok: true,
          json: async () => ({
            cues: [
              { id: 'sfx_step_player', bus: 'sfx', mode: 'synth' },
              { id: 'sfx_melee_hit', bus: 'sfx', mode: 'synth' },
              { id: 'ui_lever_click_primary', bus: 'ui', mode: 'synth' },
              { id: 'amb_main_menu', bus: 'ambiance', mode: 'synth' },
            ],
          }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    setAudioEngine(null);
  });

  it('renders dropdown select with recommended optgroup, SFX, UI, and Ambiance groups', async () => {
    const onChangeMock = vi.fn();
    const { container } = render(
      <AudioCuePicker
        value="sfx_step_player"
        onChange={onChangeMock}
        fieldKey="stepCue"
        componentKey="audioProfile"
      />,
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe('sfx_step_player');

    // Wait for optgroups to be present
    await waitFor(() => {
      const optgroups = Array.from(container.querySelectorAll('optgroup'));
      const labels = optgroups.map((og) => og.label);

      expect(labels.some((l) => l.includes('RECOMMENDED FOR STEPCUE'))).toBe(true);
      expect(labels.some((l) => l.includes('SFX (COMBAT, MOVEMENT & PROPS)'))).toBe(true);
      expect(labels.some((l) => l.includes('UI (INTERFACES & LEVERS)'))).toBe(true);
      expect(labels.some((l) => l.includes('AMBIANCE (DRONES & WORLD EMITTERS)'))).toBe(true);
    });
  });

  it('calls onChange with selected cue ID when dropdown choice changes', () => {
    const onChangeMock = vi.fn();
    render(
      <AudioCuePicker
        value=""
        onChange={onChangeMock}
        fieldKey="attackCue"
        componentKey="audioProfile"
      />,
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'sfx_melee_hit' } });

    expect(onChangeMock).toHaveBeenCalledWith('sfx_melee_hit');
  });

  it('calls onChange with undefined when "-- None (No Sound) --" is selected', () => {
    const onChangeMock = vi.fn();
    render(
      <AudioCuePicker
        value="sfx_step_player"
        onChange={onChangeMock}
        fieldKey="stepCue"
        componentKey="audioProfile"
      />,
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '' } });

    expect(onChangeMock).toHaveBeenCalledWith(undefined);
  });

  it('preserves and selects custom cue ID not present in static sound-cues list', () => {
    const onChangeMock = vi.fn();
    render(
      <AudioCuePicker
        value="sfx_unknown_custom_sound"
        onChange={onChangeMock}
        fieldKey="deathCue"
        componentKey="audioProfile"
      />,
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('sfx_unknown_custom_sound');
    expect(screen.getByText(/\[Custom\] sfx_unknown_custom_sound/i)).toBeDefined();
  });

  it('auditions cue with parent pitchMultiplier and volumeMultiplier when play button is clicked', () => {
    const onChangeMock = vi.fn();
    render(
      <AudioCuePicker
        value="sfx_step_player"
        onChange={onChangeMock}
        fieldKey="stepCue"
        componentKey="audioProfile"
        pitchMultiplier={1.4}
        volumeMultiplier={0.7}
      />,
    );

    const playBtn = screen.getByRole('button', { name: /Audition sfx_step_player/i });
    fireEvent.click(playBtn);

    expect(playCueMock).toHaveBeenCalledTimes(1);
    const [cue, options] = playCueMock.mock.calls[0];
    expect(cue.id).toBe('sfx_step_player');
    expect(options?.pitchMultiplier).toBe(1.4);
    expect(options?.volumeMultiplier).toBe(0.7);
  });

  it('switches between dropdown and manual text input when toggle button is clicked', () => {
    const onChangeMock = vi.fn();
    render(
      <AudioCuePicker
        value="sfx_step_player"
        onChange={onChangeMock}
        fieldKey="stepCue"
        componentKey="audioProfile"
      />,
    );

    // Initial is dropdown
    expect(screen.getByRole('combobox')).toBeDefined();

    // Toggle to manual
    const toggleBtn = screen.getByRole('button', { name: /MANUAL/i });
    fireEvent.click(toggleBtn);

    const textInput = screen.getByRole('textbox') as HTMLInputElement;
    expect(textInput.value).toBe('sfx_step_player');

    fireEvent.change(textInput, { target: { value: 'sfx_step_ghost' } });
    expect(onChangeMock).toHaveBeenCalledWith('sfx_step_ghost');

    // Toggle back to list
    const listBtn = screen.getByRole('button', { name: /LIST/i });
    fireEvent.click(listBtn);
    expect(screen.getByRole('combobox')).toBeDefined();
  });

  it('clears cue value when clear button is clicked', () => {
    const onChangeMock = vi.fn();
    render(
      <AudioCuePicker
        value="sfx_step_player"
        onChange={onChangeMock}
        fieldKey="stepCue"
        componentKey="audioProfile"
      />,
    );

    const clearBtn = screen.getByRole('button', { name: /✕/i });
    fireEvent.click(clearBtn);

    expect(onChangeMock).toHaveBeenCalledWith(undefined);
  });

  it('renders AudioCuePicker dropdown automatically inside FormField for audioProfile cue fields', () => {
    const onChangeMock = vi.fn();
    render(
      <FormField
        componentKey="audioProfile"
        meta={{
          key: 'interactCue',
          type: 'string',
          optional: true,
          nullable: false,
        }}
        value="sfx_prop_search"
        allValues={{
          interactCue: 'sfx_prop_search',
          pitchMultiplier: 1.2,
          volumeMultiplier: 0.9,
        }}
        onChange={onChangeMock}
      />,
    );

    // Should render a dropdown combobox rather than a plain text input
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe('sfx_prop_search');

    // Should render audition button
    const playBtn = screen.getByRole('button', { name: /Audition sfx_prop_search/i });
    expect(playBtn).toBeDefined();

    fireEvent.click(playBtn);
    expect(playCueMock).toHaveBeenCalledTimes(1);
    const [, options] = playCueMock.mock.calls[0];
    expect(options?.pitchMultiplier).toBe(1.2);
    expect(options?.volumeMultiplier).toBe(0.9);
  });

  it('toggles audition button between play and stop and invokes engine.stopCue', () => {
    const onChangeMock = vi.fn();
    render(
      <AudioCuePicker
        value="sfx_step_player"
        onChange={onChangeMock}
        fieldKey="stepCue"
        componentKey="audioProfile"
      />,
    );

    // Initial state: play button
    const playBtn = screen.getByRole('button', { name: /Audition sfx_step_player/i });
    expect(playBtn.textContent).toBe('▶');

    // Click play
    fireEvent.click(playBtn);
    expect(playCueMock).toHaveBeenCalledTimes(1);

    // Toggled to stop button
    const stopBtn = screen.getByRole('button', { name: /Stop sfx_step_player/i });
    expect(stopBtn.textContent).toBe('■');

    // Click stop
    fireEvent.click(stopBtn);
    expect(stopCueMock).toHaveBeenCalledWith('sfx_step_player');

    // Back to play button
    expect(screen.getByRole('button', { name: /Audition sfx_step_player/i })).toBeDefined();
  });

  it('stops active cue audition on unmount', () => {
    const onChangeMock = vi.fn();
    const { unmount } = render(
      <AudioCuePicker
        value="sfx_step_player"
        onChange={onChangeMock}
        fieldKey="stepCue"
        componentKey="audioProfile"
      />,
    );

    unmount();
    expect(stopCueMock).toHaveBeenCalledWith('sfx_step_player');
  });
});
