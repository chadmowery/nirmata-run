import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { TurnManager } from '@engine/turn/turn-manager';
import { GameTurnAdapter } from '@game/turn/game-turn-adapter';
import { GameEvents } from '@game/events/types';
import { registerClientSystems, ClientSystems } from './client-systems';
import { MoveIntent, VentIntent, FirmwareIntent } from '@shared/components';
import { GameAction, DIRECTIONS, isFirmwareAction, getFirmwareSlotIndex } from '@game/input/actions';
import { DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT } from '@shared/constants';

export interface ClientEngineInitConfig {
  width?: number;
  height?: number;
  sessionId?: string;
  playerId?: number;
  world?: World<GameEvents>;
  grid?: Grid;
  eventBus?: EventBus<GameEvents>;
}

export interface ClientEngineInstance {
  world: World<GameEvents>;
  grid: Grid;
  eventBus: EventBus<GameEvents>;
  turnManager: TurnManager<GameEvents>;
  playerId: number;
  sessionId?: string;
  systems: ClientSystems<GameEvents>;
}

/**
 * Creates a lean, prediction-safe client engine.
 * Does NOT import or run procedural dungeon generation, entity placement,
 * loot tables, combat resolution, or enemy AI.
 */
export function createClientEngine(config: ClientEngineInitConfig = {}): ClientEngineInstance {
  const eventBus = config.eventBus ?? new EventBus<GameEvents>();
  const world = config.world ?? new World<GameEvents>(eventBus, { childComponentKey: 'children' });
  const grid = config.grid ?? new Grid(config.width ?? DEFAULT_GRID_WIDTH, config.height ?? DEFAULT_GRID_HEIGHT);

  const systems = registerClientSystems(world, grid, eventBus);

  const turnAdapter = new GameTurnAdapter(world, {
    defaultActionCost: 1000,
    waitActionCost: 500,
  });

  const turnManager = new TurnManager<GameEvents>(
    world,
    eventBus,
    {
      energyThreshold: 1000,
      defaultActionCost: 1000,
      waitActionCost: 500,
      isClient: true,
    },
    turnAdapter,
  );

  // Wire player prediction action handlers
  turnManager.setPlayerActionHandler((action: string, entityId: number) => {
    if (DIRECTIONS[action]) {
      const { dx, dy } = DIRECTIONS[action];
      if (dx !== 0 || dy !== 0) {
        world.addComponent(entityId, MoveIntent, { dx, dy });
      }
    } else if (action === GameAction.WAIT) {
      // Wait (energy advances on server)
    } else if (isFirmwareAction(action)) {
      const slotIndex = getFirmwareSlotIndex(action);
      if (slotIndex !== null) {
        const parts = action.split(':');
        world.addComponent(entityId, FirmwareIntent, {
          actorId: entityId,
          slotIndex,
          targetX: parts[1] !== undefined ? parseInt(parts[1]) : undefined,
          targetY: parts[2] !== undefined ? parseInt(parts[2]) : undefined,
        });
      }
    } else if (action === GameAction.VENT) {
      world.addComponent(entityId, VentIntent, {});
    } else if (
      action === GameAction.ANCHOR_DESCEND ||
      action === GameAction.STAIRCASE_DESCEND ||
      action === GameAction.ANCHOR_EXTRACT ||
      action === 'INTERACT_PROP' ||
      action === 'DEAD_DROP_ITEM' ||
      action === 'ABORT_RUN'
    ) {
      // Intent already processed by server or modal pipeline
    }

    eventBus.emit('PLAYER_ACTION', { action, entityId });
  });

  return {
    world,
    grid,
    eventBus,
    turnManager,
    playerId: config.playerId ?? 0,
    sessionId: config.sessionId,
    systems,
  };
}
