import React, { useState } from 'react';
import { EquipmentSlots } from '@shared/components/equipment-slots';
import styles from './InventoryOverlay.module.css';
import { InRunItemTooltip } from './InRunItemTooltip';

interface GameContext {
  playerId: number;
  world: {
    getComponent: (entityId: number, component: any) => any;
  };
}

export const EquipmentPanel: React.FC = () => {
  const [hoveredEntityId, setHoveredEntityId] = useState<number | null>(null);
  const gameContext = (window as unknown as { gameContext: GameContext }).gameContext;
  if (!gameContext) return null;

  const eq = gameContext.world.getComponent(gameContext.playerId, EquipmentSlots);

  const renderSlot = (label: string, entityId: number | undefined) => (
    <div 
      className={styles.slot}
      onMouseEnter={() => entityId && setHoveredEntityId(entityId)}
      onMouseLeave={() => setHoveredEntityId(null)}
    >
      {label}: {entityId ?? 'Empty'}
      {hoveredEntityId === entityId && entityId && <InRunItemTooltip entityId={entityId} />}
    </div>
  );

  return (
    <div className={styles.panel}>
      <h3>Equipment</h3>
      {renderSlot('Weapon', eq?.weapon)}
      {renderSlot('Armor', eq?.armor)}
    </div>
  );
};
