'use client';

import React, { useState } from 'react';
import { VaultItem } from '@/shared/profile';
import { getVaultItemValue } from '@/shared/vault';
import { BtnLever } from '../atomic';
import { ItemTooltip } from './ItemTooltip';
import { ItemMetadata, resolveItemMetadata } from './item-metadata';
import styles from './VaultOverflowBanner.module.css';

interface VaultOverflowBannerProps {
  overflowItems: VaultItem[];
  onSell: (itemIdentifier: string | number, item?: VaultItem) => void;
  onDiscard: (itemIdentifier: string | number, item?: VaultItem) => void;
  onSellAll?: () => void;
  onDiscardAll?: () => void;
}

const VaultOverflowBanner: React.FC<VaultOverflowBannerProps> = ({
  overflowItems,
  onSell,
  onDiscard,
  onSellAll,
  onDiscardAll,
}) => {
  const [hoveredItem, setHoveredItem] = useState<{
    metadata: ItemMetadata;
    x: number;
    y: number;
  } | null>(null);

  if (overflowItems.length === 0) return null;

  const totalSellValue = overflowItems.reduce((sum, item) => sum + getVaultItemValue(item), 0);

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
      <div className={styles.headerRow}>
        <h3 className={styles.heading}>OVERFLOW: {overflowItems.length} IN_LIMBO</h3>
        {(onDiscardAll || onSellAll) && (
          <div className={styles.bulkActions}>
            {onDiscardAll && (
              <BtnLever
                variant="danger"
                holdToConfirm={true}
                aria-label="Discard all overflow items"
                onClick={(e) => {
                  e.stopPropagation();
                  onDiscardAll();
                }}
                style={{ padding: '3px 10px', fontSize: '10px' }}
              >
                DISCARD ALL
              </BtnLever>
            )}
            {onSellAll && (
              <BtnLever
                variant="cyan"
                holdToConfirm={true}
                aria-label="Sell all overflow items"
                onClick={(e) => {
                  e.stopPropagation();
                  onSellAll();
                }}
                style={{ padding: '3px 10px', fontSize: '10px' }}
                rightSlot={`${totalSellValue} CR`}
              >
                SELL ALL
              </BtnLever>
            )}
          </div>
        )}
      </div>
      <div className={styles.itemList}>
        {overflowItems.map((item, idx) => {
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
              key={item.vaultItemId || `${item.entityId}-${idx}`}
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
                <BtnLever
                  variant="danger"
                  holdToConfirm={true}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDiscard(item.vaultItemId, item);
                  }}
                  style={{ padding: '3px 8px', fontSize: '10px' }}
                >
                  DISCARD
                </BtnLever>
                <BtnLever
                  variant="cyan"
                  holdToConfirm={true}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSell(item.vaultItemId, item);
                  }}
                  style={{ padding: '3px 8px', fontSize: '10px' }}
                  rightSlot={`${getVaultItemValue(item)} CR`}
                >
                  SELL
                </BtnLever>
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
