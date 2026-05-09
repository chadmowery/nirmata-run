import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId, Phase } from '@engine/ecs/types';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from '../events/types';
import {
  AnchorMarker,
  FloorState,
  StaircaseMarker,
  Position,
  MovedThisTurn,
  DescentIntent,
  ExtractionIntent,
  Actor,
} from '@shared/components';

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
    const pos = w.getComponent(playerId, Position);

    if (playerMoved && pos) {
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
    eventBus.emit('MESSAGE_EMITTED', {
      text: "Reality Anchor active. Extract now?",
      type: 'info'
    });
  };

  const handleStaircaseProximity = (playerId: EntityId, staircaseId: EntityId) => {
    const floorState = world.getComponent(playerId, FloorState);
    const currentFloor = floorState?.currentFloor ?? 1;
    const nextFloor = currentFloor + 1;

    eventBus.emit('MESSAGE_EMITTED', {
      text: `Staircase leads to Floor ${nextFloor}. Descend?`,
      type: 'info'
    });
  };

  return {
    init() {
      world.registerSystem(Phase.REACTION, update);
    },
    dispose() {
      world.unregisterSystem(Phase.REACTION, update);
    },
    update,
  };
}

export type AnchorInteractionSystem<T extends GameplayEvents = GameEvents> = ReturnType<typeof createAnchorInteractionSystem<T>>;
