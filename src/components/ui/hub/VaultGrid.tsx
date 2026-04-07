import React from 'react';
import { VaultItem } from '@/shared/profile';
import { ItemTooltip } from './ItemTooltip';
import styles from './VaultGrid.module.css';

interface VaultGridProps {
  items: VaultItem[];
  onCellClick: (item: VaultItem, e: React.MouseEvent) => void;
  onCellRightClick: (item: VaultItem, e: React.MouseEvent) => void;
}

const VaultGrid: React.FC<VaultGridProps> = ({ items, onCellClick, onCellRightClick }) => {
  const [hoveredItem, setHoveredItem] = React.useState<{ item: VaultItem; x: number; y: number } | null>(null);

  const gridCells = Array(30).fill(null);
  items.slice(0, 30).forEach((item, index) => {
    gridCells[index] = item;
  });

  const handleMouseEnter = (item: VaultItem, e: React.MouseEvent) => {
    setHoveredItem({ item, x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredItem) {
      setHoveredItem({ ...hoveredItem, x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'uncommon': return 'var(--vibrant-cyan)';
      case 'rare': return 'var(--vibrant-pink)';
      case 'legendary': return 'var(--safety-orange)';
      default: return 'rgba(255, 255, 255, 0.2)';
    }
  };

  return (
    <div className={styles.gridContainer}>
      <div className={styles.grid}>
        {gridCells.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} className={styles.emptyCell} />;
          }

          const item = cell as VaultItem;
          const initials = item.templateId.substring(0, 2).toUpperCase();

          return (
            <div
              key={item.entityId}
              className={styles.cell}
              style={{ borderColor: getRarityColor(item.rarityTier) }}
              onClick={(e) => onCellClick(item, e)}
              onContextMenu={(e) => {
                e.preventDefault();
                onCellRightClick(item, e);
              }}
              onMouseEnter={(e) => handleMouseEnter(item, e)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <span className={styles.initials}>{initials}</span>
              <div className={styles.itemGlow} style={{ background: getRarityColor(item.rarityTier) }} />
            </div>
          );
        })}
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

export default VaultGrid;
