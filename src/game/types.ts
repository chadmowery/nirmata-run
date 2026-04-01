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
import { HeatSystem } from './systems/heat';
import { StatusEffectSystem } from './systems/status-effects';
import { FirmwareSystem } from './systems/firmware';
import { KernelPanicSystem } from './systems/kernel-panic';
import { AugmentSystem } from './systems/augment';
import { PackCoordinatorSystem } from './systems/pack-coordinator';
import { TileCorruptionSystem } from './systems/tile-corruption';
import { RunEnderSystem } from './systems/run-ender';
import { EntityFactory } from '@engine/entity/factory';
import { AutoPathfinder } from './debug/auto-pathfind';

export interface GameSystem {
  init?(): void;
  dispose?(): void;
}

/**
 * The unified context that holds all engine and game modules.
 */
export interface GameContext {
  world: World<GameEvents>;
  grid: Grid;
  eventBus: EventBus<GameEvents>;
  fsm: StateMachine<GameState, GameContext>;
  turnManager: TurnManager<GameEvents>;
  inputManager: InputManager;
  movementSystem: MovementSystem;
  combatSystem: CombatSystem;
  aiSystem: AISystem;
  itemPickupSystem: ItemPickupSystem;
  heatSystem: HeatSystem;
  statusEffectSystem: StatusEffectSystem;
  firmwareSystem: FirmwareSystem;
  kernelPanicSystem: KernelPanicSystem;
  augmentSystem: AugmentSystem;
  packCoordinatorSystem: PackCoordinatorSystem;
  tileCorruptionSystem: TileCorruptionSystem;
  runEnderSystem: RunEnderSystem;
  entityFactory: EntityFactory;
  autoPathfinder?: AutoPathfinder;
  playerId?: EntityId;
  currentSeed?: string;
  sessionId?: string;
}
