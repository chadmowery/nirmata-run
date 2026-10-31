'use client';

import React, { useState } from 'react';
import { logger } from '@engine/utils/logger';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import VaultOverflowBanner from './VaultOverflowBanner';
import { VaultItem } from '@/shared/profile';
import { getVaultItemValue } from '@/shared/vault';
import {
  isWeaponItem,
  isArmorItem,
  isSoftwareItem,
  canSocketSoftware,
  getSoftwareTargetSlot,
} from '@/shared/utils/equipment-util';
import { PanelCard, DottedSpecRow, BtnLever, TaikokuStamp, ItemIcon } from '../atomic';
import { ItemTooltip } from './ItemTooltip';
import { ItemMetadata, resolveItemMetadata, getSoftwareModificationInfo } from './item-metadata';
import styles from './VaultTab.module.css';

export { getVaultItemValue };

export type VaultSortField = 'default' | 'rarity' | 'type' | 'value';
export type VaultSortDirection = 'asc' | 'desc';

export const RARITY_SORT_WEIGHT: Record<string, number> = {
  legendary: 4,
  rare: 3,
  uncommon: 2,
  common: 1,
};

export const TYPE_SORT_WEIGHT: Record<string, number> = {
  weapon: 6,
  armor: 5,
  firmware: 4,
  augment: 3,
  software: 2,
  equipment: 1,
  backpack: 1,
  item: 0,
};

export function sortVaultItems(
  items: VaultItem[],
  field: VaultSortField,
  direction: VaultSortDirection,
): VaultItem[] {
  if (field === 'default') {
    return [...items];
  }

  return [...items].sort((a, b) => {
    if (field === 'rarity') {
      const weightA = RARITY_SORT_WEIGHT[a.rarityTier?.toLowerCase()] ?? 0;
      const weightB = RARITY_SORT_WEIGHT[b.rarityTier?.toLowerCase()] ?? 0;
      const diff = direction === 'desc' ? weightB - weightA : weightA - weightB;
      if (diff !== 0) return diff;
      // Secondary tiebreaker: Value (desc)
      const valDiff = getVaultItemValue(b) - getVaultItemValue(a);
      if (valDiff !== 0) return valDiff;
      // Tertiary tiebreaker: templateId
      const tmplDiff = a.templateId.localeCompare(b.templateId);
      if (tmplDiff !== 0) return tmplDiff;
      return a.entityId - b.entityId;
    }

    if (field === 'type') {
      const weightA = TYPE_SORT_WEIGHT[a.itemType?.toLowerCase()] ?? 0;
      const weightB = TYPE_SORT_WEIGHT[b.itemType?.toLowerCase()] ?? 0;
      const diff = direction === 'desc' ? weightB - weightA : weightA - weightB;
      if (diff !== 0) return diff;
      // Secondary tiebreaker: Rarity (desc)
      const rarDiff =
        (RARITY_SORT_WEIGHT[b.rarityTier?.toLowerCase()] ?? 0) -
        (RARITY_SORT_WEIGHT[a.rarityTier?.toLowerCase()] ?? 0);
      if (rarDiff !== 0) return rarDiff;
      // Tertiary tiebreaker: templateId
      const tmplDiff = a.templateId.localeCompare(b.templateId);
      if (tmplDiff !== 0) return tmplDiff;
      return a.entityId - b.entityId;
    }

    if (field === 'value') {
      const valA = getVaultItemValue(a);
      const valB = getVaultItemValue(b);
      const diff = direction === 'desc' ? valB - valA : valA - valB;
      if (diff !== 0) return diff;
      // Secondary tiebreaker: Rarity (desc)
      const rarDiff =
        (RARITY_SORT_WEIGHT[b.rarityTier?.toLowerCase()] ?? 0) -
        (RARITY_SORT_WEIGHT[a.rarityTier?.toLowerCase()] ?? 0);
      if (rarDiff !== 0) return rarDiff;
      // Tertiary tiebreaker: templateId
      const tmplDiff = a.templateId.localeCompare(b.templateId);
      if (tmplDiff !== 0) return tmplDiff;
      return a.entityId - b.entityId;
    }

    return 0;
  });
}

