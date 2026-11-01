'use client';

import React, { useEffect } from 'react';
import { TaikokuPlacard } from '../atomic';
import styles from './ContainerOverlay.module.css';

export interface ContainerItem {
  id: number;
  templateId: string;
  name?: string;
  rarityTier?: string;
  type?: string;
}

export interface ContainerOverlayProps {
  containerEntityId: number;
  containerName?: string;
  containerItems: ContainerItem[];
  backpackItems?: ContainerItem[];
  onClose: () => void;
  onTakeItem?: (item: ContainerItem) => void;
  onStoreItem?: (item: ContainerItem) => void;
}

export const ContainerOverlay: React.FC<ContainerOverlayProps> = ({
  containerName = 'SCAVENGE CONTAINER',
  containerItems,
  backpackItems = [],
  onClose,
  onTakeItem,
  onStoreItem,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  return (
    <div
      className={styles.containerOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Container Loot Transfer Modal"
      onClick={onClose}
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <TaikokuPlacard
          kanji="保管庫 // 物資回収"
          title={containerName.toUpperCase()}
          stampText="SECURE // TRANSFER"
          stampVariant="cyan"
          onClose={onClose}
          closeLabel="✕ CLOSE [ESC]"
          style={{ marginBottom: 0, border: 'none', borderBottom: '3px solid #00f0ff' }}
        />

        <div className={styles.splitLayout}>
          {/* Container Items Column */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>CONTAINER CARGO</span>
              <span className={styles.panelBadge}>{containerItems.length} ITEMS</span>
            </div>

            <div className={styles.itemList}>
              {containerItems.length === 0 ? (
                <div className={styles.emptyState}>CONTAINER IS EMPTY</div>
              ) : (
                containerItems.map((item) => (
                  <div key={item.id} className={styles.itemCard}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemName}>{item.name || item.templateId}</span>
                      <span className={styles.itemMeta}>
                        {item.rarityTier || 'COMMON'} // {item.type || 'ITEM'}
                      </span>
                    </div>
                    {onTakeItem && (
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={() => onTakeItem(item)}
                      >
                        TAKE
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Player Backpack Column */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>TACTICAL BACKPACK</span>
              <span className={styles.panelBadge}>{backpackItems.length} SLOTS</span>
            </div>

            <div className={styles.itemList}>
              {backpackItems.length === 0 ? (
                <div className={styles.emptyState}>BACKPACK EMPTY</div>
              ) : (
                backpackItems.map((item) => (
                  <div key={item.id} className={styles.itemCard}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemName}>{item.name || item.templateId}</span>
                      <span className={styles.itemMeta}>
                        {item.rarityTier || 'COMMON'} // {item.type || 'ITEM'}
                      </span>
                    </div>
                    {onStoreItem && (
                      <button
                        type="button"
                        className={styles.actionButtonSecondary}
                        onClick={() => onStoreItem(item)}
                      >
                        STORE
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContainerOverlay;
