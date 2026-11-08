import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { gameStore } from '@/game/ui/store';
import { AudioSettingsPanel } from '../AudioSettingsPanel';

describe('AudioSettingsPanel Component', () => {
  beforeEach(() => {
    localStorage.clear();
    gameStore.setState({
      audioSettings: {
        masterVolume: 0.8,
        ambianceVolume: 0.6,
        sfxVolume: 0.7,
        uiVolume: 0.65,
        muted: false,
      },
      systemSettingsModalVisible: false,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders audio title, mute toggle button, and all four bus volume sliders', () => {
    render(<AudioSettingsPanel />);

    expect(screen.getByText(/AUDIO & TELEMETRY CALIBRATION/i)).toBeDefined();
    expect(screen.getByText(/MUTE ALL \[消音\]/i)).toBeDefined();

    expect(screen.getByRole('slider', { name: /MASTER GAIN/i })).toBeDefined();
    expect(screen.getByRole('slider', { name: /AMBIANCE \/ DRONE BUS/i })).toBeDefined();
    expect(screen.getByRole('slider', { name: /TACTICAL SFX BUS/i })).toBeDefined();
    expect(screen.getByRole('slider', { name: /INTERFACE \/ LEVER BUS/i })).toBeDefined();
  });

  it('updates slider value, store state, and localStorage when slider is moved', () => {
    render(<AudioSettingsPanel />);

    const masterSlider = screen.getByRole('slider', { name: /MASTER GAIN/i }) as HTMLInputElement;
    expect(masterSlider.value).toBe('0.8');

    fireEvent.change(masterSlider, { target: { value: '0.45' } });

    expect(gameStore.getState().audioSettings.masterVolume).toBe(0.45);
    const persisted = JSON.parse(localStorage.getItem('nirmata_audio_settings') ?? '{}');
    expect(persisted.masterVolume).toBe(0.45);
  });

  it('toggles mute, disables sliders, and toggles button label', () => {
    render(<AudioSettingsPanel />);

    const muteBtn = screen.getByText(/MUTE ALL \[消音\]/i);
    fireEvent.click(muteBtn);

    expect(gameStore.getState().audioSettings.muted).toBe(true);
    expect(screen.getByText(/UNMUTE AUDIO \[消音解除\]/i)).toBeDefined();

    const masterSlider = screen.getByRole('slider', { name: /MASTER GAIN/i }) as HTMLInputElement;
    expect(masterSlider.disabled).toBe(true);
    expect(screen.getAllByText('MUTED').length).toBe(4);

    // Unmute
    const unmuteBtn = screen.getByText(/UNMUTE AUDIO \[消音解除\]/i);
    fireEvent.click(unmuteBtn);

    expect(gameStore.getState().audioSettings.muted).toBe(false);
    expect(masterSlider.disabled).toBe(false);
  });
});
