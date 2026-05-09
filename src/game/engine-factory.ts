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
import { MoveIntent, VentIntent } from '@shared/components';
import { createCombatSystem } from './systems/combat';
import { createAISystem } from './systems/ai';
import { registerCoreSystems } from './systems/registration';
import { DeadZoneSystem } from './systems/dead-zone';
import { ItemPickupSystem } from './systems/item-pickup';
import { createHeatSystem, HeatSystem } from './systems/heat';
import { StatusEffectSystem } from './systems/status-effects';
import { createFirmwareSystem, FirmwareSystem } from './systems/firmware';
import { createKernelPanicSystem, KernelPanicSystem } from './systems/kernel-panic';
import { AugmentSystem } from './systems/augment';
import { PackCoordinatorSystem } from './systems/pack-coordinator';
import { createTileCorruptionSystem } from './systems/tile-corruption';
import { createRunEnderSystem } from './systems/run-ender';
import { StabilitySystem } from './systems/stability';
import { FloorManagerSystem } from './systems/floor-manager';
import { AnchorInteractionSystem } from './systems/anchor-interaction';
import { RewardDropSystem } from './systems/reward-drop';
import { createTagCleanupSystem } from './systems/tag-cleanup';
import { createGravediggerSystem } from './systems/gravedigger';
import { generateDungeon } from './generation/dungeon-generator';
import { placeEntities } from './generation/entity-placement';
import RNG from 'rot-js/lib/rng';
import { GameAction, DIRECTIONS, isFirmwareAction, getFirmwareSlotIndex } from './input/actions';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from './events/types';
import { Phase } from '../engine/ecs/types';

import { ShellRecord } from './shells/types';
import { PlayerProfile } from '@shared/profile';
import { RunMode } from '@shared/run-mode';

export interface EngineInitConfig {
  width: number;
  height: number;
  seed: string;
  isClient?: boolean;
  shellRecord?: ShellRecord;
  sessionId?: string;
  profile?: PlayerProfile;
  runMode?: RunMode;
}

export interface EngineInstance<T extends GameplayEvents = GameEvents> {
  world: World<T>;
  grid: Grid;
  eventBus: EventBus<T>;
  turnManager: TurnManager<T>;
  entityFactory: EntityFactory;
  playerId: number;
  sessionId?: string;
  systems: {
    movement: ReturnType<typeof createMovementSystem<T>>;
    combat: ReturnType<typeof createCombatSystem<T>>;
    ai: ReturnType<typeof createAISystem<T>>;
    deadZone: DeadZoneSystem<T>;
    itemPickup: ItemPickupSystem<T>;
    heat: HeatSystem<T>;
    statusEffect: StatusEffectSystem<T>;
    firmware: FirmwareSystem<T>;
    kernelPanic: KernelPanicSystem<T>;
    augment: AugmentSystem<T>;
    packCoordinator: PackCoordinatorSystem<T>;
    tileCorruption: ReturnType<typeof createTileCorruptionSystem<T>>;
    runEnder: ReturnType<typeof createRunEnderSystem<T>>;
    stability: StabilitySystem<T>;
    floorManager: FloorManagerSystem<T>;
    anchorInteraction: AnchorInteractionSystem<T>;
    rewardDrop: RewardDropSystem<T>;
    tagCleanup: ReturnType<typeof createTagCleanupSystem<T>>;
    gravedigger: ReturnType<typeof createGravediggerSystem<T>>;
  };
}

/**
 * Creates and initializes a pure game engine instance.
 * Shared between client and server.
 */
