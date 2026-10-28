import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock PixiJS
vi.mock('pixi.js', () => {
  const Sprite = vi.fn().mockImplementation(function () {
    return {
      x: 0,
      y: 0,
      width: 32,
      height: 32,
      removeFromParent: vi.fn(),
      destroy: vi.fn(),
    };
  });
  const Container = vi.fn().mockImplementation(function () {
    return {
      addChild: vi.fn(),
      removeChild: vi.fn(),
    };
  });
  const Graphics = vi.fn().mockImplementation(function () {
    return {
      clear: vi.fn(),
      rect: vi.fn(),
      stroke: vi.fn(),
    };
  });
  const Texture = {
    from: vi.fn().mockReturnValue({ width: 32, height: 32 }),
  };
  return {
    Sprite,
    Container,
    Graphics,
    Texture,
    Assets: { get: vi.fn() },
    Text: vi.fn(),
    TextStyle: vi.fn(),
    Ticker: vi.fn(),
  };
});

// Mock animations
vi.mock('../../src/rendering/animations', () => ({
  tickAnimations: vi.fn(),
  queueMoveTween: vi.fn(),
  queueAttackAnimationWithDefender: vi.fn(),
  queueDeathAnimation: vi.fn(),
  clearAnimations: vi.fn(),
  hasActiveAnimation: vi.fn(),
}));

import { createRenderSystem } from '../../src/rendering/render-system';
import { World } from '../../src/engine/ecs/world';
import { EventBus } from '../../src/engine/events/event-bus';
import { GameEvents } from '../../src/game/events/types';
import { Grid } from '../../src/engine/grid/grid';
import { SpriteComponent } from '../../src/shared/components/sprite';
import { Position } from '../../src/shared/components/position';
import {
  getEntitySprite,
  getSpriteCount,
  clearAllSprites,
} from '../../src/rendering/sprite-map';

describe('Sprite Reconciliation & Ghost Purging (Phase 3)', () => {
  let world: World<GameEvents>;
  let eventBus: EventBus<GameEvents>;
  let grid: Grid;
  let renderSystem: ReturnType<typeof createRenderSystem>;
  let mockLayers: any;

  beforeEach(() => {
    vi.clearAllMocks();
    clearAllSprites();

    eventBus = new EventBus<GameEvents>();
    world = new World<GameEvents>(eventBus);
    grid = new Grid(10, 10);

    mockLayers = {
      worldContainer: { x: 0, y: 0 },
      effectsLayer: { addChild: vi.fn() },
      entityLayer: { addChild: vi.fn() },
    };

    const mockApp: any = {
      ticker: { add: vi.fn() },
    };

    renderSystem = createRenderSystem({
      app: mockApp,
      layers: mockLayers,
      world,
      eventBus,
      getGrid: () => grid,
      getPlayerEntity: () => 1,
      lightPasses: () => true,
    });

    renderSystem.init();
  });

  it('purges orphaned ghost sprites when entities are deleted without ENTITY_DESTROYED event', () => {
    // 1. Entity exists and has a sprite created via ENTITY_CREATED
    const enemyId = world.createEntity();
    world.addComponent(enemyId, SpriteComponent, { key: 'enemy' });
    world.addComponent(enemyId, Position, { x: 3, y: 3 });

    eventBus.emit('ENTITY_CREATED', { entityId: enemyId });
    eventBus.flush();
    expect(getEntitySprite(enemyId)).toBeDefined();
    expect(getSpriteCount()).toBe(1);

    // 2. Silently remove entity from world (simulating delta sync dropping entity without lifecycle event)
    world.destroyEntity(enemyId);

    // 3. Trigger reconciliation
    eventBus.emit('STATE_RECONCILED', { turnNumber: 2, playerId: 1 });
    eventBus.flush();

    // 4. Ghost sprite must be purged
    expect(getEntitySprite(enemyId)).toBeUndefined();
    expect(getSpriteCount()).toBe(0);
  });

  it('automatically materializes missing sprites for newly reconciled entities', () => {
    expect(getSpriteCount()).toBe(0);

    // Entity exists in ECS but was never passed to ENTITY_CREATED
    const newItemId = world.createEntity();
    world.addComponent(newItemId, SpriteComponent, { key: 'item' });
    world.addComponent(newItemId, Position, { x: 4, y: 4 });

    // Trigger reconciliation
    eventBus.emit('STATE_RECONCILED', { turnNumber: 3, playerId: 1 });
    eventBus.flush();

    // Sprite should be created automatically
    expect(getEntitySprite(newItemId)).toBeDefined();
    expect(getSpriteCount()).toBe(1);
  });
});
