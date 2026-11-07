import { World } from '../engine/ecs/world';
import { EntityId } from '../engine/ecs/types';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { StateMachine } from '../engine/state-machine/state-machine';
import { TurnManager } from '../engine/turn/turn-manager';
import { InputManager } from './input/input-manager';
import { MovementSystem } from './systems/movement';
import { GameEvents } from './events/types';
import { GameState } from './states/types';
import { EntityFactory } from '@engine/entity/factory';
import { ActionIntent } from '@shared/types';
export interface AutoPathfinderInstance {
  setContext(context: GameContext): void;
  toggle(): void;
  start(): void;
  cancel(): void;
  isActive(): boolean;
}

export interface GameSystem {
  init?(): void;
  dispose?(): void;
}

/**
 * The unified context that holds client engine and game modules.
 */
export interface GameContext {
  world: World<GameEvents>;
  grid: Grid;
  eventBus: EventBus<GameEvents>;
  fsm: StateMachine<GameState, GameContext>;
  turnManager: TurnManager<GameEvents>;
  inputManager: InputManager;
  movementSystem?: MovementSystem<GameEvents>;
  systems?: Record<string, GameSystem>;
  entityFactory?: EntityFactory;
  autoPathfinder?: AutoPathfinderInstance;
  submitAction?: (intent: ActionIntent) => Promise<void>;
  playerId?: EntityId;
  currentSeed?: string;
  sessionId?: string;
}
