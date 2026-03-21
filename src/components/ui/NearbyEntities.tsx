'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import styles from './styles.module.css';
import { Eye } from 'lucide-react';

export const NearbyEntities: React.FC = () => {
  const visibleEntities = useStore(gameStore, (s) => s.visibleEntities);

  if (visibleEntities.length === 0) return null;

  return (
    <div className={`${styles.terminalPanel} ${styles.entitiesPanel}`}>
      <div className={styles.panelHeader}>
        <Eye size={14} className="inline mr-1" /> Visible Threats
      </div>
      <div className={styles.scrollArea}>
        {visibleEntities.map((entity) => (
          <div key={entity.id} className={styles.entityItem}>
            <div className={styles.entityName}>{entity.name}</div>
            <div className={styles.entityHealthBar}>
              <div 
                className={styles.entityHealthFill} 
                style={{ width: `${entity.maxHp > 0 ? Math.max(0, (entity.hp / entity.maxHp) * 100) : 0}%` }} 
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
