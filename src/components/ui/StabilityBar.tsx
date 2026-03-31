'use client';
import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import styles from './styles.module.css';

export const StabilityBar: React.FC = () => {
  const stability = useStore(gameStore, (s) => s.stability);
  const maxStability = useStore(gameStore, (s) => s.maxStability);
  const percent = maxStability > 0 ? (stability / maxStability) * 100 : 0;

  // Determine state per UI-SPEC interaction states
  const getBarClass = () => {
    if (stability === 0) return styles.stabilityDegraded;
    if (percent <= 10) return styles.stabilityCritical;
    if (percent <= 30) return styles.stabilityWarning;
    return styles.stabilitySafe;
  };

  return (
    <div className={styles.stabilityContainer}>
      <div className={styles.stabilityLabel}>REALITY_STABILITY: {Math.round(percent)}%</div>
      <div className={styles.stabilityBarTrack}>
        <div
          className={`${styles.stabilityBarFill} ${getBarClass()}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
