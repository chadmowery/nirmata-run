import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { TurnManager } from '../engine/turn/turn-manager';
import { EntityRegistry } from '../engine/entity/registry';
import { EntityFactory } from '../engine/entity/factory';
import * as Components from '@shared/components';
import { registerGameTemplates } from './entities';
import { createMovementSystem } from './systems/movement';
import { createCombatSystem } from './systems/combat';
import { createAISystem } from './systems/ai';
import { ItemPickupSystem, createItemPickupSystem } from './systems/item-pickup';
import { generateDungeon } from './generation/dungeon-generator';
import { placeEntities } from './generation/entity-placement';
import RNG from 'rot-js/lib/rng';
import { GameAction, DIRECTIONS } from './input/actions';
import { GameEvents } from './events/types';

export interface EngineInitConfig {
  width: number;
  height: number;
  seed: string;
  isClient?: boolean;
}

export interface EngineInstance {
  world: World<GameEvents>;
  grid: Grid;
  eventBus: EventBus<GameEvents>;
  turnManager: TurnManager<GameEvents>;
  entityFactory: EntityFactory;
  playerId: number;
  systems: {
    movement: ReturnType<typeof createMovementSystem<GameEvents>>;
    combat: ReturnType<typeof createCombatSystem<GameEvents>>;
    ai: ReturnType<typeof createAISystem<GameEvents>>;
    itemPickup: ItemPickupSystem;
  };
}

/**
 * Creates and initializes a pure game engine instance.
 * Shared between client and server.
 */
export function createEngineInstance(config: EngineInitConfig): EngineInstance {
  const eventBus = new EventBus<GameEvents>();
  const world = new World<GameEvents>(eventBus);
  
  // Entity pipeline
  const entityRegistry = new EntityRegistry();
  registerGameTemplates(entityRegistry);
  const entityFactory = new EntityFactory(entityRegistry);
  
  const componentsMap = Object.fromEntries(
    Object.entries(Components)
      .filter(([, component]) => component && typeof component === 'object' && 'key' in component)
      .map(([, component]) => [(component as any).key, component])
  );
  const componentRegistry: any = {
    get: (key: string) => componentsMap[key],
    has: (key: string) => !!componentsMap[key],
  };

  // Dungeon Generation
  const dungeonResult = generateDungeon({
    width: config.width,
    height: config.height,
    seed: config.seed,
  });

  const grid = dungeonResult.grid;

  // Systems
  const movementSystem = createMovementSystem(world, grid, eventBus);
  const combatSystem = createCombatSystem(world, grid, eventBus, entityFactory, componentRegistry, {
    skipLoot: config.isClient
  });
  const aiSystem = createAISystem(world, grid, movementSystem);
  const itemPickupSystem = createItemPickupSystem(world, grid, eventBus);

  combatSystem.init();
  itemPickupSystem.init();

  const turnManager = new TurnManager<GameEvents>(world, eventBus, {
    energyThreshold: 1000,
    defaultActionCost: 1000,
    waitActionCost: 500,
  });

  // Entity Placement
  function hashSeedForPlacement(seed: string): number {
    let hash = 5381;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  RNG.setSeed(hashSeedForPlacement(config.seed));
  const rng = { random: () => RNG.getUniform() };

  const placement = placeEntities(
    world,
    grid,
    entityFactory,
    componentRegistry,
    dungeonResult.rooms,
    dungeonResult.playerSpawnRoom,
    rng
  );

  // Turn Manager Handlers
  turnManager.setEnemyActionHandler((entityId) => {
    aiSystem.processEnemyTurn(entityId);
  });

  turnManager.setPlayerActionHandler((action: string, entityId: number) => {
    // This handler will be customized by the environment (client vs server)
    // but we provide a default one that uses the systems we just created.
    if (DIRECTIONS[action]) {
      const { dx, dy } = DIRECTIONS[action];
      if (dx !== 0 || dy !== 0) {
        movementSystem.processMove(entityId, dx, dy);
      }
    } else if (action === GameAction.WAIT) {
      // Wait action usually just consumes energy/time, which TurnManager already did
    }
    
    eventBus.emit('PLAYER_ACTION', { action, entityId });
  });

  return {
    world,
    grid,
    eventBus,
    turnManager,
    entityFactory,
    playerId: placement.playerId,
    systems: {
      movement: movementSystem,
      combat: combatSystem,
      ai: aiSystem,
      itemPickup: itemPickupSystem,
    }
  };
}
