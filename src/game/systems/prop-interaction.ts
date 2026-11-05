import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { Phase } from '@engine/ecs/types';
import { Position } from '@shared/components/position';
import { Hostile } from '@shared/components/hostile';
import { Heat } from '@shared/components/heat';
import { Stability } from '@shared/components/stability';
import { FloorState } from '@shared/components/floor-state';
import { BlocksMovement } from '@shared/components/blocks-movement';
import { AlertIntent } from '@shared/components/intents';
import { RunInventory, RunCurrency } from '@shared/components/run-inventory';
import {
  Prop,
  SecurityLock,
  Container,
  CorruptedNode,
  DirectionalProp,
  vectorToOrientation,
  InteractPropIntent,
  PropInteractedThisTurn,
  FactionTheme,
} from '@shared/components/environment';
import { GameplayEvents } from '@shared/events/types';
import { EntityFactory } from '@engine/entity/factory';
import { ComponentRegistry } from '@engine/entity/types';
import { logger } from '@engine/utils/logger';
import { SoftwareDef } from '@shared/components/software-def';
import { EquipmentDef } from '@shared/components/equipment-def';
import { Item } from '@shared/components/item';
import { PickupEffect } from '@shared/components/pickup-effect';
import { RarityTier } from '@shared/components/rarity-tier';
import { TemplateId } from '@shared/components/template-id';
import { SpriteComponent } from '@shared/components/sprite';
import { Children } from '@shared/components/children';
import { AbilityDef } from '@shared/components/ability-def';
import { AugmentData } from '@shared/components/augment-data';
import { VaultItem, generateVaultItemId } from '@shared/profile';
import * as InventoryUtil from '@shared/utils/inventory-util';
import { addCurrency, getCurrencyAmount, removeCurrency } from '@shared/utils/inventory-util';
import RNG from 'rot-js/lib/rng';

export const CORPORATE_FORENSICS_LOGS: Record<FactionTheme, string[]> = {
  cyberacme: [
    '[CYBERACME_LOG_09]: "Project Void-Echo exceeded thermal containment. Deploy administrative wipes immediately."',
    '[CYBERACME_ARCHIVE_12]: "Unauthorized subnet intrusion detected from Level 3. Terminate neural tap."',
  ],
  traxus: [
    '[TRAXUS_CARGO_44]: "Automated freight hauler offline. Biological cargo exhibits aggressive self-replication."',
    '[TRAXUS_MANIFEST_88]: "Bespoke shielding crates sealed under order 77. Do not scan."',
  ],
  sekiguchi: [
    '[SEKIGUCHI_MEMO_02]: "Recall all v3 Neural-Spike firmwares. Cognitive leakage exceeds legal indemnity thresholds."',
    '[SEKIGUCHI_LAB_05]: "Cryo-suspension failure in Bay 4. Quarantining sector sub-grid."',
  ],
  nucaloric: [
    '[NUCALORIC_VEND_14]: "Caloric ration synthesis halted. All biomass diverted to sub-level 15 anchor."',
    '[NUCALORIC_THERMAL_03]: "Cooling manifold overflow. Core temperature rising."',
  ],
  system: [
    '[SYS_ADMIN_TRACE]: "Corrupted execution cycle logged. Automated gravedigger dispatched."',
  ],
};

import { playerHasAccessKey, consumeAccessKey } from '@shared/utils/access-key-util';
export { playerHasAccessKey, consumeAccessKey } from '@shared/utils/access-key-util';

/**
 * Trigger an acoustic alert pulsing outward from a coordinate to hostile entities within radius.
 * Attaches AlertIntent so AISystem can update awareness and behavior in Phase.GATHER_INTENT.
 */
export function triggerAcousticAlert<T extends GameplayEvents>(
  world: World<T>,
  originX: number,
  originY: number,
  radius: number,
): void {
  const hostileEntities = world.query(Hostile, Position);
  for (const enemyId of hostileEntities) {
    const ePos = world.getComponent(enemyId, Position);
    if (!ePos) continue;

    const dist = Math.abs(ePos.x - originX) + Math.abs(ePos.y - originY);
    if (dist <= radius) {
      world.addComponent(enemyId, AlertIntent, {
        sourceX: originX,
        sourceY: originY,
      });
    }
  }
}

