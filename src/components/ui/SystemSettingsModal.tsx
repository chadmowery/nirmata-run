'use client';

import React, { useEffect, useCallback } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { TaikokuPlacard, BtnLever } from './atomic';
import { AudioSettingsPanel } from './AudioSettingsPanel';
import styles from './SystemSettingsModal.module.css';

export const SystemSettingsModal: React.FC = () => {
  const visible = useStore(gameStore, (s) => s.systemSettingsModalVisible);
  const setVisible = useStore(gameStore, (s) => s.setSystemSettingsModalVisible);

  const handleClose = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [visible, handleClose]);

  if (!visible) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-settings-title"
      onClick={handleClose}
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <TaikokuPlacard
          kanji="環境設定"
          title="SYSTEM SETTINGS // AUDIO & TELEMETRY CALIBRATION"
          stampText="CONFIG // NOMINAL"
          stampVariant="cyan"
          onClose={handleClose}
          closeLabel="✕ CLOSE [ESC]"
          style={{
            marginBottom: 0,
            border: 'none',
            borderBottom: '2px solid var(--c-accent, #d8ff00)',
          }}
        />

        <div className={styles.body}>
          <AudioSettingsPanel showCardWrapper={false} />

          <div className={styles.footer}>
            <BtnLever variant="primary" onClick={handleClose} rightSlot="[ESC]">
              DONE [完了]
            </BtnLever>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettingsModal;
