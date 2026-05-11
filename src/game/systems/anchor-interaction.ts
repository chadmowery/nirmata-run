import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId, Phase } from '@engine/ecs/types';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from '../events/types';
import { logger } from '@engine/utils/logger';
import {
  AnchorMarker,
  FloorState,
  StaircaseMarker,
  Position,
  MovedThisTurn,
  DescentIntent,
  ExtractionIntent,
  Actor,
  Stability,
  RunInventory,
  FirmwareSlots,
  AugmentSlots,
  AbilityDef,
  SoftwareDef,
  AugmentData,
  Acting,
} from '@shared/components';
import { getCurrencyAmount } from '@shared/utils/inventory-util';

/**
 * System that manages interaction with Reality Anchors and Staircases.
 * It detects proximity and handles intent resolution.
 */
export function createAnchorInteractionSystem<T extends GameplayEvents = GameEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>
) {
  const getPlayerId = () => {
    const actors = world.query(Actor);
    for (const id of actors) {
      const actor = world.getComponent(id, Actor);
      if (actor?.isPlayer) return id;
    }
    return null;
  };

  const update = (w: World<T>) => {
    const playerId = getPlayerId();
    if (playerId === null) return;

    // 1. Check for player move into interactive entities
    const playerMoved = w.getComponent(playerId, MovedThisTurn);
    const isActing = w.hasComponent(playerId, Acting);
    const pos = w.getComponent(playerId, Position);

    if (playerMoved && isActing && pos) {
      const occupants = grid.getEntitiesAt(pos.x, pos.y);
      for (const occupantId of occupants) {
        if (occupantId === playerId) continue;

        // Anchor Interaction
        if (w.hasComponent(occupantId, AnchorMarker)) {
          handleAnchorProximity(playerId, occupantId);
        }

        // Staircase Interaction
        if (w.hasComponent(occupantId, StaircaseMarker)) {
          handleStaircaseProximity(playerId, occupantId);
          break; // Only one interaction per tile
        }
      }
    }

    // 2. Process Descent Intents (confirmed by UI)
    const descent = w.getComponent(playerId, DescentIntent);
    if (descent) {
      // Logic handled by FloorManagerSystem which monitors the same intent
    }

    // 3. Process Extraction Intents (confirmed by UI)
    const extraction = w.getComponent(playerId, ExtractionIntent);
    if (extraction) {
      // Logic handled by RunEnderSystem which monitors the same intent
    }
  };

  const handleAnchorProximity = (playerId: EntityId, anchorId: EntityId) => {
    logger.info(`Anchor Proximity Triggered: Entity ${playerId} at Anchor ${anchorId}`, 'SYSTEM');
    const floorState = world.getComponent(playerId, FloorState);
    const stability = world.getComponent(playerId, Stability);
    const fSlots = world.getComponent(playerId, FirmwareSlots);
    const aSlots = world.getComponent(playerId, AugmentSlots);
    const inventory = world.getComponent(playerId, RunInventory);

    const currentFloor = floorState?.currentFloor ?? 1;
    const stabilityVal = stability?.current ?? 0;
    const stabilityMax = stability?.max ?? 100;
    const stabilityPercent = (stabilityVal / stabilityMax) * 100;

    // Build inventory summary (names only)
    const firmware = (fSlots?.equipped || []).map(id => world.getComponent(id, AbilityDef)?.name || 'Unknown');
    const augments = (aSlots?.equipped || []).map(id => world.getComponent(id, AugmentData)?.name || 'Unknown');
    const software = (inventory?.software || []).map(item => {
      const def = world.getComponent(item.entityId, SoftwareDef);
      return def?.name || 'Unknown';
    });
    const scrap = getCurrencyAmount(world, playerId, 'scrap');

    // Emit message log
    eventBus.emit('MESSAGE_EMITTED', {
      text: "Reality Anchor active. Extract now?",
      type: 'info'
    });

    // Emit interaction event for UI modal
    eventBus.emit('ANCHOR_INTERACTION', {
      entityId: playerId,
      anchorId,
      floorNumber: currentFloor,
      stabilityPercent,
      inventory: {
        firmware,
        augments,
        software,
        scrap
      },
      descendCost: 0, // Calculated by server/FloorManager
      nextFloorEnemyTier: 'Standard',
      estimatedStabilityAfterDescent: Math.max(0, stabilityPercent - 5)
    });
  };

  const handleStaircaseProximity = (playerId: EntityId, staircaseId: EntityId) => {
    logger.info(`Staircase Proximity Triggered: Entity ${playerId} at Staircase ${staircaseId}`, 'SYSTEM');
    const floorState = world.getComponent(playerId, FloorState);
    const currentFloor = floorState?.currentFloor ?? 1;
    const nextFloor = currentFloor + 1;

    // Emit message log
    eventBus.emit('MESSAGE_EMITTED', {
      text: `Staircase leads to Floor ${nextFloor}. Descend?`,
      type: 'info'
    });

    // Emit interaction event for UI modal
    eventBus.emit('STAIRCASE_INTERACTION', {
      entityId: playerId,
      staircaseId,
      targetFloor: nextFloor
    });
  };

  return {
    init() {
      world.registerSystem(Phase.REACTION, update, 'AnchorInteractionSystem');
    },
    dispose() {
      world.unregisterSystem(Phase.REACTION, update);
    },
    update,
  };
}

export type AnchorInteractionSystem<T extends GameplayEvents = GameEvents> = ReturnType<typeof createAnchorInteractionSystem<T>>;
