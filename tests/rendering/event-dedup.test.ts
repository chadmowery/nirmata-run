import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pixi.js
vi.mock('pixi.js', () => {
  return {
    Application: vi.fn(),
    Ticker: vi.fn(),
    Graphics: vi.fn().mockImplementation(function () {
      return {
        clear: vi.fn(),
        rect: vi.fn(),
        stroke: vi.fn(),
      };
    }),
    Sprite: vi.fn().mockImplementation(() => ({
      x: 0,
      y: 0,
      width: 32,
      height: 32,
    })),
    Container: vi.fn().mockImplementation(() => ({
      addChild: vi.fn(),
      removeChild: vi.fn(),
    })),
    Texture: { from: vi.fn() },
    Assets: { get: vi.fn() },
    Text: vi.fn(),
    TextStyle: vi.fn(),
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
import { EventOriginContext } from '../../src/engine/utils/event-context';
import { queueMoveTween } from '../../src/rendering/animations';

describe('RenderSystem Event Deduplication (Phase 2)', () => {
  let world: World<GameEvents>;
  let eventBus: EventBus<GameEvents>;
  let grid: Grid;
  let playerId: number;
  let enemyId: number;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new EventBus<GameEvents>();
    world = new World<GameEvents>(eventBus);
    grid = new Grid(10, 10);
    playerId = 1;
    enemyId = 2;
    EventOriginContext.current = 'client';

    const mockLayers: any = {
      worldContainer: { x: 0, y: 0 },
      effectsLayer: { addChild: vi.fn() },
      entityLayer: { addChild: vi.fn() },
    };

    const mockApp: any = {
      ticker: { add: vi.fn() },
    };

    const renderSystem = createRenderSystem({
      app: mockApp,
      layers: mockLayers,
      world,
      eventBus,
      getGrid: () => grid,
      getPlayerEntity: () => playerId,
      lightPasses: () => true,
    });

    renderSystem.init();
  });

  it('skips duplicate move tween when server confirms predicted player movement', () => {
    // 1. Client prediction: player moves (1, 1) -> (2, 1)
    EventOriginContext.current = 'client';
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 1,
      fromY: 1,
      toX: 2,
      toY: 1,
    });
    eventBus.flush();

    expect(queueMoveTween).toHaveBeenCalledTimes(1);
    expect(queueMoveTween).toHaveBeenCalledWith(playerId, 1, 1, 2, 1, expect.any(Function));

    // 2. Server reconciliation arrives with matching ENTITY_MOVED
    EventOriginContext.current = 'server';
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 1,
      fromY: 1,
      toX: 2,
      toY: 1,
    });
    eventBus.flush();

    // queueMoveTween should NOT have been called a second time!
    expect(queueMoveTween).toHaveBeenCalledTimes(1);
  });

  it('always executes move tween for non-predicted entities (enemies)', () => {
    // Server delivers enemy movement
    EventOriginContext.current = 'server';
    eventBus.emit('ENTITY_MOVED', {
      entityId: enemyId,
      fromX: 5,
      fromY: 5,
      toX: 5,
      toY: 6,
    });
    eventBus.flush();

    expect(queueMoveTween).toHaveBeenCalledTimes(1);
    expect(queueMoveTween).toHaveBeenCalledWith(enemyId, 5, 5, 5, 6, expect.any(Function));
  });

  it('corrects player position if server moves player to a different tile than predicted', () => {
    // 1. Client predicted move to (2, 1)
    EventOriginContext.current = 'client';
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 1,
      fromY: 1,
      toX: 2,
      toY: 1,
    });
    eventBus.flush();
    expect(queueMoveTween).toHaveBeenCalledTimes(1);

    // 2. Server says player was pushed to (1, 2) instead (e.g. trap or knockback)
    EventOriginContext.current = 'server';
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 1,
      fromY: 1,
      toX: 1,
      toY: 2,
    });
    eventBus.flush();

    // Since it diverged from prediction, queueMoveTween IS called for the correction!
    expect(queueMoveTween).toHaveBeenCalledTimes(2);
    expect(queueMoveTween).toHaveBeenLastCalledWith(playerId, 1, 1, 1, 2, expect.any(Function));
  });
});
