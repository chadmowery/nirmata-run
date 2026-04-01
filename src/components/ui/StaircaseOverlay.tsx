'use client';
import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import styles from './StaircaseOverlay.module.css';

export const StaircaseOverlay: React.FC = () => {
  const staircaseData = useStore(gameStore, (s) => s.staircaseData);
  const makeStaircaseDecision = useStore(gameStore, (s) => s.makeStaircaseDecision);

  if (!staircaseData) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-labelledby="staircase-title">
      <div className={styles.modal}>
        <h1 id="staircase-title" className={styles.title}>DESCEND_PROTOCOL</h1>
        <h2 className={styles.subtitle}>LOCATION: TRANSITION_NODE</h2>

        <div className={styles.message}>
          WARNING: Proceeding to Floor {staircaseData.targetFloor} will finalize current floor calculations. 
          Reality stability will be further compromised upon entry.
        </div>

        <div className={styles.buttonRow}>
          <button 
            className={styles.cancelButton}
            onClick={() => makeStaircaseDecision(false)}
          >
            ABORT
          </button>
          <button 
            className={styles.confirmButton}
            onClick={() => makeStaircaseDecision(true)}
          >
            CONFIRM_DESCENT
          </button>
        </div>
      </div>
    </div>
  );
};
