import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { TurnManager } from '../engine/turn/turn-manager';
import { EntityRegistry } from '../engine/entity/registry';
import { EntityFactory } from '../engine/entity/factory';
import { COMPONENTS_REGISTRY } from '@shared/components';
import { ComponentRegistry } from '../engine/entity/types';
import { ComponentDef } from '../engine/ecs/types';
import { registerGameTemplates } from './entities';
import { createMovementSystem } from './systems/movement';
import { createCombatSystem } from './systems/combat';
import { createAISystem } from './systems/ai';
import { createDeadZoneSystem, DeadZoneSystem } from './systems/dead-zone';
import { ItemPickupSystem, createItemPickupSystem } from './systems/item-pickup';
import { createHeatSystem, HeatSystem } from './systems/heat';
import { createStatusEffectSystem, StatusEffectSystem } from './systems/status-effects';
import { createFirmwareSystem, FirmwareSystem } from './systems/firmware';
import { createKernelPanicSystem, KernelPanicSystem } from './systems/kernel-panic';
import { createAugmentSystem, AugmentSystem } from './systems/augment';
import { createPackCoordinatorSystem, PackCoordinatorSystem } from './systems/pack-coordinator';
import { createTileCorruptionSystem } from './systems/tile-corruption';
import { createRunEnderSystem } from './systems/run-ender';
import { createStabilitySystem, StabilitySystem } from './systems/stability';
import { createFloorManagerSystem, FloorManagerSystem } from './systems/floor-manager';
import { createAnchorInteractionSystem, AnchorInteractionSystem } from './systems/anchor-interaction';
import { generateDungeon } from './generation/dungeon-generator';
import { placeEntities } from './generation/entity-placement';
import RNG from 'rot-js/lib/rng';
import { GameAction, DIRECTIONS, isFirmwareAction, getFirmwareSlotIndex } from './input/actions';
import { GameEvents } from './events/types';
import { Phase } from '../engine/ecs/types';

import { ShellRecord } from './shells/types';

export interface EngineInitConfig {
  width: number;
  height: number;
  seed: string;
  isClient?: boolean;
  shellRecord?: ShellRecord;
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
    deadZone: DeadZoneSystem;
    itemPickup: ItemPickupSystem;
    heat: HeatSystem;
    statusEffect: StatusEffectSystem;
    firmware: FirmwareSystem;
    kernelPanic: KernelPanicSystem;
    augment: AugmentSystem;
    packCoordinator: PackCoordinatorSystem;
    tileCorruption: ReturnType<typeof createTileCorruptionSystem<GameEvents>>;
    runEnder: ReturnType<typeof createRunEnderSystem<GameEvents>>;
    stability: StabilitySystem;
    floorManager: FloorManagerSystem;
    anchorInteraction: AnchorInteractionSystem;
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
  
  const componentsMap: Record<string, ComponentDef<unknown>> = Object.fromEntries(
    COMPONENTS_REGISTRY.map((component) => [component.key, component])
  );
  const componentRegistry: ComponentRegistry = {
    get: (key: string) => componentsMap[key],
    has: (key: string) => !!componentsMap[key],
  };

  // Dungeon Generation
  const dungeonResult = generateDungeon({
    width: config.width,
    height: config.height,
    seed: config.seed,
    depth: 1
  });

  const grid = dungeonResult.grid;

  // Systems
  const movementSystem = createMovementSystem(world, grid, eventBus);
  const combatSystem = createCombatSystem(world, grid, eventBus, entityFactory, componentRegistry, {
    skipLoot: config.isClient
  });
  const deadZoneSystem = createDeadZoneSystem(world, grid, eventBus);
  const aiSystem = createAISystem(world, grid, eventBus, movementSystem, deadZoneSystem);
  const itemPickupSystem = createItemPickupSystem(world, grid, eventBus);
  const heatSystem = createHeatSystem(world, eventBus);
  const statusEffectSystem = createStatusEffectSystem(world, eventBus);
  const firmwareSystem = createFirmwareSystem(world, grid, eventBus, movementSystem, heatSystem);
  const kernelPanicSystem = createKernelPanicSystem(world, eventBus, statusEffectSystem);
  const augmentSystem = createAugmentSystem(world, eventBus, statusEffectSystem, heatSystem);
  const packCoordinatorSystem = createPackCoordinatorSystem(world, grid, eventBus);
  const tileCorruptionSystem = createTileCorruptionSystem(world, grid, eventBus, entityFactory, componentRegistry);
  const runEnderSystem = createRunEnderSystem(world, grid, eventBus);
  const stabilitySystem = createStabilitySystem(world, eventBus);

