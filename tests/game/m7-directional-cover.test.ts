import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import {
  Position,
  InteractiveSurface,
  Shell,
} from '@shared/components';
import { checkDirectionalCover, bresenhamLine } from '../../src/game/systems/combat';

describe('M7: Raycasted Directional Cover Invariants', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let attacker: number;
  let defender: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(20, 20);

    attacker = world.createEntity();
    world.addComponent(attacker, Position, { x: 5, y: 10 });
    grid.addEntity(attacker, 5, 10);

    defender = world.createEntity();
    world.addComponent(defender, Position, { x: 5, y: 5 });
    grid.addEntity(defender, 5, 5);
  });

  it('bresenhamLine traces points from start to end inclusively', () => {
    const line = bresenhamLine(0, 0, 0, 3);
    expect(line).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
    ]);
  });

  it('detects intervening orthogonal cover along raycast trajectory', () => {
    // Cover placed at (5, 6) directly in front of defender on the ray from (5, 10)
    const cover = world.createEntity();
    world.addComponent(cover, Position, { x: 5, y: 6 });
    world.addComponent(cover, InteractiveSurface, {
      surfaceId: 'crate_1',
      providesCover: true,
      coverDamageReduction: 0.25,
    });
    grid.addEntity(cover, 5, 6);

    const result = checkDirectionalCover(world, attacker, defender, grid);
    expect(result.hasCover).toBe(true);
    expect(result.reduction).toBe(0.25);
    expect(result.coverId).toBe(cover);
  });

  it('does NOT grant cover if surface is not intervening along attack path', () => {
    // Cover placed at (5, 4) behind defender relative to attacker at y=10
    const cover = world.createEntity();
    world.addComponent(cover, Position, { x: 5, y: 4 });
    world.addComponent(cover, InteractiveSurface, {
      surfaceId: 'crate_behind',
      providesCover: true,
      coverDamageReduction: 0.25,
    });
    grid.addEntity(cover, 5, 4);

    const result = checkDirectionalCover(world, attacker, defender, grid);
    expect(result.hasCover).toBe(false);
  });

  it('takes Math.max for Bastion override rather than downgrading high-tier cover', () => {
    // High-tier reinforced barrier with 0.50 cover reduction
    const cover = world.createEntity();
    world.addComponent(cover, Position, { x: 5, y: 6 });
    world.addComponent(cover, InteractiveSurface, {
      surfaceId: 'reinforced_cover',
      providesCover: true,
      coverDamageReduction: 0.5,
    });
    grid.addEntity(cover, 5, 6);

    // Defender has Bastion shell (baseline 0.35)
    world.addComponent(defender, Shell, {
      archetypeId: 'bastion-v1',
      speed: 80,
      stability: 100,
      armor: 3,
      maxHealth: 100,
    });

    const result = checkDirectionalCover(world, attacker, defender, grid);
    expect(result.hasCover).toBe(true);
    // Should take Math.max(0.35, 0.50) = 0.50, NOT downgrade to 0.35!
    expect(result.reduction).toBe(0.5);
  });
});
