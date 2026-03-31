'use client';

import React from 'react';
import { PlayerHUD } from './PlayerHUD';
import { MessageLog } from './MessageLog';
import { NearbyEntities } from './NearbyEntities';
import { FloorIndicator } from './FloorIndicator';
import styles from './styles.module.css';

export const HUDOverlay: React.FC = () => {
  return (
    <div className={styles.overlay}>
      <FloorIndicator />
      <PlayerHUD />
      <NearbyEntities />
      <MessageLog />
    </div>
  );
};