  combatSystem.init();
  deadZoneSystem.init();
  itemPickupSystem.init();
  heatSystem.init();
  statusEffectSystem.init();
  kernelPanicSystem.init();
  augmentSystem.init();
  packCoordinatorSystem.init();
  tileCorruptionSystem.init();
  runEnderSystem.init();
  stabilitySystem.init();

  // Register ticks to POST_TURN phase
  world.registerSystem(Phase.POST_TURN, () => {
    deadZoneSystem.tickDeadZones();
    tileCorruptionSystem.tick();
  });

  const turnManager = new TurnManager<GameEvents>(world, eventBus, {
    energyThreshold: 1000,
    defaultActionCost: 1000,
    waitActionCost: 500,
  });

  // Entity Placement
  RNG.setSeed(hashSeedForPlacement(config.seed));
  const rng = { random: () => RNG.getUniform() };

  // Prepare shell overrides
  const playerOverrides: Record<string, Record<string, unknown>> = {
    'augmentSlots': { equipped: [] },
    'augmentState': { activationsThisTurn: {}, cooldownsRemaining: {} },
    'heat': { current: 0, maxSafe: 100, baseDissipation: 5, ventPercentage: 0.5, isVenting: false },
    'stability': { current: 100, max: 100 },
    'scrap': { amount: 0 },
    'floorState': { currentFloor: 1, maxFloor: 15, runSeed: config.seed }
  };

  if (config.shellRecord) {
    const { currentStats, portConfig } = config.shellRecord;
    playerOverrides['health'] = { max: currentStats.maxHealth, current: currentStats.maxHealth } as unknown as Record<string, unknown>;
    playerOverrides['defense'] = { armor: currentStats.armor } as unknown as Record<string, unknown>;
    playerOverrides['energy'] = { speed: currentStats.speed } as unknown as Record<string, unknown>;
    
    // Core Shell Components
    playerOverrides['shell'] = currentStats as unknown as Record<string, unknown>;
    playerOverrides['portConfig'] = portConfig as unknown as Record<string, unknown>;
    playerOverrides['firmwareSlots'] = { equipped: [] };
    playerOverrides['softwareSlots'] = { equipped: [] };
  }

  const placement = placeEntities(
    world,
    grid,
    entityFactory,
    componentRegistry,
    dungeonResult.rooms,
    dungeonResult.playerSpawnRoom,
    rng,
    { playerOverrides, depth: 1 }
  );

  const floorManagerSystem = createFloorManagerSystem(
    world,
    grid,
    eventBus,
    entityFactory,
    componentRegistry,
    placement.playerId
  );
  floorManagerSystem.init();

  const anchorInteractionSystem = createAnchorInteractionSystem(
    world,
    grid,
    eventBus,
    turnManager,
    placement.playerId
  );
  anchorInteractionSystem.init();

  // Turn Manager Handlers
  turnManager.setEnemyActionHandler((entityId) => {
    statusEffectSystem.tickDown(entityId);
    augmentSystem.resetTurnState(entityId);
    packCoordinatorSystem.resetTurnState();
    aiSystem.processEnemyTurn(entityId);
  });

  turnManager.setPlayerActionHandler((action: string, entityId: number) => {
    statusEffectSystem.tickDown(entityId);
    augmentSystem.resetTurnState(entityId);
    packCoordinatorSystem.resetTurnState();
    if (DIRECTIONS[action]) {
      const { dx, dy } = DIRECTIONS[action];
      if (dx !== 0 || dy !== 0) {
        movementSystem.processMove(entityId, dx, dy);
      }
    } else if (action === GameAction.WAIT) {
      // Wait
    } else if (isFirmwareAction(action as GameAction)) {
      const slotIndex = getFirmwareSlotIndex(action as GameAction);
      if (slotIndex !== null) {
        firmwareSystem.activateAbility(entityId, slotIndex, 0, 0);
      }
    } else if (action === GameAction.VENT) {
      heatSystem.vent(entityId);
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
      deadZone: deadZoneSystem,
      itemPickup: itemPickupSystem,
      heat: heatSystem,
      statusEffect: statusEffectSystem,
      firmware: firmwareSystem,
      kernelPanic: kernelPanicSystem,
      augment: augmentSystem,
      packCoordinator: packCoordinatorSystem,
      tileCorruption: tileCorruptionSystem,
      runEnder: runEnderSystem,
      stability: stabilitySystem,
      floorManager: floorManagerSystem,
      anchorInteraction: anchorInteractionSystem
    }
  };
}

/**
 * Hashes a seed string into a numeric seed for placement RNG.
 */
export function hashSeedForPlacement(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
