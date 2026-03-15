'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import styles from './styles.module.css';
import { Heart, Trophy, Zap } from 'lucide-react';

export const PlayerHUD: React.FC = () => {
  const player = useStore(gameStore, (s) => s.player);

  const hpPercent = Math.min(100, Math.max(0, (player.hp / player.maxHp) * 100)) || 0;
  const xpNextLevel = player.level * 100; // Simple XP curve for now
  const xpPercent = Math.min(100, Math.max(0, (player.xp / xpNextLevel) * 100)) || 0;

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

      {/* Buffs/Statuses */}
      {player.statuses.length > 0 && (
        <div className="mt-2 flex gap-2">
          {player.statuses.map((status, i) => (
            <span key={i} className="text-xs px-1 border border-green-500 uppercase">
              {status}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
