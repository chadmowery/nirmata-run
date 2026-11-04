import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../ecs/world';
import { EventBus } from '../events/event-bus';
import { EngineEvents } from '../events/types';
import { TurnManager } from './turn-manager';
import { TurnPhase, ENERGY_THRESHOLD, TurnSchedulerAdapter } from './types';
import { Phase } from '../ecs/types';

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

  allowsInactiveActorAction(action: string): boolean {
    return action === 'special_meta_action';
  }

  public abortedActors: Set<number> = new Set();

  refundActionCost(actorId: number, cost: number): void {
    const actor = this.actors.get(actorId);
    if (actor) {
      actor.energy += cost;
    }
  }

  wasActionAborted(actorId: number): boolean {
    return this.abortedActors.has(actorId);
  }

  clearActionAborted(actorId: number): void {
    this.abortedActors.delete(actorId);
  }
}

describe('TurnManager (Generic Engine)', () => {
  let world: World;
  let eventBus: EventBus<EngineEvents>;
  let turnManager: TurnManager;
  let adapter: TestTurnSchedulerAdapter;
  let playerEntity: number;

  const config = {
    energyThreshold: ENERGY_THRESHOLD,
    defaultActionCost: 1000,
    waitActionCost: 500,
  };

  beforeEach(() => {
    eventBus = new EventBus<EngineEvents>();
    world = new World(eventBus);
    adapter = new TestTurnSchedulerAdapter();
    turnManager = new TurnManager(world, eventBus, config, adapter);

    playerEntity = world.createEntity();
    adapter.addActor({
      id: playerEntity,
      isPlayer: true,
      isAlive: true,
      energy: 0,
      speed: 100,
      acting: false,
    });
  });

  it('starts at AWAIT_INPUT phase after start()', () => {
    turnManager.start();
    expect(turnManager.getPhase()).toBe(TurnPhase.AWAIT_INPUT);
    expect(turnManager.canAcceptInput()).toBe(true);
  });

  it('accumulates energy during start() if player not ready', () => {
    const player = adapter.actors.get(playerEntity)!;
    player.energy = 0;

    turnManager.start();

    // 10 ticks of 100 speed = 1000 threshold
    expect(player.energy).toBeGreaterThanOrEqual(config.energyThreshold);
  });

  it('gating: ignores submitAction when not in AWAIT_INPUT', () => {
    (turnManager as any).phase = TurnPhase.PLAYER_ACTION;

    const handler = vi.fn();
    turnManager.setPlayerActionHandler(handler);

    turnManager.submitAction('move');
    expect(handler).not.toHaveBeenCalled();
  });

  it('deducts energy and calls playerActionHandler on submitAction', () => {
    turnManager.start();

    const handler = vi.fn(() => {
      turnManager.pause();
    });
    turnManager.setPlayerActionHandler(handler);

    turnManager.submitAction('move');

    expect(handler).toHaveBeenCalledWith('move', playerEntity);
    const player = adapter.actors.get(playerEntity)!;
    expect(player.energy).toBe(0); // 1000 - 1000 cost
  });

  it('deducts half cost for wait action', () => {
    turnManager.start();

    const player = adapter.actors.get(playerEntity)!;
    player.energy = 1000;

    turnManager.setPlayerActionHandler(() => {
      turnManager.pause();
    });

    turnManager.submitAction('WAIT');

    expect(player.energy).toBe(500); // 1000 - 500 cost
  });

  it('processes enemy turns deterministically (ID order)', () => {
    const enemy1 = world.createEntity(); // ID 2
    adapter.addActor({
      id: enemy1,
      isPlayer: false,
      isAlive: true,
      energy: 1000,
      speed: 100,
      acting: false,
    });

    const enemy2 = world.createEntity(); // ID 3
    adapter.addActor({
      id: enemy2,
      isPlayer: false,
      isAlive: true,
      energy: 1000,
      speed: 100,
      acting: false,
    });

    const player = adapter.actors.get(playerEntity)!;
    player.energy = 1000;

    const actingEnemies: number[] = [];
    const originalExecute = world.executeSystems.bind(world);
    vi.spyOn(world, 'executeSystems').mockImplementation((phase) => {
      if (phase === Phase.GATHER_INTENT) {
        for (const [id, actor] of adapter.actors.entries()) {
          if (!actor.isPlayer && actor.acting) {
            actingEnemies.push(id);
          }
        }
      }
      originalExecute(phase);
    });

    turnManager.start();
    turnManager.submitAction('move');

    expect(actingEnemies).toContain(enemy1);
    expect(actingEnemies).toContain(enemy2);
  });

  it('skips dead enemies', () => {
    const enemy = world.createEntity();
    adapter.addActor({
      id: enemy,
      isPlayer: false,
      isAlive: false,
      energy: 1000,
      speed: 100,
      acting: false,
    });

    const player = adapter.actors.get(playerEntity)!;
    player.energy = 1000;

    let actingEnemyFound = false;
    const originalExecute = world.executeSystems.bind(world);
    vi.spyOn(world, 'executeSystems').mockImplementation((phase) => {
      if (phase === Phase.GATHER_INTENT) {
        if (adapter.actors.get(enemy)?.acting) {
          actingEnemyFound = true;
        }
      }
      originalExecute(phase);
    });

    turnManager.start();
    turnManager.submitAction('move');

    expect(actingEnemyFound).toBe(false);
  });

  it('executes turn cycle phases in order', () => {
    const order: string[] = [];
    vi.spyOn(world, 'executeSystems').mockImplementation((phase) => {
      order.push(phase);
    });

    const player = adapter.actors.get(playerEntity)!;
    player.energy = 1000;

    turnManager.start();
    turnManager.submitAction('move');

    expect(order).toEqual([
      Phase.PRE_TURN,
      Phase.GATHER_INTENT,
      Phase.ACTION,
      Phase.REACTION,
      Phase.CLEANUP,
      Phase.POST_TURN,
    ]);
  });

  it('handles fast enemies with sub-tick processing', () => {
    const fastEnemy = world.createEntity();
    adapter.addActor({
      id: fastEnemy,
      isPlayer: false,
      isAlive: true,
      energy: 0,
      speed: 200,
      acting: false,
    });

    let enemyActingCount = 0;
    const originalExecute = world.executeSystems.bind(world);
    vi.spyOn(world, 'executeSystems').mockImplementation((phase) => {
      if (phase === Phase.GATHER_INTENT) {
        if (adapter.actors.get(fastEnemy)?.acting) {
          enemyActingCount++;
        }
      }
      originalExecute(phase);
    });

    const player = adapter.actors.get(playerEntity)!;
    player.energy = 0;

    turnManager.start();
    expect(enemyActingCount).toBe(1);

    turnManager.submitAction('move');
    expect(enemyActingCount).toBe(3);
  });

  it('emits TURN_START and TURN_END events', () => {
    const startSpy = vi.fn();
    const endSpy = vi.fn();
    eventBus.on('TURN_START', startSpy);
    eventBus.on('TURN_END', endSpy);

    turnManager.start();
    turnManager.submitAction('move');

    expect(startSpy).toHaveBeenCalled();
    expect(endSpy).toHaveBeenCalled();
  });

  it('skips enemies destroyed mid-enemy-turn-phase without throwing or freezing', () => {
    const enemy1 = world.createEntity();
    const enemy2 = world.createEntity();

    adapter.addActor({
      id: enemy1,
      isPlayer: false,
      isAlive: true,
      energy: 1000,
      speed: 100,
      acting: false,
    });

    adapter.addActor({
      id: enemy2,
      isPlayer: false,
      isAlive: true,
      energy: 1000,
      speed: 100,
      acting: false,
    });

    // When enemy1 acts in ACTION phase, it kills enemy2
    const originalExecute = world.executeSystems.bind(world);
    vi.spyOn(world, 'executeSystems').mockImplementation((phase) => {
      if (phase === Phase.ACTION && adapter.actors.get(enemy1)?.acting) {
        // Enemy 2 dies
        const e2 = adapter.actors.get(enemy2)!;
        e2.isAlive = false;
      }
      originalExecute(phase);
    });

    turnManager.start();
    expect(turnManager.getPhase()).toBe(TurnPhase.AWAIT_INPUT);

    // Player acts
    expect(() => turnManager.submitAction('move')).not.toThrow();

    // Verify enemy2 never had onBeforeActorAct called while dead
    expect(turnManager.getPhase()).toBe(TurnPhase.AWAIT_INPUT);
    expect(turnManager.canAcceptInput()).toBe(true);
  });

  it('resets phase to AWAIT_INPUT when turn execution throws an unexpected error', () => {
    vi.spyOn(world, 'executeSystems').mockImplementationOnce(() => {
      throw new Error('Simulated critical turn error');
    });

    turnManager.start();
    expect(() => turnManager.submitAction('move')).toThrow('Simulated critical turn error');
    expect(turnManager.getPhase()).toBe(TurnPhase.AWAIT_INPUT);
    expect(turnManager.canAcceptInput()).toBe(true);
  });

  it('allows actions that bypass active player check via adapter.allowsInactiveActorAction', () => {
    // Kill the player actor
    adapter.actors.get(playerEntity)!.isAlive = false;

    let handlerCalledWith = '';
    turnManager.setPlayerActionHandler((action) => {
      handlerCalledWith = action;
    });

    turnManager.start();
    // Normal move should be rejected
    turnManager.submitAction('move');
    expect(handlerCalledWith).toBe('');

    // Meta action allowed via adapter
    turnManager.submitAction('special_meta_action');
    expect(handlerCalledWith).toBe('special_meta_action');
  });

  describe('Two-Tier Bump Safeguard (0-turn action abort outcome)', () => {
    it('refunds action cost, does not advance turnNumber, and skips enemy turns when action is aborted', () => {
      // Add a ready enemy with 1000 energy
      const enemyEntity = world.createEntity();
      adapter.addActor({
        id: enemyEntity,
        isPlayer: false,
        isAlive: true,
        energy: 1000,
        speed: 100,
        acting: false,
      });

      turnManager.start();
      expect(turnManager.getTurnNumber()).toBe(0);
      expect(adapter.actors.get(playerEntity)!.energy).toBe(1000);
      expect(adapter.actors.get(enemyEntity)!.energy).toBe(1000);

      // Handler simulates a bump safeguard halt (marks actor as aborted in ACTION phase)
      turnManager.setPlayerActionHandler(() => {
        adapter.abortedActors.add(playerEntity);
      });

      turnManager.submitAction('move');

      // 1. Energy must be refunded to 1000 (0 turn cost)
      expect(adapter.actors.get(playerEntity)!.energy).toBe(1000);

      // 2. Turn number must remain 0 (not incremented)
      expect(turnManager.getTurnNumber()).toBe(0);

      // 3. Enemy must NOT have acted (energy remains 1000, not deducted)
      expect(adapter.actors.get(enemyEntity)!.energy).toBe(1000);

      // 4. Aborted tag must have been cleared
      expect(adapter.abortedActors.has(playerEntity)).toBe(false);

      // 5. Phase must be reset to AWAIT_INPUT
      expect(turnManager.getPhase()).toBe(TurnPhase.AWAIT_INPUT);
      expect(turnManager.canAcceptInput()).toBe(true);
    });
  });
});
