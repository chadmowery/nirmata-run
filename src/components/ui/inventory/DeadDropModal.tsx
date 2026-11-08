'use client';

import React, { useEffect } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import type { GameContext } from '@/game/types';
import { TaikokuPlacard, ItemIcon, BtnLever } from '../atomic';
import { uiAudio } from '@/game/audio/ui-audio';
import styles from './ContainerOverlay.module.css';
import {
  RunInventory,
  RunCurrency,
  SoftwareDef,
  EquipmentDef,
  AbilityDef,
  AugmentData,
  Item,
} from '@shared/components';

import { getActiveGameContext } from '@/game/setup';

interface DeadDropModalProps {
  onClose: () => void;
}

interface DeadDropCandidate {
  id: number | string;
  templateId: string;
  name: string;
  rarityTier: string;
  type: string;
  quantity?: number;
}

export const DeadDropModal: React.FC<DeadDropModalProps> = ({ onClose }) => {
  const deadDropPropId = useStore(gameStore, (s) => s.deadDropPropId);
  const deadDropFluxCost = useStore(gameStore, (s) => s.deadDropFluxCost);
  const flux = useStore(gameStore, (s) => s.flux);
  const inventoryRevision = useStore(gameStore, (s) => s.inventoryRevision);
  void inventoryRevision;

  const getContext = (): GameContext | undefined => {
    return getActiveGameContext() ?? undefined;
  };

  useEffect(() => {
    uiAudio.playModalOpen();
    return () => {
      uiAudio.playModalClose();
    };
  }, []);

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

  if (deadDropPropId === null) return null;

  const candidates: DeadDropCandidate[] = [];
  const ctx = getContext();

  if (ctx?.world && ctx?.playerId) {
    const inv = ctx.world.getComponent(ctx.playerId, RunInventory);
    if (inv) {
      for (const sw of inv.software) {
        const swDef = ctx.world.getComponent(sw.entityId, SoftwareDef);
        const itemComp = ctx.world.getComponent(sw.entityId, Item);
        candidates.push({
          id: sw.entityId,
          templateId: sw.templateId,
          name: swDef?.name || itemComp?.name || sw.templateId,
          rarityTier: sw.rarityTier,
          type: 'software',
          quantity: sw.quantity ?? 1,
        });
      }
      for (const eq of inv.equipment) {
        const eqDef = ctx.world.getComponent(eq.entityId, EquipmentDef);
        const ability = ctx.world.getComponent(eq.entityId, AbilityDef);
        const augment = ctx.world.getComponent(eq.entityId, AugmentData);
        const itemComp = ctx.world.getComponent(eq.entityId, Item);

        let name = itemComp?.name || eq.templateId;
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
          if (eq.templateId === 'nanite-canister') {
            name = 'Repair Nanites';
          } else if (eq.templateId === 'health-potion') {
            name = 'Field Nanite Repair';
          }
          type = 'consumable';
        }

        candidates.push({
          id: eq.entityId,
          templateId: eq.templateId,
          name,
          rarityTier: eq.rarityTier,
          type,
          quantity: eq.quantity ?? 1,
        });
      }
    }

    const runCurrency = ctx.world.getComponent(ctx.playerId, RunCurrency);
    if (runCurrency?.stacks) {
      for (const stack of runCurrency.stacks) {
        if (stack.currencyType === 'blueprint' && stack.blueprintId && stack.amount > 0) {
          candidates.push({
            id: stack.blueprintId,
            templateId: stack.blueprintId,
            name: `Locked File: ${stack.blueprintId}`,
            rarityTier: 'v2.x',
            type: 'blueprint',
            quantity: stack.amount,
          });
        }
      }
    }
  }

  const canAfford = flux >= deadDropFluxCost;

  const handleTransmit = async (selectionId: number | string) => {
    const activeCtx = getContext();
    if (!activeCtx?.submitAction || deadDropPropId === null) return;
    await activeCtx.submitAction({
      type: 'DEAD_DROP_ITEM',
      targetPropId: deadDropPropId,
      itemId: selectionId,
    });
    onClose();
  };

  return (
    <div
      className={styles.containerOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Dead-Drop Uplink Terminal"
      onClick={onClose}
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <TaikokuPlacard
          kanji="軌道通信 // 秘匿転送"
          title="TELEMETRY DEAD-DROP UPLINK // ORBITAL VAULT TRANSFER"
          stampText={`COST: ${deadDropFluxCost} FLUX`}
          stampVariant={canAfford ? 'cyan' : 'danger'}
          onClose={onClose}
          closeLabel="✕ CLOSE [ESC]"
          style={{ marginBottom: 0, border: 'none', borderBottom: '3px solid #000000' }}
        />

        <div className={styles.splitLayout} style={{ gridTemplateColumns: '1fr' }}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>
                SELECT CARGO OR LOCKED BLUEPRINT FOR ORBITAL TRANSMISSION
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: canAfford ? 'var(--c-accent-secondary, #00f0ff)' : 'var(--c-danger, #ff2a55)',
                  fontWeight: 800,
                }}
              >
                AVAILABLE FLUX: {flux} FX (REQUIRED: {deadDropFluxCost} FX)
              </span>
            </div>

            <div className={styles.itemList}>
              {candidates.length === 0 ? (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: 'var(--c-text-muted)',
                    fontSize: '11px',
                  }}
                >
                  NO ELIGIBLE CARGO OR BLUEPRINTS IN BACKPACK.
                </div>
              ) : (
                candidates.map((item) => (
                  <div
                    key={String(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(0, 240, 255, 0.04)',
                      border: '1px solid rgba(0, 240, 255, 0.2)',
                      padding: '8px 12px',
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
                      variant="cyan"
                      disabled={!canAfford}
                      onClick={() => handleTransmit(item.id)}
                      rightSlot={`${deadDropFluxCost} FX`}
                      style={{ fontSize: '9px', padding: '4px 10px' }}
                    >
                      TRANSMIT TO VAULT
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

export default DeadDropModal;
