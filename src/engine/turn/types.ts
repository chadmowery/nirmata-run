import { EntityId } from '../ecs/types';

/**
 * Phases of the turn-based loop.
 */
export enum TurnPhase {
  AWAIT_INPUT = 'AWAIT_INPUT',
  PLAYER_ACTION = 'PLAYER_ACTION',
  PRE_TURN = 'PRE_TURN',
  ENEMY_TURNS = 'ENEMY_TURNS',
  POST_TURN = 'POST_TURN',
  ENERGY_TICK = 'ENERGY_TICK',
}

/**
 * Default energy threshold for an actor to take a turn.
 */
export const ENERGY_THRESHOLD = 1000;

/**
 * Configuration for the turn manager.
 */
export interface TurnManagerConfig {
  energyThreshold: number;
  defaultActionCost: number;
  waitActionCost: number;
}

/**
 * Costs for various actions.
 */
export interface ActionCosts {
  move: number;
  attack: number;
  wait: number;
}

/**
 * Default values for action costs.
 */
export const DEFAULT_ACTION_COSTS: ActionCosts = {
  move: 1000,
  attack: 1000,
  wait: 500,
};

/**
 * Callback for player actions.
 */
export type PlayerActionHandler = (action: string, entityId: EntityId) => void;

/**
 * Callback for enemy actions.
 */
export type EnemyActionHandler = (entityId: EntityId) => void;
