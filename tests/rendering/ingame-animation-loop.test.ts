import { describe, it, expect, vi, beforeEach } from 'vitest';

const textureStore = new Map<string, any>();
function getOrCreateTexture(key: string) {
  if (!textureStore.has(key)) {
    textureStore.set(key, { key, width: 32, height: 32 });
  }
  return textureStore.get(key);
}

// Mock PixiJS
vi.mock('pixi.js', () => {
  const Sprite = vi.fn().mockImplementation(function (initialTexture?: any) {
    let currentTexture = initialTexture ?? getOrCreateTexture('default');
    return {
      x: 0,
      y: 0,
      width: 32,
      height: 32,
      pivot: { set: vi.fn() },
      scale: { set: vi.fn() },
      get texture() {
        return currentTexture;
      },
      set texture(val: any) {
        currentTexture = val;
      },
      removeFromParent: vi.fn(),
      destroy: vi.fn(),
    };
  });

  const Container = vi.fn().mockImplementation(function () {
    return {
      x: 0,
      y: 0,
      scale: { set: vi.fn() },
      addChild: vi.fn(),
      removeChild: vi.fn(),
      filters: [],
    };
  });

  const Graphics = vi.fn().mockImplementation(function () {
    return {
      clear: vi.fn(),
      lineStyle: vi.fn(),
      beginFill: vi.fn(),
      drawRect: vi.fn(),
      drawCircle: vi.fn(),
      endFill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
    };
  });

  const Texture = {
    EMPTY: { width: 0, height: 0 },
    from: vi.fn((key: string) => getOrCreateTexture(key)),
  };

  return {
    Application: vi.fn(),
    Sprite,
    Container,
    Graphics,
    Texture,
    Assets: {
      get: vi.fn().mockReturnValue(null),
    },
    Ticker: vi.fn(),
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
  hasActiveAnimation: vi.fn().mockReturnValue(false),
}));

import { createRenderSystem } from '../../src/rendering/render-system';
import { World } from '../../src/engine/ecs/world';
import { EventBus } from '../../src/engine/events/event-bus';
import { GameEvents } from '../../src/game/events/types';
import { Grid } from '../../src/engine/grid/grid';
import { Position } from '../../src/shared/components/position';
import { SpriteComponent } from '../../src/shared/components/sprite';
import { Actor } from '../../src/shared/components/actor';
import { Prop } from '../../src/shared/components/environment';
import {
  clearAllSprites,
  getEntitySprite,
} from '../../src/rendering/sprite-map';
import { spriteAnimator } from '../../src/rendering/sprite-animator';
import { EventOriginContext } from '../../src/engine/utils/event-context';

