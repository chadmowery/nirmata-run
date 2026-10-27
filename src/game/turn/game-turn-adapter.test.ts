import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EngineEvents } from '@engine/events/types';
import { Actor, Energy, Health, Acting } from '@shared/components';
import { GameTurnAdapter } from './game-turn-adapter';

describe('GameTurnAdapter', () => {
  let world: World<EngineEvents>;
  let adapter: GameTurnAdapter<EngineEvents>;

  beforeEach(() => {
    const eventBus = new EventBus<EngineEvents>();
    world = new World(eventBus);
    adapter = new GameTurnAdapter(world, {
      defaultActionCost: 1000,
      waitActionCost: 500,
    });
  });

  it('identifies candidate actors queried by Actor and Energy', () => {
    const p = world.createEntity();
    world.addComponent(p, Actor, { isPlayer: true });
    world.addComponent(p, Energy, { current: 1000, speed: 100, threshold: 1000 });

    const e = world.createEntity();
    world.addComponent(e, Actor, { isPlayer: false });
    world.addComponent(e, Energy, { current: 500, speed: 100, threshold: 1000 });

    const other = world.createEntity(); // No Actor/Energy

    const candidates = adapter.getCandidateActors();
    expect(candidates).toContain(p);
    expect(candidates).toContain(e);
    expect(candidates).not.toContain(other);
  });

  it('checks if actor is active based on Health component', () => {
    const aliveEntity = world.createEntity();
    world.addComponent(
      aliveEntity,
      Health,
      Health.schema.parse({ current: 10, max: 10, isAlive: true }),
    );

    const deadEntity = world.createEntity();
    world.addComponent(
      deadEntity,
      Health,
      Health.schema.parse({ current: 0, max: 10, isAlive: false }),
    );

    const noHealthEntity = world.createEntity();

    expect(adapter.isActorActive(aliveEntity)).toBe(true);
    expect(adapter.isActorActive(deadEntity)).toBe(false);
    expect(adapter.isActorActive(noHealthEntity)).toBe(true);
  });

  it('checks if actor can act based on energy threshold', () => {
    const ready = world.createEntity();
    world.addComponent(ready, Energy, { current: 1000, speed: 100, threshold: 1000 });

    const notReady = world.createEntity();
    world.addComponent(notReady, Energy, { current: 999, speed: 100, threshold: 1000 });

    expect(adapter.canActorAct(ready, 1000)).toBe(true);
    expect(adapter.canActorAct(notReady, 1000)).toBe(false);
  });

  it('accumulates energy based on speed', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Energy, { current: 200, speed: 150, threshold: 1000 });

    adapter.accumulateEnergy(entity);

    const energy = world.getComponent(entity, Energy);
    expect(energy?.current).toBe(350);
  });

  it('deducts action cost correctly', () => {
    const entity = world.createEntity();
    world.addComponent(entity, Energy, { current: 1000, speed: 100, threshold: 1000 });

    adapter.deductActionCost(entity, 400);

    const energy = world.getComponent(entity, Energy);
    expect(energy?.current).toBe(600);
  });

  it('identifies primary player actor', () => {
    const player = world.createEntity();
    world.addComponent(player, Actor, { isPlayer: true });

    const enemy = world.createEntity();
    world.addComponent(enemy, Actor, { isPlayer: false });

    expect(adapter.isPrimaryActor(player)).toBe(true);
    expect(adapter.isPrimaryActor(enemy)).toBe(false);
    expect(adapter.getPrimaryActor()).toBe(player);
  });

  it('returns appropriate action costs', () => {
    const entity = world.createEntity();
    expect(adapter.getActionCost(entity, 'WAIT')).toBe(500);
    expect(adapter.getActionCost(entity, 'MOVE')).toBe(1000);
  });

  it('attaches Acting component before acting and removes it after acting', () => {
    const entity = world.createEntity();

    expect(world.hasComponent(entity, Acting)).toBe(false);

    adapter.onBeforeActorAct(entity);
    expect(world.hasComponent(entity, Acting)).toBe(true);

    adapter.onAfterActorAct(entity);
    expect(world.hasComponent(entity, Acting)).toBe(false);
  });
});
