'use client';

import React, { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { gameStore, GroundItemInfo } from '@/game/ui/store';
import { getActiveGameContext } from '@/game/active-context';
import { TaikokuPlacard, ItemIcon, BtnLever } from '../atomic';
import styles from './GroundTransferModal.module.css';
import { resolveItemMetadata } from '../hub/item-metadata';
import {
  RunInventory,
  SoftwareDef,
  EquipmentDef,
  AbilityDef,
  AugmentData,
  TemplateId,
  RarityTier,
  Position,
  Item,
  PickupEffect,
  Dying,
} from '@shared/components';

interface GroundTransferModalProps {
  onClose: () => void;
}

export const GroundTransferModal: React.FC<GroundTransferModalProps> = ({ onClose }) => {
  const groundItems = useStore(gameStore, (s) => s.nearbyGroundItems);
  const inventoryRevision = useStore(gameStore, (s) => s.inventoryRevision);
  void inventoryRevision;

  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    modalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === modalRef.current) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  // Helper to re-scan ground items nearby after a take or drop
  const rescanNearby = () => {
    const ctx = getActiveGameContext();
    if (!ctx?.world || !ctx?.grid || !ctx?.playerId) return;
    const playerPos = ctx.world.getComponent(ctx.playerId, Position);
    if (!playerPos) return;

    const nearby: GroundItemInfo[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const tx = playerPos.x + dx;
        const ty = playerPos.y + dy;
        const cellItems = ctx.grid.getItemsAt(tx, ty);
        for (const itemId of cellItems) {
          if (!ctx.world.entityExists(itemId) || ctx.world.hasComponent(itemId, Dying)) {
            continue;
          }
          const itemPos = ctx.world.getComponent(itemId, Position);
          if (!itemPos || itemPos.x !== tx || itemPos.y !== ty) {
            continue;
          }

          const tmpl = ctx.world.getComponent(itemId, TemplateId);
          const rarity = ctx.world.getComponent(itemId, RarityTier);
          const sw = ctx.world.getComponent(itemId, SoftwareDef);
          const eq = ctx.world.getComponent(itemId, EquipmentDef);
          const ability = ctx.world.getComponent(itemId, AbilityDef);
          const augment = ctx.world.getComponent(itemId, AugmentData);
          const itemComp = ctx.world.getComponent(itemId, Item);
          const pickupEffect = ctx.world.getComponent(itemId, PickupEffect);

          let name = itemComp?.name;
          let type = 'equipment';
          let isConsumable = false;

          if (sw) {
            name = name || sw.name;
            type = 'software';
          } else if (eq) {
            name = name || eq.name;
            type = eq.slotType;
          } else if (ability) {
            name = name || ability.name;
            type = 'firmware';
          } else if (augment) {
            name = name || augment.name;
            type = 'augment';
          } else if (pickupEffect?.type === 'heal' || itemComp?.type === 'consumable') {
            name =
              name ||
              (tmpl?.id === 'nanite-canister'
                ? 'Repair Nanites'
                : resolveItemMetadata({ templateId: tmpl?.id || '' }).name || tmpl?.id || 'Consumable');
            type = 'consumable';
            isConsumable = true;
          } else {
            name = name || tmpl?.id || `Item #${itemId}`;
          }

          let directionLabel = 'CURRENT TILE';
          if (dx !== 0 || dy !== 0) {
            const ns = dy < 0 ? 'N' : dy > 0 ? 'S' : '';
            const ew = dx < 0 ? 'W' : dx > 0 ? 'E' : '';
            directionLabel = `ADJACENT (${ns}${ew})`;
          }

          nearby.push({
            itemId,
            templateId: tmpl?.id || 'unknown',
            name,
            rarityTier: rarity?.tier || 'v1.x',
            type,
            x: tx,
            y: ty,
            isPlayerTile: dx === 0 && dy === 0,
            directionLabel,
            isConsumable,
          });
        }
      }
    }
    gameStore.getState().updateNearbyGroundItems(nearby);
  };

  // Read player's current backpack items
  const backpackItems: Array<{
    entityId: number;
    templateId: string;
    name: string;
    rarityTier: string;
    type: string;
    quantity?: number;
    isConsumable?: boolean;
  }> = [];

  let maxSlots = 30;

  const currentCtx = getActiveGameContext();
  if (currentCtx?.world && currentCtx?.playerId) {
    const inv = currentCtx.world.getComponent(currentCtx.playerId, RunInventory);
    if (inv) {
      maxSlots = inv.maxSlots || 30;
      for (const sw of inv.software) {
        const swDef = currentCtx.world.getComponent(sw.entityId, SoftwareDef);
        const itemComp = currentCtx.world.getComponent(sw.entityId, Item);
        backpackItems.push({
          entityId: sw.entityId,
          templateId: sw.templateId,
          name: itemComp?.name || swDef?.name || sw.templateId,
          rarityTier: sw.rarityTier,
          type: 'software',
          quantity: sw.quantity ?? 1,
          isConsumable: false,
        });
      }
      for (const eq of inv.equipment) {
        const eqDef = currentCtx.world.getComponent(eq.entityId, EquipmentDef);
        const ability = currentCtx.world.getComponent(eq.entityId, AbilityDef);
        const augment = currentCtx.world.getComponent(eq.entityId, AugmentData);
        const itemComp = currentCtx.world.getComponent(eq.entityId, Item);
        let name = itemComp?.name;
        let type = 'equipment';
        if (eqDef) {
          name = name || eqDef.name;
          type = eqDef.slotType;
        } else if (ability) {
          name = name || ability.name;
          type = 'firmware';
        } else if (augment) {
          name = name || augment.name;
          type = 'augment';
        } else if (eq.isConsumable) {
          name =
            name ||
            (eq.templateId === 'nanite-canister'
              ? 'Repair Nanites'
              : resolveItemMetadata({ templateId: eq.templateId }).name || eq.templateId);
          type = 'consumable';
        } else {
          name = name || eq.templateId;
        }

        backpackItems.push({
          entityId: eq.entityId,
          templateId: eq.templateId,
          name,
          rarityTier: eq.rarityTier,
          type,
          quantity: eq.quantity ?? 1,
          isConsumable: eq.isConsumable,
        });
      }
    }
  }

  // Capacity check taking stacking into account
  const canTakeItem = (item: GroundItemInfo): boolean => {
    if (backpackItems.length < maxSlots) return true;
    const isConsumable = item.isConsumable || item.type === 'consumable';
    if (isConsumable) {
      return backpackItems.some(
        (b) => b.isConsumable && b.templateId === item.templateId && (b.quantity ?? 1) < 10,
      );
    }
    return false;
  };

  const handleTakeItem = async (itemId: number, targetX?: number, targetY?: number) => {
    const activeCtx = getActiveGameContext();
    if (!activeCtx?.submitAction) return;
    await activeCtx.submitAction({
      type: 'PICKUP',
      itemId,
      targetX,
      targetY,
    });
    rescanNearby();
  };

  const handleTakeAll = async () => {
    const itemsToTake = [...groundItems];
    for (const item of itemsToTake) {
      const activeCtx = getActiveGameContext();
      if (!activeCtx?.world || !activeCtx?.playerId) break;
      const inv = activeCtx.world.getComponent(activeCtx.playerId, RunInventory);
      if (!inv) break;
      const limit = inv.maxSlots || 30;
      const currentCount = inv.software.length + inv.equipment.length;
      const isConsumable = item.isConsumable || item.type === 'consumable';
      const canStack =
        isConsumable &&
        inv.equipment.some(
          (e) => e.isConsumable && e.templateId === item.templateId && (e.quantity ?? 1) < 10,
        );

      if (currentCount >= limit && !canStack) {
        continue;
      }
      await handleTakeItem(item.itemId, item.x, item.y);
    }
  };

  const handleDropItem = async (itemEntityId: number) => {
    const activeCtx = getActiveGameContext();
    if (!activeCtx?.submitAction) return;
    await activeCtx.submitAction({
      type: 'DROP_ITEM',
      itemEntityId,
    });
    rescanNearby();
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Ground Loot Transfer Modal"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
      >
        <TaikokuPlacard
          kanji="戦術回収 // 物資移送"
          title="TACTICAL GROUND RECOVERY & BACKPACK TRANSFER"
          stampText="RADIAL // 1-TILE SCAN"
          stampVariant="cyan"
          onClose={onClose}
          closeLabel="✕ CLOSE [ESC]"
          className={styles.placardHeader}
        />

        <div className={styles.splitLayout}>
          {/* Left Panel: Ground Items */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>GROUND OBJECTS ({groundItems.length})</span>
              {groundItems.length > 0 && groundItems.some(canTakeItem) && (
                <BtnLever
                  variant="cyan"
                  onClick={handleTakeAll}
                  className={styles.takeAllBtn}
                >
                  TAKE ALL
                </BtnLever>
              )}
            </div>

            <div className={styles.itemList}>
              {groundItems.length === 0 ? (
                <div className={styles.emptyState}>
                  NO LOOT ON GROUND WITHIN REACH.
                </div>
              ) : (
                groundItems.map((item) => (
                  <div key={item.itemId} className={styles.itemRowGround}>
                    <div className={styles.itemLeft}>
                      <ItemIcon
                        templateId={item.templateId}
                        itemType={item.type}
                        rarityTier={item.rarityTier}
                        size="sm"
                      />
                      <div className={styles.itemText}>
                        <div className={styles.itemName}>{item.name}</div>
                        <div
                          className={
                            item.isPlayerTile ? styles.itemMetaCurrentTile : styles.itemMetaAdjacent
                          }
                        >
                          {item.directionLabel} • [{item.type.toUpperCase()}]
                        </div>
                      </div>
                    </div>

                    <BtnLever
                      variant="cyan"
                      onClick={() => handleTakeItem(item.itemId, item.x, item.y)}
                      disabled={!canTakeItem(item)}
                      className={styles.actionBtn}
                    >
                      TAKE
                    </BtnLever>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel: Player Backpack */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>BACKPACK INVENTORY</span>
              <span className={styles.slotBadge}>
                {backpackItems.length} / {maxSlots} SLOTS
              </span>
            </div>

            <div className={styles.itemList}>
              {backpackItems.length === 0 ? (
                <div className={styles.emptyState}>
                  BACKPACK IS EMPTY.
                </div>
              ) : (
                backpackItems.map((item) => (
                  <div key={item.entityId} className={styles.itemRowBackpack}>
                    <div className={styles.itemLeft}>
                      <ItemIcon
                        templateId={item.templateId}
                        itemType={item.type}
                        rarityTier={item.rarityTier}
                        size="sm"
                      />
                      <div className={styles.itemText}>
                        <div className={styles.itemName}>
                          {item.name} {item.quantity && item.quantity > 1 ? `x${item.quantity}` : ''}
                        </div>
                        <div className={styles.itemMetaDim}>
                          [{item.type.toUpperCase()}] • {item.rarityTier.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <BtnLever
                      variant="danger"
                      onClick={() => handleDropItem(item.entityId)}
                      className={styles.actionBtn}
                      title="Drop item onto floor to make room"
                    >
                      DROP
                    </BtnLever>
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

export default GroundTransferModal;
