import React, { useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import {
  EquipmentSlots,
  SoftwareDef,
  EquipmentDef,
  TemplateId,
  RarityTier,
  Children,
  RunInventory,
  Item,
} from '@shared/components';
import type { ComponentDef } from '@engine/ecs/types';
import type { EventBus } from '@engine/events/event-bus';
import type { GameEvents } from '@/game/events/types';
import styles from './InventoryOverlay.module.css';
import { InRunItemTooltip } from './InRunItemTooltip';
import { ItemIcon, BtnLever } from '../atomic';
import { getSoftwareModificationInfo } from '../hub/item-metadata';

interface GameContext {
  playerId: number;
  eventBus?: EventBus<GameEvents>;
  world: {
    getComponent: <T>(entityId: number, component: ComponentDef<T>) => T | undefined;
    hasComponent: (entityId: number, component: ComponentDef<unknown>) => boolean;
  };
}

import { getActiveGameContext } from '@/game/setup';

export const EquipmentPanel: React.FC = () => {
  const [hoveredEntityId, setHoveredEntityId] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [openSocketMenuSlot, setOpenSocketMenuSlot] = useState<'weapon' | 'armor' | null>(null);
  const [pendingBurnTarget, setPendingBurnTarget] = useState<{
    entityId: number;
    targetSlot: 'weapon' | 'armor';
    softwareName: string;
  } | null>(null);

  const gameContext = getActiveGameContext() as unknown as GameContext | null;

  // Connect to Zustand game store to subscribe to revisions and handle updates
  const inventoryRevision = useStore(gameStore, (s) => s.inventoryRevision);
  void inventoryRevision;
  const draggedRunItemEntityId = useStore(gameStore, (s) => s.draggedRunItemEntityId);
  const dragOverSlot = useStore(gameStore, (s) => s.dragOverSlot);
  const optimisticWeapon = useStore(gameStore, (s) => s.optimisticWeapon);
  const optimisticArmor = useStore(gameStore, (s) => s.optimisticArmor);

  if (!gameContext) return null;

  const eq = gameContext.world.getComponent(gameContext.playerId, EquipmentSlots);
  const inv = gameContext.world.getComponent(gameContext.playerId, RunInventory);

  // Compute displayed weapon and armor ids based on optimistic state overrides
  const weaponId = optimisticWeapon !== undefined ? optimisticWeapon : eq?.weapon;
  const armorId = optimisticArmor !== undefined ? optimisticArmor : eq?.armor;

  const renderSlot = (slotType: 'weapon' | 'armor', entityId: number | null | undefined) => {
    const isDraggedOver = dragOverSlot === slotType;

    // Check compatibility of currently dragged item
    let isCompatible = false;
    if (draggedRunItemEntityId) {
      const isSw = gameContext.world.hasComponent(draggedRunItemEntityId, SoftwareDef);
      const swDef = gameContext.world.getComponent(draggedRunItemEntityId, SoftwareDef);
      const isEq = gameContext.world.hasComponent(draggedRunItemEntityId, EquipmentDef);
      const eqDef = gameContext.world.getComponent(draggedRunItemEntityId, EquipmentDef);

      if (slotType === 'weapon') {
        isCompatible =
          (isEq && eqDef?.slotType === 'weapon') || (isSw && swDef?.targetSlot === 'weapon');
      } else if (slotType === 'armor') {
        isCompatible =
          (isEq && eqDef?.slotType === 'armor') || (isSw && swDef?.targetSlot === 'armor');
      }
    }

    // Get item name and details if entityId is present
    let itemName = '';
    let detailText = '';
    let itemTemplateId = '';
    let itemRarity = 'common';
    let socketedSwName = '';
    let socketedSwEffect = '';

    if (entityId) {
      const sw = gameContext.world.getComponent(entityId, SoftwareDef);
      const eqItem = gameContext.world.getComponent(entityId, EquipmentDef);
      const tmpl = gameContext.world.getComponent(entityId, TemplateId);
      const rarity = gameContext.world.getComponent(entityId, RarityTier);

      itemTemplateId = tmpl?.id || '';
      itemRarity = rarity?.tier || 'common';

      if (sw) {
        itemName = sw.name;
        detailText = `[Software: ${sw.type}]`;
      } else if (eqItem) {
        itemName = eqItem.name;
        detailText = `[${slotType.toUpperCase()}]`;

        // Check for attached software subroutines
        const children = gameContext.world.getComponent(entityId, Children);
        if (children && children.entityIds && children.entityIds.length > 0) {
          for (const childId of children.entityIds) {
            const cSw = gameContext.world.getComponent(childId, SoftwareDef);
            const cTmpl = gameContext.world.getComponent(childId, TemplateId);
            const cItem = gameContext.world.getComponent(childId, Item);
            if (cSw || cTmpl || cItem) {
              const info = getSoftwareModificationInfo(cTmpl?.id || cSw?.type || '');
              socketedSwName = cSw?.name || cItem?.name || info.name || cTmpl?.id || 'Software Mod';
              socketedSwEffect = info.effect || cSw?.description || '';
              break;
            }
          }
        }
        if (!socketedSwName) {
          const direct = gameContext.world.getComponent(entityId, SoftwareDef);
          if (direct) {
            socketedSwName = direct.name;
            const info = getSoftwareModificationInfo(direct.type);
            socketedSwEffect = info.effect;
          }
        }
      } else {
        itemName = `Entity #${entityId}`;
      }
    }

    // Check available compatible software in the backpack for this slot
    const backpackSoftware = (inv?.software || [])
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        const swDef = gameContext.world.getComponent(item.entityId, SoftwareDef);
        return swDef && (swDef.targetSlot === slotType || !swDef.targetSlot);
      });

    // Class name based on drag states
    let borderStyle = {};
    if (isDraggedOver) {
      borderStyle = {
        border: `2px solid ${isCompatible ? '#00F0FF' : '#FF0055'}`,
      };
    }

    const isMenuOpen = openSocketMenuSlot === slotType;

    return (
      <div
        className={`${styles.slot} ${entityId ? styles.slotFilled : ''}`}
        style={{
          ...borderStyle,
          cursor: entityId ? 'grab' : 'default',
          position: 'relative',
          padding: '10px',
          minHeight: '90px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          marginBottom: '16px',
        }}
        draggable={!!entityId}
        onDragStart={(e) => {
          if (entityId) {
            e.dataTransfer.setData(
              'application/json',
              JSON.stringify({ source: 'equipment', slotType, entityId }),
            );
            gameStore.getState().setDraggedRunItemEntityId(entityId);
          }
        }}
        onDragEnd={() => {
          gameStore.getState().setDraggedRunItemEntityId(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDragEnter={() => {
          gameStore.getState().setDragOverSlot(slotType);
        }}
        onDragLeave={() => {
          if (gameStore.getState().dragOverSlot === slotType) {
            gameStore.getState().setDragOverSlot(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          gameStore.getState().setDragOverSlot(null);
          try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.source === 'inventory') {
              const itemEntityId = data.entityId;
              const isSw = gameContext.world.hasComponent(itemEntityId, SoftwareDef);
              const swDef = gameContext.world.getComponent(itemEntityId, SoftwareDef);
              const isEq = gameContext.world.hasComponent(itemEntityId, EquipmentDef);
              const eqDef = gameContext.world.getComponent(itemEntityId, EquipmentDef);

              const eventBus = gameContext.eventBus;
              if (slotType === 'weapon') {
                if (isEq && eqDef && eqDef.slotType === 'weapon') {
                  gameStore.getState().optimisticEquipItem(itemEntityId, 'weapon');
                  eventBus?.emit('EQUIP_REQUESTED', { slotType: 'weapon', itemEntityId });
                } else if (isSw && swDef && (swDef.targetSlot === 'weapon' || !swDef.targetSlot)) {
                  setPendingBurnTarget({
                    entityId: itemEntityId,
                    targetSlot: 'weapon',
                    softwareName: swDef.name,
                  });
                } else {
                  eventBus?.emit('MESSAGE_EMITTED', {
                    text: 'Invalid drop target. Must be a compatible slot.',
                    type: 'error',
                  });
                }
              } else if (slotType === 'armor') {
                if (isEq && eqDef && eqDef.slotType === 'armor') {
                  gameStore.getState().optimisticEquipItem(itemEntityId, 'armor');
                  eventBus?.emit('EQUIP_REQUESTED', { slotType: 'armor', itemEntityId });
                } else if (isSw && swDef && (swDef.targetSlot === 'armor' || !swDef.targetSlot)) {
                  setPendingBurnTarget({
                    entityId: itemEntityId,
                    targetSlot: 'armor',
                    softwareName: swDef.name,
                  });
                } else {
                  eventBus?.emit('MESSAGE_EMITTED', {
                    text: 'Invalid drop target. Must be a compatible slot.',
                    type: 'error',
                  });
                }
              }
            }
          } catch (err) {
            console.error(err);
          }
        }}
        onDoubleClick={() => {
          if (entityId) {
            gameStore.getState().optimisticUnequipItem(slotType);
            const eventBus = gameContext.eventBus;
            eventBus?.emit('UNEQUIP_REQUESTED', { slotType, slotIndex: 0 });
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
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ItemIcon
                templateId={itemTemplateId}
                name={itemName}
                itemType={slotType}
                rarityTier={itemRarity}
                size="md"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '13px', color: '#ffffff', textTransform: 'uppercase' }}>
                  {itemName}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--c-text-dim)', marginTop: '2px' }}>
                  {detailText}
                </div>
                {socketedSwName && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
                    <div style={{ fontSize: '9px', color: 'var(--c-accent-secondary)', fontWeight: 700 }}>
                      ⚡ MOD: {socketedSwName.toUpperCase()} — {socketedSwEffect}
                    </div>
                    <BtnLever
                      variant="danger"
                      holdToConfirm={true}
                      holdDurationMs={600}
                      onHoldComplete={() => {
                        gameContext.eventBus?.emit('PURGE_SOFTWARE_REQUESTED', {
                          targetSlot: slotType,
                        });
                      }}
                      rightSlot="HOLD"
                      style={{ fontSize: '8px', padding: '2px 6px', height: 'auto', minHeight: 'unset' }}
                      title="Hold to delete burned software from socket"
                    >
                      ✕ PURGE MOD
                    </BtnLever>
                  </div>
                )}
                <div style={{ fontSize: '9px', color: 'var(--c-text-muted)', marginTop: '3px' }}>
                  Double-click to unequip.
                </div>
              </div>
            </div>

            {/* Confirmation Prompt for Dropped Software */}
            {pendingBurnTarget && pendingBurnTarget.targetSlot === slotType && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '8px',
                  background: 'rgba(255, 0, 85, 0.12)',
                  border: '1px solid #ff0055',
                  borderRadius: '2px',
                }}
              >
                <div style={{ fontSize: '10px', color: '#ff0055', fontWeight: 800, marginBottom: '4px' }}>
                  ⚠️ BURN CONFIRMATION: {pendingBurnTarget.softwareName.toUpperCase()}
                </div>
                <div style={{ fontSize: '9px', color: '#ffffff', opacity: 0.8, marginBottom: '8px' }}>
                  Once burned into {slotType.toUpperCase()}, this software cannot be returned to backpack.
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <BtnLever
                    variant="danger"
                    holdToConfirm={true}
                    holdDurationMs={600}
                    onHoldComplete={() => {
                      gameContext.eventBus?.emit('BURN_SOFTWARE_REQUESTED', {
                        softwareEntityId: pendingBurnTarget.entityId,
                        targetSlot: slotType,
                      });
                      setPendingBurnTarget(null);
                    }}
                    rightSlot="HOLD"
                    style={{ fontSize: '9px', padding: '4px 8px' }}
                  >
                    ⚡ CONFIRM BURN (600MS)
                  </BtnLever>
                  <BtnLever
                    variant="primary"
                    onClick={() => setPendingBurnTarget(null)}
                    style={{ fontSize: '9px', padding: '4px 8px' }}
                  >
                    CANCEL
                  </BtnLever>
                </div>
              </div>
            )}

            {/* Software Socketing UI */}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '6px', marginTop: '2px' }}>
              {backpackSoftware.length > 0 ? (
                <div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenSocketMenuSlot(isMenuOpen ? null : slotType);
                    }}
                    style={{
                      background: isMenuOpen ? 'var(--c-accent-secondary, #00f0ff)' : 'rgba(0, 240, 255, 0.1)',
                      color: isMenuOpen ? '#000000' : 'var(--c-accent-secondary, #00f0ff)',
                      border: '1px solid var(--c-accent-secondary, #00f0ff)',
                      padding: '3px 8px',
                      fontSize: '9px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      borderRadius: '2px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {socketedSwName ? '⚡ REPLACE SOFTWARE MOD' : '+ INSTALL SOFTWARE MOD'} ({backpackSoftware.length})
                  </button>

                  {isMenuOpen && (
                    <div
                      style={{
                        marginTop: '6px',
                        background: '#070c14',
                        border: '1px solid var(--c-accent-secondary, #00f0ff)',
                        borderRadius: '2px',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ fontSize: '8px', color: 'var(--c-text-muted)', textTransform: 'uppercase' }}>
                        Press & hold (600ms) to burn software into socket:
                      </div>
                      {backpackSoftware.map(({ item, index }) => {
                        const swDef = gameContext.world.getComponent(item.entityId, SoftwareDef);
                        const info = getSoftwareModificationInfo(item.templateId || swDef?.type || '');
                        return (
                          <div
                            key={item.entityId}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              background: 'rgba(0, 240, 255, 0.05)',
                              border: '1px solid rgba(0, 240, 255, 0.2)',
                              padding: '6px',
                              borderRadius: '2px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '10px', fontWeight: 800, color: '#ffffff' }}>
                                {swDef?.name || item.templateId}
                              </span>
                              <span style={{ fontSize: '8px', color: 'var(--c-accent-secondary)' }}>
                                {info.effect}
                              </span>
                            </div>
                            <BtnLever
                              variant="cyan"
                              holdToConfirm={true}
                              holdDurationMs={600}
                              onHoldComplete={() => {
                                gameContext.eventBus?.emit('BURN_SOFTWARE_REQUESTED', {
                                  softwareEntityId: item.entityId,
                                  runInventoryIndex: index,
                                  targetSlot: slotType,
                                });
                                setOpenSocketMenuSlot(null);
                              }}
                              rightSlot="HOLD"
                              style={{ width: '100%', fontSize: '9px', padding: '4px 8px' }}
                            >
                              ⚡ HOLD TO BURN SUBROUTINE
                            </BtnLever>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '8px', color: 'var(--c-text-muted)' }}>
                  {socketedSwName
                    ? 'No other compatible software in backpack.'
                    : 'No compatible software in backpack to install.'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>Empty Slot</div>
            <div style={{ fontSize: '9px', opacity: 0.6 }}>Drag an item here to equip.</div>
          </div>
        )}
        {hoveredEntityId === entityId && entityId && (
          <InRunItemTooltip entityId={entityId} position={mousePos} />
        )}
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      <h3>Equipment</h3>
      {renderSlot('weapon', weaponId)}
      {renderSlot('armor', armorId)}
    </div>
  );
};
