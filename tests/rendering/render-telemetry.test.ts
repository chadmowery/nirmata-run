import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { World } from '../../src/engine/ecs/world';
import { EventBus } from '../../src/engine/events/event-bus';
import { GameEvents } from '../../src/game/events/types';
import { Grid } from '../../src/engine/grid/grid';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { SpriteComponent } from '@shared/components/sprite';
import { Prop, SecurityLock } from '@shared/components/environment';
import { createRenderSystem, RenderSystem } from '../../src/rendering/render-system';
import { gameStore } from '../../src/game/ui/store';

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
      filters: null,
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

describe('Render Telemetry and Bisection Flags (PERF-02)', () => {
  let eventBus: EventBus<GameEvents>;
  let world: World<GameEvents>;
  let grid: Grid;
  let playerEntity: number;
  let layers: any;
  let app: any;
  let renderSystem: RenderSystem;

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
        filters: null,
      },
      terrainLayer: { addChild: vi.fn(), removeChild: vi.fn() },
      entityLayer: { addChild: vi.fn(), removeChild: vi.fn() },
      effectsLayer: { addChild: vi.fn(), removeChild: vi.fn() },
    };

    app = {
      canvas: {
        width: 800,
        height: 600,
        getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0, right: 800, bottom: 600 }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      ticker: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      stage: {
        addChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };

    renderSystem = createRenderSystem({
      app,
      layers,
      world,
      eventBus,
      getGrid: () => grid,
      getPlayerEntity: () => playerEntity,
      lightPasses: (x, y) => grid.isTransparent(x, y),
    });

    renderSystem.init();
  });

  afterEach(() => {
    renderSystem.destroy();
  });

  it('exposes getRenderTelemetry with stage timings and pool counters', () => {
    renderSystem.setDevRenderFlags({ measureTimings: true });
    renderSystem.renderSystem();

    const telemetry = renderSystem.getRenderTelemetry();
    expect(telemetry).toHaveProperty('stageTimings');
    expect(telemetry.stageTimings).toHaveProperty('fovMs');
    expect(telemetry.stageTimings).toHaveProperty('tilemapMs');
    expect(telemetry.stageTimings).toHaveProperty('spriteSyncMs');
    expect(telemetry.stageTimings).toHaveProperty('totalCpuMs');
    expect(telemetry).toHaveProperty('tilemap');
    expect(telemetry).toHaveProperty('particles');
    expect(telemetry).toHaveProperty('filters');
  });

  it('supports render bisection flags to disable sprite and world filters', () => {
    const propId = world.createEntity();
    world.addComponent(propId, Position, { x: 6, y: 5 });
    world.addComponent(propId, Prop, { propType: 'safe', isSearched: false });
    world.addComponent(propId, SecurityLock, { isLocked: true, accessLevel: 1 });
    world.addComponent(propId, SpriteComponent, { key: 'prop_safe' });

    // Enable bisection flag to disable sprite filters
    renderSystem.setDevRenderFlags({ disableSpriteFilters: true });
    renderSystem.renderSystem();

    const telemetry = renderSystem.getRenderTelemetry();
    expect(telemetry.filters.totalPropFilters).toBe(0);
  });

  it('suppresses hover inspection when cursor is over data-perf-monitor', () => {
    const origElementFromPoint = document.elementFromPoint;
    const fakePerfMonitor = {
      id: 'perf-monitor',
      closest: (selector: string) => (selector === '[data-perf-monitor="true"]' ? fakePerfMonitor : null),
    };
    document.elementFromPoint = vi.fn().mockReturnValue(fakePerfMonitor);

    try {
      // Simulate hover
      const setHoverSpy = vi.spyOn(gameStore.getState(), 'setHoveredEntity');
      renderSystem.renderSystem();
      // Hover check suppresses inspect
      expect(setHoverSpy).not.toHaveBeenCalledWith(expect.objectContaining({ isVisibleInFov: true }));
    } finally {
      document.elementFromPoint = origElementFromPoint;
    }
  });
});
