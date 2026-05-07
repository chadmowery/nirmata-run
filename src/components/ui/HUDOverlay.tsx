'use client';

import React from 'react';
import { PlayerHUD } from './PlayerHUD';
import { MessageLog } from './MessageLog';
import { NearbyEntities } from './NearbyEntities';
import { FloorIndicator } from './FloorIndicator';
import EventTimelinePanel from './EventTimelinePanel';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import styles from './styles.module.css';

export const HUDOverlay: React.FC = () => {
  const heatTier = useStore(gameStore, (s) => s.heatTier);

  // Map tier number to CSS module class name
  const tierClassMap: Record<number, string> = {
    0: styles.heatTierClean,
    1: styles.heatTierJitter,
    2: styles.heatTierGhosting,
    3: styles.heatTierInversion,
    4: styles.heatTierScreenTear,
    5: styles.heatTierGrayscale,
  };

  const tierClass = tierClassMap[heatTier] ?? styles.heatTierClean;

  return (
    <div className={`${styles.overlay} ${tierClass}`}>
      <FloorIndicator />
      <PlayerHUD />
      <NearbyEntities />
      <MessageLog />
      <EventTimelinePanel />
    </div>
  );
};
