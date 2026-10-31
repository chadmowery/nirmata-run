import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { PortConfig } from '@/game/shells/shared';
import { InstalledItem } from '@/shared/profile';
import { SlotBox } from './SlotBox';
import {
  isWeaponItem,
  isArmorItem,
  isSoftwareItem,
  canSocketSoftware,
} from '@/shared/utils/equipment-util';
import styles from './LoadoutSlotPanel.module.css';

interface LoadoutSlotPanelProps {
  portConfig: PortConfig;
  equippedItems: InstalledItem[];
  shellId: string;
  onSlotDrop: (slotType: string, slotIndex: number) => void;
  onSlotDragStart: (item: InstalledItem) => void;
  onSoftwareSocket?: (targetEntityId: number, softwareEntityId: number) => void;
}

export const LoadoutSlotPanel: React.FC<LoadoutSlotPanelProps> = ({
  portConfig,
  equippedItems,
  onSlotDrop,
  onSlotDragStart,
  onSoftwareSocket,
}) => {
  const draggedItem = useStore(gameStore, (s) => s.draggedItem);
  const dragOverSlot = useStore(gameStore, (s) => s.dragOverSlot);
  const setDragOverSlot = useStore(gameStore, (s) => s.setDragOverSlot);

  const renderSlotGroup = (
    type: 'firmware' | 'augment' | 'software' | 'weapon' | 'armor' | 'backpack',
    max: number,
    customLabel?: string,
  ) => {
    const slots = [];
    const typeEquipped = equippedItems.filter((i) => i.type === type);

    for (let i = 0; i < max; i++) {
      const item = typeEquipped[i];
      const slotId = `${type}-${i}`;
      const isOver = dragOverSlot === slotId;

      let isCompatible = false;
      let isSocketDrop = false;

      if (draggedItem) {
        if (!item) {
          // Empty slot drop checks
          if (type === 'firmware') isCompatible = draggedItem.itemType === 'firmware';
          else if (type === 'augment') isCompatible = draggedItem.itemType === 'augment';
          else if (type === 'software') isCompatible = draggedItem.itemType === 'software';
          else if (type === 'weapon') isCompatible = isWeaponItem(draggedItem);
          else if (type === 'armor') isCompatible = isArmorItem(draggedItem);
          else if (type === 'backpack') isCompatible = true;
        } else {
          // Filled slot: check if dragging software onto weapon or armor to socket
          if (
            (type === 'weapon' || type === 'armor') &&
            isSoftwareItem(draggedItem) &&
            canSocketSoftware(draggedItem.templateId, item.blueprintId, type)
          ) {
            isCompatible = true;
            isSocketDrop = true;
          }
        }
      }

      const handlePointerEnter = () => {
        if (draggedItem && draggedItem.entityId !== -1) {
          setDragOverSlot(slotId);
        }
      };

      const handlePointerLeave = () => {
        setDragOverSlot(null);
      };

      const handlePointerUp = () => {
        if (isOver && isCompatible) {
          if (isSocketDrop && item && onSoftwareSocket && draggedItem) {
            onSoftwareSocket(item.entityId, draggedItem.entityId);
          } else if (!item) {
            onSlotDrop(type, i);
          }
        }
      };

      const handleDragStart = () => {
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
          onClick={item ? () => onSlotDragStart(item) : undefined}
        >
          <SlotBox
            filled={!!item}
            itemName={item?.blueprintId}
            slotType={type}
            legacy={item?.isLegacy}
            socketedSoftware={item?.socketedSoftware}
          />
        </div>,
      );
    }

    return (
      <div className={styles.slotGroup} key={type}>
        <div className={styles.slotGroupLabel}>{customLabel || type.toUpperCase()}</div>
        <div className={styles.slotRow}>{slots}</div>
      </div>
    );
  };

  return (
    <div className={styles.panelContainer}>
      {renderSlotGroup('firmware', portConfig.maxFirmware, 'FIRMWARE PORTS')}
      {renderSlotGroup('augment', portConfig.maxAugment, 'AUGMENT PORTS')}
      {renderSlotGroup('software', portConfig.maxSoftware, 'SOFTWARE PORTS')}
      {renderSlotGroup('weapon', 1, 'PRIMARY WEAPON')}
      {renderSlotGroup('armor', 1, 'TACTICAL ARMOR')}
      {renderSlotGroup('backpack', 5, 'RUN BACKPACK (RESERVE)')}
    </div>
  );
};
