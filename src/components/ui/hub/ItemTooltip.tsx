import React from 'react';
import styles from './ItemTooltip.module.css';
import { VaultItem } from '@/shared/profile';

interface ItemTooltipProps {
  item: VaultItem | null;
  position: { x: number, y: number };
  visible: boolean;
}

export const ItemTooltip: React.FC<ItemTooltipProps> = ({
  item,
  position,
  visible
}) => {
  if (!item || !visible) return null;

  // Format templateId for display: "neural-spike" -> "NEURAL_SPIKE"
  const displayName = item.templateId.replace(/-/g, '_').toUpperCase();
  const displayType = item.itemType.toUpperCase();
  const displayRarity = item.rarityTier.toUpperCase();

  return (
    <div 
      className={styles.tooltip} 
      style={{ 
        left: `${position.x + 15}px`, 
        top: `${position.y + 15}px` 
      }}
      aria-live="polite"
    >
      <div className={styles.header}>
        <span className={styles.name}>{displayName}</span>
        <span className={styles.type}>{displayType}</span>
      </div>
      
      <div className={styles.details}>
        <div className={styles.rarity}>RARITY: {displayRarity}</div>
        {item.extractedAtFloor !== undefined && (
          <div className={styles.floor}>SECURED_AT: FLOOR_{item.extractedAtFloor}</div>
        )}
      </div>

      <div className={styles.stats}>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>ID</span>
          <span className={styles.statValue}>{item.entityId}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>TIMESTAMP</span>
          <span className={styles.statValue}>{new Date(item.extractedAtTimestamp).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Note: stats and isLegacy would need a registry lookup or richer VaultItem data */}
    </div>
  );
};
