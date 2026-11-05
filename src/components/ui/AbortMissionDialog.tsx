'use client';

import React, { useEffect, useCallback } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { GameState } from '@/game/states/types';
import { dispatchUIAction } from '@/game/input/input-bridge';
import { GameAction } from '@/game/input/actions';
import { GameContext } from '@/game/types';
import { getActiveGameContext } from '@/game/setup';
import { TaikokuPlacard, BtnLever } from './atomic';
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
  const showBSOD = useStore(gameStore, (s) => s.showBSOD);
  const setGameStatus = useStore(gameStore, (s) => s.setGameStatus);
  const currentFloor = useStore(gameStore, (s) => s.currentFloor);
  const stats = useStore(gameStore, (s) => s.stats);
  const player = useStore(gameStore, (s) => s.player);

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

    // Retrieve active session ID
    let sessionId = getActiveGameContext()?.sessionId || 'default-player-session';
    if (typeof window !== 'undefined' && sessionId === 'default-player-session') {
      sessionId =
        localStorage.getItem('nimrata_sessionId') ||
        (window as unknown as { gameContext?: { sessionId?: string } }).gameContext?.sessionId ||
        sessionId;
    }

    try {
      // 1. Dispatch authoritative ABORT_RUN action to server
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: { type: 'ABORT_RUN' },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Server handles turn, emits RUN_ENDED, and returns delta payload
        if (data.payload) {
          const { applyStateDelta } = await import('@shared/reconciliation');
          const context = getActiveGameContext() || (typeof window !== 'undefined' ? (window as unknown as { gameContext?: GameContext }).gameContext : undefined);
          if (context) {
            applyStateDelta(
              context.world,
              context.grid,
              context.turnManager,
              context.eventBus,
              data.payload,
            );
          }
        }

        // If gameStatus was not automatically transitioned by sync bridge, trigger BSOD autopsy
        if (gameStore.getState().gameStatus !== GameState.GameOver) {
          const calculatedScore = currentFloor * 100 + stats.kills * 10;
          gameStore.getState().setRunResultsData({
            reason: 'OPERATOR_MANUAL_DESYNC',
            deathReason: 'OPERATOR EMERGENCY LINK ABORT',
            floorNumber: currentFloor,
            turnsElapsed: stats.turns,
            enemiesKilled: stats.kills,
            peakHeat: player.heat ?? 0,
            itemsSecured: {
              firmware: 0,
              augments: 0,
              software: 0,
              scrap: Math.floor((player.xp || 0) * 0.5),
            },
            score: calculatedScore,
          });

          showBSOD('OPERATOR_MANUAL_DESYNC [EMERGENCY CORE EJECT]');
          setGameStatus(GameState.GameOver);
        }
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch (err) {
      console.warn('[AbortMissionDialog] Fallback to client-side desync:', err);

      // Local fallback in standalone/offline/test scenarios
      const calculatedScore = currentFloor * 100 + stats.kills * 10;
      gameStore.getState().setRunResultsData({
        reason: 'OPERATOR_MANUAL_DESYNC',
        deathReason: 'OPERATOR EMERGENCY LINK ABORT',
        floorNumber: currentFloor,
        turnsElapsed: stats.turns,
        enemiesKilled: stats.kills,
        peakHeat: player.heat ?? 0,
        itemsSecured: {
          firmware: 0,
          augments: 0,
          software: 0,
          scrap: Math.floor(player.xp * 0.5),
        },
        score: calculatedScore,
      });

      showBSOD('OPERATOR_MANUAL_DESYNC [EMERGENCY CORE EJECT]');
      setGameStatus(GameState.GameOver);
    }
  }, [
    onConfirmAbort,
    setAbortDialogVisible,
    currentFloor,
    stats,
    player,
    showBSOD,
    setGameStatus,
  ]);

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
          stampText="ABORT // CATASTROPHIC"
          stampVariant="danger"
          onClose={handleClose}
          closeLabel="✕ RESUME [ESC]"
          style={{ marginBottom: 0, border: 'none', borderBottom: '2px solid var(--c-danger)' }}
        />

        <div className={styles.body}>
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
