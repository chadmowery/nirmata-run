'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { GameState } from '@/game/states/types';
import styles from './styles.module.css';

export const GameOver: React.FC = () => {
  const stats = useStore(gameStore, (s) => s.stats);
  const setGameStatus = useStore(gameStore, (s) => s.setGameStatus);

  const handleRestart = () => {
    // For now, reload the page to cleanly reset everything. 
    // In a mature app, we'd destroy the engine and re-init.
    window.location.reload();
  };

  return (
    <div className={styles.menuOverlay}>
      <div className={styles.titleContainer}>
        <h1 className={styles.mainTitle} style={{ color: 'var(--error-color)', textShadow: '0 0 20px var(--error-color)' }}>
          CONNECTION_LOST
        </h1>
        <p className={styles.subTitle}>CRITICAL_SYSTEM_FAILURE // BIOMETRICS_OFFLINE</p>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statLabel}>Cycles Completed:</div>
        <div className={styles.statValue}>{stats.turns}</div>
        
        <div className={styles.statLabel}>Threats Neutralized:</div>
        <div className={styles.statValue}>{stats.kills}</div>
      </div>

      <div className={styles.menuActions}>
        <button 
          className={styles.menuButton}
          onClick={handleRestart}
          style={{ borderColor: 'var(--error-color)' }}
        >
          Re-establish Link
        </button>
        
        <button 
          className={styles.menuButton}
          onClick={() => setGameStatus(GameState.MainMenu)}
        >
          Main Console
        </button>
      </div>
    </div>
  );
};
