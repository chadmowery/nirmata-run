import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { Phase, EntityId } from '@engine/ecs/types';
import { Position } from '@shared/components/position';
import { Hostile } from '@shared/components/hostile';
import { Heat } from '@shared/components/heat';
import { Stability } from '@shared/components/stability';
import { FloorState } from '@shared/components/floor-state';
import { BlocksMovement } from '@shared/components/blocks-movement';
import { Children } from '@shared/components/children';
import { FovAwareness } from '@shared/components/fov-awareness';
import { AIState, AIBehavior } from '@shared/components/ai-state';
import { RunInventory } from '@shared/components/run-inventory';
import {
  Prop,
  SecurityLock,
  Container,
  CorruptedNode,
  InteractPropIntent,
  PropInteractedThisTurn,
  FactionTheme,
} from '@shared/components/environment';
import { GameplayEvents } from '@shared/events/types';
import { EntityFactory } from '@engine/entity/factory';
import { ComponentRegistry } from '@engine/entity/types';
import { addCurrency, getCurrencyAmount, removeCurrency } from '@shared/utils/inventory-util';

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

/**
 * Check if the player possesses an Access Key (either on FloorState or in RunInventory).
 */
export function playerHasAccessKey<T extends GameplayEvents>(
  world: World<T>,
  playerId: EntityId,
): boolean {
  const floorState = world.getComponent(playerId, FloorState);
  if (floorState && (floorState.accessKeysHeld ?? 0) > 0) {
    return true;
  }
  const runInv = world.getComponent(playerId, RunInventory);
  if (runInv) {
    if (runInv.software?.some((s) => s.templateId.includes('access-key'))) {
      return true;
    }
    if (runInv.equipment?.some((e) => e.templateId.includes('access-key'))) {
      return true;
    }
  }
  return false;
}

/**
 * Consume an Access Key held by the player.
 */
export function consumeAccessKey<T extends GameplayEvents>(
  world: World<T>,
  playerId: EntityId,
): boolean {
  const floorState = world.getComponent(playerId, FloorState);
  if (floorState && (floorState.accessKeysHeld ?? 0) > 0) {
    world.patchComponent(playerId, FloorState, {
      accessKeysHeld: (floorState.accessKeysHeld ?? 1) - 1,
    });
    return true;
  }

  const runInv = world.getComponent(playerId, RunInventory);
  if (runInv) {
    const swIdx = runInv.software.findIndex((s) => s.templateId.includes('access-key'));
    if (swIdx !== -1) {
      const updatedSw = [...runInv.software];
      updatedSw.splice(swIdx, 1);
      world.patchComponent(playerId, RunInventory, { software: updatedSw });
      return true;
    }
  }
  return false;
}

/**
 * Trigger an acoustic alert pulsing outward from a coordinate to hostile entities within radius.
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
      if (world.hasComponent(enemyId, FovAwareness)) {
        world.patchComponent(enemyId, FovAwareness, {
          canSeePlayer: true,
          lastKnownPlayerX: originX,
          lastKnownPlayerY: originY,
        });
      }
      if (world.hasComponent(enemyId, AIState)) {
        world.patchComponent(enemyId, AIState, { behavior: AIBehavior.CHASING });
      }
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
) {
  const update = (w: World<T>) => {
    const actorsWithIntent = w.query(InteractPropIntent);
    const bus = eventBus as unknown as EventBus<GameplayEvents>;

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

      // 1. Resolve SecurityLock
      if (w.hasComponent(targetId, SecurityLock)) {
        const lock = w.getComponent(targetId, SecurityLock)!;
        if (lock.isLocked) {
          if (playerHasAccessKey(w, actorId)) {
            consumeAccessKey(w, actorId);
            w.patchComponent(targetId, SecurityLock, { isLocked: false });

            if (w.hasComponent(targetId, BlocksMovement) && propClass === 'vault_door') {
              w.removeComponent(targetId, BlocksMovement);
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

            if (w.hasComponent(targetId, BlocksMovement) && propClass === 'vault_door') {
              w.removeComponent(targetId, BlocksMovement);
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
          w.patchComponent(targetId, CorruptedNode, { triggered: true });

          if (corrupted.trapType === 'acoustic_alert' && actorPos) {
            triggerAcousticAlert(w, actorPos.x, actorPos.y, 12);
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
            removeCurrency(w, actorId, 'flux', fluxCost);
            // Remove item from RunInventory
            const runInv = w.getComponent(actorId, RunInventory);
            if (runInv) {
              const swIdx = runInv.software.findIndex(
                (s) =>
                  s.entityId === intent.deadDropSelectionId ||
                  (s as unknown as Record<string, unknown>).templateId ===
                    intent.deadDropSelectionId,
              );
              if (swIdx !== -1) {
                const updatedSw = [...runInv.software];
                updatedSw.splice(swIdx, 1);
                w.patchComponent(actorId, RunInventory, { software: updatedSw });
              } else {
                const eqIdx = runInv.equipment.findIndex(
                  (e) =>
                    e.entityId === intent.deadDropSelectionId ||
                    (e as unknown as Record<string, unknown>).templateId ===
                      intent.deadDropSelectionId,
                );
                if (eqIdx !== -1) {
                  const updatedEq = [...runInv.equipment];
                  updatedEq.splice(eqIdx, 1);
                  w.patchComponent(actorId, RunInventory, { equipment: updatedEq });
                }
              }
            }

            bus.emit('DEAD_DROP_TRANSMITTED', {
              entityId: actorId,
              itemEntityId:
                typeof intent.deadDropSelectionId === 'number'
                  ? intent.deadDropSelectionId
                  : undefined,
              blueprintId:
                typeof intent.deadDropSelectionId === 'string'
                  ? intent.deadDropSelectionId
                  : undefined,
            });
            bus.emit('MESSAGE_EMITTED', {
              text: `[ORBITAL UPLINK COMPLETE]: Item transmitted to persistent Profile Vault.`,
              type: 'info',
            });
            w.patchComponent(targetId, Prop, { isSearched: true });
          }
        } else {
          bus.emit('MESSAGE_EMITTED', {
            text: `[TELEMETRY DEAD-DROP READY]: Select an item or Blueprint to transmit to Vault (Cost: ${fluxCost} Flux).`,
            type: 'info',
          });
        }
      }

      // 4. Resolve Container / Workstations
      if (w.hasComponent(targetId, Container) && !prop.isSearched) {
        const container = w.getComponent(targetId, Container)!;

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
            } catch {
              // Ignore template instantiation failure if mock/test
            }
          }
        }

        w.patchComponent(targetId, Container, {
          itemEntityIds,
          storedLoot: [],
        });

        if (itemEntityIds.length > 0) {
          w.addComponent(targetId, Children, { entityIds: itemEntityIds });
        }

        // Atmospheric Corporate Forensics Audio Log
        const faction = prop.faction ?? 'system';
        const logs = CORPORATE_FORENSICS_LOGS[faction] || CORPORATE_FORENSICS_LOGS.system;
        const logText = logs[Math.floor(Math.random() * logs.length)];
        bus.emit('MESSAGE_EMITTED', { text: logText, type: 'info' });

        w.patchComponent(targetId, Prop, { isSearched: true });
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
