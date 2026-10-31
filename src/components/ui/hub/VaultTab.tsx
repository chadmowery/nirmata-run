'use client';

import React, { useState } from 'react';
import { logger } from '@engine/utils/logger';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import VaultOverflowBanner from './VaultOverflowBanner';
import { VaultItem } from '@/shared/profile';
import {
  isWeaponItem,
  isArmorItem,
  isSoftwareItem,
  canSocketSoftware,
  getSoftwareTargetSlot,
} from '@/shared/utils/equipment-util';
import { PanelCard, DottedSpecRow, BtnLever, TaikokuStamp, ItemIcon } from '../atomic';
import { ItemTooltip } from './ItemTooltip';
import { ItemMetadata, resolveItemMetadata } from './item-metadata';
import styles from './VaultTab.module.css';

export const VaultTab: React.FC = () => {
  const profile = useStore(gameStore, (s) => s.playerProfile);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [draggedVaultItem, setDraggedVaultItem] = useState<VaultItem | null>(null);
  const [dragOverEntityId, setDragOverEntityId] = useState<number | null>(null);

  const [hoveredSlot, setHoveredSlot] = useState<{
    metadata: ItemMetadata;
    x: number;
    y: number;
  } | null>(null);

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

  const handleSocketSoftware = async (targetEntityId: number, softwareEntityId: number) => {
    logger.debug(`[Vault] Socketing software ${softwareEntityId} onto gear ${targetEntityId}`, 'UI');
    const previousProfile = { ...profile };
    const softwareItem = profile.vault.find((i) => i.entityId === softwareEntityId);
    if (!softwareItem) return;

    // Optimistic UI update
    updateProfileOptimistic((p) => {
      const newVault = p.vault
        .filter((i) => i.entityId !== softwareEntityId)
        .map((i) =>
          i.entityId === targetEntityId
            ? { ...i, socketedSoftware: [softwareItem.templateId] }
            : i,
        );
      return { ...p, vault: newVault };
    });

    if (selectedItem && selectedItem.entityId === targetEntityId) {
      setSelectedItem({
        ...selectedItem,
        socketedSoftware: [softwareItem.templateId],
      });
    }

    try {
      const response = await fetch('/api/vault/socket-software', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: profile.sessionId,
          targetEntityId,
          softwareEntityId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to socket software');
      }
      const data = await response.json();
      if (data.profile) {
        gameStore.getState().setPlayerProfile(data.profile);
      }
    } catch (error) {
      logger.error('Socket software error:', 'UI', error);
      updateProfileOptimistic(() => previousProfile);
    } finally {
      setDraggedVaultItem(null);
      setDragOverEntityId(null);
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
    if (type === 'weapon') return styles.slotTagFirm;
    if (type === 'armor') return styles.slotTagAug;
    return styles.slotTagSoft;
  };

  const handleFocus = (metadata: ItemMetadata, e: React.FocusEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredSlot({
      metadata,
      x: rect.right,
      y: rect.top,
    });
  };

  // Inspect compatibility
  const isSelectedGear =
    selectedItem && (isWeaponItem(selectedItem) || isArmorItem(selectedItem));

  const compatibleSoftwareInVault = isSelectedGear
    ? profile.vault.filter(
        (v) =>
          isSoftwareItem(v) &&
          canSocketSoftware(v.templateId, selectedItem.templateId, selectedItem.itemType),
      )
    : [];

  const isSelectedSoftware = selectedItem && isSoftwareItem(selectedItem);
  const compatibleGearInVault = isSelectedSoftware
    ? profile.vault.filter(
        (v) =>
          (isWeaponItem(v) || isArmorItem(v)) &&
          canSocketSoftware(selectedItem.templateId, v.templateId, v.itemType),
      )
    : [];

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
              const isDraggedOver = dragOverEntityId === item.entityId;

              const isDropTargetValid =
                draggedVaultItem &&
                isSoftwareItem(draggedVaultItem) &&
                (isWeaponItem(item) || isArmorItem(item)) &&
                canSocketSoftware(draggedVaultItem.templateId, item.templateId, item.itemType);

              const meta = resolveItemMetadata({
                templateId: item.templateId,
                type: item.itemType,
                rarity: item.rarityTier,
                entityId: item.entityId,
                floor: item.extractedAtFloor,
                coord,
                socketedSoftware: item.socketedSoftware,
                status: `BAY ${coord} // SECURED`,
                statusVariant: 'secured',
              });

              return (
                <div
                  key={item.entityId}
                  className={`
                    ${styles.vaultSlot} 
                    ${isSelected ? styles.selected : ''}
                    ${isDraggedOver && isDropTargetValid ? styles.dropValid : ''}
                  `}
                  tabIndex={0}
                  draggable={true}
                  onDragStart={() => setDraggedVaultItem(item)}
                  onDragEnd={() => {
                    setDraggedVaultItem(null);
                    setDragOverEntityId(null);
                  }}
                  onDragOver={(e) => {
                    if (isDropTargetValid) e.preventDefault();
                  }}
                  onDragEnter={() => {
                    if (isDropTargetValid) setDragOverEntityId(item.entityId);
                  }}
                  onDragLeave={() => {
                    if (dragOverEntityId === item.entityId) setDragOverEntityId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedVaultItem && isDropTargetValid) {
                      handleSocketSoftware(item.entityId, draggedVaultItem.entityId);
                    }
                  }}
                  onClick={() => setSelectedItem(item)}
                  onPointerEnter={(e) =>
                    setHoveredSlot({ metadata: meta, x: e.clientX, y: e.clientY })
                  }
                  onPointerMove={(e) => {
                    if (hoveredSlot?.metadata.id === item.templateId) {
                      setHoveredSlot({ metadata: meta, x: e.clientX, y: e.clientY });
                    }
                  }}
                  onPointerLeave={() => setHoveredSlot(null)}
                  onFocus={(e) => handleFocus(meta, e)}
                  onBlur={() => setHoveredSlot(null)}
                >
                  <span className={styles.slotCoord}>{coord}</span>
                  <ItemIcon
                    templateId={item.templateId}
                    itemType={item.itemType}
                    rarityTier={item.rarityTier}
                    size="sm"
                    style={{ margin: '2px 0' }}
                  />
                  <span className={`${styles.slotTag} ${getTagClass(item.itemType)}`}>
                    {item.socketedSoftware && item.socketedSoftware.length > 0
                      ? 'SW+'
                      : item.itemType.substring(0, 4).toUpperCase()}
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <ItemIcon
                      templateId={selectedItem.templateId}
                      itemType={selectedItem.itemType}
                      rarityTier={selectedItem.rarityTier}
                      size="md"
                    />
                    <div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '9px',
                          color: 'var(--c-accent-secondary)',
                        }}
                      >
                        SERIAL: TK-VLT-{selectedItem.entityId.toString().slice(-6)}
                      </div>
                      <h3
                        style={{
                          fontSize: '15px',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          color: '#ffffff',
                          margin: 0,
                        }}
                      >
                        {selectedItem.templateId}
                      </h3>
                    </div>
                  </div>
                  <TaikokuStamp variant="cyan">{selectedItem.rarityTier.toUpperCase()}</TaikokuStamp>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    margin: '14px 0',
                  }}
                >
                  <DottedSpecRow label="TYPE" value={selectedItem.itemType.toUpperCase()} />
                  <DottedSpecRow
                    label="HARVESTED AT"
                    value={`SUB-LEVEL ${selectedItem.extractedAtFloor}`}
                  />
                  <DottedSpecRow
                    label="SCRAP SALVAGE VALUE"
                    value="25 CR"
                    valueColor="var(--c-scrap)"
                  />
                  <DottedSpecRow label="INTEGRITY STATUS" value="SEALED CONTAINER" />

                  {isSelectedGear && (
                    <DottedSpecRow
                      label="LOADED SOFTWARE"
                      value={
                        selectedItem.socketedSoftware && selectedItem.socketedSoftware.length > 0
                          ? selectedItem.socketedSoftware.join(', ').toUpperCase()
                          : 'NONE // EMPTY'
                      }
                      valueColor={
                        selectedItem.socketedSoftware && selectedItem.socketedSoftware.length > 0
                          ? 'var(--c-accent-secondary)'
                          : undefined
                      }
                    />
                  )}

                  {isSelectedSoftware && (
                    <DottedSpecRow
                      label="TARGET SOCKET"
                      value={getSoftwareTargetSlot(selectedItem.templateId)?.toUpperCase() || 'UNKNOWN'}
                      valueColor="var(--c-accent)"
                    />
                  )}
                </div>

                {/* Software Socketing Actions */}
                {isSelectedGear && (
                  <div style={{ marginTop: '14px', borderTop: '1px solid #1f2b3e', paddingTop: '10px' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        color: 'var(--c-accent)',
                        marginBottom: '6px',
                        fontWeight: 800,
                      }}
                    >
                      LOAD SOFTWARE SUBROUTINE ({compatibleSoftwareInVault.length} IN VAULT):
                    </div>
                    {compatibleSoftwareInVault.length === 0 ? (
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '9px',
                          color: 'var(--c-text-muted)',
                          marginBottom: '8px',
                        }}
                      >
                        NO COMPATIBLE SOFTWARE CORES IN VAULT
                      </div>
                    ) : (
                      <div className={styles.actionList}>
                        {compatibleSoftwareInVault.map((sw) => (
                          <BtnLever
                            key={sw.entityId}
                            variant="cyan"
                            onClick={() => handleSocketSoftware(selectedItem.entityId, sw.entityId)}
                            rightSlot="LOAD"
                          >
                            {sw.templateId.toUpperCase()}
                          </BtnLever>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {isSelectedSoftware && (
                  <div style={{ marginTop: '14px', borderTop: '1px solid #1f2b3e', paddingTop: '10px' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        color: 'var(--c-accent)',
                        marginBottom: '6px',
                        fontWeight: 800,
                      }}
                    >
                      SOCKET ONTO GEAR ({compatibleGearInVault.length} IN VAULT):
                    </div>
                    {compatibleGearInVault.length === 0 ? (
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '9px',
                          color: 'var(--c-text-muted)',
                          marginBottom: '8px',
                        }}
                      >
                        NO COMPATIBLE WEAPON/ARMOR IN VAULT
                      </div>
                    ) : (
                      <div className={styles.actionList}>
                        {compatibleGearInVault.map((gear) => (
                          <BtnLever
                            key={gear.entityId}
                            variant="cyan"
                            onClick={() => handleSocketSoftware(gear.entityId, selectedItem.entityId)}
                            rightSlot="ATTACH"
                          >
                            {gear.templateId.toUpperCase()}
                          </BtnLever>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.inspectorEmpty}>
                <span>[ SELECT CARGO CONTAINER TO INSPECT TELEMETRY ]</span>
              </div>
            )}

            {selectedItem && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginTop: 'auto',
                }}
              >
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

      {/* Floating Hover Tooltip for Cargo Bay Slots */}
      {hoveredSlot && (
        <ItemTooltip
          metadata={hoveredSlot.metadata}
          position={{ x: hoveredSlot.x, y: hoveredSlot.y }}
          visible={true}
          onDismiss={() => setHoveredSlot(null)}
        />
      )}
    </div>
  );
};

export default VaultTab;
