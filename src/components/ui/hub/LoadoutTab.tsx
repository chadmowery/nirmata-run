'use client';

import React, { useState, useEffect } from 'react';
import { logger } from '@engine/utils/logger';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { ShellTemplate } from '@/game/shells/shared';
import { VaultItem, InstalledItem } from '@/shared/profile';
import { LoadoutSlotPanel } from './LoadoutSlotPanel';
import { StashItemList } from './StashItemList';
import { PanelCard, DottedSpecRow, TaikokuStamp } from '../atomic';
import styles from './LoadoutTab.module.css';

export const LoadoutTab: React.FC = () => {
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);
  const selectedShellIndex = useStore(gameStore, (s) => s.selectedShellIndex);
  const draggedItem = useStore(gameStore, (s) => s.draggedItem);
  const setDraggedItem = useStore(gameStore, (s) => s.setDraggedItem);
  const setDragOverSlot = useStore(gameStore, (s) => s.setDragOverSlot);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);

  const [templates, setTemplates] = useState<ShellTemplate[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'firmware' | 'augment' | 'software'>('all');
  const [inspectedItem, setInspectedItem] = useState<{
    name: string;
    type: string;
    description: string;
    cooldown?: number;
    heat?: number;
    rarity?: string;
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
      name: item.templateId.toUpperCase(),
      type: item.itemType.toUpperCase(),
      description: `Reserve hardware asset recovered from Sector ${item.extractedAtFloor}.`,
      rarity: item.rarityTier.toUpperCase(),
      cooldown: 3,
      heat: 15,
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
    });
    setInspectedItem({
      name: item.blueprintId.toUpperCase(),
      type: item.type.toUpperCase(),
      description: `Installed system socketed into ${activeShellTemplate.name} hardware bus.`,
      rarity: 'SOCKETED',
      cooldown: 2,
      heat: 10,
    });
  };

  const handleSlotDrop = async (slotType: string, slotIndex: number) => {
    logger.debug(`[Loadout] Dropping into ${slotType}:${slotIndex}`, 'UI');
    if (!draggedItem || draggedItem.extractedAtTimestamp === -1) return;

    const sessionId = playerProfile.sessionId;
    const entityId = draggedItem.entityId;
    const shellId = activeShellId;
    const previousProfile = { ...playerProfile };

    updateProfileOptimistic((prev) => {
      const isInVault = prev.vault.some((item) => item.entityId === entityId);
      if (!isInVault) return prev;

      const newVault = prev.vault.filter((item) => item.entityId !== entityId);
      const newInstalled = [
        ...prev.installedItems,
        {
          entityId,
          blueprintId: draggedItem.templateId,
          type: draggedItem.itemType as 'firmware' | 'augment' | 'software',
          shellId,
          isLegacy: false,
        },
      ];
      return { ...prev, vault: newVault, installedItems: newInstalled };
    });

    try {
      const response = await fetch('/api/vault/equip-from-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, entityId, shellId }),
      });

      if (!response.ok) {
        throw new Error('Failed to equip item');
      }
    } catch (error) {
      logger.error('Equip error:', 'UI', error);
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
        itemType: draggedItem.itemType as 'firmware' | 'augment' | 'software',
        rarityTier: 'common',
        extractedAtFloor: 1,
        extractedAtTimestamp: Date.now(),
      };
      return { ...prev, installedItems: newInstalled, vault: [...prev.vault, restoredItem] };
    });

    try {
      const uninstallRes = await fetch('/api/economy/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, blueprintId, shellId }),
      });
      if (!uninstallRes.ok) throw new Error('Uninstall failed');
    } catch (error) {
      logger.error('Unequip error:', 'UI', error);
      updateProfileOptimistic(() => previousProfile);
    } finally {
      setDraggedItem(null);
      setDragOverSlot(null);
    }
  };

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
              </div>
            </div>
          ) : (
            <div className={styles.schematicEmpty}>
              <span>[ SELECT OR DRAG ANY MODULE TO INSPECT TELEMETRY ]</span>
              <span style={{ fontSize: '9px', marginTop: '8px', color: 'var(--c-text-dim)' }}>
                FIRMWARE // AUGMENT // SOFTWARE CHIPSET
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
          onFilterChange={(f) => setActiveFilter(f as 'all' | 'firmware' | 'augment' | 'software')}
          onDragStart={handleDragStartFromStash}
        />
      </PanelCard>
    </div>
  );
};
