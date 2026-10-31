'use client';

import React, { useState } from 'react';
import { VaultItem } from '@/shared/profile';
import { ItemTooltip } from './ItemTooltip';
import { ItemMetadata, resolveItemMetadata } from './item-metadata';
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
  const [hoveredItem, setHoveredItem] = useState<{
    metadata: ItemMetadata;
    x: number;
    y: number;
  } | null>(null);

  if (overflowItems.length === 0) return null;

  const getSellPrice = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'uncommon':
        return 25;
      case 'rare':
        return 50;
      case 'legendary':
        return 150;
      default:
        return 10;
    }
  };

  const handleFocus = (metadata: ItemMetadata, e: React.FocusEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredItem({
      metadata,
      x: rect.right,
      y: rect.top,
    });
  };

  return (
    <div className={styles.banner}>
      <h3 className={styles.heading}>OVERFLOW: {overflowItems.length} IN_LIMBO</h3>
      <div className={styles.itemList}>
        {overflowItems.map((item) => {
          const meta = resolveItemMetadata({
            templateId: item.templateId,
            type: item.itemType,
            rarity: item.rarityTier,
            entityId: item.entityId,
            floor: item.extractedAtFloor,
            status: 'OVERFLOW // LIMBO',
            statusVariant: 'amber',
          });

          return (
            <div
              key={item.entityId}
              className={styles.itemRow}
              tabIndex={0}
              onPointerEnter={(e) =>
                setHoveredItem({ metadata: meta, x: e.clientX, y: e.clientY })
              }
              onPointerMove={(e) => {
                if (hoveredItem?.metadata.id === item.templateId) {
                  setHoveredItem({ metadata: meta, x: e.clientX, y: e.clientY });
                }
              }}
              onPointerLeave={() => setHoveredItem(null)}
              onFocus={(e) => handleFocus(meta, e)}
              onBlur={() => setHoveredItem(null)}
            >
              <span className={styles.itemName}>[{item.templateId}]</span>
              <div className={styles.actions}>
                <button
                  className={styles.discardButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDiscard(item.entityId);
                  }}
                >
                  DISCARD
                </button>
                <button
                  className={styles.sellButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSell(item.entityId);
                  }}
                >
                  SELL: {getSellPrice(item.rarityTier)} SCRAP
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {hoveredItem && (
        <ItemTooltip
          metadata={hoveredItem.metadata}
          position={{ x: hoveredItem.x, y: hoveredItem.y }}
          visible={true}
          onDismiss={() => setHoveredItem(null)}
        />
      )}
    </div>
  );
};

export default VaultOverflowBanner;
