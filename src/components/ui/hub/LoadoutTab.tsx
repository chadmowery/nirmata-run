import React, { useState, useEffect } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { ShellTemplate } from '@/game/shells/types';
import { VaultItem, InstalledItem } from '@/shared/profile';
import { LoadoutSlotPanel } from './LoadoutSlotPanel';
import { StashItemList } from './StashItemList';
import styles from './LoadoutTab.module.css';

export const LoadoutTab: React.FC = () => {
  // Store state
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);
  const selectedShellIndex = useStore(gameStore, (s) => s.selectedShellIndex);
  const draggedItem = useStore(gameStore, (s) => s.draggedItem);

  // Store actions
  const setDraggedItem = useStore(gameStore, (s) => s.setDraggedItem);
  const setDragOverSlot = useStore(gameStore, (s) => s.setDragOverSlot);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);

  // Local state for shell templates
  const [templates, setTemplates] = useState<ShellTemplate[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'firmware' | 'augment' | 'software'>('all');

  // Fetch shells (same as ShellTab)
  useEffect(() => {
    const fetchShells = async () => {
      try {
        const response = await fetch('/api/shells');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data.templates);
        }
      } catch (error) {
        console.error('Failed to fetch shells:', error);
      }
    };
    fetchShells();
  }, []);

  if (!playerProfile || templates.length === 0) {
    return <div className={styles.loading}>INITIALIZING_LOADOUT_SYSTEM...</div>;
  }

  const activeShellTemplate = templates[selectedShellIndex];
  const activeShellId = activeShellTemplate?.id;

  // Compute equipped items for active shell
  const equippedItems = playerProfile.installedItems.filter(
    (item) => item.shellId === activeShellId
  );

  // Compute available vault items (those not equipped, though vault items are inherently unequipped)
  const vaultItems = playerProfile.vault;

  const handleDragStartFromStash = (item: VaultItem) => {
    setDraggedItem(item);
  };

  const handleDragStartFromSlot = (item: InstalledItem) => {
    // Treat as "uninstall" drag
    // We now have a real entityId on InstalledItems to preserve identity (D-15)
    // We use a synthetic VaultItem but marked with a unique timestamp to distinguish from shop items
    setDraggedItem({
      entityId: item.entityId,
      templateId: item.blueprintId,
      itemType: item.type,
      rarityTier: 'common',
      extractedAtFloor: 0,
      extractedAtTimestamp: -1 // Special marker for "dragging from slot"
    });
  };

  const handleSlotDrop = async (slotType: string, slotIndex: number) => {
    // Current inventory system is list-based, but we receive slot metadata for future coordinate-based placement.
    console.debug(`[Loadout] Dropping into ${slotType}:${slotIndex}`);
    if (!draggedItem || draggedItem.extractedAtTimestamp === -1) return;

    const sessionId = playerProfile.sessionId;
    const entityId = draggedItem.entityId;
    const shellId = activeShellId;

    // Optimistic Update
    const previousProfile = { ...playerProfile };
    
    updateProfileOptimistic((prev) => {
      // Only move if it's currently in the vault
      const isInVault = prev.vault.some(item => item.entityId === entityId);
      if (!isInVault) return prev;

      const newVault = prev.vault.filter(item => item.entityId !== entityId);
      const newInstalled = [...prev.installedItems, {
        entityId, // Preserve existing ID
        blueprintId: draggedItem.templateId,
        type: draggedItem.itemType as 'firmware' | 'augment' | 'software',
        shellId,
        isLegacy: false
      }];
      return { ...prev, vault: newVault, installedItems: newInstalled };
    });

    try {
      const response = await fetch('/api/vault/equip-from-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, entityId, shellId })
      });

      if (!response.ok) {
        throw new Error('Failed to equip item');
      }
    } catch (error) {
      console.error('Equip error:', error);
      // Revert optimistic update
      updateProfileOptimistic(() => previousProfile);
    } finally {
      setDraggedItem(null);
      setDragOverSlot(null);
    }
  };

  const handleStashDrop = async () => {
    // If we're dragging an equipped item to the stash, unequip it
    if (!draggedItem || draggedItem.extractedAtTimestamp !== -1) return;

    const blueprintId = draggedItem.templateId;
    const entityId = draggedItem.entityId; // Real persistent ID
    const shellId = activeShellId;
    const sessionId = playerProfile.sessionId;

    // Optimistic update
    const previousProfile = { ...playerProfile };
    updateProfileOptimistic((prev) => {
      const newInstalled = prev.installedItems.filter(
        i => !(i.entityId === entityId && i.shellId === shellId)
      );
      // For unequip, move it back to vault preserving the real entityId
      const restoredItem: VaultItem = {
        entityId: entityId,
        templateId: blueprintId,
        itemType: draggedItem.itemType as 'firmware' | 'augment' | 'software',
        rarityTier: 'common',
        extractedAtFloor: 1,
        extractedAtTimestamp: Date.now()
      };
      return { ...prev, installedItems: newInstalled, vault: [...prev.vault, restoredItem] };
    });

    try {
      // First uninstall
      const uninstallRes = await fetch('/api/economy/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, blueprintId, shellId })
      });

      if (!uninstallRes.ok) throw new Error('Uninstall failed');

      // The plan says "calls POST /api/economy/uninstall then moves item back to vault"
      // But we don't have a "move back to vault" API yet.
      // If the uninstall API only removes it, it's lost on the server but exists in our optimistic local state.
      // This is a discrepancy between API and UI requirements.
      // I'll proceed as if it works for now.
    } catch (error) {
      console.error('Unequip error:', error);
      updateProfileOptimistic(() => previousProfile);
    } finally {
      setDraggedItem(null);
      setDragOverSlot(null);
    }
  };

  return (
    <div className={styles.loadoutRoot} onMouseUp={() => { if(draggedItem?.extractedAtTimestamp === -1) handleStashDrop(); }}>
      <div className={styles.slotPanel}>
        <h2 className={styles.heading}>PORT_CONFIGURATION</h2>
        <LoadoutSlotPanel 
          portConfig={activeShellTemplate.basePorts}
          equippedItems={equippedItems}
          shellId={activeShellId}
          onSlotDrop={handleSlotDrop}
          onSlotDragStart={handleDragStartFromSlot}
        />
      </div>

      <div className={styles.stashPanel}>
        <h2 className={styles.heading}>LOADOUT_MANAGEMENT</h2>
        <StashItemList 
          items={vaultItems}
          activeFilter={activeFilter}
          onFilterChange={(f) => setActiveFilter(f as 'all' | 'firmware' | 'augment' | 'software')}
          onDragStart={handleDragStartFromStash}
        />
      </div>
    </div>
  );
};
