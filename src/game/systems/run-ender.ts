import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId, Phase } from '@engine/ecs/types';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { AIState, AIBehaviorType } from '@shared/components/ai-state';
import { FloorState } from '@shared/components/floor-state';
import { RunInventory, BurnedSoftware, MovedThisTurn, Dying, FirmwareSlots, SoftwareSlots, AugmentSlots, Stability } from '@shared/components';
import * as InventoryUtil from '@shared/utils/inventory-util';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from '../events/types';
import { RunMode } from '@shared/run-mode';
import { VaultItem } from '@shared/profile';
import {
  calculatePityScrap,
  calculateExtractionFluxBonus,
  mapInventoryToVaultItems
} from '@shared/utils/economy-util';

/**
 * System that monitors for System_Admin adjacency to the player to end the run.
 */
export function createRunEnderSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  runMode: RunMode = RunMode.SIMULATION
): RunEnderSystem<T> {
  let isEnding = false;

  function getPlayerEntity(): { id: EntityId; x: number; y: number } | null {
    const actors = world.query(Actor, Position);
    for (const id of actors) {
      const actor = world.getComponent(id, Actor);
      if (actor?.isPlayer) {
        const pos = world.getComponent(id, Position)!;
        return { id, x: pos.x, y: pos.y };
      }
    }
    return null;
  }

  function isAdjacentOrSame(x1: number, y1: number, x2: number, y2: number): boolean {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return dx <= 1 && dy <= 1;
  }

  function executeRunEnd(playerId: EntityId, reason: string, isSuccess: boolean) {
    if (isEnding) return;
    isEnding = true;

    console.log(`[RunEnderSystem] executeRunEnd STARTED. Reason: ${reason}`);

    const floorState = world.getComponent(playerId, FloorState);
    const floorNumber = floorState?.currentFloor ?? 1;

    let finalScrap = 0;
    let finalFlux = 0;
    let swCount = 0;
    let pityAwarded = false;
    let itemsExtracted: VaultItem[] = [];


    if (playerId) {
      // Clear equipment slots explicitly (Phase 6.5 requirement)
      if (world.hasComponent(playerId, FirmwareSlots)) {
        world.patchComponent(playerId, FirmwareSlots, { equipped: [] });
      }
      if (world.hasComponent(playerId, SoftwareSlots)) {
        world.patchComponent(playerId, SoftwareSlots, { equipped: [] });
      }
      if (world.hasComponent(playerId, AugmentSlots)) {
        world.patchComponent(playerId, AugmentSlots, { equipped: [] });
      }

      console.log(`[RunEnderSystem] executeRunEnd: Player found (${playerId}), isSuccess: ${isSuccess}`);
      if (isSuccess) {
        // Authoritative extraction calculation (per D-06)
        finalScrap = InventoryUtil.getCurrencyAmount(world, playerId, 'scrap');
        const inventoryFlux = InventoryUtil.getCurrencyAmount(world, playerId, 'flux');

        finalFlux = inventoryFlux + calculateExtractionFluxBonus(floorNumber);

        const inventory = world.getComponent(playerId, RunInventory);
        swCount = inventory?.software.length || 0;

        // Map software to VaultItems using unified utility
        itemsExtracted = mapInventoryToVaultItems(inventory?.software || [], floorNumber);

        // Finalize inventory (clear for extraction)
        InventoryUtil.clearInventory(world, playerId);
        if (world.hasComponent(playerId, BurnedSoftware)) {
          world.patchComponent(playerId, BurnedSoftware, { weapon: null, armor: null });
        }
      } else {
        // Handle Pity on Failure (Death, Admin Contact, Instability)
        const totalScrap = InventoryUtil.getCurrencyAmount(world, playerId, 'scrap');
        finalScrap = calculatePityScrap(totalScrap);
        console.log(`[RunEnderSystem] executeRunEnd (FAIL): totalScrap: ${totalScrap}, pityScrap: ${finalScrap}`);
        pityAwarded = true;

        InventoryUtil.clearInventory(world, playerId);
        if (world.hasComponent(playerId, BurnedSoftware)) {
          world.patchComponent(playerId, BurnedSoftware, { weapon: null, armor: null });
        }
        if (finalScrap > 0) InventoryUtil.addCurrency(world, playerId, 'scrap', finalScrap);
      }
    }

    eventBus.emit('RUN_ENDED', {
      reason,
      entityId: playerId,
      floorNumber,
      stats: {
        runMode,
        scrapExtracted: finalScrap,
        fluxExtracted: finalFlux,
        softwareExtracted: swCount,
        pityAwarded,
        itemsExtracted,
      }
    } as unknown as T['RUN_ENDED']);

    const message = isSuccess
      ? `SUCCESS: Extraction protocol complete. ${finalScrap} Scrap, ${finalFlux} Flux secured.`
      : `FATAL: ${reason}. Pity Scrap: ${finalScrap}`;

    eventBus.emit('MESSAGE_EMITTED', {
      text: message,
      type: isSuccess ? 'info' : 'error'
    });
  }

  function checkAdminAdjacency(entityId: EntityId, x: number, y: number) {
    const player = getPlayerEntity();
    if (!player) return;

    if (isAdjacentOrSame(x, y, player.x, player.y)) {
      executeRunEnd(player.id, 'FATAL: ADMIN_CONTACT', false);
    }
  }

  const update = (w: World<T>) => {
    // Phase 6.4: Only check adjacency if something moved
    const movers = w.query(MovedThisTurn);
    if (movers.length === 0) return;

    for (const entityId of movers) {
      const moved = w.getComponent(entityId, MovedThisTurn)!;
      const { toX, toY } = moved;

      const actor = w.getComponent(entityId, Actor);
      const aiState = w.getComponent(entityId, AIState);

      // If System_Admin moved
      if (aiState?.behaviorType === AIBehaviorType.SYSTEM_ADMIN) {
        checkAdminAdjacency(entityId, toX, toY);
      }
      // If player moved
      else if (actor?.isPlayer) {
        // Check all System_Admins
        const admins = w.query(AIState, Position);
        for (const adminId of admins) {
          const adminAI = w.getComponent(adminId, AIState);
          if (adminAI?.behaviorType === AIBehaviorType.SYSTEM_ADMIN) {
            const adminPos = w.getComponent(adminId, Position)!;
            if (isAdjacentOrSame(toX, toY, adminPos.x, adminPos.y)) {
              executeRunEnd(entityId, 'FATAL: ADMIN_CONTACT', false);
              break;
            }
          }
        }
      }
    }
  };

  const handleAnchorExtract = () => {
    const player = getPlayerEntity();
    if (player) {
      executeRunEnd(player.id, 'extraction', true);
    }
  };

  const updateCleanup = (w: World<T>) => {
    // Check for dying players
    const dyingEntities = w.query(Dying);
    for (const entityId of dyingEntities) {
      const actor = w.getComponent(entityId, Actor);
      if (actor?.isPlayer) {
        executeRunEnd(entityId, 'death', false);
      }
    }

    // Check for collapsed stability (Phase 6.6)
    const actorsWithStability = w.query(Actor, Stability);
    for (const entityId of actorsWithStability) {
      const actor = w.getComponent(entityId, Actor);
      const stability = w.getComponent(entityId, Stability);
      if (actor?.isPlayer && stability && stability.current <= 0) {
        executeRunEnd(entityId, 'FATAL: REALITY_ANCHOR_COLLAPSED', false);
      }
    }
  };

  return {
    init() {
      world.registerSystem(Phase.REACTION, update);
      world.registerSystem(Phase.CLEANUP, updateCleanup);
      eventBus.on('ANCHOR_EXTRACT', handleAnchorExtract);
    },
    dispose() {
      world.unregisterSystem(Phase.REACTION, update);
      world.unregisterSystem(Phase.CLEANUP, updateCleanup);
      eventBus.off('ANCHOR_EXTRACT', handleAnchorExtract);
    },
    update,
  };
}

export interface RunEnderSystem<T extends GameplayEvents = GameEvents> {
  init(): void;
  dispose(): void;
  update(world: World<T>): void;
}
