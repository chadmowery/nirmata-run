/**
 * Nirmata Runner — Client UI Audio Controller
 * Provides immediate feedback triggers for atomic UI elements, buttons,
 * mechanical levers, hold-to-confirm sweeps, tab changes, and modals.
 */

import { getAudioEngine } from '@engine/audio';
import { getSoundCue } from './cue-registry';

class UIAudioController {
  public play(
    cueId: string,
    options?: { volumeMultiplier?: number; pitchMultiplier?: number },
  ): void {
    const cue = getSoundCue(cueId);
    if (!cue) return;
    const engine = getAudioEngine();
    engine.playCue(cue, options);
  }

  public playHover(): void {
    this.play('ui_lever_hover');
  }

  public playClick(variant?: 'primary' | 'cyan' | 'danger'): void {
    switch (variant) {
      case 'cyan':
        this.play('ui_lever_click_cyan');
        break;
      case 'danger':
        this.play('ui_lever_click_danger');
        break;
      case 'primary':
      default:
        this.play('ui_lever_click_primary');
        break;
    }
  }

  public startHoldRamp(): string {
    const cue = getSoundCue('ui_lever_hold_ramp');
    const engine = getAudioEngine();
    return engine.startHoldRamp(
      cue ?? {
        id: 'ui_lever_hold_ramp',
        bus: 'ui',
        mode: 'synth',
        baseVolume: 0.35,
        cooldownMs: 0,
        pitchVariance: 0,
      },
    );
  }

  public updateHoldRamp(voiceId: string, progress: number): void {
    if (!voiceId) return;
    const engine = getAudioEngine();
    engine.updateHoldRamp(voiceId, progress);
  }

  public stopHoldRamp(voiceId: string): void {
    if (!voiceId) return;
    const engine = getAudioEngine();
    engine.stopHoldRamp(voiceId);
  }

  public playHoldConfirm(): void {
    this.play('ui_lever_hold_confirm');
  }

  public playHoldCancel(): void {
    this.play('ui_lever_hold_cancel');
  }

  public playTabSwitch(): void {
    this.play('ui_tab_switch');
  }

  public playModalOpen(): void {
    this.play('ui_modal_open');
  }

  public playModalClose(): void {
    this.play('ui_modal_close');
  }

  public playTypewriter(): void {
    this.play('ui_boot_typewriter');
  }
}

export const uiAudio = new UIAudioController();
