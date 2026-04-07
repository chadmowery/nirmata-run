import React from 'react';
import { VaultItem } from '@/shared/profile';
import styles from './VaultOverflowBanner.module.css';

interface VaultOverflowBannerProps {
  overflowItems: VaultItem[];
  onSell: (entityId: number) => void;
  onDiscard: (entityId: number) => void;
}

const VaultOverflowBanner: React.FC<VaultOverflowBannerProps> = ({
  overflowItems,
  onSell,
  onDiscard,
}) => {
  if (overflowItems.length === 0) return null;

  const getSellPrice = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'uncommon': return 25;
      case 'rare': return 50;
      case 'legendary': return 150;
      default: return 10;
    }
  };

  return (
    <div className={styles.banner}>
      <h3 className={styles.heading}>OVERFLOW: {overflowItems.length} IN_LIMBO</h3>
      <div className={styles.itemList}>
        {overflowItems.map((item) => (
          <div key={item.entityId} className={styles.itemRow}>
            <span className={styles.itemName}>[{item.templateId}]</span>
            <div className={styles.actions}>
              <button
                className={styles.discardButton}
                onClick={() => onDiscard(item.entityId)}
              >
                DISCARD
              </button>
              <button
                className={styles.sellButton}
                onClick={() => onSell(item.entityId)}
              >
                SELL: {getSellPrice(item.rarityTier)} SCRAP
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VaultOverflowBanner;
