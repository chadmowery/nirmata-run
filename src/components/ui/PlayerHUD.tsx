'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import styles from './styles.module.css';
import { Heart, Trophy, Zap, Coins } from 'lucide-react';
import { dispatchUIAction } from '@/game/input/input-bridge';
import { GameAction } from '@/game/input/actions';
import { StabilityBar } from './StabilityBar';

export const PlayerHUD: React.FC = () => {
  const player = useStore(gameStore, (s) => s.player);
  const scrap = useStore(gameStore, (s) => s.scrap);

  const hpPercent = (player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0) || 0;
  const xpNextLevel = (player.level || 1) * 100; // Simple XP curve for now
  const xpPercent = (xpNextLevel > 0 ? (player.xp / xpNextLevel) * 100 : 0) || 0;

  return (
    <div className={`${styles.terminalPanel} ${styles.statsPanel}`}>
      <div className={styles.panelHeader}>Character Status</div>

      {/* HP Bar */}
      <div className={styles.statRow}>
        <span className={styles.statLabel}>
          <Heart size={14} className="inline mr-1" /> HP
        </span>
        <span className={styles.statValue}>{player.hp} / {player.maxHp}</span>
      </div>
      <div className={styles.barContainer}>
        <div 
          className={`${styles.barFill} ${styles.hpBar}`} 
          style={{ width: `${hpPercent}%` }} 
        />
      </div>

      {/* Level & XP */}
      <div className={styles.statRow}>
        <span className={styles.statLabel}>
          <Trophy size={14} className="inline mr-1" /> LEVEL
        </span>
        <span className={styles.statValue}>{player.level}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>
          <Zap size={14} className="inline mr-1" /> XP
        </span>
        <span className={styles.statValue}>{player.xp} / {xpNextLevel}</span>
      </div>
      <div className={styles.barContainer}>
        <div 
          className={`${styles.barFill} ${styles.xpBar}`} 
          style={{ width: `${xpPercent}%` }} 
        />
      </div>

      {/* Scrap */}
      <div className={styles.statRow}>
        <span className={styles.statLabel}>
          <Coins size={14} className="inline mr-1" /> SCRAP
        </span>
        <span className={styles.statValue}>{scrap}</span>
      </div>

      {/* Stability Bar */}
      <StabilityBar />

      {/* Action Controls */}
      <div className={styles.actionRow}>
        <button 
          className={styles.hudButton}
          onClick={() => dispatchUIAction(GameAction.WAIT)}
          title="Skip turn and recover energy (Z)"
        >
          Wait
        </button>
      </div>
    </div>
  );
};
