import { World } from '../ecs/world';
import { EventBus } from '../events/event-bus';
import { EngineEvents } from '../events/types';
import { EntityId, Phase } from '../ecs/types';
import {
  TurnPhase,
  TurnManagerConfig,
  PlayerActionHandler,
} from './types';
import { Actor, Energy, Health, Acting } from '@shared/components';

/**
 * Orchestrates the game turn loop using an energy-based system.
 */
export class TurnManager<TEvents extends EngineEvents = EngineEvents> {
  private phase: TurnPhase = TurnPhase.AWAIT_INPUT;
  private turnNumber: number = 0;
  private playerActionHandler: PlayerActionHandler | null = null;
  private _paused = false;

  constructor(
    private world: World<TEvents>,
    private eventBus: EventBus<TEvents>,
    private config: TurnManagerConfig
  ) { }

  /**
   * Submit a player action. Only allowed during AWAIT_INPUT.
   */
  submitAction(action: string): void {
    if (this._paused || this.phase !== TurnPhase.AWAIT_INPUT) return;

    this.phase = TurnPhase.PLAYER_ACTION;
    const playerEntity = this.getPlayerEntity();
    if (playerEntity === null || !this.isAlive(playerEntity)) {
      this.phase = TurnPhase.AWAIT_INPUT;
      return;
    }

    // Process player action
    const cost = action === 'WAIT' ? this.config.waitActionCost : this.config.defaultActionCost;
    this.deductEnergy(playerEntity, cost);

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
    this.eventBus.emit('TURN_START', { turnNumber: this.turnNumber });

    // 1. Pre-turn phase
    this.phase = TurnPhase.PRE_TURN;
    this.world.executeSystems(Phase.PRE_TURN);
    if (this._paused) return;

    // 2. Resolve Player Action Sequence
    // The player's intent was already attached in submitAction via the playerActionHandler
    this.executeActionSequence();
    if (this._paused) return;

    // 3. Enemy turns (for those already ready)
    this.phase = TurnPhase.ENEMY_TURNS;
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

    const enemies = this.world.query(Actor, Energy)
      .filter(id => {
        const actor = this.world.getComponent(id, Actor);
        const energy = this.world.getComponent(id, Energy);
        return actor && !actor.isPlayer && energy && energy.current >= this.config.energyThreshold;
      })
      .filter(id => this.isAlive(id));

    if (enemies.length === 0) return;

    // Deterministic order: entity ID ascending
    enemies.sort((a, b) => a - b);

    for (const enemyId of enemies) {
      // Mark enemy as acting to trigger AI gathering intent
      this.world.addComponent(enemyId, Acting, {});
      
      this.deductEnergy(enemyId, this.config.defaultActionCost);
      
      // Resolve the enemy's intent (GATHER_INTENT -> ACTION -> REACTION -> CLEANUP)
      this.executeActionSequence();

      // Clear acting tag
      this.world.removeComponent(enemyId, Acting);
    }
  }

  /**
   * Tick all actors' energy until the player is ready to act.
   */
  private advanceUntilPlayerReady(): void {
    const playerEntity = this.getPlayerEntity();
    if (playerEntity === null || !this.isAlive(playerEntity)) return;

    let subTickCount = 0;
    const MAX_SUB_TICKS = 10000;

    while (subTickCount < MAX_SUB_TICKS) {
      if (this._paused || !this.isAlive(playerEntity)) break;

      const playerEnergy = this.world.getComponent(playerEntity, Energy);
      if (playerEnergy && playerEnergy.current >= this.config.energyThreshold) {
        break;
      }

      this.tickEnergy();

      // IMPORTANT: Only process enemies if the player is NOT yet ready
      // This prevents double-dipping when player and enemy reach threshold in same tick
      const updatedPlayerEnergy = this.world.getComponent(playerEntity, Energy);
      if (updatedPlayerEnergy && updatedPlayerEnergy.current < this.config.energyThreshold) {
        this.processEnemyTurns();
      }

      subTickCount++;
    }

    if (subTickCount >= MAX_SUB_TICKS) {
      console.error('Max sub-ticks reached in TurnManager. Check for degenerate speed values.');
    }
  }

  /**
   * Increment energy for all living actors based on their speed.
   */
  private tickEnergy(): void {
    const actors = this.world.query(Actor, Energy)
      .filter(id => this.isAlive(id));

    for (const id of actors) {
      const energy = this.world.getComponent(id, Energy);
      if (energy) {
        // Need to update the component data since we're using a class based world with stores
        const currentData = { ...energy };
        currentData.current += currentData.speed;
        this.world.addComponent(id, Energy, currentData);
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
   * Check if an entity is alive.
   */
  private isAlive(id: EntityId): boolean {
    const health = this.world.getComponent(id, Health);
    return !health || health.isAlive;
  }

  /**
   * Find the player entity ID.
   */
  private getPlayerEntity(): number | null {
    const actors = this.world.query(Actor);
    for (const id of actors) {
      const actor = this.world.getComponent(id, Actor);
      if (actor?.isPlayer) return id;
    }
    return null;
  }

  /**
   * Deduct energy cost from an entity.
   */
  private deductEnergy(id: number, cost: number): void {
    const energy = this.world.getComponent(id, Energy);
    if (energy) {
      const updatedData = { ...energy, current: energy.current - cost };
      this.world.addComponent(id, Energy, updatedData);
    }
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
  getPhase(): TurnPhase { return this.phase; }
  canAcceptInput(): boolean { return !this._paused && this.phase === TurnPhase.AWAIT_INPUT; }
  getTurnNumber(): number { return this.turnNumber; }

  pause(): void { this._paused = true; }
  resume(): void { this._paused = false; }
  get isPaused(): boolean { return this._paused; }
}
