'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { GameState } from '@/game/states/types';
import styles from './styles.module.css';

export const MainMenu: React.FC = () => {
  const setGameStatus = useStore(gameStore, (s) => s.setGameStatus);

  const handleStart = () => {
    // Transition to Playing triggers engine initialization in page.tsx
    setGameStatus(GameState.Playing);
  };

  return (
    <div className={styles.menuOverlay}>
      <div className={styles.titleContainer}>
        <h1 className={styles.mainTitle}>FLASH_RUNNER</h1>
        <p className={styles.subTitle}>v0.1.0 // ENGINE_READY</p>
      </div>

      <div className={styles.menuActions}>
        <button 
          className={styles.menuButton}
          onClick={handleStart}
        >
          Initialize Session
        </button>
        
        <button className={styles.menuButton} disabled>
          High Scores [OFFLINE]
        </button>
      </div>

      <div style={{ marginTop: '4rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
        [PRESS ANY KEY TO START]
      </div>
    </div>
  );
};