/**
 * System that resolves InteractPropIntent during Phase.ACTION.
 */
export function createPropInteractionSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  entityFactory?: EntityFactory,
  componentRegistry?: ComponentRegistry,
  rng?: { random(): number },
) {
  const update = (w: World<T>) => {
    const actorsWithIntent = w.query(InteractPropIntent);
    const bus = eventBus;

    for (const actorId of actorsWithIntent) {
      const intent = w.getComponent(actorId, InteractPropIntent);
      if (!intent) continue;

      const targetId = intent.targetPropId;
      if (!targetId || !w.hasComponent(targetId, Prop)) {
        w.removeComponent(actorId, InteractPropIntent);
        continue;
      }

      const actorPos = w.getComponent(actorId, Position);
      const propPos = w.getComponent(targetId, Position);

      // Validate adjacency (Manhattan distance <= 1)
      if (actorPos && propPos) {
        const dist = Math.abs(actorPos.x - propPos.x) + Math.abs(actorPos.y - propPos.y);
        if (dist > 1) {
          w.removeComponent(actorId, InteractPropIntent);
          continue;
        }
      }

      let wasOverclockBypass = false;
      let wasCorruptedTrap = false;

      const prop = w.getComponent(targetId, Prop)!;
      const propClass = prop.propClass;

      // Validate DirectionalProp front-facing access
      if (w.hasComponent(targetId, DirectionalProp)) {
        const directional = w.getComponent(targetId, DirectionalProp)!;
        if (directional.requiresFrontAccess && actorPos && propPos) {
          const dxToPlayer = actorPos.x - propPos.x;
          const dyToPlayer = actorPos.y - propPos.y;
          const fx = directional.frontFacingVector.x;
          const fy = directional.frontFacingVector.y;

          if (dxToPlayer !== fx || dyToPlayer !== fy) {
            const facingOrientation = vectorToOrientation(fx, fy);
            bus.emit('MESSAGE_EMITTED', {
              text: `[NOTICE] ${propClass.toUpperCase()} FRONT INTERFACE IS TO THE ${facingOrientation}.`,
              type: 'warning',
            });
            w.removeComponent(actorId, InteractPropIntent);
            continue;
          }
        }
      }

      // 1. Resolve SecurityLock
      if (w.hasComponent(targetId, SecurityLock)) {
        const lock = w.getComponent(targetId, SecurityLock)!;
        if (lock.isLocked) {
          if (playerHasAccessKey(w, actorId)) {
            const consumed = consumeAccessKey(w, actorId);
            if (!consumed) {
              bus.emit('MESSAGE_EMITTED', {
                text: '[ACCESS DENIED]: Access Key could not be consumed.',
                type: 'error',
              });
              w.removeComponent(actorId, InteractPropIntent);
              continue;
            }
            w.patchComponent(targetId, SecurityLock, { isLocked: false });

            if (propClass === 'vault_door') {
              if (w.hasComponent(targetId, SpriteComponent)) {
                w.patchComponent(targetId, SpriteComponent, { key: 'prop_vault_door' });
              }
              if (w.hasComponent(targetId, BlocksMovement)) {
                w.removeComponent(targetId, BlocksMovement);
              }
            } else if (propClass === 'encrypted_safe') {
              if (w.hasComponent(targetId, SpriteComponent)) {
                w.patchComponent(targetId, SpriteComponent, { key: 'prop_safe' });
              }
            } else if (propClass === 'locker') {
              if (w.hasComponent(targetId, SpriteComponent)) {
                w.patchComponent(targetId, SpriteComponent, { key: 'prop_locker' });
              }
            }

            // Increment vaults breached score on clean key unlock
            const floorState = w.getComponent(actorId, FloorState);
            if (floorState) {
              w.patchComponent(actorId, FloorState, {
                vaultsBreached: (floorState.vaultsBreached ?? 0) + 1,
              });
            }

            bus.emit('LOCK_UNLOCKED', {
              propId: targetId,
              method: 'key',
              entityId: actorId,
            });
            bus.emit('MESSAGE_EMITTED', {
              text: '[SECURITY OVERRIDE]: Blast lock opened using Access Key.',
              type: 'info',
            });
          } else if (intent.forceOverride) {
            const heat = w.getComponent(actorId, Heat);
            const currentHeat = heat?.current ?? 0;
            const cost = lock.overclockHeatCost ?? 35;

            if (currentHeat + cost > 100) {
              bus.emit('MESSAGE_EMITTED', {
                text: `[HEAT CRITICAL]: Overclocking would exceed 100 Heat (${currentHeat + cost}/100) and trigger Emergency Shutdown. Vent Heat first.`,
                type: 'error',
              });
              w.removeComponent(actorId, InteractPropIntent);
              continue;
            }

            // Apply Overclock Heat
            if (heat) {
              const newHeat = Math.min(100, currentHeat + cost);
              w.patchComponent(actorId, Heat, { current: newHeat });
              bus.emit('HEAT_CHANGED', {
                entityId: actorId,
                oldHeat: currentHeat,
                newHeat,
                maxSafe: heat.maxSafe ?? 100,
              });
            }

            wasOverclockBypass = true;
            w.patchComponent(targetId, SecurityLock, { isLocked: false });

            if (propClass === 'vault_door') {
              if (w.hasComponent(targetId, SpriteComponent)) {
                w.patchComponent(targetId, SpriteComponent, { key: 'prop_vault_door' });
              }
              if (w.hasComponent(targetId, BlocksMovement)) {
                w.removeComponent(targetId, BlocksMovement);
              }
            } else if (propClass === 'encrypted_safe') {
              if (w.hasComponent(targetId, SpriteComponent)) {
                w.patchComponent(targetId, SpriteComponent, { key: 'prop_safe' });
              }
            } else if (propClass === 'locker') {
              if (w.hasComponent(targetId, SpriteComponent)) {
                w.patchComponent(targetId, SpriteComponent, { key: 'prop_locker' });
              }
            }

            // Increment vaults breached score
            const floorState = w.getComponent(actorId, FloorState);
            if (floorState) {
              w.patchComponent(actorId, FloorState, {
                vaultsBreached: (floorState.vaultsBreached ?? 0) + 1,
              });
            }

            // Trigger acoustic alarm
            const alertRadius = lock.alertRadiusOnBypass ?? 12;
            if (actorPos) {
              triggerAcousticAlert(w, actorPos.x, actorPos.y, alertRadius);
            }

            bus.emit('LOCK_UNLOCKED', {
              propId: targetId,
              method: 'overclock',
              entityId: actorId,
            });
            bus.emit('MESSAGE_EMITTED', {
              text: `[OVERCLOCK ENGAGED]: Blast lock breached (+${cost} Heat). Acoustic alarm triggered!`,
              type: 'warning',
            });
          } else {
            // Locked and no force override
            bus.emit('MESSAGE_EMITTED', {
              text: '[ACCESS DENIED]: Encrypted lock requires Access Key or Overclock Bypass.',
              type: 'warning',
            });
            w.removeComponent(actorId, InteractPropIntent);
            continue;
          }
        }
      }

      // 2. Resolve CorruptedNode
      if (w.hasComponent(targetId, CorruptedNode)) {
        const corrupted = w.getComponent(targetId, CorruptedNode)!;
        if (!corrupted.isDisarmed && !corrupted.triggered) {
          wasCorruptedTrap = true;
          w.patchComponent(targetId, CorruptedNode, { triggered: true, revealed: true });

          if (corrupted.trapType === 'acoustic_alert' && actorPos) {
            const floorState = w.getComponent(actorId, FloorState);
            const alertRadius = floorState?.sectorCondition === 'DARK_SUBNET' ? 6 : 12;
            triggerAcousticAlert(w, actorPos.x, actorPos.y, alertRadius);
            bus.emit('MESSAGE_EMITTED', {
              text: '[SECURITY FAULT]: Corrupted node triggered Acoustic Trap! Enemies alerted.',
              type: 'error',
            });
          } else if (corrupted.trapType === 'thermal_dump') {
            const heat = w.getComponent(actorId, Heat);
            if (heat) {
              const newHeat = Math.min(100, heat.current + 25);
              w.patchComponent(actorId, Heat, { current: newHeat });
              bus.emit('HEAT_CHANGED', {
                entityId: actorId,
                oldHeat: heat.current,
                newHeat,
                maxSafe: heat.maxSafe ?? 100,
              });
            }
            bus.emit('MESSAGE_EMITTED', {
              text: '[SECURITY FAULT]: Corrupted node triggered Thermal Dump (+25 Heat)!',
              type: 'error',
            });
          } else if (corrupted.trapType === 'hud_glitch') {
            bus.emit('MESSAGE_EMITTED', {
              text: '[SECURITY FAULT]: Corrupted node triggered HUD Glitch! Sensor telemetry compromised.',
              type: 'error',
            });
          }
        }
      }

      // 3. Resolve Tactical Terminals & Utilities
      if (propClass === 'reality_stabilizer' && !prop.isSearched) {
        const stability = w.getComponent(actorId, Stability);
        const restoreAmount = prop.stabilityRestoreAmount ?? 20;
        if (stability) {
          w.patchComponent(actorId, Stability, {
            current: Math.min(100, stability.current + restoreAmount),
          });
        }
        w.patchComponent(targetId, Prop, { isSearched: true });
        if (w.hasComponent(targetId, SpriteComponent)) {
          w.patchComponent(targetId, SpriteComponent, { key: 'prop_stabilizer' });
        }
        bus.emit('PROP_INTERACTED', {
          entityId: actorId,
          propId: targetId,
          propClass: 'reality_stabilizer',
        });
        bus.emit('MESSAGE_EMITTED', {
          text: `[QUANTUM ANCHOR CHARGED]: +${restoreAmount}% Reality Stability restored.`,
          type: 'info',
        });
      } else if (propClass === 'cooling_vent' && !prop.isSearched) {
        const heat = w.getComponent(actorId, Heat);
        const ventAmount = prop.ventAmount ?? 40;
        if (heat) {
          const newHeat = Math.max(0, heat.current - ventAmount);
          w.patchComponent(actorId, Heat, { current: newHeat });
          bus.emit('HEAT_CHANGED', {
            entityId: actorId,
            oldHeat: heat.current,
            newHeat,
            maxSafe: heat.maxSafe ?? 100,
          });
        }
        w.patchComponent(targetId, Prop, { isSearched: true });
        if (w.hasComponent(targetId, SpriteComponent)) {
          w.patchComponent(targetId, SpriteComponent, { key: 'prop_cooling_vent' });
        }
        bus.emit('PROP_INTERACTED', {
          entityId: actorId,
          propId: targetId,
          propClass: 'cooling_vent',
        });
        bus.emit('MESSAGE_EMITTED', {
          text: `[VENT ENGAGED]: Purged ${ventAmount} Neural Heat safely without dropping armor.`,
          type: 'info',
        });
      } else if (propClass === 'subnet_console' && !prop.isSearched) {
        const heat = w.getComponent(actorId, Heat);
        const cost = prop.heatCostOnAccess ?? 15;
        if (heat) {
          const newHeat = Math.min(100, heat.current + cost);
          w.patchComponent(actorId, Heat, { current: newHeat });
          bus.emit('HEAT_CHANGED', {
            entityId: actorId,
            oldHeat: heat.current,
            newHeat,
            maxSafe: heat.maxSafe ?? 100,
          });
        }
        // Reveal all corrupted nodes on floor
        for (const cNodeId of w.query(CorruptedNode)) {
          w.patchComponent(cNodeId, CorruptedNode, { revealed: true });
        }
        w.patchComponent(targetId, Prop, { isSearched: true });
        bus.emit('PROP_INTERACTED', {
          entityId: actorId,
          propId: targetId,
          propClass: 'subnet_console',
        });
        bus.emit('MESSAGE_EMITTED', {
          text: '[SUBNET RECON ACTIVE]: Full sector telemetry uploaded. All corrupted nodes and challenge rooms identified.',
          type: 'info',
        });
      } else if (propClass === 'dead_drop_uplink') {
        const fluxCost = prop.deadDropFluxCost ?? 25;
        if (intent.deadDropSelectionId !== undefined) {
          const availableFlux = getCurrencyAmount(w, actorId, 'flux');
          if (availableFlux < fluxCost) {
            bus.emit('MESSAGE_EMITTED', {
              text: `[UPLINK ERROR]: Insufficient Flux. ${fluxCost} Flux required for orbital uplink transmission.`,
              type: 'error',
            });
          } else {
            // Locate item or blueprint to remove before charging Flux
            const runInv = w.getComponent(actorId, RunInventory);
            const floorState = w.getComponent(actorId, FloorState);
            const floorNumber = floorState?.currentFloor ?? 1;
            let removedItem = false;
            let transmittedItemEntityId: number | undefined;
            let transmittedVaultItem: VaultItem | undefined;
            let transmittedBlueprintId: string | undefined;
            let transmittedBlueprintType: 'firmware' | 'augment' | undefined;

            if (runInv) {
              const swIdx = runInv.software.findIndex(
                (s) =>
                  s.entityId === intent.deadDropSelectionId ||
                  s.templateId === intent.deadDropSelectionId,
              );
              if (swIdx !== -1) {
                const item = runInv.software[swIdx];
                transmittedItemEntityId = item.entityId;
                transmittedVaultItem = {
                  vaultItemId: generateVaultItemId(),
                  entityId: item.entityId,
                  templateId: item.templateId,
                  rarityTier: item.rarityTier,
                  itemType: 'software',
                  quantity: item.quantity ?? 1,
                  extractedAtFloor: floorNumber,
                  extractedAtTimestamp: Date.now(),
                };
                const updatedSw = [...runInv.software];
                updatedSw.splice(swIdx, 1);
                w.patchComponent(actorId, RunInventory, { software: updatedSw });
                removedItem = true;
              } else {
                const eqIdx = runInv.equipment.findIndex(
                  (e) =>
                    e.entityId === intent.deadDropSelectionId ||
                    e.templateId === intent.deadDropSelectionId,
                );
                if (eqIdx !== -1) {
                  const item = runInv.equipment[eqIdx];
                  transmittedItemEntityId = item.entityId;
                  const children = w.getComponent(item.entityId, Children);
                  const swList: string[] = [];
                  if (children) {
                    for (const cId of children.entityIds) {
                      const cTmpl = w.getComponent(cId, TemplateId);
                      if (cTmpl?.id) swList.push(cTmpl.id);
                    }
                  }
                  let itemType: VaultItem['itemType'] = item.isConsumable
                    ? 'consumable'
                    : 'equipment';
                  const eqDef = w.getComponent(item.entityId, EquipmentDef);
                  if (eqDef?.slotType === 'weapon' || eqDef?.slotType === 'armor') {
                    itemType = eqDef.slotType;
                  } else if (w.hasComponent(item.entityId, AbilityDef)) {
                    itemType = 'firmware';
                  } else if (w.hasComponent(item.entityId, AugmentData)) {
                    itemType = 'augment';
                  }
                  transmittedVaultItem = {
                    vaultItemId: generateVaultItemId(),
                    entityId: item.entityId,
                    templateId: item.templateId,
                    rarityTier: item.rarityTier,
                    itemType,
                    quantity: item.quantity ?? 1,
                    extractedAtFloor: floorNumber,
                    extractedAtTimestamp: Date.now(),
                    socketedSoftware: swList.length > 0 ? swList : undefined,
                  };
                  const updatedEq = [...runInv.equipment];
                  updatedEq.splice(eqIdx, 1);
                  w.patchComponent(actorId, RunInventory, { equipment: updatedEq });
                  removedItem = true;
                }
              }
            }

            // Also check if transmitting a blueprint from RunCurrency
            if (!removedItem && typeof intent.deadDropSelectionId === 'string') {
              const runCurrency = w.getComponent(actorId, RunCurrency);
              if (runCurrency) {
                const stackIdx = runCurrency.stacks.findIndex(
                  (s) =>
                    s.currencyType === 'blueprint' &&
                    s.blueprintId === intent.deadDropSelectionId &&
                    s.amount > 0,
                );
                if (stackIdx !== -1) {
                  const updatedStacks = [...runCurrency.stacks];
                  const stack = { ...updatedStacks[stackIdx] };
                  transmittedBlueprintType = stack.blueprintType ?? 'firmware';
                  stack.amount -= 1;
                  if (stack.amount <= 0) {
                    updatedStacks.splice(stackIdx, 1);
                  } else {
                    updatedStacks[stackIdx] = stack;
                  }
                  w.patchComponent(actorId, RunCurrency, { stacks: updatedStacks });
                  transmittedBlueprintId = intent.deadDropSelectionId;
                  removedItem = true;
                }
              }
            }

            if (!removedItem) {
              bus.emit('MESSAGE_EMITTED', {
                text: `[UPLINK ERROR]: Target item not found in inventory. Transmission aborted.`,
                type: 'error',
              });
            } else {
              removeCurrency(w, actorId, 'flux', fluxCost);

              bus.emit('DEAD_DROP_TRANSMITTED', {
                entityId: actorId,
                propId: targetId,
                itemEntityId: transmittedItemEntityId,
                vaultItem: transmittedVaultItem,
                blueprintId: transmittedBlueprintId,
                blueprintType: transmittedBlueprintType,
              });
              bus.emit('PROP_INTERACTED', {
                entityId: actorId,
                propId: targetId,
                propClass: 'dead_drop_uplink',
                outcome: 'transmitted',
              });
              bus.emit('MESSAGE_EMITTED', {
                text: `[ORBITAL UPLINK COMPLETE]: Item transmitted to persistent Profile Vault.`,
                type: 'info',
              });
              w.patchComponent(targetId, Prop, { isSearched: true });
              if (w.hasComponent(targetId, SpriteComponent)) {
                w.patchComponent(targetId, SpriteComponent, { key: 'prop_dead_drop' });
              }
            }
          }
        } else {
          bus.emit('PROP_INTERACTED', {
            entityId: actorId,
            propId: targetId,
            propClass: 'dead_drop_uplink',
            outcome: 'ready',
          });
          bus.emit('MESSAGE_EMITTED', {
            text: `[TELEMETRY DEAD-DROP READY]: Select an item or Blueprint to transmit to Vault (Cost: ${fluxCost} Flux).`,
            type: 'info',
          });
        }
      }

      // 4. Resolve Container / Workstations
      if (w.hasComponent(targetId, Container) && !prop.isSearched) {
        const container = w.getComponent(targetId, Container)!;

        // Workstation access thermal cost (0 during THERMAL_SURGE, 10 baseline)
        if (propClass === 'workstation') {
          const floorState = w.getComponent(actorId, FloorState);
          const isThermalSurge = floorState?.sectorCondition === 'THERMAL_SURGE';
          const cost = isThermalSurge ? 0 : (prop.heatCostOnAccess ?? 10);
          if (cost > 0) {
            const heat = w.getComponent(actorId, Heat);
            if (heat) {
              const newHeat = Math.min(100, heat.current + cost);
              w.patchComponent(actorId, Heat, { current: newHeat });
              bus.emit('HEAT_CHANGED', {
                entityId: actorId,
                oldHeat: heat.current,
                newHeat,
                maxSafe: heat.maxSafe ?? 100,
              });
              bus.emit('MESSAGE_EMITTED', {
                text: `[WORKSTATION ACCESS]: Injected +${cost} Neural Heat.`,
                type: 'warning',
              });
            }
          }
        }

        // Yield scrap
        if (container.scrapYield && container.scrapYield > 0) {
          addCurrency(w, actorId, 'scrap', container.scrapYield);
          bus.emit('MESSAGE_EMITTED', {
            text: `[SCAVENGED]: Retrieved ${container.scrapYield} Raw Scrap.`,
            type: 'info',
          });
        }

        // Yield flux
        if (container.fluxYield && container.fluxYield > 0) {
          addCurrency(w, actorId, 'flux', container.fluxYield);
          bus.emit('MESSAGE_EMITTED', {
            text: `[SCAVENGED]: Retrieved ${container.fluxYield} Flux.`,
            type: 'info',
          });
        }

        // Yield access key
        if (container.grantsAccessKey) {
          const floorState = w.getComponent(actorId, FloorState);
          if (floorState) {
            w.patchComponent(actorId, FloorState, {
              accessKeysHeld: (floorState.accessKeysHeld ?? 0) + 1,
            });
          }
          bus.emit('MESSAGE_EMITTED', {
            text: '[ACCESS KEY ACQUIRED]: Obtained Sector Keycard.',
            type: 'info',
          });
        }

        // Yield blueprint
        if (container.blueprintId) {
          addCurrency(w, actorId, 'blueprint', 1, {
            blueprintId: container.blueprintId,
            blueprintType: container.blueprintType ?? 'firmware',
          });
          bus.emit('MESSAGE_EMITTED', {
            text: `[BLUEPRINT RECOVERED]: Secured ${container.blueprintId} (${container.blueprintType ?? 'firmware'}) blueprint.`,
            type: 'info',
          });
        }

        // Materialize stored loot entities
        const itemEntityIds: number[] = [];
        if (
          container.storedLoot &&
          container.storedLoot.length > 0 &&
          entityFactory &&
          componentRegistry
        ) {
          for (const item of container.storedLoot) {
            try {
              const itemEntityId = entityFactory.create(
                w,
                item.templateId,
                componentRegistry,
                propPos ? { position: { x: propPos.x, y: propPos.y } } : undefined,
              );
              itemEntityIds.push(itemEntityId);
            } catch (err) {
              logger.error(
                `Failed to instantiate container item template '${item.templateId}': ${err instanceof Error ? err.message : String(err)}`,
                'PROP_INTERACTION',
              );
            }
          }
        }

        const playerInventory = w.getComponent(actorId, RunInventory);
        const floorState = w.getComponent(actorId, FloorState);
        const currentFloor = floorState?.currentFloor ?? 1;

        const groundOverflowIds: number[] = [];

        for (const itemEntityId of itemEntityIds) {
          let transferred = false;
          if (playerInventory) {
            const swDef = w.getComponent(itemEntityId, SoftwareDef);
            const eqDef = w.getComponent(itemEntityId, EquipmentDef);
            const itemDef = w.getComponent(itemEntityId, Item);
            const pickupEffect = w.getComponent(itemEntityId, PickupEffect);
            const rarity = w.getComponent(itemEntityId, RarityTier);
            const templateRef = w.getComponent(itemEntityId, TemplateId);
            const templateId = templateRef?.id ?? '';

            if (swDef && templateId) {
              transferred = InventoryUtil.addSoftware(w, actorId, {
                entityId: itemEntityId,
                templateId,
                rarityTier: rarity?.tier || 'v1.x',
                pickedUpAtFloor: currentFloor,
                pickedUpAtTimestamp: Date.now(),
              });
              if (transferred) {
                bus.emit('MESSAGE_EMITTED', {
                  text: `+ SOFTWARE SECURED: ${swDef.name} [${rarity?.tier || 'v1.x'}]`,
                  type: 'info',
                });
              }
            } else if (pickupEffect && templateId) {
              transferred = InventoryUtil.addConsumable(
                w,
                actorId,
                {
                  entityId: itemEntityId,
                  templateId,
                  rarityTier: rarity?.tier || 'common',
                  pickedUpAtFloor: currentFloor,
                  pickedUpAtTimestamp: Date.now(),
                },
                10,
              );
              if (transferred) {
                bus.emit('MESSAGE_EMITTED', {
                  text: `+ CONSUMABLE SECURED: Stored in backpack`,
                  type: 'info',
                });
              }
            } else if (templateId) {
              transferred = InventoryUtil.addEquipment(w, actorId, {
                entityId: itemEntityId,
                templateId,
                rarityTier: rarity?.tier || 'v1.x',
                pickedUpAtFloor: currentFloor,
                pickedUpAtTimestamp: Date.now(),
              });
              if (transferred) {
                const name = eqDef?.name ?? itemDef?.name ?? templateId;
                bus.emit('MESSAGE_EMITTED', {
                  text: `+ EQUIPMENT SECURED: ${name} [${rarity?.tier || 'v1.x'}]`,
                  type: 'info',
                });
              }
            }
          }

          if (transferred) {
            // Remove world ground coordinates since item transferred to inventory
            if (w.hasComponent(itemEntityId, Position)) {
              w.removeComponent(itemEntityId, Position);
            }
            if (w.hasComponent(itemEntityId, SpriteComponent)) {
              w.removeComponent(itemEntityId, SpriteComponent);
            }
            if (grid && propPos) {
              grid.removeItem(itemEntityId, propPos.x, propPos.y);
            }
            bus.emit('ITEM_PICKED_UP', { entityId: actorId, itemId: itemEntityId });
          } else {
            // Overflow: drop to ground on the tile
            groundOverflowIds.push(itemEntityId);
            if (grid && propPos) {
              grid.addItem(itemEntityId, propPos.x, propPos.y);
            }
            bus.emit('MESSAGE_EMITTED', {
              text: `[OVERFLOW]: Inventory full - cargo dropped to deck.`,
              type: 'info',
            });
          }
        }

        w.patchComponent(targetId, Container, {
          itemEntityIds: groundOverflowIds,
          storedLoot: [],
        });
        // NOTE: We deliberately do NOT attach Children to targetId here,
        // ensuring ground overflow items are independent and not destroyed if the container is later destroyed.

        // Atmospheric Corporate Forensics Audio Log
        const faction = prop.faction ?? 'system';
        const logs = CORPORATE_FORENSICS_LOGS[faction] || CORPORATE_FORENSICS_LOGS.system;
        const randomRoll = rng ? rng.random() : RNG.getUniform();
        const logText = logs[Math.floor(randomRoll * logs.length)];
        bus.emit('MESSAGE_EMITTED', { text: logText, type: 'info' });

        w.patchComponent(targetId, Prop, { isSearched: true });
        if (w.hasComponent(targetId, SpriteComponent)) {
          if (propClass === 'locker') {
            w.patchComponent(targetId, SpriteComponent, { key: 'prop_locker' });
          } else if (propClass === 'cabinet') {
            w.patchComponent(targetId, SpriteComponent, { key: 'prop_biocabinet' });
          } else if (propClass === 'workstation') {
            w.patchComponent(targetId, SpriteComponent, { key: 'prop_workstation' });
          } else if (propClass === 'encrypted_safe') {
            w.patchComponent(targetId, SpriteComponent, { key: 'prop_safe' });
          }
        }
        bus.emit('PROP_INTERACTED', {
          entityId: actorId,
          propId: targetId,
          propClass: prop.propClass,
        });
      }

      // Mark prop as interacted this turn
      w.addComponent(targetId, PropInteractedThisTurn, {
        propEntityId: targetId,
        propClass: prop.propClass,
        wasOverclockBypass,
        wasCorruptedTrap,
        interactedBy: actorId,
      });

      // Cleanup intent after processing
      w.removeComponent(actorId, InteractPropIntent);
    }
  };

  return {
    init() {
      world.registerSystem(Phase.ACTION, update, 'PropInteractionSystem');
    },
    dispose() {
      world.unregisterSystem(Phase.ACTION, update);
    },
    update,
  };
}

export type PropInteractionSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<
  typeof createPropInteractionSystem<T>
>;
