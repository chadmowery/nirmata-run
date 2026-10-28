import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import {
  Actor,
  Position,
  PackMember,
  MovedThisTurn,
  ApplyStatusEffectIntent,
  DamageIntent,
  Dying,
} from '@shared/components';
import { createPackCoordinatorSystem } from '../pack-coordinator';
import { Phase } from '@engine/ecs/types';

describe('PackCoordinatorSystem Unit Tests', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let packSystem: ReturnType<typeof createPackCoordinatorSystem>;
  let playerId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);
    packSystem = createPackCoordinatorSystem(world, grid, eventBus);
    packSystem.init();

    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    grid.addEntity(playerId, 5, 5);
  });

  it('detonates pack when 3+ adjacent members surround the player', () => {
    const messageHandler = vi.fn();
    eventBus.on('MESSAGE_EMITTED', messageHandler);

    // 3 adjacent members belonging to 'pack-alpha'
    const m1 = world.createEntity();
    world.addComponent(m1, Actor, { isPlayer: false });
    world.addComponent(m1, PackMember, { packId: 'pack-alpha', isLeader: false });
    world.addComponent(m1, Position, { x: 5, y: 4 }); // north
    grid.addEntity(m1, 5, 4);

    const m2 = world.createEntity();
    world.addComponent(m2, Actor, { isPlayer: false });
    world.addComponent(m2, PackMember, { packId: 'pack-alpha', isLeader: false });
    world.addComponent(m2, Position, { x: 6, y: 5 }); // east
    grid.addEntity(m2, 6, 5);

    const m3 = world.createEntity();
    world.addComponent(m3, Actor, { isPlayer: false });
    world.addComponent(m3, PackMember, { packId: 'pack-alpha', isLeader: false });
    world.addComponent(m3, Position, { x: 5, y: 6 }); // south
    grid.addEntity(m3, 5, 6);

    // Player or pack member moved this turn
    world.addComponent(playerId, MovedThisTurn, { fromX: 5, fromY: 4, toX: 5, toY: 5 });

    world.executeSystems(Phase.REACTION);
    eventBus.flush();

    // Player should receive MOVEMENT_SLOW intent
    const statusIntent = world.getComponent(playerId, ApplyStatusEffectIntent);
    expect(statusIntent).toBeDefined();
    expect(statusIntent?.effect.name).toBe('MOVEMENT_SLOW');

    // Each member should have attached DamageIntent and be marked Dying
    for (const memberId of [m1, m2, m3]) {
      const damageIntent = world.getComponent(memberId, DamageIntent);
      expect(damageIntent).toBeDefined();
      expect(damageIntent?.targetId).toBe(playerId);
      expect(damageIntent?.amount).toBe(8);

      expect(world.hasComponent(memberId, Dying)).toBe(true);
    }

    expect(messageHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'A Buffer-Overflow pack detonates!',
      }),
    );
  });

  it('does not detonate when fewer than 3 members are adjacent', () => {
    const m1 = world.createEntity();
    world.addComponent(m1, PackMember, { packId: 'pack-beta', isLeader: false });
    world.addComponent(m1, Position, { x: 5, y: 4 });
    grid.addEntity(m1, 5, 4);

    const m2 = world.createEntity();
    world.addComponent(m2, PackMember, { packId: 'pack-beta', isLeader: false });
    world.addComponent(m2, Position, { x: 6, y: 5 });
    grid.addEntity(m2, 6, 5);

    world.addComponent(playerId, MovedThisTurn, { fromX: 5, fromY: 4, toX: 5, toY: 5 });

    world.executeSystems(Phase.REACTION);

    expect(world.hasComponent(playerId, ApplyStatusEffectIntent)).toBe(false);
    expect(world.hasComponent(m1, Dying)).toBe(false);
    expect(world.hasComponent(m2, Dying)).toBe(false);
  });
});