export const VaultTab: React.FC = () => {
  const profile = useStore(gameStore, (s) => s.playerProfile);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [draggedVaultItem, setDraggedVaultItem] = useState<VaultItem | null>(null);
  const [dragOverEntityId, setDragOverEntityId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<VaultSortField>('default');
  const [sortDirection, setSortDirection] = useState<VaultSortDirection>('desc');

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

  const handleSortClick = (field: 'rarity' | 'type' | 'value') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleResetSort = () => {
    setSortField('default');
    setSortDirection('desc');
  };

  const sortedVaultItems = React.useMemo(() => {
    return sortVaultItems(profile.vault, sortField, sortDirection);
  }, [profile.vault, sortField, sortDirection]);

  const capacity = profile.vault.length;
  const maxSlots = 48;
  const gridCells = Array(maxSlots).fill(null);
  sortedVaultItems.slice(0, maxSlots).forEach((item, idx) => {
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
          {/* Sort Controls Toolbar */}
          <div className={styles.sortToolbar}>
            <span className={styles.sortLabel}>SORT CARGO:</span>
            <div className={styles.sortButtons}>
              <button
                type="button"
                className={`${styles.sortBtn} ${sortField === 'rarity' ? styles.sortBtnActive : ''}`}
                onClick={() => handleSortClick('rarity')}
                aria-label="Sort cargo by rarity"
              >
                RARITY {sortField === 'rarity' ? (sortDirection === 'desc' ? '▼' : '▲') : ''}
              </button>
              <button
                type="button"
                className={`${styles.sortBtn} ${sortField === 'type' ? styles.sortBtnActive : ''}`}
                onClick={() => handleSortClick('type')}
                aria-label="Sort cargo by type"
              >
                TYPE {sortField === 'type' ? (sortDirection === 'desc' ? '▼' : '▲') : ''}
              </button>
              <button
                type="button"
                className={`${styles.sortBtn} ${sortField === 'value' ? styles.sortBtnActive : ''}`}
                onClick={() => handleSortClick('value')}
                aria-label="Sort cargo by value"
              >
                VALUE {sortField === 'value' ? (sortDirection === 'desc' ? '▼' : '▲') : ''}
              </button>
              {sortField !== 'default' && (
                <button
                  type="button"
                  className={styles.sortResetBtn}
                  onClick={handleResetSort}
                  aria-label="Reset cargo bay sort order"
                >
                  RESET
                </button>
              )}
            </div>
          </div>

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
                    value={`${getVaultItemValue(selectedItem)} CR`}
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

                  {/* Rich Software Modification Preview for Gear */}
                  {isSelectedGear &&
                    selectedItem.socketedSoftware &&
                    selectedItem.socketedSoftware.length > 0 && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '8px',
                          background: 'rgba(0, 240, 255, 0.04)',
                          border: '1px solid rgba(0, 240, 255, 0.25)',
                          borderLeft: '3px solid var(--c-accent-secondary)',
                        }}
                      >
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '8px',
                            color: 'var(--c-accent-secondary)',
                            fontWeight: 800,
                            letterSpacing: '0.06em',
                            marginBottom: '4px',
                          }}
                        >
                          ACTIVE SOFTWARE SUBROUTINE MODIFIERS:
                        </div>
                        {selectedItem.socketedSoftware.map((swId) => {
                          const info = getSoftwareModificationInfo(swId);
                          return (
                            <div key={swId} style={{ marginTop: '4px' }}>
                              <div
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '10px',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                }}
                              >
                                ⚡ {info.name.toUpperCase()} [{info.targetSlot.toUpperCase()}]
                              </div>
                              <div
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '9px',
                                  color: 'var(--c-accent-secondary)',
                                  marginTop: '2px',
                                  lineHeight: 1.3,
                                }}
                              >
                                MOD EFFECT: {info.effect}
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
                        {compatibleSoftwareInVault.map((sw) => {
                          const swMeta = resolveItemMetadata({
                            templateId: sw.templateId,
                            type: sw.itemType,
                            rarity: sw.rarityTier,
                            entityId: sw.entityId,
                            floor: sw.extractedAtFloor,
                          });
                          return (
                            <div
                              key={sw.entityId}
                              onPointerEnter={(e) =>
                                setHoveredSlot({ metadata: swMeta, x: e.clientX, y: e.clientY })
                              }
                              onPointerMove={(e) => {
                                if (hoveredSlot?.metadata.id === sw.templateId) {
                                  setHoveredSlot({ metadata: swMeta, x: e.clientX, y: e.clientY });
                                }
                              }}
                              onPointerLeave={() => setHoveredSlot(null)}
                              onFocus={(e) => handleFocus(swMeta, e)}
                              onBlur={() => setHoveredSlot(null)}
                            >
                              <BtnLever
                                variant="cyan"
                                onClick={() => handleSocketSoftware(selectedItem.entityId, sw.entityId)}
                                rightSlot="LOAD"
                              >
                                {sw.templateId.toUpperCase()}
                              </BtnLever>
                            </div>
                          );
                        })}
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
                  rightSlot={`+${getVaultItemValue(selectedItem)} CR`}
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
