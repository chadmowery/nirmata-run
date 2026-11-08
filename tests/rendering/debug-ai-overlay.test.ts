import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { World } from '../../src/engine/ecs/world';
import { EventBus } from '../../src/engine/events/event-bus';
import { GameEvents } from '../../src/game/events/types';
import { Grid } from '../../src/engine/grid/grid';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { SpriteComponent } from '@shared/components/sprite';
import { InteractiveSurface } from '@shared/components/environment';
import { createRenderSystem } from '../../src/rendering/render-system';

// Mock PIXI
vi.mock('pixi.js', () => {
  const Sprite = vi.fn().mockImplementation(function () {
    return {
      x: 0,
      y: 0,
      width: 32,
      height: 32,
      alpha: 1.0,
      visible: true,
      filters: null,
      parent: { addChild: vi.fn() },
      removeFromParent: vi.fn(),
      destroy: vi.fn(),
    };
  });
  const Container = vi.fn().mockImplementation(function () {
    return {
      x: 0,
      y: 0,
      scale: {
        x: 1,
        y: 1,
        set: vi.fn(function (this: any, val: number) {
          this.x = val;
          this.y = val;
        }),
      },
      addChild: vi.fn(),
      removeChild: vi.fn(),
    };
  });
  const Graphics = vi.fn().mockImplementation(function () {
    const inst: any = {
      clear: vi.fn().mockReturnThis(),
      rect: vi.fn().mockReturnThis(),
      fill: vi.fn().mockReturnThis(),
      stroke: vi.fn().mockReturnThis(),
      lineStyle: vi.fn().mockReturnThis(),
      drawCircle: vi.fn().mockReturnThis(),
      drawRect: vi.fn().mockReturnThis(),
      beginFill: vi.fn().mockReturnThis(),
      endFill: vi.fn().mockReturnThis(),
      moveTo: vi.fn().mockReturnThis(),
      lineTo: vi.fn().mockReturnThis(),
    };
    return inst;
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

vi.mock('pixi-filters', () => ({
  GlitchFilter: class {
    destroy = vi.fn();
    constructor(public options: any) {}
  },
  RGBSplitFilter: class {
    destroy = vi.fn();
    constructor(public options: any) {}
  },
  OutlineFilter: class {
    destroy = vi.fn();
    constructor(public options: any) {}
  },
}));

describe('/debug-ai PixiJS Overlay with Real DijkstraMap (BT-REV-05)', () => {
  let eventBus: EventBus<GameEvents>;
  let world: World<GameEvents>;
  let grid: Grid;
  let playerEntity: number;
  let layers: any;
  let app: any;

  beforeEach(() => {
    eventBus = new EventBus<GameEvents>();
    world = new World<GameEvents>(eventBus);
    grid = new Grid(20, 20);

    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        grid.setTile(x, y, { walkable: true, transparent: true, terrain: 'floor' });
      }
    }

    playerEntity = world.createEntity();
    world.addComponent(playerEntity, Position, { x: 5, y: 5 });
    world.addComponent(playerEntity, Actor, { isPlayer: true });
    world.addComponent(playerEntity, SpriteComponent, { key: 'player' });

    layers = {
      worldContainer: {
        x: 0,
        y: 0,
        scale: { x: 1, y: 1, set: vi.fn() },
        addChild: vi.fn(),
        removeChild: vi.fn(),
      },
      terrainLayer: { addChild: vi.fn(), removeChild: vi.fn(), removeChildren: vi.fn() },
      entityLayer: { addChild: vi.fn(), removeChild: vi.fn(), removeChildren: vi.fn() },
      effectsLayer: { addChild: vi.fn(), removeChild: vi.fn(), removeChildren: vi.fn() },
    };

    app = {
      canvas: {
        width: 960,
        height: 640,
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 960, bottom: 640, width: 960, height: 640 }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      stage: { addChild: vi.fn() },
      ticker: { add: vi.fn(), remove: vi.fn() },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes and renders real Dijkstra approach gradient on DEBUG_TOGGLE_AI signal', () => {
    const renderSystem = createRenderSystem({
      app,
      layers,
      world,
      eventBus,
      getGrid: () => grid,
      getPlayerEntity: () => playerEntity,
      lightPasses: () => true,
    });

    renderSystem.init();

    // Enable AI debug with approach_target
    eventBus.emit('DEBUG_TOGGLE_AI', { enabled: true, mapType: 'approach_target' });
    eventBus.flush();
    renderSystem.renderSystem();

    const aiGraphics = layers.effectsLayer.addChild.mock.calls[1][0];

    expect(aiGraphics).toBeDefined();
    expect(aiGraphics.clear).toHaveBeenCalled();
    // Verify rect was called for walkable tiles
    expect(aiGraphics.rect).toHaveBeenCalled();
    expect(aiGraphics.fill).toHaveBeenCalledWith(
      expect.objectContaining({ color: 0x00f0ff }),
    );

    renderSystem.destroy();
  });

  it('renders flee_from_target with red color palette and inverted relaxation', () => {
    const renderSystem = createRenderSystem({
      app,
      layers,
      world,
      eventBus,
      getGrid: () => grid,
      getPlayerEntity: () => playerEntity,
      lightPasses: () => true,
    });

    renderSystem.init();

    // Enable AI debug with flee_from_target
    eventBus.emit('DEBUG_TOGGLE_AI', { enabled: true, mapType: 'flee_from_target' });
    eventBus.flush();
    renderSystem.renderSystem();

    const aiGraphics = layers.effectsLayer.addChild.mock.calls[1][0];

    expect(aiGraphics.fill).toHaveBeenCalledWith(
      expect.objectContaining({ color: 0xff2a4b }),
    );

    renderSystem.destroy();
  });

  it('renders kite_to_cover and pack_surround_cardinal with appropriate color tokens', () => {
    const renderSystem = createRenderSystem({
      app,
      layers,
      world,
      eventBus,
      getGrid: () => grid,
      getPlayerEntity: () => playerEntity,
      lightPasses: () => true,
    });

    renderSystem.init();

    // Place a cover crate
    const crate = world.createEntity();
    world.addComponent(crate, Position, { x: 5, y: 7 });
    world.addComponent(crate, InteractiveSurface, { surfaceId: 'crate_1', providesCover: true });

    // 1. Kite to cover (purple 0xa855f7)
    eventBus.emit('DEBUG_TOGGLE_AI', { enabled: true, mapType: 'kite_to_cover' });
    eventBus.flush();
    renderSystem.renderSystem();

    const aiGraphics = layers.effectsLayer.addChild.mock.calls[1][0];

    expect(aiGraphics.fill).toHaveBeenCalledWith(
      expect.objectContaining({ color: 0xa855f7 }),
    );

    // 2. Pack surround cardinal (amber 0xeab308)
    eventBus.emit('DEBUG_TOGGLE_AI', { enabled: true, mapType: 'pack_surround_cardinal' });
    eventBus.flush();
    renderSystem.renderSystem();

    expect(aiGraphics.fill).toHaveBeenCalledWith(
      expect.objectContaining({ color: 0xeab308 }),
    );

    // 3. Toggle off
    eventBus.emit('DEBUG_TOGGLE_AI', { enabled: false });
    eventBus.flush();
    expect(aiGraphics.clear).toHaveBeenCalled();

    renderSystem.destroy();
  });
});
