'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { BtnLever } from './atomic';
import { uiAudio } from '@/game/audio/ui-audio';
import styles from './AudioSettingsPanel.module.css';

interface AudioSettingsPanelProps {
  className?: string;
  showCardWrapper?: boolean;
}

export const AudioSettingsPanel: React.FC<AudioSettingsPanelProps> = ({
  className = '',
  showCardWrapper = true,
}) => {
  const audioSettings = useStore(gameStore, (s) => s.audioSettings);
  const setAudioSettings = useStore(gameStore, (s) => s.setAudioSettings);
  const toggleMute = useStore(gameStore, (s) => s.toggleMute);

  const handleSliderChange = (
    key: 'masterVolume' | 'ambianceVolume' | 'sfxVolume' | 'uiVolume',
    value: number,
  ) => {
    setAudioSettings({ [key]: value });
    uiAudio.playHover();
  };

  const sliders = [
    {
      key: 'masterVolume' as const,
      label: 'MASTER GAIN',
      kanji: '主音量 // SYSTEM BUS',
      value: audioSettings.masterVolume,
    },
    {
      key: 'ambianceVolume' as const,
      label: 'AMBIANCE / DRONE BUS',
      kanji: '環境音 // BACKGROUND & DRONES',
      value: audioSettings.ambianceVolume,
    },
    {
      key: 'sfxVolume' as const,
      label: 'TACTICAL SFX BUS',
      kanji: '効果音 // COMBAT & MOVEMENT',
      value: audioSettings.sfxVolume,
    },
    {
      key: 'uiVolume' as const,
      label: 'INTERFACE / LEVER BUS',
      kanji: '操作音 // TACTILE LEVER FEEDBACK',
      value: audioSettings.uiVolume,
    },
  ];

  const content = (
    <div className={`${styles.panel} ${className}`}>
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <span className={styles.title}>AUDIO & TELEMETRY CALIBRATION</span>
          <span className={styles.subTitle}>音響設定 // BUS MIXER & LIMITER CALIBRATION</span>
        </div>
        <BtnLever
          variant={audioSettings.muted ? 'danger' : 'primary'}
          onClick={toggleMute}
          style={{ minWidth: '160px', padding: '6px 12px', fontSize: '11px' }}
        >
          {audioSettings.muted ? 'UNMUTE AUDIO [消音解除]' : 'MUTE ALL [消音]'}
        </BtnLever>
      </div>

      <div className={styles.slidersList}>
        {sliders.map((s) => {
          const pct = Math.round(s.value * 100);
          return (
            <div key={s.key} className={styles.sliderRow}>
              <div className={styles.labelArea}>
                <span className={styles.label}>{s.label}</span>
                <span className={styles.kanji}>{s.kanji}</span>
              </div>

              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={s.value}
                  disabled={audioSettings.muted}
                  aria-label={s.label}
                  aria-valuetext={`${pct}%`}
                  onChange={(e) => handleSliderChange(s.key, parseFloat(e.target.value))}
                  className={styles.slider}
                />
                <span
                  className={`${styles.percentage} ${audioSettings.muted ? styles.muted : ''}`}
                >
                  {audioSettings.muted ? 'MUTED' : `${pct}%`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (!showCardWrapper) {
    return content;
  }

  return <div className="panel-card">{content}</div>;
};

export default AudioSettingsPanel;
