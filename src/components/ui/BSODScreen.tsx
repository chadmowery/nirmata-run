'use client';
import React, { useEffect } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import styles from './BSODScreen.module.css';

export const BSODScreen: React.FC = () => {
  const bsodReason = useStore(gameStore, (s) => s.bsodReason);
  const hideBSOD = useStore(gameStore, (s) => s.hideBSOD);
  const showRunResults = useStore(gameStore, (s) => s.showRunResults);
  const runResults = useStore(gameStore, (s) => s.runResults);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = isReduced ? 1000 : 2500;

    const timer = setTimeout(() => {
      hideBSOD();
      if (runResults) {
        showRunResults(runResults);
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [hideBSOD, showRunResults, runResults]);

  return (
    <div className={styles.bsod}>
      <h1 className={styles.title}>FATAL_EXCEPTION</h1>
      <p className={styles.reason}>{bsodReason}</p>
    </div>
  );
};
