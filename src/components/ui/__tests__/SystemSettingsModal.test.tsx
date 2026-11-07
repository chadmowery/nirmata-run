import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { gameStore } from '@/game/ui/store';
import { SystemSettingsModal } from '../SystemSettingsModal';

describe('SystemSettingsModal Component', () => {
  beforeEach(() => {
    localStorage.clear();
    gameStore.setState({
      systemSettingsModalVisible: false,
      audioSettings: {
        masterVolume: 0.8,
        ambianceVolume: 0.6,
        sfxVolume: 0.7,
        uiVolume: 0.65,
        muted: false,
      },
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('does not render when systemSettingsModalVisible is false', () => {
    render(<SystemSettingsModal />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders modal dialog when systemSettingsModalVisible is true', () => {
    gameStore.setState({ systemSettingsModalVisible: true });
    render(<SystemSettingsModal />);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/SYSTEM SETTINGS \/\/ AUDIO & TELEMETRY CALIBRATION/i)).toBeDefined();
    expect(screen.getByText(/DONE \[完了\]/i)).toBeDefined();
  });

  it('closes modal when Escape key is pressed', () => {
    gameStore.setState({ systemSettingsModalVisible: true });
    render(<SystemSettingsModal />);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(gameStore.getState().systemSettingsModalVisible).toBe(false);
  });

  it('closes modal when DONE button is clicked', () => {
    gameStore.setState({ systemSettingsModalVisible: true });
    render(<SystemSettingsModal />);

    const doneBtn = screen.getByText(/DONE \[完了\]/i);
    fireEvent.click(doneBtn);
    expect(gameStore.getState().systemSettingsModalVisible).toBe(false);
  });
});
