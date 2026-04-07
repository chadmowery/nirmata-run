import React, { useState } from 'react';
import { VaultItem } from '@/shared/profile';
import { ItemCard } from './ItemCard';
import { ItemTooltip } from './ItemTooltip';
import styles from './StashItemList.module.css';

interface StashItemListProps {
  items: VaultItem[];
  activeFilter: 'all' | 'firmware' | 'augment' | 'software';
  onFilterChange: (filter: string) => void;
  onDragStart: (item: VaultItem) => void;
}

export const StashItemList: React.FC<StashItemListProps> = ({
  items,
  activeFilter,
  onFilterChange,
  onDragStart
}) => {
  const [hoveredItem, setHoveredItem] = useState<{ item: VaultItem; x: number; y: number } | null>(null);

  const filteredItems = items.filter(item => {
    if (activeFilter === 'all') return true;
    return item.itemType === activeFilter;
  });

  const handleHover = (item: VaultItem, e: React.PointerEvent) => {
    setHoveredItem({
      item,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleHoverEnd = () => {
    setHoveredItem(null);
  };

  const filters: Array<'all' | 'firmware' | 'augment' | 'software'> = ['all', 'firmware', 'augment', 'software'];

  return (
    <div className={styles.container}>
      <div className={styles.filterRow}>
        {filters.map(f => (
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
          filteredItems.map(item => (
            <ItemCard 
              key={item.entityId} 
              item={item} 
              onDragStart={onDragStart}
              onHover={handleHover}
              onHoverEnd={handleHoverEnd}
            />
          ))
        ) : (
          <div className={styles.emptyState}>
            STASH_EMPTY // EXTRACT_TO_COLLECT
          </div>
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
