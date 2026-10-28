import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../../src/engine/ecs/world';
import { EventBus } from '../../src/engine/events/event-bus';
import { EngineEvents } from '../../src/engine/events/types';
import { TurnManager } from '../../src/engine/turn/turn-manager';
import { TurnPhase, TurnSchedulerAdapter } from '../../src/engine/turn/types';

interface TestActorState {
  id: number;
  isPlayer: boolean;
  isAlive: boolean;
  energy: number;
  speed: number;
  acting: boolean;
}

class TestTurnSchedulerAdapter implements TurnSchedulerAdapter<number> {
  public actors: Map<number, TestActorState> = new Map();

  addActor(actor: TestActorState): void {
    this.actors.set(actor.id, actor);
  }

  getCandidateActors(): number[] {
    return Array.from(this.actors.keys());
  }

  isActorActive(actorId: number): boolean {
    return this.actors.get(actorId)?.isAlive ?? false;
  }

  canActorAct(actorId: number, threshold: number): boolean {
    const actor = this.actors.get(actorId);
    return Boolean(actor && actor.energy >= threshold);
  }

  accumulateEnergy(actorId: number): void {
    const actor = this.actors.get(actorId);
    if (actor) {
      actor.energy += actor.speed;
    }
  }

  deductActionCost(actorId: number, cost: number): void {
    const actor = this.actors.get(actorId);
    if (actor) {
      actor.energy -= cost;
    }
  }

  isPrimaryActor(actorId: number): boolean {
    return Boolean(this.actors.get(actorId)?.isPlayer);
  }

  getPrimaryActor(): number | null {
    for (const actor of this.actors.values()) {
      if (actor.isPlayer) return actor.id;
    }
    return null;
  }

  onBeforeActorAct(actorId: number): void {
    const actor = this.actors.get(actorId);
    if (actor) actor.acting = true;
  }

  onAfterActorAct(actorId: number): void {
    const actor = this.actors.get(actorId);
    if (actor) actor.acting = false;
  }
}

describe('TurnManager Client Prediction Mode (isClient: true)', () => {
  let world: World;
  let eventBus: EventBus<EngineEvents>;
  let turnManager: TurnManager;
  let adapter: TestTurnSchedulerAdapter;
  let playerEntity: number;
  let enemyEntity: number;

  beforeEach(() => {
    eventBus = new EventBus<EngineEvents>();
    world = new World(eventBus);
    adapter = new TestTurnSchedulerAdapter();

    turnManager = new TurnManager(
      world,
      eventBus,
      {
        energyThreshold: 1000,
        defaultActionCost: 1000,
        waitActionCost: 500,
        isClient: true,
      },
      adapter,
    );

    playerEntity = world.createEntity();
    adapter.addActor({
      id: playerEntity,
      isPlayer: true,
      isAlive: true,
      energy: 1000,
      speed: 100,
      acting: false,
    });

    enemyEntity = world.createEntity();
    adapter.addActor({
      id: enemyEntity,
      isPlayer: false,
      isAlive: true,
      energy: 1000, // Ready to act
      speed: 100,
      acting: false,
    });
  });

  it('starts without executing enemy turns or advancing non-player energy', () => {
    const enemyBefore = adapter.actors.get(enemyEntity)!.energy;
    turnManager.start();

    expect(turnManager.getPhase()).toBe(TurnPhase.AWAIT_INPUT);
    expect(adapter.actors.get(enemyEntity)!.energy).toBe(enemyBefore);
    expect(adapter.actors.get(enemyEntity)!.acting).toBe(false);
  });

  it('executes predicted player turn and immediately returns to AWAIT_INPUT without running enemy turns', () => {
    turnManager.start();

    const turnStartSpy = vi.fn();
    const turnEndSpy = vi.fn();
    eventBus.on('TURN_START', turnStartSpy);
    eventBus.on('TURN_END', turnEndSpy);

    const actionHandler = vi.fn();
    turnManager.setPlayerActionHandler(actionHandler);

    turnManager.submitAction('MOVE_EAST');

    // Player action was handled
    expect(actionHandler).toHaveBeenCalledWith('MOVE_EAST', playerEntity);

    // Turned started and ended
    expect(turnStartSpy).toHaveBeenCalledWith({ turnNumber: 1 });
    expect(turnEndSpy).toHaveBeenCalledWith({ turnNumber: 1 });

    // Ready enemy was NOT executed on the client
    expect(adapter.actors.get(enemyEntity)!.acting).toBe(false);

    // Turn phase returned to AWAIT_INPUT for responsive client input
    expect(turnManager.getPhase()).toBe(TurnPhase.AWAIT_INPUT);
    expect(turnManager.canAcceptInput()).toBe(true);
  });

  it('does not deduct local energy or lock out input when isClient is true', () => {
    turnManager.start();

    const initialPlayerEnergy = adapter.actors.get(playerEntity)!.energy;
    turnManager.submitAction('MOVE_EAST');

    // Client prediction does not drain player energy; server remains the authority
    expect(adapter.actors.get(playerEntity)!.energy).toBe(initialPlayerEnergy);
    expect(turnManager.canAcceptInput()).toBe(true);
  });
});
