import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { PortConfig } from '@/game/shells/types';
import { InstalledItem } from '@/shared/profile';
import { SlotBox } from './SlotBox';
import styles from './LoadoutSlotPanel.module.css';

interface LoadoutSlotPanelProps {
  portConfig: PortConfig;
  equippedItems: InstalledItem[];
  shellId: string;
  onSlotDrop: (slotType: string, slotIndex: number) => void;
  onSlotDragStart: (item: InstalledItem) => void;
}

export const LoadoutSlotPanel: React.FC<LoadoutSlotPanelProps> = ({
  portConfig,
  equippedItems,
  shellId,
  onSlotDrop,
  onSlotDragStart
}) => {
  const draggedItem = useStore(gameStore, (s) => s.draggedItem);
  const dragOverSlot = useStore(gameStore, (s) => s.dragOverSlot);
  const setDragOverSlot = useStore(gameStore, (s) => s.setDragOverSlot);

  const renderSlotGroup = (type: 'firmware' | 'augment' | 'software', max: number) => {
    const slots = [];
    const typeEquipped = equippedItems.filter(i => i.type === type);

    for (let i = 0; i < max; i++) {
      const item = typeEquipped[i];
      const slotId = `${type}-${i}`;
      const isOver = dragOverSlot === slotId;
      
      const isCompatible = draggedItem ? (
        (draggedItem.itemType === 'firmware' && type === 'firmware') ||
        (draggedItem.itemType === 'augment' && type === 'augment') ||
        (draggedItem.itemType === 'software' && type === 'software')
      ) : false;

      const handlePointerEnter = () => {
        if (draggedItem && draggedItem.entityId !== -1) {
          setDragOverSlot(slotId);
        }
      };

      const handlePointerLeave = () => {
        setDragOverSlot(null);
      };

      const handlePointerUp = () => {
        if (isOver && isCompatible && !item) {
          onSlotDrop(type, i);
        }
      };

      const handleDragStart = (e: React.PointerEvent) => {
        if (item) {
          onSlotDragStart(item);
        }
      };

      slots.push(
        <div 
          key={slotId}
          className={`
            ${styles.slotWrapper} 
            ${isOver && isCompatible ? styles.dropValid : ''} 
            ${isOver && !isCompatible ? styles.dropInvalid : ''}
          `}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onPointerUp={handlePointerUp}
          onPointerDown={item ? handleDragStart : undefined}
        >
          <SlotBox 
            filled={!!item}
            itemName={item?.blueprintId}
            slotType={type}
            legacy={item?.isLegacy}
          />
        </div>
      );
    }

    return (
      <div className={styles.slotGroup} key={type}>
        <div className={styles.slotGroupLabel}>{type.toUpperCase()}</div>
        <div className={styles.slotRow}>
          {slots}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.panelContainer}>
      {renderSlotGroup('firmware', portConfig.maxFirmware)}
      {renderSlotGroup('augment', portConfig.maxAugment)}
      {renderSlotGroup('software', portConfig.maxSoftware)}
    </div>
  );
};