export function createEngineInstance(config: EngineInitConfig): EngineInstance<GameEvents> {
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
  // Core Systems (Shared with Pipeline)
  const coreSystems = registerCoreSystems(
    world,
    grid,
    eventBus,
    entityFactory,
    componentRegistry,
    { runMode: config.runMode }
  );

  const aiSystem = createAISystem(world, grid, eventBus, entityFactory, componentRegistry);
  const heatSystem = createHeatSystem(world, eventBus);
  const firmwareSystem = createFirmwareSystem(world, grid, eventBus);
  const kernelPanicSystem = createKernelPanicSystem(world, eventBus);
  const tileCorruptionSystem = createTileCorruptionSystem(world, grid, eventBus, entityFactory, componentRegistry);

  // Initialize remaining systems
  aiSystem.init();
  heatSystem.init();
  firmwareSystem.init();
  kernelPanicSystem.init();
  tileCorruptionSystem.init();

  // Register ticks to POST_TURN phase
  world.registerSystem(Phase.POST_TURN, () => {
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
    'floorState': { currentFloor: 1, maxFloor: 15, runSeed: config.seed }
  };

  // If a profile is provided, populate slots from installed items
  if (config.profile) {
    const activeShellId = config.shellRecord ? config.shellRecord.id : null;

    // Filter installed items for this specific shell
    const items = config.profile.installedItems.filter(item =>
      !activeShellId || item.shellId === activeShellId
    );

    const firmwareIds: number[] = [];
    const softwareIds: number[] = [];
    const augmentIds: number[] = [];
    let weaponSoftwareId: number | null = null;
    let armorSoftwareId: number | null = null;

    for (const item of items) {
      // Spawn the item entity (D-15/D-16 Fix)
      const itemId = entityFactory.create(world, item.blueprintId, componentRegistry);

      if (item.type === 'firmware') {
        firmwareIds.push(itemId);
      } else if (item.type === 'software') {
        softwareIds.push(itemId);
        // Map burned components for passive resolution
        if (!item.isLegacy) {
          weaponSoftwareId = itemId;
        } else {
          armorSoftwareId = itemId;
        }
      } else if (item.type === 'augment') {
        augmentIds.push(itemId);
      }
    }

    playerOverrides['firmwareSlots'] = { equipped: firmwareIds };
    playerOverrides['softwareSlots'] = { equipped: softwareIds };
    playerOverrides['augmentSlots'] = { equipped: augmentIds };

    // Populate "BurnedSoftware" component for passive software effects
    playerOverrides['burnedSoftware'] = {
      weapon: weaponSoftwareId,
      armor: armorSoftwareId,
    };
  }

  // Phase 16: Starter Loadout fallback (D-02, D-04)
  const hasEquippedItems = ((playerOverrides['firmwareSlots'] as any)?.equipped?.length || 0) > 0 ||
    ((playerOverrides['softwareSlots'] as any)?.equipped?.length || 0) > 0 ||
    ((playerOverrides['augmentSlots'] as any)?.equipped?.length || 0) > 0;

  if (!hasEquippedItems && config.shellRecord?.starterLoadout) {
    const firmwareIds: number[] = [];

    for (const itemBlueprintId of config.shellRecord.starterLoadout) {
      // Spawn the starter item
      const itemId = entityFactory.create(world, itemBlueprintId, componentRegistry);

      // For now, starter items are assumed to be firmware (per PRD archetypes)
      // but we could check the template type if needed.
      firmwareIds.push(itemId);
    }

    playerOverrides['firmwareSlots'] = { equipped: firmwareIds };
  }

  if (config.shellRecord) {
    const { currentStats, portConfig } = config.shellRecord;
    playerOverrides['health'] = { max: currentStats.maxHealth, current: currentStats.maxHealth, isAlive: true } as unknown as Record<string, unknown>;
    playerOverrides['defense'] = { armor: currentStats.armor } as unknown as Record<string, unknown>;
    playerOverrides['energy'] = { speed: currentStats.speed } as unknown as Record<string, unknown>;

    // Core Shell Components
    playerOverrides['shell'] = {
      archetypeId: config.shellRecord.archetypeId,
      ...currentStats
    } as unknown as Record<string, unknown>;
    playerOverrides['portConfig'] = portConfig as unknown as Record<string, unknown>;

    // Heat dissipation scales with shell stability
    playerOverrides['heat'] = {
      ...playerOverrides['heat'],
      baseDissipation: 5 + (currentStats.stability * 0.1) // Every 10 stability adds 1 dissipation
    };
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

  // Turn Manager Handlers
  // Turn Manager Handlers
  turnManager.setEnemyActionHandler((entityId) => {
    aiSystem.processEnemyTurn(entityId);
  });

  turnManager.setPlayerActionHandler((action: string, entityId: number) => {
    if (DIRECTIONS[action]) {
      const { dx, dy } = DIRECTIONS[action];
      if (dx !== 0 || dy !== 0) {
        world.addComponent(entityId, MoveIntent, { dx, dy });
      }
    } else if (action === GameAction.WAIT) {
      // Wait
    } else if (isFirmwareAction(action)) {
      const slotIndex = getFirmwareSlotIndex(action);
      if (slotIndex !== null) {
        // Parse coordinates if provided (encoded as USE_FIRMWARE_X:targetX:targetY)
        const parts = action.split(':');
        const targetX = parts[1] !== undefined ? parseInt(parts[1]) : 0;
        const targetY = parts[2] !== undefined ? parseInt(parts[2]) : 0;

        firmwareSystem.activateAbility(entityId, slotIndex, targetX, targetY);
      }
    } else if (action === GameAction.VENT) {
      world.addComponent(entityId, VentIntent, {});
    }

    eventBus.emit('PLAYER_ACTION', { action, entityId });
  });

  // Common shared handlers (pity, extraction bonus, etc.)
  // setupInternalHandlers(
  //   world as unknown as World<GameplayEvents>, 
  //   grid, 
  //   eventBus as unknown as EventBus<GameplayEvents>
  // );

  return {
    world,
    grid,
    eventBus,
    turnManager,
    entityFactory,
    playerId: placement.playerId,
    sessionId: config.sessionId,
    systems: {
      ...coreSystems,
      ai: aiSystem,
      heat: heatSystem,
      firmware: firmwareSystem,
      kernelPanic: kernelPanicSystem,
      tileCorruption: tileCorruptionSystem,
    } as any
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