describe('In-Game Animation Loop & Event Trigger Integration', () => {
  let world: World<GameEvents>;
  let eventBus: EventBus<GameEvents>;
  let grid: Grid;
  let renderSystem: ReturnType<typeof createRenderSystem>;
  let tickerCallbacks: ((ticker: { deltaMS: number }) => void)[] = [];
  const playerId = 1;
  const enemyId = 2;

  beforeEach(() => {
    vi.clearAllMocks();
    textureStore.clear();
    clearAllSprites();
    spriteAnimator.clear();
    spriteAnimator.setCustomManifest(null);
    tickerCallbacks = [];
    EventOriginContext.current = 'client';

    eventBus = new EventBus<GameEvents>();
    world = new World<GameEvents>(eventBus);
    grid = new Grid(20, 20);

    const mockLayers: any = {
      worldContainer: { x: 0, y: 0, scale: { set: vi.fn() }, filters: [] },
      terrainLayer: { addChild: vi.fn() },
      entityLayer: { addChild: vi.fn() },
      effectsLayer: { addChild: vi.fn() },
    };

    const mockApp: any = {
      ticker: {
        add: vi.fn((cb) => {
          tickerCallbacks.push(cb);
        }),
      },
    };

    // Setup player entity
    const pId = world.createEntity();
    world.addComponent(pId, Position, { x: 5, y: 5 });
    world.addComponent(pId, SpriteComponent, { key: 'player_vanguard' });
    world.addComponent(pId, Actor, { isPlayer: true });

    // Setup enemy entity
    const eId = world.createEntity();
    world.addComponent(eId, Position, { x: 6, y: 5 });
    world.addComponent(eId, SpriteComponent, { key: 'enemy_null_pointer' });
    world.addComponent(eId, Actor, { isPlayer: false });

    renderSystem = createRenderSystem({
      app: mockApp,
      layers: mockLayers,
      world,
      eventBus,
      getGrid: () => grid,
      getPlayerEntity: () => pId,
      lightPasses: () => true,
    });

    renderSystem.init();
  });

  const simulateGameTick = (deltaMs: number) => {
    // 1. PixiJS updateCameraFrame ticker
    for (const cb of tickerCallbacks) {
      cb({ deltaMS: deltaMs });
    }
    // 2. Client page.tsx ticker calling renderSystem()
    renderSystem.renderSystem();
  };

  it('idle ambient animation advances frames and is NOT clobbered by the render loop', () => {
    const playerSprite = getEntitySprite(playerId);
    expect(playerSprite).toBeDefined();

    // Initial frame should be player_vanguard
    expect((playerSprite!.texture as any).key).toBe('player_vanguard');

    // Simulate 550ms: player_vanguard idle frame 0 is 550ms
    simulateGameTick(500);
    expect((playerSprite!.texture as any).key).toBe('player_vanguard');

    // Ticking past 550ms (e.g. +100ms = 600ms total) should transition to player_vanguard_idle_1
    simulateGameTick(100);
    expect((playerSprite!.texture as any).key).toBe('player_vanguard_idle_1');

    // Continuous frames in page.tsx render loop should preserve the animated texture!
    simulateGameTick(16);
    simulateGameTick(16);
    expect((playerSprite!.texture as any).key).toBe('player_vanguard_idle_1');

    // At 800ms total cycle (550 + 250), it wraps back to player_vanguard
    simulateGameTick(200);
    expect((playerSprite!.texture as any).key).toBe('player_vanguard');
  });

  it('ENTITY_MOVED triggers move animation and is preserved during render loop', () => {
    const playerSprite = getEntitySprite(playerId);

    // Initial idle state
    simulateGameTick(16);

    // Player moves right (5,5) -> (6,5)
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 5,
      fromY: 5,
      toX: 6,
      toY: 5,
    });
    eventBus.flush();

    // Verify SpriteAnimator has transientState = 'move'
    const animState = spriteAnimator.getEntityState(playerId);
    expect(animState?.transientState).toBe('move');

    // Tick into move animation (move clip: fps 12 -> ~83ms per frame, frames: ['player_vanguard_idle_1', 'player_vanguard'])
    simulateGameTick(20);
    expect((playerSprite!.texture as any).key).toBe('player_vanguard_idle_1');

    // Repeated render ticks must not wipe the move frame back to static base
    simulateGameTick(16);
    simulateGameTick(16);
    expect((playerSprite!.texture as any).key).toBe('player_vanguard_idle_1');
  });

  it('DAMAGE_DEALT triggers attack animation for attacker and hit animation for defender', () => {
    const playerSprite = getEntitySprite(playerId);
    const enemySprite = getEntitySprite(enemyId);

    // Initial tick
    simulateGameTick(16);

    // Player hits enemy
    eventBus.emit('DAMAGE_DEALT', {
      attackerId: playerId,
      defenderId: enemyId,
      amount: 3,
    });
    eventBus.flush();

    // Attacker should be in attack state; Defender in hit state
    expect(spriteAnimator.getEntityState(playerId)?.transientState).toBe('attack');
    expect(spriteAnimator.getEntityState(enemyId)?.transientState).toBe('hit');

    // Tick into combat frames
    // player_vanguard attack: frames: ['player_vanguard_atk_1', 'player_vanguard']
    // enemy_null_pointer hit: frames: ['enemy_null_pointer', 'enemy_null_pointer_atk_1']
    simulateGameTick(20);
    expect((playerSprite!.texture as any).key).toBe('player_vanguard_atk_1');

    // Next render ticks must preserve attack frame
    simulateGameTick(16);
    expect((playerSprite!.texture as any).key).toBe('player_vanguard_atk_1');
  });

  it('PROP_INTERACTED triggers interact animation on interactive environment props', () => {
    const propId = world.createEntity();
    world.addComponent(propId, Position, { x: 4, y: 5 });
    world.addComponent(propId, SpriteComponent, { key: 'prop_workstation_n' });
    world.addComponent(propId, Prop, {
      propId: 'ws_1',
      faction: 'traxus',
      propClass: 'workstation',
      isSearched: false,
    });

    renderSystem.reconcileSprites();
    const propSprite = getEntitySprite(propId);
    expect(propSprite).toBeDefined();

    // Interact with prop
    eventBus.emit('PROP_INTERACTED', {
      entityId: propId,
      propId,
      propClass: 'workstation',
    });
    eventBus.flush();

    expect(spriteAnimator.getEntityState(propId)?.transientState).toBe('interact');
  });
});
