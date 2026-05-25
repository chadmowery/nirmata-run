import React, { useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { 
  RunInventory, SoftwareDef, EquipmentDef, TemplateId, RarityTier 
} from '@shared/components';
import styles from './InventoryOverlay.module.css';
import { InRunItemTooltip } from './InRunItemTooltip';

interface GameContext {
  playerId: number;
  world: {
    getComponent: (entityId: number, component: any) => any;
    hasComponent: (entityId: number, component: any) => boolean;
  };
}

export const BackpackGrid: React.FC = () => {
  const [hoveredEntityId, setHoveredEntityId] = useState<number | null>(null);
  
  const gameContext = (window as unknown as { gameContext: GameContext }).gameContext;
  
  // Connect to Zustand game store to subscribe to revisions and handle updates
  const inventoryRevision = useStore(gameStore, (s) => s.inventoryRevision);
  const optimisticInventoryEquipmentIds = useStore(gameStore, (s) => s.optimisticInventoryEquipmentIds);

  if (!gameContext) return null;

  const inv = gameContext.world.getComponent(gameContext.playerId, RunInventory);
  
  // Construct the lists of items
  const softwareItems = inv?.software || [];
  let equipmentItems: Array<{ entityId: number; templateId: string; rarityTier: string }> = [];

  if (optimisticInventoryEquipmentIds !== null) {
    equipmentItems = optimisticInventoryEquipmentIds.map(id => {
      const templateRef = gameContext.world.getComponent(id, TemplateId);
      const rarity = gameContext.world.getComponent(id, RarityTier);
      return {
        entityId: id,
        templateId: templateRef?.id || 'unknown',
        rarityTier: rarity?.tier || 'v1.x'
      };
    });
  } else if (inv?.equipment) {
    equipmentItems = inv.equipment;
  }

  const slots = Array(15).fill(null);

  return (
    <div className={styles.panel}>
      <h3>Backpack</h3>
      <div className={styles.gridContainer}>
        {slots.map((_, i) => {
          const isSoftware = i < softwareItems.length;
          const softwareItem = isSoftware ? softwareItems[i] : null;
          const equipmentItem = !isSoftware ? equipmentItems[i - softwareItems.length] : null;
          const item = softwareItem || equipmentItem;
          const entityId = item?.entityId || null;

          // Get item name and details if entityId is present
          let itemName = '';
          let itemDetails = '';
          if (entityId) {
            const sw = gameContext.world.getComponent(entityId, SoftwareDef);
            const eq = gameContext.world.getComponent(entityId, EquipmentDef);
            if (sw) {
              itemName = sw.name;
              itemDetails = '[Software]';
            } else if (eq) {
              itemName = eq.name;
              itemDetails = `[${eq.slotType.toUpperCase()}]`;
            } else {
              itemName = `Entity #${entityId}`;
            }
          }

          return (
            <div 
              key={i} 
              className={`${styles.slot} ${entityId ? styles.slotFilled : ''}`}
              style={{
                cursor: entityId ? 'grab' : 'default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                padding: '4px',
                textAlign: 'center',
                position: 'relative'
              }}
              draggable={!!entityId}
              onDragStart={(e) => {
                if (entityId) {
                  const dragData = {
                    source: 'inventory',
                    entityId,
                    itemType: isSoftware ? 'software' : 'equipment',
                    inventoryIndex: isSoftware ? i : (i - softwareItems.length)
                  };
                  e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                  gameStore.getState().setDraggedRunItemEntityId(entityId);
                }
              }}
              onDragEnd={() => {
                gameStore.getState().setDraggedRunItemEntityId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                try {
                  const data = JSON.parse(e.dataTransfer.getData('application/json'));
                  if (data.source === 'equipment') {
                    // Trigger unequip with optimistic update
                    gameStore.getState().optimisticUnequipItem(data.slotType);
                    const eventBus = (window as any).gameContext?.eventBus;
                    if (eventBus) {
                      eventBus.emit('UNEQUIP_REQUESTED', { slotType: data.slotType, slotIndex: 0 });
                    }
                  }
                } catch (err) {
                  console.error('Error handling drop in BackpackGrid:', err);
                }
              }}
              onDoubleClick={() => {
                if (entityId) {
                  const isSw = gameContext.world.hasComponent(entityId, SoftwareDef);
                  const swDef = gameContext.world.getComponent(entityId, SoftwareDef);
                  const isEq = gameContext.world.hasComponent(entityId, EquipmentDef);
                  const eqDef = gameContext.world.getComponent(entityId, EquipmentDef);
                  
                  const eventBus = (window as any).gameContext?.eventBus;
                  if (isEq && eqDef) {
                    gameStore.getState().optimisticEquipItem(entityId, eqDef.slotType);
                    eventBus?.emit('EQUIP_REQUESTED', { slotType: eqDef.slotType, itemEntityId: entityId });
                  } else if (isSw && swDef) {
                    eventBus?.emit('BURN_SOFTWARE_REQUESTED', { 
                      runInventoryIndex: isSoftware ? i : (i - softwareItems.length), 
                      targetSlot: swDef.targetSlot 
                    });
                  }
                }
              }}
              onMouseEnter={() => entityId && setHoveredEntityId(entityId)}
              onMouseLeave={() => setHoveredEntityId(null)}
            >
              {entityId ? (
                <div>
                  <div style={{ fontWeight: 'bold' }}>{itemName}</div>
                  <div style={{ fontSize: '9px', opacity: 0.6 }}>{itemDetails}</div>
                </div>
              ) : ''}
              {hoveredEntityId === entityId && entityId && <InRunItemTooltip entityId={entityId} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
