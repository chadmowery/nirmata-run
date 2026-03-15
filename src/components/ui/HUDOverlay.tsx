'use client';

import React from 'react';
import { PlayerHUD } from './PlayerHUD';
import { MessageLog } from './MessageLog';
import { NearbyEntities } from './NearbyEntities';
import styles from './styles.module.css';

export const HUDOverlay: React.FC = () => {
  return (
    <div className={styles.overlay}>
      <PlayerHUD />
      <NearbyEntities />
      <MessageLog />
    </div>
  );
};
