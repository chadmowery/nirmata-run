import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uiAudio } from '../ui-audio';
import { getAudioEngine, setAudioEngine, IAudioEngine } from '@engine/audio';

describe('UIAudioController', () => {
  let mockEngine: IAudioEngine;

  beforeEach(() => {
    mockEngine = {
      init: vi.fn(),
      destroy: vi.fn(),
      playCue: vi.fn(),
      playAmbianceCue: vi.fn(),
      stopCue: vi.fn(),
      stopVoice: vi.fn(),
      updateVoiceSpatial: vi.fn(),
      stopAllAudio: vi.fn(),
      startHoldRamp: vi.fn(() => 'ramp-voice-42'),
      updateHoldRamp: vi.fn(),
      stopHoldRamp: vi.fn(),
      setAmbianceState: vi.fn(),
      getAmbianceState: vi.fn(() => ({
        depthBand: 'MAIN_MENU',
        sectorCondition: null,
        heatTier: 0,
        isAnchorDucked: false,
        isPaused: false,
      })),
      stopAmbiance: vi.fn(),
      updateSettings: vi.fn(),
      getSettings: vi.fn(() => ({
        muted: false,
        masterVolume: 0.8,
        ambianceVolume: 0.6,
        sfxVolume: 0.85,
        uiVolume: 0.75,
      })),
      isMuted: vi.fn(() => false),
    };

    setAudioEngine(mockEngine);
  });

  it('triggers hover sound', () => {
    uiAudio.playHover();
    expect(mockEngine.playCue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ui_lever_hover' }),
      undefined,
    );
  });

  it('triggers click sound for primary, cyan, and danger variants', () => {
    uiAudio.playClick('primary');
    expect(mockEngine.playCue).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'ui_lever_click_primary' }),
      undefined,
    );

    uiAudio.playClick('cyan');
    expect(mockEngine.playCue).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'ui_lever_click_cyan' }),
      undefined,
    );

    uiAudio.playClick('danger');
    expect(mockEngine.playCue).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'ui_lever_click_danger' }),
      undefined,
    );
  });

  it('handles hold-to-confirm ramp lifecycle', () => {
    const voiceId = uiAudio.startHoldRamp();
    expect(voiceId).toBe('ramp-voice-42');
    expect(mockEngine.startHoldRamp).toHaveBeenCalled();

    uiAudio.updateHoldRamp(voiceId, 0.5);
    expect(mockEngine.updateHoldRamp).toHaveBeenCalledWith('ramp-voice-42', 0.5);

    uiAudio.stopHoldRamp(voiceId);
    expect(mockEngine.stopHoldRamp).toHaveBeenCalledWith('ramp-voice-42');

    uiAudio.playHoldConfirm();
    expect(mockEngine.playCue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ui_lever_hold_confirm' }),
      undefined,
    );

    uiAudio.playHoldCancel();
    expect(mockEngine.playCue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ui_lever_hold_cancel' }),
      undefined,
    );
  });

  it('triggers tab switch, modal, and typewriter ticks', () => {
    uiAudio.playTabSwitch();
    expect(mockEngine.playCue).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'ui_tab_switch' }),
      undefined,
    );

    uiAudio.playModalOpen();
    expect(mockEngine.playCue).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'ui_modal_open' }),
      undefined,
    );

    uiAudio.playModalClose();
    expect(mockEngine.playCue).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'ui_modal_close' }),
      undefined,
    );

    uiAudio.playTypewriter();
    expect(mockEngine.playCue).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'ui_boot_typewriter' }),
      undefined,
    );
  });
});
