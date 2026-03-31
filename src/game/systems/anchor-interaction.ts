import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { TurnManager } from '@engine/turn/turn-manager';
import { GameEvents } from '../events/types';
import {
  AnchorMarker,
  FloorState,
  Stability,
  Scrap,
  FirmwareSlots,
  AugmentSlots,
  SoftwareSlots,
  StaircaseMarker,
  AbilityDef,
  SoftwareDef
} from '@shared/components';
import { gameStore } from '../ui/store';
import depthConfig from '../generation/depth-config.json';

export function createAnchorInteractionSystem(
  world: World<GameEvents>,
  grid: Grid,
  eventBus: EventBus<GameEvents>,
  turnManager: TurnManager<GameEvents>,
  playerId: EntityId
) {
  const handleEntityMoved = (payload: GameEvents['ENTITY_MOVED']) => {
    if (payload.entityId !== playerId) return;

    const { toX, toY } = payload;
    const occupants = grid.getEntitiesAt(toX, toY);

    for (const occupantId of occupants) {
      // Check for Anchor
      const anchor = world.getComponent(occupantId, AnchorMarker);
      if (anchor && !anchor.used) {
        triggerAnchorInteraction(occupantId);
        return;
      }

      // Check for Staircase
      const staircase = world.getComponent(occupantId, StaircaseMarker);
      if (staircase) {
        triggerStaircaseInteraction(occupantId);
        return;
      }
    }
  };

  const triggerAnchorInteraction = (anchorId: EntityId) => {
    turnManager.pause();
    eventBus.emit('APPLY_WORLD_FILTER', { filterType: 'grayscale' });

    const floorState = world.getComponent(playerId, FloorState);
    const stability = world.getComponent(playerId, Stability);
    const scrap = world.getComponent(playerId, Scrap);
    const firmware = world.getComponent(playerId, FirmwareSlots);
    const augments = world.getComponent(playerId, AugmentSlots);
    const software = world.getComponent(playerId, SoftwareSlots);

    const floorNumber = floorState?.currentFloor ?? 1;
    const stabilityPercent = stability?.current ?? 100;

    // Categorized inventory data
    const inventory = {
      firmware: firmware?.equipped.map(id => world.getComponent(id, AbilityDef)?.name ?? 'Unknown') ?? [],
      augments: augments?.equipped.map(id => world.getComponent(id, AbilityDef)?.name ?? 'Unknown') ?? [],
      software: software?.equipped.map(id => world.getComponent(id, SoftwareDef)?.name ?? 'Unknown') ?? [],
      scrap: scrap?.amount ?? 0
    };

    const descendCost = 50 + (floorNumber * 10);

    // Find next floor enemy tier
    const nextFloor = floorNumber + 1;
    const band = depthConfig.depthBands.find(b => nextFloor >= b.range.min && nextFloor <= b.range.max);
    const nextFloorEnemyTier = band?.label ?? 'UNKNOWN_SECTOR';

    // Estimated stability refill (50% of max)
    const estimatedStabilityAfterDescent = Math.min(100, stabilityPercent + 50);

    gameStore.getState().showAnchorOverlay({
      floorNumber,
      stabilityPercent,
      inventory,
      descendCost,
      nextFloorEnemyTier,
      estimatedStabilityAfterDescent,
      anchorId // Pass through for decision
    });
  };

  const triggerStaircaseInteraction = (staircaseId: EntityId) => {
    const floorState = world.getComponent(playerId, FloorState);
    const currentFloor = floorState?.currentFloor ?? 1;
    const targetFloor = currentFloor + 1;

    // In a real implementation, this might show a confirmation dialog in React.
    // For now, we'll emit the event if the user confirms.
    eventBus.emit('STAIRCASE_INTERACTION', {
      entityId: playerId,
      staircaseId,
      targetFloor
    });
  };

  const handleAnchorDecisionMade = (payload: GameEvents['ANCHOR_DECISION_MADE']) => {
    eventBus.emit('REMOVE_WORLD_FILTER', { filterType: 'grayscale' });
    turnManager.resume();

    const anchorData = gameStore.getState().anchorData;
    if (!anchorData) return;

    if (payload.decision === 'extract') {
      eventBus.emit('ANCHOR_EXTRACT', {});
    } else if (payload.decision === 'descend') {
      eventBus.emit('ANCHOR_DESCEND', {
        anchorId: anchorData.anchorId,
        cost: anchorData.descendCost
      });

      // Also trigger staircase interaction logic to actually descend
      const currentFloor = anchorData.floorNumber;
      const targetFloor = currentFloor + 1;
      eventBus.emit('STAIRCASE_INTERACTION', {
        entityId: playerId,
        staircaseId: anchorData.anchorId,
        targetFloor
      });
    }
  };

  return {
    init() {
      eventBus.on('ENTITY_MOVED', handleEntityMoved);
      eventBus.on('ANCHOR_DECISION_MADE', handleAnchorDecisionMade);
    },
    dispose() {
      eventBus.off('ENTITY_MOVED', handleEntityMoved);
      eventBus.off('ANCHOR_DECISION_MADE', handleAnchorDecisionMade);
    }
  };
}

export type AnchorInteractionSystem = ReturnType<typeof createAnchorInteractionSystem>;
