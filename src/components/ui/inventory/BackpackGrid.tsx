import React, { useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import {
  RunInventory,
  RunInventoryItem,
  SoftwareDef,
  EquipmentDef,
  AbilityDef,
  AugmentData,
  TemplateId,
  RarityTier,
  Children,
  PortConfig,
  AugmentSlots,
} from '@shared/components';
import type { ComponentDef } from '@engine/ecs/types';
import type { EventBus } from '@engine/events/event-bus';
import type { GameEvents } from '@/game/events/types';
import type { ActionIntent } from '@shared/types';
import styles from './InventoryOverlay.module.css';
import { InRunItemTooltip } from './InRunItemTooltip';
import { ItemIcon, BtnLever } from '../atomic';

interface GameContext {
  playerId: number;
  eventBus?: EventBus<GameEvents>;
  submitAction?: (intent: ActionIntent) => Promise<void>;
  world: {
    getComponent: <T>(entityId: number, component: ComponentDef<T>) => T | undefined;
    hasComponent: (entityId: number, component: ComponentDef<unknown>) => boolean;
  };
}

export const BackpackGrid: React.FC = () => {
  const [hoveredEntityId, setHoveredEntityId] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  const gameContext = (window as unknown as { gameContext: GameContext }).gameContext;

  // Connect to Zustand game store to subscribe to revisions and handle updates
  useStore(gameStore, (s) => s.inventoryRevision);
  const optimisticInventoryEquipmentIds = useStore(
    gameStore,
    (s) => s.optimisticInventoryEquipmentIds,
  );

  if (!gameContext) return null;

  const inv = gameContext.world.getComponent(gameContext.playerId, RunInventory);

  // Construct the lists of items
  const softwareItems = inv?.software || [];
  let equipmentItems: RunInventoryItem[] = [];

  if (optimisticInventoryEquipmentIds !== null) {
    equipmentItems = optimisticInventoryEquipmentIds.map((id) => {
      const templateRef = gameContext.world.getComponent(id, TemplateId);
      const rarity = gameContext.world.getComponent(id, RarityTier);
      return {
        entityId: id,
        templateId: templateRef?.id || 'unknown',
        rarityTier: rarity?.tier || 'v1.x',
        pickedUpAtFloor: 1,
        pickedUpAtTimestamp: Date.now(),
      };
    });
  } else if (inv?.equipment) {
    equipmentItems = inv.equipment;
  }

  const slots = Array(15).fill(null);

  // Selected item details for action panel
  interface ActionConfig {
    label: string;
    variant?: 'primary' | 'cyan' | 'danger';
    holdToConfirm?: boolean;
    holdDurationMs?: number;
    action: () => void;
    rightSlot?: string;
  }
  const selectedItemActions: ActionConfig[] = [];

  if (selectedSlotIndex !== null) {
    const isSw = selectedSlotIndex < softwareItems.length;
    const item = isSw ? softwareItems[selectedSlotIndex] : equipmentItems[selectedSlotIndex - softwareItems.length];
    if (item?.entityId) {
      const swDef = gameContext.world.getComponent(item.entityId, SoftwareDef);
      const eqDef = gameContext.world.getComponent(item.entityId, EquipmentDef);
      const abilityDef = gameContext.world.getComponent(item.entityId, AbilityDef);
      const augmentData = gameContext.world.getComponent(item.entityId, AugmentData);
      const eventBus = gameContext.eventBus;

      if (item.isConsumable) {
        selectedItemActions.push({
          label: `💊 USE REPAIR CANISTER`,
          variant: 'primary',
          action: async () => {
            if (gameContext.submitAction) {
              await gameContext.submitAction({
                type: 'USE_CONSUMABLE',
                inventoryIndex: isSw ? selectedSlotIndex : selectedSlotIndex - softwareItems.length,
              });
            }
            setSelectedSlotIndex(null);
          },
        });
      } else if (swDef) {
        selectedItemActions.push({
          label: `⚡ BURN ON ${swDef.targetSlot.toUpperCase()}`,
          variant: 'cyan',
          holdToConfirm: true,
          holdDurationMs: 600,
          rightSlot: 'HOLD',
          action: () => {
            eventBus?.emit('BURN_SOFTWARE_REQUESTED', {
              softwareEntityId: item.entityId,
              runInventoryIndex: isSw ? selectedSlotIndex : selectedSlotIndex - softwareItems.length,
              targetSlot: swDef.targetSlot,
            });
            setSelectedSlotIndex(null);
          },
        });
      } else if (eqDef) {
        selectedItemActions.push({
          label: `EQUIP ${eqDef.name.toUpperCase()} TO ${eqDef.slotType.toUpperCase()}`,
          variant: 'primary',
          action: () => {
            gameStore.getState().optimisticEquipItem(item.entityId, eqDef.slotType);
            eventBus?.emit('EQUIP_REQUESTED', {
              slotType: eqDef.slotType,
              itemEntityId: item.entityId,
            });
            setSelectedSlotIndex(null);
          },
        });
      } else if (abilityDef) {
        const portConfig = gameContext.world.getComponent(gameContext.playerId, PortConfig);
        const maxFirmware = portConfig?.maxFirmware ?? 2;
        Array.from({ length: maxFirmware }, (_, i) => i).forEach((slotIdx) => {
          selectedItemActions.push({
            label: `⚡ BURN FIRMWARE (SLOT ${slotIdx + 1})`,
            variant: 'cyan',
            holdToConfirm: true,
            holdDurationMs: 600,
            rightSlot: 'HOLD',
            action: () => {
              eventBus?.emit('BURN_FIRMWARE_REQUESTED', {
                firmwareEntityId: item.entityId,
                slotIndex: slotIdx,
              });
              setSelectedSlotIndex(null);
            },
          });
        });
      } else if (augmentData) {
        const portConfig = gameContext.world.getComponent(gameContext.playerId, PortConfig);
        const maxAugment = portConfig?.maxAugment ?? 3;
        const agSlots = gameContext.world.getComponent(gameContext.playerId, AugmentSlots);

        // Allow overwriting existing equipped augment slots
        if (agSlots && agSlots.equipped.length > 0) {
          agSlots.equipped.forEach((_, slotIdx) => {
            selectedItemActions.push({
              label: `🧬 OVERWRITE AUGMENT (SLOT ${slotIdx + 1})`,
              variant: 'cyan',
              holdToConfirm: true,
              holdDurationMs: 600,
              rightSlot: 'HOLD',
              action: () => {
                eventBus?.emit('BURN_AUGMENT_REQUESTED', {
                  augmentEntityId: item.entityId,
                  slotIndex: slotIdx,
                });
                setSelectedSlotIndex(null);
              },
            });
          });
        }

        // Allow burning into chassis if available ports remain
        if (!agSlots || agSlots.equipped.length < maxAugment) {
          selectedItemActions.push({
            label: `🧬 BURN AUGMENT INTO CHASSIS`,
            variant: 'cyan',
            holdToConfirm: true,
            holdDurationMs: 600,
            rightSlot: 'HOLD',
            action: () => {
              eventBus?.emit('BURN_AUGMENT_REQUESTED', {
                augmentEntityId: item.entityId,
              });
              setSelectedSlotIndex(null);
            },
          });
        }
      }
    }
  }

  return (
    <div className={styles.panel}>
      <h3>Backpack</h3>
      <div className={styles.gridContainer}>
        {slots.map((_, i) => {
          const isSoftware = i < softwareItems.length;
          const softwareItem = isSoftware ? softwareItems[i] : null;
          const equipmentItem = !isSoftware ? equipmentItems[i - softwareItems.length] : null;
          const item = softwareItem || equipmentItem;
          const entityId = item?.entityId || null;
          const isSelected = selectedSlotIndex === i;

          // Get item name and details if entityId is present
          let itemName = '';
          let itemTemplateId = '';
          let itemRarity = 'common';
          let itemType = 'software';
          let hasSocketedSoftware = false;

          if (entityId) {
            const sw = gameContext.world.getComponent(entityId, SoftwareDef);
            const eq = gameContext.world.getComponent(entityId, EquipmentDef);
            const ability = gameContext.world.getComponent(entityId, AbilityDef);
            const augment = gameContext.world.getComponent(entityId, AugmentData);
            const tmpl = gameContext.world.getComponent(entityId, TemplateId);
            const rarity = gameContext.world.getComponent(entityId, RarityTier);

            itemTemplateId = tmpl?.id || (equipmentItem?.templateId || '');
            itemRarity = rarity?.tier || (equipmentItem?.rarityTier || 'common');

            if (sw) {
              itemName = sw.name;
              itemType = 'software';
            } else if (eq) {
              itemName = eq.name;
              itemType = eq.slotType;

              // Check if gear has software in children
              const children = gameContext.world.getComponent(entityId, Children);
              if (children && children.entityIds.length > 0) {
                hasSocketedSoftware = true;
              }
            } else if (ability) {
              itemName = ability.name;
              itemType = 'firmware';
            } else if (augment) {
              itemName = augment.name;
              itemType = 'augment';
            } else if (equipmentItem?.isConsumable) {
              itemName = itemTemplateId === 'nanite-canister' ? 'Repair Nanites' : 'Nanite Canister';
              itemType = 'consumable';
            } else {
              itemName = itemTemplateId || `Entity #${entityId}`;
            }
          }

          return (
            <div
              key={i}
              className={`${styles.slot} ${entityId ? styles.slotFilled : ''}`}
              style={{
                cursor: entityId ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                padding: '4px',
                textAlign: 'center',
                position: 'relative',
                border: isSelected ? '2px solid var(--c-accent, #00f0ff)' : undefined,
                background: isSelected ? 'rgba(0, 240, 255, 0.1)' : undefined,
              }}
              draggable={!!entityId}
              onClick={() => {
                if (entityId) {
                  setSelectedSlotIndex(isSelected ? null : i);
                } else {
                  setSelectedSlotIndex(null);
                }
              }}
              onDragStart={(e) => {
                if (entityId) {
                  const dragData = {
                    source: 'inventory',
                    entityId,
                    itemType: isSoftware ? 'software' : 'equipment',
                    inventoryIndex: isSoftware ? i : i - softwareItems.length,
                  };
                  e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                  gameStore.getState().setDraggedRunItemEntityId(entityId);
                }
              }}
              onDragEnd={() => {
                gameStore.getState().setDraggedRunItemEntityId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                try {
                  const data = JSON.parse(e.dataTransfer.getData('application/json'));
                  if (data.source === 'equipment') {
                    // Trigger unequip with optimistic update
                    gameStore.getState().optimisticUnequipItem(data.slotType);
                    const eventBus = gameContext.eventBus;
                    if (eventBus) {
                      eventBus.emit('UNEQUIP_REQUESTED', { slotType: data.slotType, slotIndex: 0 });
                    }
                  }
                } catch (err) {
                  console.error('Error handling drop in BackpackGrid:', err);
                }
              }}
              onDoubleClick={() => {
                if (entityId) {
                  if (equipmentItem?.isConsumable) {
                    if (gameContext.submitAction) {
                      void gameContext.submitAction({
                        type: 'USE_CONSUMABLE',
                        inventoryIndex: isSoftware ? i : i - softwareItems.length,
                      });
                    }
                    return;
                  }

                  const isSw = gameContext.world.hasComponent(entityId, SoftwareDef);
                  const swDef = gameContext.world.getComponent(entityId, SoftwareDef);
                  const isEq = gameContext.world.hasComponent(entityId, EquipmentDef);
                  const eqDef = gameContext.world.getComponent(entityId, EquipmentDef);

                  const eventBus = gameContext.eventBus;
                  if (isEq && eqDef) {
                    gameStore.getState().optimisticEquipItem(entityId, eqDef.slotType);
                    eventBus?.emit('EQUIP_REQUESTED', {
                      slotType: eqDef.slotType,
                      itemEntityId: entityId,
                    });
                  } else if (isSw && swDef) {
                    eventBus?.emit('BURN_SOFTWARE_REQUESTED', {
                      runInventoryIndex: isSoftware ? i : i - softwareItems.length,
                      targetSlot: swDef.targetSlot,
                    });
                  }
                }
              }}
              onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
              onMouseEnter={(e) => {
                if (entityId) {
                  setMousePos({ x: e.clientX, y: e.clientY });
                  setHoveredEntityId(entityId);
                }
              }}
              onMouseLeave={() => setHoveredEntityId(null)}
            >
              {entityId ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', width: '100%', position: 'relative' }}>
                  <ItemIcon
                    templateId={itemTemplateId}
                    name={itemName}
                    itemType={itemType}
                    rarityTier={itemRarity}
                    size="sm"
                  />
                  {hasSocketedSoftware && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        background: 'var(--c-accent-secondary, #00ff9d)',
                        color: '#000000',
                        fontSize: '7px',
                        fontWeight: 900,
                        padding: '0 2px',
                        borderRadius: '1px',
                        lineHeight: '9px',
                      }}
                      title="Loaded Software Subroutine"
                    >
                      SW
                    </div>
                  )}
                  {equipmentItem?.isConsumable && (equipmentItem.quantity ?? 1) > 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        background: 'rgba(0, 240, 255, 0.9)',
                        color: '#000000',
                        fontSize: '8px',
                        fontWeight: 900,
                        padding: '0 3px',
                        borderRadius: '2px',
                        lineHeight: '10px',
                      }}
                      title={`Stack: ${equipmentItem.quantity}`}
                    >
                      x{equipmentItem.quantity}
                    </div>
                  )}
                  <div
                    style={{
                      fontWeight: 'bold',
                      fontSize: '9px',
                      maxWidth: '52px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#ffffff',
                    }}
                    title={itemName}
                  >
                    {itemName}
                  </div>
                </div>
              ) : (
                ''
              )}
              {hoveredEntityId === entityId && entityId && (
                <InRunItemTooltip entityId={entityId} position={mousePos} />
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Action Buttons for Selected Item */}
      {selectedItemActions.length > 0 && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {selectedItemActions.map((act, idx) => (
            <BtnLever
              key={idx}
              variant={act.variant || 'cyan'}
              holdToConfirm={act.holdToConfirm}
              holdDurationMs={act.holdDurationMs ?? 600}
              onHoldComplete={act.holdToConfirm ? act.action : undefined}
              onClick={!act.holdToConfirm ? act.action : undefined}
              rightSlot={act.rightSlot}
              style={{ width: '100%', fontSize: '9px', padding: '5px 10px' }}
            >
              {act.label}
            </BtnLever>
          ))}
        </div>
      )}
    </div>
  );
};
