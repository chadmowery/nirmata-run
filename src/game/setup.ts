import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { EngineEvents } from '../engine/events/types';
import { StateMachine } from '../engine/state-machine/state-machine';
import { StateConfig } from '../engine/state-machine/types';
import { TurnManager } from '../engine/turn/turn-manager';
import { InputManager } from './input/input-manager';
import { MovementSystem, createMovementSystem } from './systems/movement';
import { GameAction, DIRECTIONS, DEFAULT_BINDINGS } from './input/actions';
import { GameEvents } from './events/types';
import { GameState } from './states/types';
import { GAME_TRANSITIONS } from './states/game-states';

import { EntityRegistry } from '../engine/entity/registry';
import { EntityFactory } from '../engine/entity/factory';
import { registerGameTemplates } from './entities';
import * as Components from '@shared/components';
import { createCombatSystem } from './systems/combat';
import { createAISystem } from './systems/ai';
import { createItemPickupSystem } from './systems/item-pickup';
import { generateDungeon } from './generation/dungeon-generator';
import { placeEntities } from './generation/entity-placement';
import RNG from 'rot-js/lib/rng';

import { GameContext } from './types';

export interface GameConfig {
  gridWidth: number;
  gridHeight: number;
  seed?: string;
}

/**
 * Bootstraps the game and engine together.
 */
export function createGame(config: GameConfig): GameContext {
  const eventBus = new EventBus<GameEvents>();
  const world = new World(eventBus as any);
  const grid = new Grid(config.gridWidth, config.gridHeight);
  
  // Entity pipeline
  const entityRegistry = new EntityRegistry();
  registerGameTemplates(entityRegistry);
  const entityFactory = new EntityFactory(entityRegistry);
  const componentsMap = Object.fromEntries(
    Object.entries(Components)
      .filter(([_, component]) => component && typeof component === 'object' && 'key' in component)
      .map(([_, component]) => [(component as any).key, component])
  );
  const componentRegistry: any = {
    get: (key: string) => componentsMap[key],
    has: (key: string) => !!componentsMap[key],
  };

  const movementSystem = createMovementSystem(world, grid, eventBus);
  const combatSystem = createCombatSystem(
    world, 
    grid, 
    eventBus, 
    entityFactory, 
    componentRegistry
  );
  const aiSystem = createAISystem(world, grid, movementSystem, eventBus);
  const itemPickupSystem = createItemPickupSystem(world, grid, eventBus);

  // Initialize systems
  combatSystem.init();
  itemPickupSystem.init();

  const turnManager = new TurnManager(world, eventBus as any, {
    energyThreshold: 1000,
    defaultActionCost: 1000,
    waitActionCost: 500,
  });

  const inputManager = new InputManager(DEFAULT_BINDINGS);

  // Partial context to break circular dependency during initialization
  const context = {
    world,
    grid,
    eventBus,
    movementSystem,
    combatSystem,
    aiSystem,
    itemPickupSystem,
    entityFactory,
    turnManager,
    inputManager,
  } as GameContext;

  const stateConfigs: Record<GameState, StateConfig<GameState, GameContext>> = {
    [GameState.Loading]: {},
    [GameState.MainMenu]: {
      onEnter: (ctx) => {
        ctx.inputManager.disable();
      },
    },
    [GameState.Playing]: {
      onEnter: (ctx) => {
        // Generate dungeon and place entities on first enter
        if (!ctx.playerId) {
          const seed = config.seed ?? `dungeon-${Date.now()}`;
          ctx.currentSeed = seed;

          const dungeonResult = generateDungeon({
            width: config.gridWidth,
            height: config.gridHeight,
            seed,
          });

          // Replace the grid in context with the generated one
          (ctx as any).grid = dungeonResult.grid;

          // Update systems that reference grid
          const newMovementSystem = createMovementSystem(ctx.world, dungeonResult.grid, ctx.eventBus);
          (ctx as any).movementSystem = newMovementSystem;
          const newCombatSystem = createCombatSystem(
            ctx.world,
            dungeonResult.grid,
            ctx.eventBus,
            ctx.entityFactory,
            componentRegistry
          );
          newCombatSystem.init();
          (ctx as any).combatSystem = newCombatSystem;
          const newAISystem = createAISystem(ctx.world, dungeonResult.grid, newMovementSystem, ctx.eventBus);
          (ctx as any).aiSystem = newAISystem;
          const newItemPickupSystem = createItemPickupSystem(ctx.world, dungeonResult.grid, ctx.eventBus);
          newItemPickupSystem.init();
          (ctx as any).itemPickupSystem = newItemPickupSystem;

          // Use rot-js RNG for deterministic entity placement
          RNG.setSeed(hashSeedForPlacement(seed));
          const rng = { random: () => RNG.getUniform() };

          const placement = placeEntities(
            ctx.world,
            dungeonResult.grid,
            ctx.entityFactory,
            componentRegistry,
            dungeonResult.rooms,
            dungeonResult.playerSpawnRoom,
            rng
          );

          ctx.playerId = placement.playerId;

          // Rewire turn manager enemy handler with new AI system
          ctx.turnManager.setEnemyActionHandler((entityId) => {
            newAISystem.processEnemyTurn(entityId);
          });

          // Rewire player action handler with new movement system
          ctx.turnManager.setPlayerActionHandler((action: string, entityId: number) => {
            const gameAction = action as GameAction;
            if (DIRECTIONS[gameAction]) {
              const { dx, dy } = DIRECTIONS[gameAction];
              newMovementSystem.processMove(entityId, dx, dy);
            }
            ctx.eventBus.emit('PLAYER_ACTION', { action, entityId });
          });
        }

        ctx.inputManager.enable();
        ctx.turnManager.start();
      },
      onExit: (ctx) => {
        ctx.inputManager.disable();
      },
    },
    [GameState.Paused]: {
      onEnter: (ctx) => {
        ctx.inputManager.disable();
      },
    },
    [GameState.GameOver]: {
      onEnter: (ctx) => {
        ctx.inputManager.disable();
      },
    },
  };

  const fsm = new StateMachine<GameState, GameContext>(
    GameState.Loading,
    stateConfigs,
    GAME_TRANSITIONS,
    context
  );

  context.fsm = fsm;

  // Wire input ActionHandler
  inputManager.setActionHandler((action: GameAction) => {
    if (action === GameAction.PAUSE) {
      const currentState = fsm.getCurrentState();
      if (currentState === GameState.Playing) {
        fsm.transition(GameState.Paused);
      } else if (currentState === GameState.Paused) {
        fsm.transition(GameState.Playing);
      }
      return;
    }

    if (fsm.getCurrentState() === GameState.Playing && turnManager.canAcceptInput()) {
      turnManager.submitAction(action);
    }
  });

  // Wire TurnManager handles
  turnManager.setPlayerActionHandler((action: string, entityId: number) => {
    const gameAction = action as GameAction;
    if (DIRECTIONS[gameAction]) {
      const { dx, dy } = DIRECTIONS[gameAction];
      movementSystem.processMove(entityId, dx, dy);
    }
    
    eventBus.emit('PLAYER_ACTION', { action, entityId });
  });

  // Enemy action handler
  turnManager.setEnemyActionHandler((entityId) => {
    aiSystem.processEnemyTurn(entityId);
  });

  return context;
}

/**
 * Hash a string seed into a numeric value for rot-js RNG.
 */
function hashSeedForPlacement(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
