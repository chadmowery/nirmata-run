import { World } from '../ecs/world';
import { EventBus } from '../events/event-bus';
import { EngineEvents } from '../events/types';
import { EntityId, Phase } from '../ecs/types';
import { logger } from '../utils/logger';
import { TurnPhase, TurnManagerConfig, PlayerActionHandler, TurnSchedulerAdapter } from './types';

/**
 * Orchestrates the game turn loop using an energy-based scheduler.
 * Completely agnostic of game rules and ECS components via TurnSchedulerAdapter.
 */
export class TurnManager<TEvents extends EngineEvents = EngineEvents> {
  private phase: TurnPhase = TurnPhase.AWAIT_INPUT;
  private turnNumber: number = 0;
  private playerActionHandler: PlayerActionHandler | null = null;
  private _paused = false;

  constructor(
    private world: World<TEvents>,
    private eventBus: EventBus<TEvents>,
    private config: TurnManagerConfig,
    private adapter: TurnSchedulerAdapter<EntityId>,
  ) {}

  /**
   * Submit a player action. Only allowed during AWAIT_INPUT.
   */
  submitAction(action: string): void {
    if (this._paused || this.phase !== TurnPhase.AWAIT_INPUT) return;

    logger.info(`Player submitting action: ${action}`, 'TURN');
    this.phase = TurnPhase.PLAYER_ACTION;
    const playerEntity = this.adapter.getPrimaryActor();
    if (playerEntity === null || !this.adapter.isActorActive(playerEntity)) {
      this.phase = TurnPhase.AWAIT_INPUT;
      return;
    }

    // Process player action
    const cost = this.adapter.getActionCost
      ? this.adapter.getActionCost(playerEntity, action)
      : action === 'WAIT'
        ? this.config.waitActionCost
        : this.config.defaultActionCost;
    this.adapter.deductActionCost(playerEntity, cost);

    if (this.playerActionHandler) {
      this.playerActionHandler(action, playerEntity);
    }

    // Complete cycle
    this.executeTurnCycle();
  }

  /**
   * Run the full turn cycle: pre-turn -> action resolution -> enemy turns -> post-turn -> energy tick.
   */
  private executeTurnCycle(): void {
    if (this._paused) return;

    this.turnNumber++;
    logger.info(`STARTING TURN ${this.turnNumber}`, 'TURN');
    this.eventBus.emit('TURN_START', { turnNumber: this.turnNumber });

    // 1. Pre-turn phase
    this.phase = TurnPhase.PRE_TURN;
    this.world.executeSystems(Phase.PRE_TURN);
    if (this._paused) return;

    // 2. Resolve Player Action Sequence
    // The player's intent was already attached in submitAction via the playerActionHandler
    const playerId = this.adapter.getPrimaryActor();
    if (playerId !== null) {
      this.adapter.onBeforeActorAct?.(playerId);
    }

    this.executeActionSequence();

    if (playerId !== null) {
      this.adapter.onAfterActorAct?.(playerId);
    }

    if (this._paused) return;

    // 3. Enemy turns (for those already ready)
    this.phase = TurnPhase.ENEMY_TURNS;
    logger.debug('Processing Ready Enemies', 'TURN');
    this.processEnemyTurns();
    if (this._paused) return;

    // 4. Post-turn phase
    this.phase = TurnPhase.POST_TURN;
    this.world.executeSystems(Phase.POST_TURN);
    if (this._paused) return;

    // 5. Advance energy until player is ready
    this.advanceUntilPlayerReady();
    if (this._paused) return;

    this.phase = TurnPhase.AWAIT_INPUT;
    logger.info(`COMPLETED TURN ${this.turnNumber}`, 'TURN');
    this.eventBus.emit('TURN_END', { turnNumber: this.turnNumber });

    // Flush events at the very end of the cycle
    this.eventBus.flush();
  }

