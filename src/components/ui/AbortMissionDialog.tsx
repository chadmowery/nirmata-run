'use client';

import React, { useEffect, useCallback } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { dispatchUIAction } from '@/game/input/input-bridge';
import { GameAction } from '@/game/input/actions';
import { getActiveGameContext } from '@/game/active-context';
import { Dying } from '@shared/components';
import { TaikokuPlacard, BtnLever } from './atomic';
import { AudioSettingsPanel } from './AudioSettingsPanel';
import styles from './AbortMissionDialog.module.css';

interface AbortMissionDialogProps {
  onClose?: () => void;
  onConfirmAbort?: () => void;
}

export const AbortMissionDialog: React.FC<AbortMissionDialogProps> = ({
  onClose,
  onConfirmAbort,
}) => {
  const setAbortDialogVisible = useStore(gameStore, (s) => s.setAbortDialogVisible);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      setAbortDialogVisible(false);
      // Resume Playing state in engine
      dispatchUIAction(GameAction.PAUSE);
    }
  }, [onClose, setAbortDialogVisible]);

  const handleConfirm = useCallback(async () => {
    if (onConfirmAbort) {
      onConfirmAbort();
      return;
    }

    setAbortDialogVisible(false);

    const ctx = getActiveGameContext();
    if (!ctx) return;

    try {
      if (ctx.submitAction) {
        await ctx.submitAction({ type: 'ABORT_RUN' });
      } else if (ctx.world && ctx.playerId) {
        // Fallback for standalone/local test environments: attach Dying via Death Protocol
        ctx.world.addComponent(ctx.playerId, Dying, {
          killerId: ctx.playerId,
          reason: 'OPERATOR_MANUAL_DESYNC',
        });
      }
    } catch (err) {
      console.error('[AbortMissionDialog] Failed to abort run:', err);
    }
  }, [onConfirmAbort, setAbortDialogVisible]);

  // Handle ESC key to dismiss abort dialog and resume game
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleClose]);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="abort-dialog-title"
      onClick={handleClose}
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <TaikokuPlacard
          kanji="緊急切断"
          title="EMERGENCY ABORT PROTOCOL // OPERATOR DESYNC"
          stampText="PAUSED // CALIBRATION"
          stampVariant="danger"
          onClose={handleClose}
          closeLabel="✕ RESUME [ESC]"
          style={{ marginBottom: 0, border: 'none', borderBottom: '2px solid var(--c-danger)' }}
        />

        <div className={styles.body}>
          <AudioSettingsPanel showCardWrapper={false} />

          <div className={styles.warningBox}>
            <div className={styles.warningTitle}>
              <span>[!] CAUTION: MANUAL TERMINATION OF ACTIVE DEPLOYMENT</span>
            </div>
            <div className={styles.warningDesc}>
              You are about to sever neural link synchronization with your chassis. Ejecting
              under hostile interference causes catastrophic operator desynchronization (KIA).
            </div>
          </div>

          <div className={styles.consequencesSection}>
            <div className={styles.sectionHeader}>CASUALTY & ASSET FORFEITURE CONSEQUENCES:</div>

            <div className={styles.consequenceItem}>
              <span className={styles.consequenceIcon}>[1]</span>
              <div className={styles.consequenceText}>
                <span className={styles.consequenceTitle}>PERMANENT CARGO DISINTEGRATION</span>
                <span className={styles.consequenceDetail}>
                  All unextracted weapons, armor, software, and augments currently held in your
                  backpack will be permanently obliterated.
                </span>
              </div>
            </div>

            <div className={styles.consequenceItem}>
              <span className={styles.consequenceIcon}>[2]</span>
              <div className={styles.consequenceText}>
                <span className={styles.consequenceTitle}>PITY SALVAGE RECOVERY ONLY (50%)</span>
                <span className={styles.consequenceDetail}>
                  Extraction protocols are aborted. Only a 50% pity salvage yield of harvested
                  scrap will be recovered to your permanent vault.
                </span>
              </div>
            </div>

            <div className={styles.consequenceItem}>
              <span className={styles.consequenceIcon}>[3]</span>
              <div className={styles.consequenceText}>
                <span className={styles.consequenceTitle}>OPERATOR CASUALTY RECORD (KIA)</span>
                <span className={styles.consequenceDetail}>
                  Active neural link is zeroed out. The mission concludes immediately and enters
                  post-mortem telemetry autopsy.
                </span>
              </div>
            </div>
          </div>

          <div className={styles.actionsRow}>
            <BtnLever variant="primary" onClick={handleClose} rightSlot="[ESC]">
              RESUME MISSION [任務継続]
            </BtnLever>

            <BtnLever
              variant="danger"
              holdToConfirm={true}
              holdDurationMs={2000}
              onClick={handleConfirm}
              rightSlot="HOLD 2s"
            >
              CONFIRM DESYNC & ABORT [切断実行]
            </BtnLever>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AbortMissionDialog;
