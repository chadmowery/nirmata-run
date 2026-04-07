'use client';
import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import styles from './styles.module.css';

export const HeatBar: React.FC = () => {
  const heat = useStore(gameStore, (s) => s.player.heat);
  const maxHeat = useStore(gameStore, (s) => s.player.maxHeat);
  const percent = maxHeat > 0 ? (heat / maxHeat) * 100 : 0;

  // Determine state per neural risk system
  const getBarClass = () => {
    if (percent >= 90) return styles.heatCritical;
    if (percent >= 60) return styles.heatWarning;
    return styles.heatSafe;
  };

  return (
    <div className={styles.heatContainer}>
      <div className={styles.heatLabel}>
        NEURAL_HEAT: {Math.round(heat)} / {maxHeat}
      </div>
      <div className={styles.heatBarTrack}>
        <div
          className={`${styles.heatBarFill} ${getBarClass()}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
};
