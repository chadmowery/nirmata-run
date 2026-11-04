'use client';

import React, { useEffect } from 'react';
import { useStore } from 'zustand';
import { gameStore, GroundItemInfo } from '@/game/ui/store';
import type { GameContext } from '@/game/types';
import { TaikokuPlacard, ItemIcon, BtnLever } from '../atomic';
import styles from './ContainerOverlay.module.css';
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
  Dying,
} from '@shared/components';

interface GroundTransferModalProps {
  onClose: () => void;
}

export const GroundTransferModal: React.FC<GroundTransferModalProps> = ({ onClose }) => {
  const groundItems = useStore(gameStore, (s) => s.nearbyGroundItems);
  const inventoryRevision = useStore(gameStore, (s) => s.inventoryRevision);
  void inventoryRevision;

  const getContext = (): GameContext | undefined => {
    return (
      (typeof window !== 'undefined'
        ? (window as unknown as {
            gameContext?: GameContext;
          }).gameContext
        : undefined)
    );
  };

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

  // Helper to re-scan ground items nearby after a take or drop
  const rescanNearby = () => {
    const ctx = getContext();
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

          let name = itemComp?.name || tmpl?.id || `Item #${itemId}`;
          let type = 'equipment';
          if (sw) {
            name = sw.name;
            type = 'software';
          } else if (eq) {
            name = eq.name;
            type = eq.slotType;
          } else if (ability) {
            name = ability.name;
            type = 'firmware';
          } else if (augment) {
            name = augment.name;
            type = 'augment';
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

  let maxSlots = 20;

  const currentCtx = getContext();
  if (currentCtx?.world && currentCtx?.playerId) {
    const inv = currentCtx.world.getComponent(currentCtx.playerId, RunInventory);
    if (inv) {
      maxSlots = inv.maxSlots || 20;
      for (const sw of inv.software) {
        const swDef = currentCtx.world.getComponent(sw.entityId, SoftwareDef);
        backpackItems.push({
          entityId: sw.entityId,
          templateId: sw.templateId,
          name: swDef?.name || sw.templateId,
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
        let name = eq.templateId;
        let type = 'equipment';
        if (eqDef) {
          name = eqDef.name;
          type = eqDef.slotType;
        } else if (ability) {
          name = ability.name;
          type = 'firmware';
        } else if (augment) {
          name = augment.name;
          type = 'augment';
        } else if (eq.isConsumable) {
          name = eq.templateId === 'nanite-canister' ? 'Repair Nanites' : 'Nanite Canister';
          type = 'consumable';
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

  const handleTakeItem = async (itemId: number, targetX?: number, targetY?: number) => {
    const activeCtx = getContext();
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
      let currentBackpackCount = 0;
      let limit = 20;
      const activeCtx = getContext();
      if (activeCtx?.world && activeCtx?.playerId) {
        const inv = activeCtx.world.getComponent(activeCtx.playerId, RunInventory);
        if (inv) {
          limit = inv.maxSlots || 20;
          currentBackpackCount = inv.software.length + inv.equipment.length;
        }
      }
      if (currentBackpackCount >= limit) break;
      await handleTakeItem(item.itemId, item.x, item.y);
    }
  };

  const handleDropItem = async (itemEntityId: number) => {
    const activeCtx = getContext();
    if (!activeCtx?.submitAction) return;
    await activeCtx.submitAction({
      type: 'DROP_ITEM',
      itemEntityId,
    });
    rescanNearby();
  };

  return (
    <div
      className={styles.containerOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Ground Loot Transfer Modal"
      onClick={onClose}
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <TaikokuPlacard
          kanji="戦術回収 // 物資移送"
          title="TACTICAL GROUND RECOVERY & BACKPACK TRANSFER"
          stampText="RADIAL // 1-TILE SCAN"
          stampVariant="cyan"
          onClose={onClose}
          closeLabel="✕ CLOSE [ESC]"
          style={{ marginBottom: 0, border: 'none', borderBottom: '3px solid #000000' }}
        />

        <div className={styles.splitLayout}>
          {/* Left Panel: Ground Items */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>GROUND OBJECTS ({groundItems.length})</span>
              {groundItems.length > 0 && backpackItems.length < maxSlots && (
                <BtnLever
                  variant="cyan"
                  onClick={handleTakeAll}
                  style={{ fontSize: '9px', padding: '3px 8px' }}
                >
                  TAKE ALL
                </BtnLever>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {groundItems.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--c-text-muted)', fontSize: '11px' }}>
                  NO LOOT ON GROUND WITHIN REACH.
                </div>
              ) : (
                groundItems.map((item) => (
                  <div
                    key={item.itemId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(0, 240, 255, 0.04)',
                      border: '1px solid rgba(0, 240, 255, 0.2)',
                      padding: '6px 10px',
                      borderRadius: '2px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <ItemIcon
                        templateId={item.templateId}
                        itemType={item.type}
                        rarityTier={item.rarityTier}
                        size="sm"
                      />
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#ffffff' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '9px', color: item.isPlayerTile ? 'var(--c-accent, #00f0ff)' : 'var(--c-warning, #f59e0b)', fontWeight: 700 }}>
                          {item.directionLabel} • [{item.type.toUpperCase()}]
                        </div>
                      </div>
                    </div>

                    <BtnLever
                      variant="cyan"
                      onClick={() => handleTakeItem(item.itemId, item.x, item.y)}
                      disabled={backpackItems.length >= maxSlots}
                      style={{ fontSize: '9px', padding: '3px 10px' }}
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
              <span style={{ fontSize: '10px', color: 'var(--c-accent-secondary, #d8ff00)', fontWeight: 800 }}>
                {backpackItems.length} / {maxSlots} SLOTS
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {backpackItems.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--c-text-muted)', fontSize: '11px' }}>
                  BACKPACK IS EMPTY.
                </div>
              ) : (
                backpackItems.map((item) => (
                  <div
                    key={item.entityId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      padding: '6px 10px',
                      borderRadius: '2px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <ItemIcon
                        templateId={item.templateId}
                        itemType={item.type}
                        rarityTier={item.rarityTier}
                        size="sm"
                      />
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#ffffff' }}>
                          {item.name} {item.quantity && item.quantity > 1 ? `x${item.quantity}` : ''}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--c-text-dim)', fontWeight: 700 }}>
                          [{item.type.toUpperCase()}] • {item.rarityTier.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <BtnLever
                      variant="danger"
                      onClick={() => handleDropItem(item.entityId)}
                      style={{ fontSize: '9px', padding: '3px 10px' }}
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
