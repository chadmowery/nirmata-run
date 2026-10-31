'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { PanelCard } from './atomic';
import styles from './styles.module.css';

export const NearbyEntities: React.FC = () => {
  const visibleEntities = useStore(gameStore, (s) => s.visibleEntities);

  if (!visibleEntities || visibleEntities.length === 0) {
    return null;
  }

  const getEntityGlyph = (name: string) => {
    const firstChar = name.charAt(0);
    return firstChar || 'E';
  };

  return (
    <PanelCard
      title="HOSTILES RADAR"
      badge={`${visibleEntities.length} VISIBLE THREATS`}
      className={styles.nearbyPanel}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {visibleEntities.map((entity) => {
          const hpPercent =
            entity.maxHp > 0 ? (entity.hp / entity.maxHp) * 100 : 0;
          return (
            <div key={entity.id} className={styles.threatCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={styles.threatGlyph}>{getEntityGlyph(entity.name)}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className={styles.threatName}>{entity.name}</span>
                  <span className={styles.threatHp}>
                    HP: {entity.hp} / {entity.maxHp}
                  </span>
                </div>
              </div>

              <div style={{ width: '60px', height: '4px', background: '#1c2638' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, hpPercent)}%`,
                    background: 'var(--c-danger)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
};

export default NearbyEntities;
