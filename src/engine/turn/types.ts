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
  isClient?: boolean;
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
 * Adapter interface allowing TurnManager to orchestrate actor initiative and turns
 * without coupling the engine to specific gameplay components (Actor, Energy, Health, Acting).
 */
export interface TurnSchedulerAdapter<TActorId = EntityId> {
  /** Get all candidate actor IDs eligible for turn scheduling. */
  getCandidateActors(): TActorId[];

  /** Check if an actor is still active / alive. */
  isActorActive(actorId: TActorId): boolean;

  /** Check if an actor has reached the energy threshold to act. */
  canActorAct(actorId: TActorId, threshold: number): boolean;

  /** Increment energy/initiative for an actor based on its speed. */
  accumulateEnergy(actorId: TActorId): void;

  /** Deduct action cost from the actor's energy. */
  deductActionCost(actorId: TActorId, cost: number): void;

  /** Check if an actor is the primary actor (e.g., player). */
  isPrimaryActor(actorId: TActorId): boolean;

  /** Get the primary actor ID, or null if none exists. */
  getPrimaryActor(): TActorId | null;

  /** Optional hook to calculate cost for a specific action. Defaults to waitActionCost or defaultActionCost if omitted. */
  getActionCost?(actorId: TActorId, action: string): number;

  /** Optional hook called immediately before an actor executes its action sequence. */
  onBeforeActorAct?(actorId: TActorId): void;

  /** Optional hook called immediately after an actor completes its action sequence. */
  onAfterActorAct?(actorId: TActorId): void;
}
