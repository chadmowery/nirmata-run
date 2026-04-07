import React, { useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import VaultGrid from './VaultGrid';
import VaultOverflowBanner from './VaultOverflowBanner';
import { VaultItem } from '@/shared/profile';
import styles from './VaultTab.module.css';

const VaultTab: React.FC = () => {
  const profile = useStore(gameStore, (s) => s.playerProfile);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    item: VaultItem | null;
  }>({
    visible: false,
    position: { x: 0, y: 0 },
    item: null,
  });

  if (!profile) return null;

  const handleSell = async (entityId: number) => {
    try {
      const response = await fetch('/api/vault/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: profile.sessionId,
          entityId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        updateProfileOptimistic((p) => ({
          ...p,
          wallet: {
            ...p.wallet,
            scrap: p.wallet.scrap + (data.scrapGained || 0),
          },
          vault: p.vault.filter((item) => item.entityId !== entityId),
          overflow: p.overflow.filter((item) => item.entityId !== entityId),
        }));
      }
    } catch (error) {
      console.error('Sell failed:', error);
    }
    setContextMenu({ ...contextMenu, visible: false });
  };

  const handleDiscard = async (entityId: number) => {
    try {
      const response = await fetch('/api/vault/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: profile.sessionId,
          entityId,
        }),
      });

      if (response.ok) {
        updateProfileOptimistic((p) => ({
          ...p,
          vault: p.vault.filter((item) => item.entityId !== entityId),
          overflow: p.overflow.filter((item) => item.entityId !== entityId),
        }));
      }
    } catch (error) {
      console.error('Discard failed:', error);
    }
    setContextMenu({ ...contextMenu, visible: false });
  };

  const onCellRightClick = (item: VaultItem, e: React.MouseEvent) => {
    setContextMenu({
      visible: true,
      position: { x: e.clientX, y: e.clientY },
      item,
    });
  };

  const capacity = profile.vault.length;
  const isNearCapacity = capacity >= 25;

  return (
    <div className={styles.tabRoot} onClick={() => setContextMenu({ ...contextMenu, visible: false })}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h2 className={styles.heading}>VAULT_INVENTORY</h2>
          <span className={`${styles.capacity} ${isNearCapacity ? styles.capacityWarn : ''}`}>
            CAPACITY: {capacity}/30
          </span>
        </div>
      </header>

      {profile.overflow.length > 0 && (
        <VaultOverflowBanner
          overflowItems={profile.overflow}
          onSell={handleSell}
          onDiscard={handleDiscard}
        />
      )}

      {profile.vault.length === 0 ? (
        <div className={styles.emptyState}>
          VAULT_EMPTY // NO_SECURED_ITEMS
        </div>
      ) : (
        <VaultGrid
          items={profile.vault}
          onCellClick={() => {}}
          onCellRightClick={onCellRightClick}
        />
      )}

      {contextMenu.visible && contextMenu.item && (
        <div
          className={styles.contextMenu}
          style={{ top: contextMenu.position.y, left: contextMenu.position.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={styles.menuItem} onClick={() => handleSell(contextMenu.item!.entityId)}>
            SELL_FOR_SCRAP
          </button>
          <button className={styles.menuItem} onClick={() => handleDiscard(contextMenu.item!.entityId)}>
            DISCARD_ITEM
          </button>
        </div>
      )}
    </div>
  );
};

export default VaultTab;
