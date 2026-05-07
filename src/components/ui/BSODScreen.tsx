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
      <div style={{ position: 'relative', zIndex: 3 }}>
        <h1 className={styles.title}>FATAL_EXCEPTION</h1>
        <p className={styles.reason}>{bsodReason || "0x00000000_NULL_POINTER"}</p>
        
        <div style={{ marginTop: '40px', opacity: 0.6, fontSize: '14px' }}>
          <p>*** STOP: 0x0000007E (0xFFFFFFFFC0000005, 0xFFFFF80002E5A188)</p>
          <p>*** nirmata_runner.sys - Address 0xFFFFF80002E5A188 base at 0xFFFFF80002E00000</p>
          <p style={{ marginTop: '20px' }}>Collecting data for crash dump...</p>
          <p>Initializing disk for crash dump...</p>
          <p>Beginning dump of physical memory.</p>
          <p>Dumping physical memory to disk: 100%</p>
        </div>
      </div>
    </div>
  );
};
