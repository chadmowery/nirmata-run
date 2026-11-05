'use client';

import React, { useState, useEffect } from 'react';
import { logger } from '@engine/utils/logger';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { ShellTemplate } from '@/game/shells/shared';
import { VaultItem, InstalledItem, generateVaultItemId } from '@/shared/profile';
import {
  isWeaponItem,
  isArmorItem,
  isSoftwareItem,
  canSocketSoftware,
} from '@/shared/utils/equipment-util';
import { LoadoutSlotPanel } from './LoadoutSlotPanel';
import { StashItemList, StashFilter } from './StashItemList';
import { PanelCard, DottedSpecRow, TaikokuStamp, BtnLever } from '../atomic';
import { ItemTooltip } from './ItemTooltip';
import { ItemMetadata, resolveItemMetadata, getSoftwareModificationInfo } from './item-metadata';
import styles from './LoadoutTab.module.css';

export const LoadoutTab: React.FC = () => {
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);
  const selectedShellIndex = useStore(gameStore, (s) => s.selectedShellIndex);
  const draggedItem = useStore(gameStore, (s) => s.draggedItem);
  const setDraggedItem = useStore(gameStore, (s) => s.setDraggedItem);
  const setDragOverSlot = useStore(gameStore, (s) => s.setDragOverSlot);
  const setShellTemplates = useStore(gameStore, (s) => s.setShellTemplates);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);

  const [templates, setTemplates] = useState<ShellTemplate[]>([]);
  const [activeFilter, setActiveFilter] = useState<StashFilter>('all');
  const [hoveredSoftware, setHoveredSoftware] = useState<{
    metadata: ItemMetadata;
    x: number;
    y: number;
  } | null>(null);
  const [inspectedItem, setInspectedItem] = useState<{
    entityId?: number;
    name: string;
    type: string;
    description: string;
    cooldown?: number;
    heat?: number;
    rarity?: string;
    socketedSoftware?: string[];
  } | null>(null);

  useEffect(() => {
    const fetchShells = async () => {
      try {
        const response = await fetch('/api/shells');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data.templates);
          setShellTemplates(data.templates);
        }
      } catch (error) {
        logger.error('Failed to fetch shells:', 'UI', error);
      }
    };
    fetchShells();
  }, [setShellTemplates]);

  if (!playerProfile || templates.length === 0) {
    return <div className={styles.loading}>INITIALIZING_LOADOUT_SYSTEM // VEC-OS 1.0.4...</div>;
  }

  const activeShellTemplate = templates[selectedShellIndex] || templates[0];
  const activeShellId = activeShellTemplate?.id;

  const shellUpgrades = playerProfile.shellUpgrades?.[activeShellId] || {
    speed: 0,
    armor: 0,
    stability: 0,
    additionalPorts: 0,
  };

  const effectivePortConfig = {
    maxFirmware: (activeShellTemplate.basePorts?.maxFirmware ?? 2) + (shellUpgrades.additionalPorts || 0),
    maxAugment: (activeShellTemplate.basePorts?.maxAugment ?? 2) + (shellUpgrades.additionalPorts || 0),
    maxSoftware: (activeShellTemplate.basePorts?.maxSoftware ?? 2) + (shellUpgrades.additionalPorts || 0),
  };

  const equippedItems = playerProfile.installedItems.filter(
    (item) => item.shellId === activeShellId,
  );

  const vaultItems = playerProfile.vault;

  const handleDragStartFromStash = (item: VaultItem) => {
    setDraggedItem(item);
    setInspectedItem({
      entityId: item.entityId,
      name: item.templateId.toUpperCase(),
      type: item.itemType.toUpperCase(),
      description: `Reserve hardware asset recovered from Sector ${item.extractedAtFloor}.`,
      rarity: item.rarityTier.toUpperCase(),
      cooldown: 3,
      heat: 15,
      socketedSoftware: item.socketedSoftware,
    });
  };

  const handleDragStartFromSlot = (item: InstalledItem) => {
    setDraggedItem({
      vaultItemId: `installed-${item.entityId}`,
      entityId: item.entityId,
      templateId: item.blueprintId,
      itemType: item.type,
      rarityTier: 'common',
      extractedAtFloor: 0,
      extractedAtTimestamp: -1,
      socketedSoftware: item.socketedSoftware,
    });
    setInspectedItem({
      entityId: item.entityId,
      name: item.blueprintId.toUpperCase(),
      type: item.type.toUpperCase(),
      description: `Installed system socketed into ${activeShellTemplate.name} hardware bus.`,
      rarity: 'SOCKETED',
      cooldown: 2,
      heat: 10,
      socketedSoftware: item.socketedSoftware,
    });
  };

  const handleEquipItem = async (item: VaultItem, targetSlotType: string) => {
    logger.debug(`[Loadout] Equipping ${item.templateId} into ${targetSlotType}`, 'UI');
    const sessionId = playerProfile.sessionId;
    const vaultItemId = item.vaultItemId;
    const entityId = item.entityId;
    const shellId = activeShellId;
    const previousProfile = structuredClone(playerProfile);

    const isTarget = (i: VaultItem) =>
      vaultItemId ? i.vaultItemId === vaultItemId : i.entityId === entityId;

    // Optimistic UI update
    updateProfileOptimistic((prev) => {
      const isInVault = prev.vault.some(isTarget);
      if (!isInVault) return prev;

      const newVault = prev.vault.filter((i) => !isTarget(i));
      const newInstalled = [
        ...prev.installedItems,
        {
          entityId: entityId ?? Date.now(),
          blueprintId: item.templateId,
          type: targetSlotType as 'firmware' | 'augment' | 'software' | 'weapon' | 'armor' | 'backpack',
          shellId,
          isLegacy: false,
          socketedSoftware: item.socketedSoftware || [],
        },
      ];
      return { ...prev, vault: newVault, installedItems: newInstalled };
    });

    try {
      const response = await fetch('/api/vault/equip-from-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, vaultItemId, entityId, shellId, targetSlotType }),
      });

      if (!response.ok) {
        throw new Error('Failed to equip item');
      }
      const data = await response.json();
      if (data.profile) {
        gameStore.getState().setPlayerProfile(data.profile);
      }
    } catch (error) {
      logger.error('Equip error:', 'UI', error);
      updateProfileOptimistic(() => previousProfile);
    } finally {
      setDraggedItem(null);
      setDragOverSlot(null);
    }
  };

  const handleSlotDrop = async (slotType: string) => {
    logger.debug(`[Loadout] Dropping into ${slotType}`, 'UI');
    if (!draggedItem || draggedItem.extractedAtTimestamp === -1) return;
    await handleEquipItem(draggedItem, slotType);
  };

  const handleDoubleClickFromStash = (item: VaultItem) => {
    logger.debug(`[Loadout] Double clicked item from stash: ${item.templateId}`, 'UI');
    // Determine primary slot type
    let primarySlotType: 'weapon' | 'armor' | 'firmware' | 'augment' | 'software' | null = null;
    if (isWeaponItem(item)) primarySlotType = 'weapon';
    else if (isArmorItem(item)) primarySlotType = 'armor';
    else if (item.itemType === 'firmware') primarySlotType = 'firmware';
    else if (item.itemType === 'augment') primarySlotType = 'augment';
    else if (item.itemType === 'software') primarySlotType = 'software';

    if (!primarySlotType) return;

    const typeEquippedCount = equippedItems.filter((i) => i.type === primarySlotType).length;
    let maxForType = 1;
    if (primarySlotType === 'firmware') maxForType = effectivePortConfig.maxFirmware;
    else if (primarySlotType === 'augment') maxForType = effectivePortConfig.maxAugment;
    else if (primarySlotType === 'software') maxForType = effectivePortConfig.maxSoftware;

    let targetSlot: string | null = null;
    if (typeEquippedCount < maxForType) {
      targetSlot = primarySlotType;
    } else {
      // Primary shell slot full: check if backpack has room (< 5 slots)
      const backpackEquippedCount = equippedItems.filter((i) => i.type === 'backpack').length;
      if (backpackEquippedCount < 5) {
        targetSlot = 'backpack';
      }
    }

    if (targetSlot) {
      handleEquipItem(item, targetSlot);
    }
  };

  const handleSoftwareSocket = async (
    targetEntityId: number,
    software: { entityId?: number; vaultItemId?: string; templateId?: string },
  ) => {
    logger.debug(`[Loadout] Socketing software ${software.vaultItemId || software.entityId} onto ${targetEntityId}`, 'UI');
    const sessionId = playerProfile.sessionId;
    const previousProfile = structuredClone(playerProfile);
    const softwareItem = playerProfile.vault.find((i) =>
      software.vaultItemId ? i.vaultItemId === software.vaultItemId : i.entityId === software.entityId,
    );
    if (!softwareItem) return;

    const isSoftware = (i: VaultItem) =>
      software.vaultItemId ? i.vaultItemId === software.vaultItemId : i.entityId === software.entityId;

    updateProfileOptimistic((prev) => {
      const newVault = prev.vault.filter((i) => !isSoftware(i));
      const newInstalled = prev.installedItems.map((i) =>
        i.entityId === targetEntityId
          ? { ...i, socketedSoftware: [softwareItem.templateId] }
          : i,
      );
      return { ...prev, vault: newVault, installedItems: newInstalled };
    });

    try {
      const res = await fetch('/api/vault/socket-software', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          targetEntityId,
          softwareEntityId: software.entityId,
          softwareVaultItemId: software.vaultItemId,
        }),
      });
      if (!res.ok) throw new Error('Socket software failed');
      const data = await res.json();
      if (data.profile) {
        gameStore.getState().setPlayerProfile(data.profile);
      }
    } catch (err) {
      logger.error('Socket software error:', 'UI', err);
      updateProfileOptimistic(() => previousProfile);
    } finally {
      setDraggedItem(null);
      setDragOverSlot(null);
    }
  };

  const handleStashDrop = async () => {
    if (!draggedItem || draggedItem.extractedAtTimestamp !== -1) return;

    const blueprintId = draggedItem.templateId;
    const entityId = draggedItem.entityId;
    const shellId = activeShellId;
    const sessionId = playerProfile.sessionId;
    const previousProfile = structuredClone(playerProfile);

    updateProfileOptimistic((prev) => {
      const newInstalled = prev.installedItems.filter(
        (i) => !(i.entityId === entityId && i.shellId === shellId),
      );
      const restoredItem: VaultItem = {
        vaultItemId: generateVaultItemId(),
        entityId: entityId || Date.now(),
        templateId: blueprintId,
        itemType: (draggedItem.itemType === 'backpack'
          ? 'software'
          : draggedItem.itemType) as VaultItem['itemType'],
        rarityTier: 'common',
        extractedAtFloor: 1,
        extractedAtTimestamp: Date.now(),
        socketedSoftware: draggedItem.socketedSoftware || [],
      };
      return { ...prev, installedItems: newInstalled, vault: [...prev.vault, restoredItem] };
    });

    try {
      const uninstallRes = await fetch('/api/economy/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, blueprintId, entityId, shellId }),
      });
      if (!uninstallRes.ok) throw new Error('Uninstall failed');
      const data = await uninstallRes.json();
      if (data.profile) {
        gameStore.getState().setPlayerProfile(data.profile);
      }
    } catch (error) {
      logger.error('Unequip error:', 'UI', error);
      updateProfileOptimistic(() => previousProfile);
    } finally {
      setDraggedItem(null);
      setDragOverSlot(null);
    }
  };

  // Check if inspected item can receive software
  const canSocketOnInspected =
    inspectedItem?.entityId !== undefined &&
    (inspectedItem.type === 'WEAPON' ||
      inspectedItem.type === 'ARMOR' ||
      isWeaponItem({ templateId: inspectedItem.name.toLowerCase(), itemType: inspectedItem.type.toLowerCase() }) ||
      isArmorItem({ templateId: inspectedItem.name.toLowerCase(), itemType: inspectedItem.type.toLowerCase() }));

  const compatibleStashSoftware = canSocketOnInspected
    ? vaultItems.filter((v) =>
        isSoftwareItem(v) &&
        canSocketSoftware(
          v.templateId,
          inspectedItem!.name.toLowerCase(),
          inspectedItem!.type.toLowerCase(),
        ),
      )
    : [];

  return (
    <div
      className="three-col-grid"
      onMouseUp={() => {
        if (draggedItem?.extractedAtTimestamp === -1) handleStashDrop();
      }}
    >
      {/* Column 1: Installed Hardware Matrix */}
      <PanelCard title="INSTALLED HARDWARE" badge={activeShellTemplate.name}>
        <LoadoutSlotPanel
          portConfig={effectivePortConfig}
          basePortConfig={activeShellTemplate.basePorts}
          equippedItems={equippedItems}
          shellId={activeShellId}
          onSlotDrop={handleSlotDrop}
          onSlotDragStart={handleDragStartFromSlot}
          onSoftwareSocket={handleSoftwareSocket}
        />
      </PanelCard>

      {/* Column 2: Circuit Telemetry // Schematic Preview */}
      <PanelCard title="CIRCUIT TELEMETRY // SCHEMATIC PREVIEW" badge="DIAGNOSTIC">
        <div className={styles.schematicBox}>
          <div className="corner-mark tl">+</div>
          <div className="corner-mark tr">+</div>
          <div className="corner-mark bl">+</div>
          <div className="corner-mark br">+</div>

          {inspectedItem ? (
            <div>
              <div className={styles.schematicHeader}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--c-accent-secondary)' }}>
                    TYPE: {inspectedItem.type}
                  </div>
                  <h3 className={styles.moduleTitle}>{inspectedItem.name}</h3>
                </div>
                <TaikokuStamp variant="cyan">{inspectedItem.rarity || 'VERIFIED'}</TaikokuStamp>
              </div>

              <p className={styles.moduleDescription}>{inspectedItem.description}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '1rem' }}>
                <DottedSpecRow label="COOLDOWN CYCLES" value={`${inspectedItem.cooldown || 2} TURNS`} />
                <DottedSpecRow
                  label="THERMAL INJECTION"
                  value={`+${inspectedItem.heat || 10} HEAT`}
                  valueColor="var(--c-warning)"
                />
                <DottedSpecRow label="MEMORY CONSUMPTION" value="128 KB [BUFFERED]" />
                <DottedSpecRow
                  label="CHASSIS COMPATIBILITY"
                  value="100% NOMINAL"
                  valueColor="var(--c-accent)"
                />
                <DottedSpecRow
                  label="LOADED SOFTWARE"
                  value={
                    inspectedItem.socketedSoftware && inspectedItem.socketedSoftware.length > 0
                      ? inspectedItem.socketedSoftware.join(', ').toUpperCase()
                      : 'NONE // EMPTY'
                  }
                  valueColor={
                    inspectedItem.socketedSoftware && inspectedItem.socketedSoftware.length > 0
                      ? 'var(--c-accent-secondary)'
                      : undefined
                  }
                />

                {/* Rich Software Modification Preview */}
                {inspectedItem.socketedSoftware && inspectedItem.socketedSoftware.length > 0 && (
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
                    {inspectedItem.socketedSoftware.map((swId) => {
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
              </div>

              {canSocketOnInspected && (
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
                    LOAD SOFTWARE SUBROUTINE ({compatibleStashSoftware.length} AVAILABLE):
                  </div>
                  {compatibleStashSoftware.length === 0 ? (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--c-text-muted)' }}>
                      NO COMPATIBLE SOFTWARE CORES IN VAULT
                    </div>
                  ) : (
                    <div className={styles.socketSoftwareList}>
                      {compatibleStashSoftware.map((sw, idx) => {
                        const swMeta = resolveItemMetadata({
                          templateId: sw.templateId,
                          type: sw.itemType,
                          rarity: sw.rarityTier,
                          entityId: sw.entityId,
                          floor: sw.extractedAtFloor,
                        });
                        return (
                          <div
                            key={sw.vaultItemId || `${sw.entityId}-${idx}`}
                            style={{ width: '100%' }}
                            onPointerEnter={(e) =>
                              setHoveredSoftware({ metadata: swMeta, x: e.clientX, y: e.clientY })
                            }
                            onPointerMove={(e) => {
                              if (hoveredSoftware?.metadata.id === sw.templateId) {
                                setHoveredSoftware({ metadata: swMeta, x: e.clientX, y: e.clientY });
                              }
                            }}
                            onPointerLeave={() => setHoveredSoftware(null)}
                          >
                            <BtnLever
                              variant="cyan"
                              holdToConfirm={true}
                              onClick={() => handleSoftwareSocket(inspectedItem.entityId!, sw)}
                              rightSlot="LOAD"
                              style={{ width: '100%' }}
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
            </div>
          ) : (
            <div className={styles.schematicEmpty}>
              <span>[ SELECT OR DRAG ANY MODULE TO INSPECT TELEMETRY ]</span>
              <span style={{ fontSize: '9px', marginTop: '8px', color: 'var(--c-text-dim)' }}>
                FIRMWARE // AUGMENT // SOFTWARE // WEAPON // ARMOR
              </span>
            </div>
          )}
        </div>
      </PanelCard>

      {/* Column 3: Reserve Hardware Stash */}
      <PanelCard
        title="RESERVE HARDWARE STASH"
        badge={`${vaultItems.length} ITEMS`}
        className={styles.stashCard}
        bodyClassName={styles.stashBody}
      >
        <StashItemList
          items={vaultItems}
          activeFilter={activeFilter}
          onFilterChange={(f) => setActiveFilter(f)}
          onDragStart={handleDragStartFromStash}
          onDoubleClick={handleDoubleClickFromStash}
        />
      </PanelCard>

      {/* Floating Hover Tooltip for Software Subroutines */}
      {hoveredSoftware && (
        <ItemTooltip
          metadata={hoveredSoftware.metadata}
          position={{ x: hoveredSoftware.x, y: hoveredSoftware.y }}
          visible={true}
          onDismiss={() => setHoveredSoftware(null)}
        />
      )}
    </div>
  );
};

export default LoadoutTab;
