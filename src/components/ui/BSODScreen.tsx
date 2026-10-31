'use client';

import React, { useEffect, useCallback } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { TaikokuStamp, BtnLever } from './atomic';
import styles from './BSODScreen.module.css';

export const BSODScreen: React.FC = () => {
  const bsodReason = useStore(gameStore, (s) => s.bsodReason);
  const hideBSOD = useStore(gameStore, (s) => s.hideBSOD);
  const showRunResults = useStore(gameStore, (s) => s.showRunResults);
  const runResults = useStore(gameStore, (s) => s.runResults);

  const handleAdvance = useCallback(() => {
    hideBSOD();
    if (runResults) {
      showRunResults(runResults);
    }
  }, [hideBSOD, showRunResults, runResults]);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = isReduced ? 1200 : 3000;

    const timer = setTimeout(() => {
      handleAdvance();
    }, duration);

    return () => clearTimeout(timer);
  }, [handleAdvance]);

  return (
    <div className={styles.bsodOverlay}>
      <div className={styles.bsodFrame}>
        <div className={styles.headerRow}>
          <div>
            <div style={{ color: 'var(--c-accent-secondary)', fontSize: '10px', fontWeight: 800 }}>
              非常事態 // CRITICAL KERNEL TRAP
            </div>
            <h1 className={styles.title}>*** FATAL_EXCEPTION: REALITY_COLLAPSE ***</h1>
            <div className={styles.reasonText}>
              TRIGGER: {bsodReason || '0x00000000_NULL_POINTER_EXCEPTION'}
            </div>
          </div>
          <TaikokuStamp variant="cyan">STOP 0x0000007E</TaikokuStamp>
        </div>

        <div className={styles.stackDump}>
          <p>*** STOP: 0x0000007E (0xFFFFFFFFC0000005, 0xFFFFF80002E5A188, 0xFFFFF8800109A8F8)</p>
          <p>*** ecs_delta.sys - Address 0xFFFFF80002E5A188 base at 0xFFFFF80002E00000</p>
          <p>*** combat_system.sys - Call frame 0x4890A921 [IntentResolutionFailure]</p>
          <p>*** gravedigger.sys - Entity destruction trap verified</p>
          <p style={{ marginTop: '8px', color: 'var(--c-accent-secondary)' }}>
            Physical memory image written to persistent ledger: 100% [SYNC COMPLETED]
          </p>
        </div>

        <div className={styles.footerRow}>
          <span>AUTO-ADVANCING TO POST-MORTEM AUTOPSY IN 3s...</span>
          <BtnLever variant="cyan" onClick={handleAdvance} rightSlot="→">
            PROCEED TO POST-MORTEM AUTOPSY [検視]
          </BtnLever>
        </div>
      </div>
    </div>
  );
};
