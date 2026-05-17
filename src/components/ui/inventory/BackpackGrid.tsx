import React, { useState } from 'react';
import { RunInventory } from '@shared/components/run-inventory';
import styles from './InventoryOverlay.module.css';
import { InRunItemTooltip } from './InRunItemTooltip';

interface GameContext {
  playerId: number;
  world: {
    getComponent: (entityId: number, component: any) => any;
  };
}

export const BackpackGrid: React.FC = () => {
  const [hoveredEntityId, setHoveredEntityId] = useState<number | null>(null);
  const gameContext = (window as unknown as { gameContext: GameContext }).gameContext;
  if (!gameContext) return null;

  const inv = gameContext.world.getComponent(gameContext.playerId, RunInventory);
  const slots = Array(15).fill(null);

  return (
    <div className={styles.panel}>
      <h3>Backpack</h3>
      <div className={styles.gridContainer}>
        {slots.map((_, i) => {
          const entityId = inv ? (inv.software[i] || inv.equipment[i]) : null;
          return (
            <div 
              key={i} 
              className={styles.slot}
              onMouseEnter={() => entityId && setHoveredEntityId(entityId)}
              onMouseLeave={() => setHoveredEntityId(null)}
            >
              {entityId ? 'Item' : ''}
              {hoveredEntityId === entityId && <InRunItemTooltip entityId={entityId} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
