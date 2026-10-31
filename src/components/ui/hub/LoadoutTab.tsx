'use client';

import React, { useState, useEffect } from 'react';
import { logger } from '@engine/utils/logger';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { ShellTemplate } from '@/game/shells/shared';
import { VaultItem, InstalledItem } from '@/shared/profile';
import {
  isWeaponItem,
  isArmorItem,
  isSoftwareItem,
  canSocketSoftware,
} from '@/shared/utils/equipment-util';
import { LoadoutSlotPanel } from './LoadoutSlotPanel';
import { StashItemList, StashFilter } from './StashItemList';
import { PanelCard, DottedSpecRow, TaikokuStamp, BtnLever } from '../atomic';
import styles from './LoadoutTab.module.css';

export const LoadoutTab: React.FC = () => {
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);
  const selectedShellIndex = useStore(gameStore, (s) => s.selectedShellIndex);
  const draggedItem = useStore(gameStore, (s) => s.draggedItem);
  const setDraggedItem = useStore(gameStore, (s) => s.setDraggedItem);
  const setDragOverSlot = useStore(gameStore, (s) => s.setDragOverSlot);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);

  const [templates, setTemplates] = useState<ShellTemplate[]>([]);
  const [activeFilter, setActiveFilter] = useState<StashFilter>('all');
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
        }
      } catch (error) {
        logger.error('Failed to fetch shells:', 'UI', error);
      }
    };
    fetchShells();
  }, []);

  if (!playerProfile || templates.length === 0) {
    return <div className={styles.loading}>INITIALIZING_LOADOUT_SYSTEM // VEC-OS 1.0.4...</div>;
  }

  const activeShellTemplate = templates[selectedShellIndex] || templates[0];
  const activeShellId = activeShellTemplate?.id;

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

  const handleSlotDrop = async (slotType: string, slotIndex: number) => {
    logger.debug(`[Loadout] Dropping into ${slotType}:${slotIndex}`, 'UI');
    if (!draggedItem || draggedItem.extractedAtTimestamp === -1) return;

    const sessionId = playerProfile.sessionId;
    const entityId = draggedItem.entityId;
    const shellId = activeShellId;
    const previousProfile = { ...playerProfile };

    // Optimistic UI update
    updateProfileOptimistic((prev) => {
      const isInVault = prev.vault.some((item) => item.entityId === entityId);
      if (!isInVault) return prev;

      const newVault = prev.vault.filter((item) => item.entityId !== entityId);
      const newInstalled = [
        ...prev.installedItems,
        {
          entityId,
          blueprintId: draggedItem.templateId,
          type: slotType as 'firmware' | 'augment' | 'software' | 'weapon' | 'armor' | 'backpack',
          shellId,
          isLegacy: false,
          socketedSoftware: draggedItem.socketedSoftware || [],
        },
      ];
      return { ...prev, vault: newVault, installedItems: newInstalled };
    });

    try {
      const response = await fetch('/api/vault/equip-from-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, entityId, shellId, targetSlotType: slotType }),
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

  const handleSoftwareSocket = async (targetEntityId: number, softwareEntityId: number) => {
    logger.debug(`[Loadout] Socketing software ${softwareEntityId} onto ${targetEntityId}`, 'UI');
    const sessionId = playerProfile.sessionId;
    const previousProfile = { ...playerProfile };
    const softwareItem = playerProfile.vault.find((i) => i.entityId === softwareEntityId);
    if (!softwareItem) return;

    updateProfileOptimistic((prev) => {
      const newVault = prev.vault.filter((i) => i.entityId !== softwareEntityId);
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
        body: JSON.stringify({ sessionId, targetEntityId, softwareEntityId }),
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
    const previousProfile = { ...playerProfile };

    updateProfileOptimistic((prev) => {
      const newInstalled = prev.installedItems.filter(
        (i) => !(i.entityId === entityId && i.shellId === shellId),
      );
      const restoredItem: VaultItem = {
        entityId: entityId,
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
          portConfig={activeShellTemplate.basePorts}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {compatibleStashSoftware.map((sw) => (
                        <BtnLever
                          key={sw.entityId}
                          variant="cyan"
                          onClick={() => handleSoftwareSocket(inspectedItem.entityId!, sw.entityId)}
                          rightSlot="LOAD"
                        >
                          {sw.templateId.toUpperCase()}
                        </BtnLever>
                      ))}
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
      <PanelCard title="RESERVE HARDWARE STASH" badge={`${vaultItems.length} ITEMS`}>
        <StashItemList
          items={vaultItems}
          activeFilter={activeFilter}
          onFilterChange={(f) => setActiveFilter(f)}
          onDragStart={handleDragStartFromStash}
        />
      </PanelCard>
    </div>
  );
};

export default LoadoutTab;
