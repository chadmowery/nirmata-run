'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { GameState } from '@/game/states/types';
import styles from './styles.module.css';

export const MainMenu: React.FC = () => {
  const setGameStatus = useStore(gameStore, (s) => s.setGameStatus);
  const walletScrap = useStore(gameStore, (s) => s.walletScrap);

  const handleEnterDeck = () => {
    // Transition to Hub instead of directly to Playing
    setGameStatus(GameState.Hub);
  };

  return (
    <div className={styles.menuOverlay}>
      <div className={styles.titleContainer}>
        <h1 className={styles.mainTitle}>NIRMATA_RUNNER</h1>
        <p className={styles.subTitle}>v1.0.0 // NEURAL_LINK_ESTABLISHED</p>
        <div className={styles.walletDisplay}>
          CREDITS: {walletScrap.toLocaleString()}
        </div>
      </div>

      <div className={styles.menuActions}>
        <button 
          className={styles.menuButton}
          onClick={handleEnterDeck}
        >
          ENTER_NEURAL_DECK
        </button>
        
        <button className={styles.menuButton} disabled>
          WEEKLY_RESET [STANDBY]
        </button>
      </div>

      <div style={{ marginTop: '4rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
        [PRESS ANY KEY TO LINK]
      </div>
    </div>
  );
};
