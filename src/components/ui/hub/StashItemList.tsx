import React, { useState } from 'react';
import { VaultItem } from '@/shared/profile';
import { isWeaponItem, isArmorItem } from '@/shared/utils/equipment-util';
import { ItemCard } from './ItemCard';
import { ItemTooltip } from './ItemTooltip';
import styles from './StashItemList.module.css';

export type StashFilter = 'all' | 'firmware' | 'augment' | 'software' | 'weapon' | 'armor' | 'consumable';

interface StashItemListProps {
  items: VaultItem[];
  activeFilter: StashFilter;
  onFilterChange: (filter: StashFilter) => void;
  onDragStart: (item: VaultItem) => void;
  onDoubleClick?: (item: VaultItem) => void;
}

export const StashItemList: React.FC<StashItemListProps> = ({
  items,
  activeFilter,
  onFilterChange,
  onDragStart,
  onDoubleClick,
}) => {
  const [hoveredItem, setHoveredItem] = useState<{ item: VaultItem; x: number; y: number } | null>(
    null,
  );

  const filteredItems = items.filter((item) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'weapon') return isWeaponItem(item);
    if (activeFilter === 'armor') return isArmorItem(item);
    return item.itemType === activeFilter;
  });

  const handleHover = (item: VaultItem, e: React.PointerEvent) => {
    setHoveredItem({
      item,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleHoverEnd = () => {
    setHoveredItem(null);
  };

  const filters: StashFilter[] = ['all', 'firmware', 'augment', 'software', 'weapon', 'armor', 'consumable'];

  return (
    <div className={styles.container}>
      <div className={styles.filterRow}>
        {filters.map((f) => (
          <button
            key={f}
            className={`${styles.filterTab} ${activeFilter === f ? styles.filterTabActive : ''}`}
            onClick={() => onFilterChange(f)}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      <div className={styles.itemList}>
        {filteredItems.length > 0 ? (
          filteredItems.map((item, idx) => (
            <ItemCard
              key={`${item.entityId}-${idx}`}
              item={item}
              onDragStart={onDragStart}
              onHover={handleHover}
              onHoverEnd={handleHoverEnd}
              onDoubleClick={onDoubleClick}
            />
          ))
        ) : (
          <div className={styles.emptyState}>STASH_EMPTY // EXTRACT_TO_COLLECT</div>
        )}
      </div>

      {hoveredItem && (
        <ItemTooltip
          item={hoveredItem.item}
          position={{ x: hoveredItem.x, y: hoveredItem.y }}
          visible={true}
        />
      )}
    </div>
  );
};
