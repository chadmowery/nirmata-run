'use client';

import React, { useState } from 'react';
import { logger } from '@engine/utils/logger';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import VaultOverflowBanner from './VaultOverflowBanner';
import { VaultItem } from '@/shared/profile';
import { PanelCard, DottedSpecRow, BtnLever, TaikokuStamp } from '../atomic';
import styles from './VaultTab.module.css';

export const VaultTab: React.FC = () => {
  const profile = useStore(gameStore, (s) => s.playerProfile);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);

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
        if (selectedItem?.entityId === entityId) setSelectedItem(null);
      }
    } catch (error) {
      logger.error('Sell failed:', 'UI', error);
    }
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
        if (selectedItem?.entityId === entityId) setSelectedItem(null);
      }
    } catch (error) {
      logger.error('Discard failed:', 'UI', error);
    }
  };

  const capacity = profile.vault.length;
  const maxSlots = 48;
  const gridCells = Array(maxSlots).fill(null);
  profile.vault.slice(0, maxSlots).forEach((item, idx) => {
    gridCells[idx] = item;
  });

  const getSectorCoord = (idx: number) => {
    const rowChar = String.fromCharCode(65 + Math.floor(idx / 8));
    const colNum = (idx % 8) + 1;
    return `${rowChar}-0${colNum}`;
  };

  const getTagClass = (type: string) => {
    if (type === 'firmware') return styles.slotTagFirm;
    if (type === 'augment') return styles.slotTagAug;
    return styles.slotTagSoft;
  };

  return (
    <div>
      {/* Overflow Banner */}
      {profile.overflow?.length > 0 && (
        <VaultOverflowBanner
          overflowItems={profile.overflow}
          onSell={handleSell}
          onDiscard={handleDiscard}
        />
      )}

      <div className={styles.vaultSplit}>
        {/* Left: 8-Column Cargo Bay Matrix */}
        <PanelCard
          title="CARGO BAYS [A-01 THROUGH F-08]"
          badge={`CAPACITY: ${capacity}/${maxSlots}`}
        >
          <div className={styles.vaultGridContainer}>
            {gridCells.map((cell, idx) => {
              const coord = getSectorCoord(idx);
              if (!cell) {
                return (
                  <div key={idx} className={styles.vaultSlot}>
                    <span className={styles.slotCoord}>{coord}</span>
                    <span style={{ color: 'var(--c-text-muted)', fontSize: '8px' }}>EMPTY</span>
                    <span />
                  </div>
                );
              }

              const item = cell as VaultItem;
              const isSelected = selectedItem?.entityId === item.entityId;

              return (
                <div
                  key={item.entityId}
                  className={`${styles.vaultSlot} ${isSelected ? styles.selected : ''}`}
                  onClick={() => setSelectedItem(item)}
                >
                  <span className={styles.slotCoord}>{coord}</span>
                  <span className={styles.slotGlyph}>
                    {item.templateId.substring(0, 4).toUpperCase()}
                  </span>
                  <span className={`${styles.slotTag} ${getTagClass(item.itemType)}`}>
                    {item.itemType.substring(0, 4).toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </PanelCard>

        {/* Right: Manifest Inspector */}
        <PanelCard title="MANIFEST INSPECTOR" badge="ASSET TELEMETRY">
          <div className={styles.inspectorBox}>
            {selectedItem ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--c-accent-secondary)' }}>
                      SERIAL: TK-VLT-{selectedItem.entityId.toString().slice(-6)}
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', color: '#ffffff' }}>
                      {selectedItem.templateId}
                    </h3>
                  </div>
                  <TaikokuStamp variant="cyan">{selectedItem.rarityTier.toUpperCase()}</TaikokuStamp>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '14px 0' }}>
                  <DottedSpecRow label="TYPE" value={selectedItem.itemType.toUpperCase()} />
                  <DottedSpecRow label="HARVESTED AT" value={`SUB-LEVEL ${selectedItem.extractedAtFloor}`} />
                  <DottedSpecRow
                    label="SCRAP SALVAGE VALUE"
                    value="25 CR"
                    valueColor="var(--c-scrap)"
                  />
                  <DottedSpecRow label="INTEGRITY STATUS" value="SEALED CONTAINER" />
                </div>
              </div>
            ) : (
              <div className={styles.inspectorEmpty}>
                <span>[ SELECT CARGO CONTAINER TO INSPECT TELEMETRY ]</span>
              </div>
            )}

            {selectedItem && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
                <BtnLever
                  variant="primary"
                  onClick={() => {
                    gameStore.getState().setActiveTab('loadout');
                  }}
                  rightSlot="→"
                >
                  TRANSFER TO LOADOUT
                </BtnLever>

                <BtnLever
                  variant="danger"
                  onClick={() => handleSell(selectedItem.entityId)}
                  rightSlot="+25 CR"
                >
                  SALVAGE FOR SCRAP
                </BtnLever>
              </div>
            )}
          </div>
        </PanelCard>
      </div>
    </div>
  );
};

export default VaultTab;
