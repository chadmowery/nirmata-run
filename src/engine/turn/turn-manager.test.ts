import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../ecs/world';
import { EventBus } from '../events/event-bus';
import { EngineEvents } from '../events/types';
import { TurnManager } from './turn-manager';
import { TurnPhase, ENERGY_THRESHOLD } from './types';
import { Actor, Energy, Health, Acting } from '@shared/components';
import { Phase } from '../ecs/types';
import { GameAction } from '../../game/input/actions';

describe('TurnManager', () => {
  let world: World;
  let eventBus: EventBus<EngineEvents>;
  let turnManager: TurnManager;
  let playerEntity: number;

  const config = {
    energyThreshold: ENERGY_THRESHOLD,
    defaultActionCost: 1000,
    waitActionCost: 500,
  };

  beforeEach(() => {
    eventBus = new EventBus<EngineEvents>();
    world = new World(eventBus);
    turnManager = new TurnManager(world, eventBus, config);

    playerEntity = world.createEntity();
    world.addComponent(playerEntity, Actor, { isPlayer: true });
    world.addComponent(playerEntity, Energy, { current: 0, speed: 100, threshold: config.energyThreshold });
  });

  it('starts at AWAIT_INPUT phase after start()', () => {
    turnManager.start();
    expect(turnManager.getPhase()).toBe(TurnPhase.AWAIT_INPUT);
    expect(turnManager.canAcceptInput()).toBe(true);
  });

  it('accumulates energy during start() if player not ready', () => {
    const energy = world.getComponent(playerEntity, Energy)!;
    world.addComponent(playerEntity, Energy, { ...energy, current: 0 });

    turnManager.start();

    // 10 ticks of 100 speed = 1000 threshold
    const updatedEnergy = world.getComponent(playerEntity, Energy)!;
    expect(updatedEnergy.current).toBeGreaterThanOrEqual(config.energyThreshold);
  });

  it('gating: ignores submitAction when not in AWAIT_INPUT', () => {
    // Manually set phase to something else
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
    const updatedEnergy = world.getComponent(playerEntity, Energy)!;
    expect(updatedEnergy.current).toBe(0); // 1000 - 1000 cost
  });

  it('deducts half cost for wait action', () => {
    turnManager.start();
    
    const energy = world.getComponent(playerEntity, Energy)!;
    world.addComponent(playerEntity, Energy, { ...energy, current: 1000 });
    
    turnManager.setPlayerActionHandler(() => {
      turnManager.pause();
    });
    
    turnManager.submitAction(GameAction.WAIT);

    const updatedEnergy = world.getComponent(playerEntity, Energy)!;
    expect(updatedEnergy.current).toBe(500); // 1000 - 500 cost
  });

  it('processes enemy turns deterministically (ID order)', () => {
    const enemy1 = world.createEntity(); // ID 2
    world.addComponent(enemy1, Actor, { isPlayer: false });
    world.addComponent(enemy1, Energy, { current: 1000, speed: 100, threshold: config.energyThreshold });

    const enemy2 = world.createEntity(); // ID 3
    world.addComponent(enemy2, Actor, { isPlayer: false });
    world.addComponent(enemy2, Energy, { current: 1000, speed: 100, threshold: config.energyThreshold });

    const playerEnergy = world.getComponent(playerEntity, Energy)!;
    world.addComponent(playerEntity, Energy, { ...playerEnergy, current: 1000 });

    // Mock executeSystems to capture when enemies get the Acting tag
    const actingEnemies: number[] = [];
    const originalExecute = world.executeSystems.bind(world);
    vi.spyOn(world, 'executeSystems').mockImplementation((phase) => {
      if (phase === Phase.GATHER_INTENT) {
        const acting = world.query(Acting);
        actingEnemies.push(...acting);
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
    world.addComponent(enemy, Actor, { isPlayer: false });
    world.addComponent(enemy, Energy, { current: 1000, speed: 100, threshold: config.energyThreshold });
    world.addComponent(enemy, Health, Health.schema.parse({ current: 0, max: 10, isAlive: false }));

    const playerEnergy = world.getComponent(playerEntity, Energy)!;
    world.addComponent(playerEntity, Energy, { ...playerEnergy, current: 1000 });

    let actingEnemyFound = false;
    const originalExecute = world.executeSystems.bind(world);
    vi.spyOn(world, 'executeSystems').mockImplementation((phase) => {
      if (phase === Phase.GATHER_INTENT) {
        if (world.hasComponent(enemy, Acting)) {
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

    const playerEnergy = world.getComponent(playerEntity, Energy)!;
    world.addComponent(playerEntity, Energy, { ...playerEnergy, current: 1000 });

    turnManager.start();
    turnManager.submitAction('move');

    // pre-turn -> gather-intent -> action -> reaction -> cleanup -> post-turn
    expect(order).toEqual([
      Phase.PRE_TURN,
      Phase.GATHER_INTENT,
      Phase.ACTION,
      Phase.REACTION,
      Phase.CLEANUP,
      Phase.POST_TURN
    ]);
  });

  it('handles fast enemies with sub-tick processing', () => {
    // Player speed 100
    // Enemy speed 200
    const fastEnemy = world.createEntity();
    world.addComponent(fastEnemy, Actor, { isPlayer: false });
    world.addComponent(fastEnemy, Energy, { current: 0, speed: 200, threshold: config.energyThreshold });

    let enemyActingCount = 0;
    const originalExecute = world.executeSystems.bind(world);
    vi.spyOn(world, 'executeSystems').mockImplementation((phase) => {
      if (phase === Phase.GATHER_INTENT) {
        if (world.hasComponent(fastEnemy, Acting)) {
          enemyActingCount++;
        }
      }
      originalExecute(phase);
    });

    const playerEnergy = world.getComponent(playerEntity, Energy)!;
    world.addComponent(playerEntity, Energy, { ...playerEnergy, current: 0 });

    turnManager.start(); 
    // Player speed 100, Enemy speed 200.
    // 5 ticks of 200 = 1000 for enemy. 5 ticks of 100 = 500 for player.
    // enemyActingCount should be 1 after start()
    expect(enemyActingCount).toBe(1);

    turnManager.submitAction('move'); 
    // AdvanceUntilPlayerReady will tick 10 times to reach 1000 for player.
    // Enemy reaches 1000 at tick 5 and tick 10.
    // enemyActingCount should be 1 (start) + 2 (during advanceUntilPlayerReady) = 3.
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
});
