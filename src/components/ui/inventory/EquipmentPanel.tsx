import React, { useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { EquipmentSlots, SoftwareDef, EquipmentDef } from '@shared/components';
import styles from './InventoryOverlay.module.css';
import { InRunItemTooltip } from './InRunItemTooltip';

interface GameContext {
  playerId: number;
  world: {
    getComponent: (entityId: number, component: any) => any;
    hasComponent: (entityId: number, component: any) => boolean;
  };
}

export const EquipmentPanel: React.FC = () => {
  const [hoveredEntityId, setHoveredEntityId] = useState<number | null>(null);
  
  const gameContext = (window as unknown as { gameContext: GameContext }).gameContext;
  
  // Connect to Zustand game store to subscribe to revisions and handle updates
  const inventoryRevision = useStore(gameStore, (s) => s.inventoryRevision);
  const draggedRunItemEntityId = useStore(gameStore, (s) => s.draggedRunItemEntityId);
  const dragOverSlot = useStore(gameStore, (s) => s.dragOverSlot);
  const optimisticWeapon = useStore(gameStore, (s) => s.optimisticWeapon);
  const optimisticArmor = useStore(gameStore, (s) => s.optimisticArmor);

  if (!gameContext) return null;

  const eq = gameContext.world.getComponent(gameContext.playerId, EquipmentSlots);

  // Compute displayed weapon and armor ids based on optimistic state overrides
  const weaponId = optimisticWeapon !== undefined ? optimisticWeapon : eq?.weapon;
  const armorId = optimisticArmor !== undefined ? optimisticArmor : eq?.armor;

  const renderSlot = (slotType: 'weapon' | 'armor', entityId: number | null | undefined) => {
    const isDraggedOver = dragOverSlot === slotType;
    
    // Check compatibility of currently dragged item
    let isCompatible = false;
    if (draggedRunItemEntityId) {
      const isSw = gameContext.world.hasComponent(draggedRunItemEntityId, SoftwareDef);
      const swDef = gameContext.world.getComponent(draggedRunItemEntityId, SoftwareDef);
      const isEq = gameContext.world.hasComponent(draggedRunItemEntityId, EquipmentDef);
      const eqDef = gameContext.world.getComponent(draggedRunItemEntityId, EquipmentDef);
      
      if (slotType === 'weapon') {
        isCompatible = (isEq && eqDef.slotType === 'weapon') || (isSw && swDef.targetSlot === 'weapon');
      } else if (slotType === 'armor') {
        isCompatible = (isEq && eqDef.slotType === 'armor') || (isSw && swDef.targetSlot === 'armor');
      }
    }
    
    // Get item name and details if entityId is present
    let itemName = '';
    let isSoftwareItem = false;
    let detailText = '';
    if (entityId) {
      const sw = gameContext.world.getComponent(entityId, SoftwareDef);
      const eqItem = gameContext.world.getComponent(entityId, EquipmentDef);
      if (sw) {
        itemName = sw.name;
        isSoftwareItem = true;
        detailText = `[Software: ${sw.type}]`;
      } else if (eqItem) {
        itemName = eqItem.name;
        detailText = `[${slotType.toUpperCase()}]`;
      } else {
        itemName = `Entity #${entityId}`;
      }
    }
    
    // Class name based on drag states
    let borderStyle = {};
    if (isDraggedOver) {
      borderStyle = {
        border: `2px solid ${isCompatible ? '#00F0FF' : '#FF0055'}`,
      };
    }
    
    return (
      <div 
        className={`${styles.slot} ${entityId ? styles.slotFilled : ''}`}
        style={{
          ...borderStyle,
          cursor: entityId ? 'grab' : 'default',
          position: 'relative',
          padding: '8px',
          minHeight: '80px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          marginBottom: '16px',
        }}
        draggable={!!entityId}
        onDragStart={(e) => {
          if (entityId) {
            e.dataTransfer.setData('application/json', JSON.stringify({ source: 'equipment', slotType, entityId }));
            gameStore.getState().setDraggedRunItemEntityId(entityId);
          }
        }}
        onDragEnd={() => {
          gameStore.getState().setDraggedRunItemEntityId(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDragEnter={() => {
          gameStore.getState().setDragOverSlot(slotType);
        }}
        onDragLeave={() => {
          if (gameStore.getState().dragOverSlot === slotType) {
            gameStore.getState().setDragOverSlot(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          gameStore.getState().setDragOverSlot(null);
          try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.source === 'inventory') {
              const itemEntityId = data.entityId;
              const isSw = gameContext.world.hasComponent(itemEntityId, SoftwareDef);
              const swDef = gameContext.world.getComponent(itemEntityId, SoftwareDef);
              const isEq = gameContext.world.hasComponent(itemEntityId, EquipmentDef);
              const eqDef = gameContext.world.getComponent(itemEntityId, EquipmentDef);
              
              if (slotType === 'weapon') {
                if (isEq && eqDef.slotType === 'weapon') {
                  gameStore.getState().optimisticEquipItem(itemEntityId, 'weapon');
                  const eventBus = (window as any).gameContext?.eventBus;
                  eventBus?.emit('EQUIP_REQUESTED', { slotType: 'weapon', itemEntityId });
                } else if (isSw && swDef.targetSlot === 'weapon') {
                  const eventBus = (window as any).gameContext?.eventBus;
                  eventBus?.emit('BURN_SOFTWARE_REQUESTED', { runInventoryIndex: data.inventoryIndex, targetSlot: 'weapon' });
                } else {
                  const eventBus = (window as any).gameContext?.eventBus;
                  eventBus?.emit('MESSAGE_EMITTED', { text: 'Invalid drop target. Must be a compatible slot.', type: 'error' });
                }
              } else if (slotType === 'armor') {
                if (isEq && eqDef.slotType === 'armor') {
                  gameStore.getState().optimisticEquipItem(itemEntityId, 'armor');
                  const eventBus = (window as any).gameContext?.eventBus;
                  eventBus?.emit('EQUIP_REQUESTED', { slotType: 'armor', itemEntityId });
                } else if (isSw && swDef.targetSlot === 'armor') {
                  const eventBus = (window as any).gameContext?.eventBus;
                  eventBus?.emit('BURN_SOFTWARE_REQUESTED', { runInventoryIndex: data.inventoryIndex, targetSlot: 'armor' });
                } else {
                  const eventBus = (window as any).gameContext?.eventBus;
                  eventBus?.emit('MESSAGE_EMITTED', { text: 'Invalid drop target. Must be a compatible slot.', type: 'error' });
                }
              }
            }
          } catch (err) {
            console.error(err);
          }
        }}
        onDoubleClick={() => {
          if (entityId) {
            gameStore.getState().optimisticUnequipItem(slotType);
            const eventBus = (window as any).gameContext?.eventBus;
            eventBus?.emit('UNEQUIP_REQUESTED', { slotType, slotIndex: 0 });
          }
        }}
        onMouseEnter={() => entityId && setHoveredEntityId(entityId)}
        onMouseLeave={() => setHoveredEntityId(null)}
      >
        {entityId ? (
          <div>
            <div style={{ fontWeight: 'bold' }}>{itemName}</div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>{detailText}</div>
            <div style={{ fontSize: '9px', color: '#FF0055', marginTop: '4px' }}>Uninstall: Double-click to quick-uninstall.</div>
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>Empty Slot</div>
            <div style={{ fontSize: '9px', opacity: 0.6 }}>Drag an item here to equip.</div>
          </div>
        )}
        {hoveredEntityId === entityId && entityId && <InRunItemTooltip entityId={entityId} />}
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      <h3>Equipment</h3>
      {renderSlot('weapon', weaponId)}
      {renderSlot('armor', armorId)}
    </div>
  );
};
