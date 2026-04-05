import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { AIState, AIBehaviorType } from '@shared/components/ai-state';
import { FloorState } from '@shared/components/floor-state';
import { GameplayEvents } from '@shared/events/types';
import { runInventoryRegistry } from './run-inventory';
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
  sessionId?: string,
  runMode: RunMode = RunMode.SIMULATION
) {
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

    console.log(`[RunEnderSystem] executeRunEnd STARTED. Reason: ${reason}, sessionId: ${sessionId}`);
    
    const floorState = world.getComponent(playerId, FloorState);
    const floorNumber = floorState?.currentFloor ?? 1;

    let finalScrap = 0;
    let finalFlux = 0;
    let swCount = 0;
    let pityAwarded = false;
    let itemsExtracted: VaultItem[] = [];

    if (!sessionId) {
      console.warn(`[RunEnderSystem] executeRunEnd called without sessionId! Reason: ${reason}. Final stats will be 0.`);
    }

    if (sessionId) {
      console.log(`[RunEnderSystem] executeRunEnd: SessionId found (${sessionId}), isSuccess: ${isSuccess}`);
      const inventory = runInventoryRegistry.getOrCreate(sessionId);
      if (isSuccess) {
        // Authoritative extraction calculation (per D-06)
        finalScrap = runInventoryRegistry.getCurrencyAmount(sessionId, 'scrap');
        const inventoryFlux = runInventoryRegistry.getCurrencyAmount(sessionId, 'flux');
        
        finalFlux = inventoryFlux + calculateExtractionFluxBonus(floorNumber);
        swCount = inventory.software.length;
        
        // Map software to VaultItems using unified utility
        itemsExtracted = mapInventoryToVaultItems(inventory.software, floorNumber);

        // Finalize inventory to stash
        runInventoryRegistry.transferToStash(sessionId);
      } else {
        // Handle Pity on Failure (Death, Admin Contact, Instability)
        const totalScrap = runInventoryRegistry.getCurrencyAmount(sessionId, 'scrap');
        finalScrap = calculatePityScrap(totalScrap);
        console.log(`[RunEnderSystem] executeRunEnd (FAIL): totalScrap: ${totalScrap}, pityScrap: ${finalScrap}`);
        pityAwarded = true;

        runInventoryRegistry.clearCurrency(sessionId);
        if (finalScrap > 0) runInventoryRegistry.addCurrency(sessionId, 'scrap', finalScrap);
        runInventoryRegistry.clearSoftware(sessionId);
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

  function handleEntityMoved(payload: T['ENTITY_MOVED']) {
    const { entityId, toX, toY } = payload;
    
    const actor = world.getComponent(entityId, Actor);
    const aiState = world.getComponent(entityId, AIState);

    // If System_Admin moved
    if (aiState?.behaviorType === AIBehaviorType.SYSTEM_ADMIN) {
      checkAdminAdjacency(entityId, toX, toY);
    } 
    // If player moved
    else if (actor?.isPlayer) {
      // Check all System_Admins
      const admins = world.query(AIState, Position);
      for (const adminId of admins) {
        const adminAI = world.getComponent(adminId, AIState);
        if (adminAI?.behaviorType === AIBehaviorType.SYSTEM_ADMIN) {
          const adminPos = world.getComponent(adminId, Position)!;
          if (isAdjacentOrSame(toX, toY, adminPos.x, adminPos.y)) {
            executeRunEnd(entityId, 'FATAL: ADMIN_CONTACT', false);
            break;
          }
        }
      }
    }
  }

  const handleStabilityZero = (payload: T['STABILITY_ZERO']) => {
    if (typeof window !== 'undefined') return; // Server only
    const actor = world.getComponent(payload.entityId, Actor);
    if (actor?.isPlayer) {
      executeRunEnd(payload.entityId, 'FATAL: REALITY_ANCHOR_COLLAPSED', false);
    }
  };

  const handleAnchorExtract = () => {
    const player = getPlayerEntity();
    if (player) {
      executeRunEnd(player.id, 'extraction', true);
    }
  };

  const handleEntityDied = (payload: T['ENTITY_DIED']) => {
    if (typeof window !== 'undefined') return; // Server only
    if (payload.isPlayer) {
      executeRunEnd(payload.entityId, 'death', false);
    }
  };

  return {
    init() {
      eventBus.on('ENTITY_MOVED', handleEntityMoved);
      eventBus.on('STABILITY_ZERO', handleStabilityZero);
      eventBus.on('ANCHOR_EXTRACT', handleAnchorExtract);
      eventBus.on('ENTITY_DIED', handleEntityDied);
    },
    dispose() {
      eventBus.off('ENTITY_MOVED', handleEntityMoved);
      eventBus.off('STABILITY_ZERO', handleStabilityZero);
      eventBus.off('ANCHOR_EXTRACT', handleAnchorExtract);
      eventBus.off('ENTITY_DIED', handleEntityDied);
    }
  };
}

export type RunEnderSystem = ReturnType<typeof createRunEnderSystem>;
