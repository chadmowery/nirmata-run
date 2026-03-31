'use client';
import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import styles from './styles.module.css';

export const FloorIndicator: React.FC = () => {
  const currentFloor = useStore(gameStore, (s) => s.currentFloor);
  const depthBand = useStore(gameStore, (s) => s.depthBand);
  const floorStr = String(currentFloor).padStart(2, '0');

  return (
    <div className={styles.floorIndicator}>
      FLOOR {floorStr} // DEPTH BAND: {depthBand}
    </div>
  );
};