  /**
   * Sequentially executes the core gameplay phases (ACTION, REACTION, CLEANUP).
   */
  private executeActionSequence(): void {
    if (this._paused) return;

    // 1. Gather Intent phase
    this.world.executeSystems(Phase.GATHER_INTENT);

    // 2. Action phase (Movement)
    this.world.executeSystems(Phase.ACTION);

    // 3. Reaction phase (Combat)
    this.world.executeSystems(Phase.REACTION);

    // 4. Cleanup phase
    this.world.executeSystems(Phase.CLEANUP);
  }

  /**
   * Process actions for all enemies that have reached the energy threshold.
   */
  private processEnemyTurns(): void {
    if (this._paused) return;

    const candidates = this.adapter.getCandidateActors();
    const readyEnemies = candidates
      .filter((id) => !this.adapter.isPrimaryActor(id))
      .filter((id) => this.adapter.isActorActive(id))
      .filter((id) => this.adapter.canActorAct(id, this.config.energyThreshold));

    if (readyEnemies.length === 0) return;

    // Deterministic order: entity ID ascending
    readyEnemies.sort((a, b) => Number(a) - Number(b));

    for (const enemyId of readyEnemies) {
      logger.info(`Enemy Acting: ${enemyId}`, 'TURN');
      this.adapter.onBeforeActorAct?.(enemyId);

      const cost = this.adapter.getActionCost
        ? this.adapter.getActionCost(enemyId, 'DEFAULT')
        : this.config.defaultActionCost;
      this.adapter.deductActionCost(enemyId, cost);

      // Resolve the enemy's intent (GATHER_INTENT -> ACTION -> REACTION -> CLEANUP)
      this.executeActionSequence();

      // Clear acting tag
      this.adapter.onAfterActorAct?.(enemyId);
    }
  }

  /**
   * Tick all actors' energy until the player is ready to act.
   */
  private advanceUntilPlayerReady(): void {
    const playerEntity = this.adapter.getPrimaryActor();
    if (playerEntity === null || !this.adapter.isActorActive(playerEntity)) return;

    let subTickCount = 0;
    const MAX_SUB_TICKS = 10000;

    while (subTickCount < MAX_SUB_TICKS) {
      if (this._paused || !this.adapter.isActorActive(playerEntity)) break;

      if (this.adapter.canActorAct(playerEntity, this.config.energyThreshold)) {
        break;
      }

      this.tickEnergy();

      // IMPORTANT: Only process enemies if the player is NOT yet ready
      // This prevents double-dipping when player and enemy reach threshold in same tick
      if (!this.adapter.canActorAct(playerEntity, this.config.energyThreshold)) {
        logger.debug(`Player not ready. Checking enemies...`, 'TURN');
        this.processEnemyTurns();
      }

      subTickCount++;
    }

    if (subTickCount >= MAX_SUB_TICKS) {
      logger.error(
        'Max sub-ticks reached in TurnManager. Check for degenerate speed values.',
        'TURN',
      );
    }
  }

  /**
   * Increment energy for all living actors based on their speed.
   */
  private tickEnergy(): void {
    const actors = this.adapter.getCandidateActors();
    for (const id of actors) {
      if (this.adapter.isActorActive(id)) {
        this.adapter.accumulateEnergy(id);
      }
    }
  }

  /**
   * Start the turn manager, initializing energy levels.
   */
  start(): void {
    this.advanceUntilPlayerReady();
    this.phase = TurnPhase.AWAIT_INPUT;
    this.eventBus.flush(); // Initial flush
  }

  /**
   * Loads the turn manager state from external data.
   */
  loadState(turnNumber: number, phase: TurnPhase): void {
    this.turnNumber = turnNumber;
    this.phase = phase;
  }

  // Setters for handlers
  setPlayerActionHandler(handler: PlayerActionHandler): void {
    this.playerActionHandler = handler;
  }

  // Getters & Controls
  getPhase(): TurnPhase {
    return this.phase;
  }
  canAcceptInput(): boolean {
    return !this._paused && this.phase === TurnPhase.AWAIT_INPUT;
  }
  getTurnNumber(): number {
    return this.turnNumber;
  }

  pause(): void {
    this._paused = true;
  }
  resume(): void {
    this._paused = false;
  }
  get isPaused(): boolean {
    return this._paused;
  }
}
