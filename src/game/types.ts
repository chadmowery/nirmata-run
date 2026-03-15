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

import { CombatSystem } from './systems/combat';
import { AISystem } from './systems/ai';
import { ItemPickupSystem } from './systems/item-pickup';
import { EntityFactory } from '@engine/entity/factory';

/**
 * The unified context that holds all engine and game modules.
 */
export interface GameContext {
  world: World;
  grid: Grid;
  eventBus: EventBus<GameEvents>;
  fsm: StateMachine<GameState, GameContext>;
  turnManager: TurnManager;
  inputManager: InputManager;
  movementSystem: MovementSystem;
  combatSystem: CombatSystem;
  aiSystem: AISystem;
  itemPickupSystem: ItemPickupSystem;
  entityFactory: EntityFactory;
  playerId?: EntityId;
  currentSeed?: string;
  sessionId?: string;
}
