import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    return {
      clear: vi.fn(),
      rect: vi.fn(),
      stroke: vi.fn(),
      lineStyle: vi.fn(),
      drawCircle: vi.fn(),
      drawRect: vi.fn(),
      beginFill: vi.fn(),
      endFill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
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

// Mock pixi-filters
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
import { Position } from '../../src/shared/components/position';
import { SpriteComponent } from '../../src/shared/components/sprite';
import { Actor } from '../../src/shared/components/actor';
import { Prop, CorruptedNode, SecurityLock } from '../../src/shared/components/environment';
import { gameStore } from '../../src/game/ui/store';
import { setActiveGameContext, getActiveGameContext } from '../../src/game/active-context';
import { applyPropOutline, applyDamageDistortion } from '../../src/rendering/filters/glitch-effects';
import { getEntitySprite } from '../../src/rendering/sprite-map';

describe('R1–R4 Rendering and Controls Review Specifications', () => {
  let world: World<GameEvents>;
  let eventBus: EventBus<GameEvents>;
  let grid: Grid;
  let playerEntity: number;
  let layers: any;
  let app: any;
  let canvasListeners: Record<string, (e: any) => void>;
  let windowListeners: Record<string, (e: any) => void>;

  beforeEach(() => {
    eventBus = new EventBus<GameEvents>();
    world = new World<GameEvents>(eventBus);
    grid = new Grid(20, 20);

    // Setup player
    playerEntity = world.createEntity();
    world.addComponent(playerEntity, Position, { x: 5, y: 5 });
    world.addComponent(playerEntity, Actor, {
      isPlayer: true,
    });
    world.addComponent(playerEntity, SpriteComponent, { key: 'player' });

    // Mock canvas with listener tracking and getBoundingClientRect
    canvasListeners = {};
    windowListeners = {};
    const mockCanvas = {
      width: 960,
      height: 640,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        right: 960,
        bottom: 640,
        width: 960,
        height: 640,
      }),
      addEventListener: vi.fn((event: string, handler: (e: any) => void) => {
        canvasListeners[event] = handler;
      }),
      removeEventListener: vi.fn((event: string) => {
        delete canvasListeners[event];
      }),
    };

    // Intercept window listeners for pointermove / pointerup
    vi.spyOn(window, 'addEventListener').mockImplementation((event: string, handler: any) => {
      windowListeners[event] = handler;
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((event: string) => {
      delete windowListeners[event];
    });

    layers = {
      worldContainer: {
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
      },
      terrainLayer: { addChild: vi.fn(), removeChild: vi.fn(), removeChildren: vi.fn() },
      entityLayer: { addChild: vi.fn(), removeChild: vi.fn(), removeChildren: vi.fn() },
      effectsLayer: { addChild: vi.fn(), removeChild: vi.fn(), removeChildren: vi.fn() },
    };

    app = {
      canvas: mockCanvas,
      stage: { addChild: vi.fn() },
      ticker: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };

    gameStore.getState().setHoveredEntity(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('R1: Hover Inspection Optimization and Screen-Reader / HUD Protection', () => {
    it('uses spatial index grid lookups during tile inspection instead of full entity query scan', () => {
      const getEntitiesAtSpy = vi.spyOn(grid, 'getEntitiesAt');
      const getItemsAtSpy = vi.spyOn(grid, 'getItemsAt');

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
      renderSystem.renderSystem();

      // Trigger hover over tile (5, 5)
      windowListeners['pointermove']({ clientX: 5 * 32 + 10, clientY: 5 * 32 + 10 });

      expect(getEntitiesAtSpy).toHaveBeenCalledWith(5, 5);
      expect(getItemsAtSpy).toHaveBeenCalledWith(5, 5);

      renderSystem.destroy();
    });

    it('does not re-notify store subscribers when hovered tile data remains deeply identical', () => {
      let storeNotifications = 0;
      const unsubscribe = gameStore.subscribe(() => {
        storeNotifications++;
      });

      const initialCount = storeNotifications;
      const dummyEntityInfo = {
        type: 'prop' as const,
        category: 'prop' as const,
        name: 'TERMINAL_CONSOLE',
        description: 'Subnet terminal.',
        screenX: 100,
        screenY: 100,
        gridX: 5,
        gridY: 5,
      };

      // First set: should notify
      gameStore.getState().setHoveredEntity(dummyEntityInfo);
      expect(storeNotifications).toBe(initialCount + 1);

      // Second set with equivalent data: should NOT notify
      gameStore.getState().setHoveredEntity({ ...dummyEntityInfo });
      expect(storeNotifications).toBe(initialCount + 1);

      // Clearing or changing: should notify
      gameStore.getState().setHoveredEntity(null);
      expect(storeNotifications).toBe(initialCount + 2);

      unsubscribe();
    });

    it('clears hover inspection if cursor is over a HUD element inside #ui-root', () => {
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

      // Mock document.elementFromPoint returning a HUD button
      const mockHudButton = {
        closest: (selector: string) => (selector === '#ui-root' ? {} : null),
      };
      (document as any).elementFromPoint = vi.fn().mockReturnValue(mockHudButton as any);

      windowListeners['pointermove']({ clientX: 100, clientY: 100 });

      expect(gameStore.getState().hoveredEntity).toBeNull();
      delete (document as any).elementFromPoint;

      renderSystem.destroy();
    });
  });

  describe('R2: Prop Outline Freshness and Persistent Searched Dimming', () => {
    it('preserves searched prop dimming (alpha 0.6x) and does not clobber it in FOV passes', () => {
      const propId = world.createEntity();
      world.addComponent(propId, Position, { x: 5, y: 6 });
      world.addComponent(propId, SpriteComponent, { key: 'prop_crate' });
      world.addComponent(propId, Prop, {
        propId: 'prop-crate-1',
        faction: 'traxus',
        propClass: 'locker',
        isSearched: true, // Searched/depleted prop
      });

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
      renderSystem.renderSystem();

      const sprite = getEntitySprite(propId);
      expect(sprite).toBeDefined();
      // Alpha should be 1.0 * 0.6 = 0.6 in FOV
      expect(sprite!.alpha).toBeCloseTo(0.6, 2);

      // Execute a second render cycle: verify it stays 0.6 and does not revert to 1.0
      renderSystem.renderSystem();
      expect(sprite!.alpha).toBeCloseTo(0.6, 2);

      renderSystem.destroy();
    });

    it('composes prop outlines with damage glitch filters and destroys replaced filters', () => {
      const { Sprite } = require('pixi.js');
      const testSprite = new Sprite();

      // 1. Apply damage distortion
      applyDamageDistortion(testSprite, 200);
      expect(testSprite.filters).toHaveLength(1);

      // 2. Apply prop outline: should compose alongside damage filter
      applyPropOutline(testSprite, 'locked');
      expect(testSprite.filters).toHaveLength(2);

      // 3. Update prop outline to searched (clearing outline): damage filter preserved
      applyPropOutline(testSprite, 'searched');
      expect(testSprite.filters).toHaveLength(1);

      // 4. Update prop outline to corrupted (creates new outline + glitch): replaced filters destroyed
      applyPropOutline(testSprite, 'corrupted');
      expect(testSprite.filters).toHaveLength(3); // 1 damage + 2 corrupted
    });

    it('dynamically refreshes prop outlines on state change without requiring sprite recreation', () => {
      const propId = world.createEntity();
      world.addComponent(propId, Position, { x: 6, y: 5 });
      world.addComponent(propId, SpriteComponent, { key: 'prop_terminal' });
      world.addComponent(propId, Prop, {
        propId: 'prop-term-1',
        faction: 'cyberacme',
        propClass: 'workstation',
        isSearched: false,
      });
      world.addComponent(propId, CorruptedNode, {
        trapType: 'acoustic_alert',
        corruptionLevel: 1,
        isDisarmed: false,
        triggered: false,
        revealed: false, // Initially unrevealed
      });

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
      renderSystem.renderSystem();

      const sprite = getEntitySprite(propId);
      // Safe / unrevealed outline applied
      expect(sprite).toBeDefined();
      expect(sprite!.filters).toBeDefined();

      // Now reveal the corrupted node (e.g. sensor probe)
      world.patchComponent(propId, CorruptedNode, { revealed: true });

      // In the next render loop, renderSystem() detects the changed state and refreshes outline
      renderSystem.renderSystem();
      expect(sprite!.filters).toHaveLength(2); // Corrupted outline + glitch filter

      // Now disarm the node via firmware
      world.patchComponent(propId, CorruptedNode, { isDisarmed: true });
      renderSystem.renderSystem();
      // Should refresh to safe outline
      expect(sprite!.filters).toHaveLength(1);

      renderSystem.destroy();
    });
  });

  describe('R3: Camera Input Alignment (Tactical Zoom & Button Gating)', () => {
    it('ignores left-click (button 0) for dragging and only starts free-pan on middle/right click', () => {
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

      // Left click (button 0): should NOT drag
      canvasListeners['pointerdown']({ button: 0, clientX: 100, clientY: 100 } as any);
      windowListeners['pointermove']({ clientX: 150, clientY: 150 } as any);
      expect(renderSystem.getCameraPanOffset()).toEqual({ x: 0, y: 0 });

      // Right click (button 2): SHOULD drag
      canvasListeners['pointerdown']({ button: 2, clientX: 100, clientY: 100 } as any);
      windowListeners['pointermove']({ clientX: 150, clientY: 130 } as any);
      expect(renderSystem.getCameraPanOffset()).toEqual({ x: 50, y: 30 });

      // Pointer up releases drag
      windowListeners['pointerup']({ button: 2 } as any);
      windowListeners['pointermove']({ clientX: 200, clientY: 200 } as any);
      // Pan offset should remain where it was left (50, 30)
      expect(renderSystem.getCameraPanOffset()).toEqual({ x: 50, y: 30 });

      renderSystem.destroy();
    });

    it('handles wheel scroll for optical zoom, clamped strictly between 0.75x and 1.5x', () => {
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
      expect(renderSystem.getCameraZoom()).toBe(1.0);

      const preventDefault = vi.fn();

      // Zoom in (deltaY negative)
      canvasListeners['wheel']({ deltaY: -100, preventDefault } as any);
      expect(preventDefault).toHaveBeenCalled();
      expect(renderSystem.getCameraZoom()).toBeCloseTo(1.1, 2);
      expect(layers.worldContainer.scale.x).toBeCloseTo(1.1, 2);

      // Zoom in past maximum (1.5x clamp)
      for (let i = 0; i < 10; i++) {
        canvasListeners['wheel']({ deltaY: -100, preventDefault } as any);
      }
      expect(renderSystem.getCameraZoom()).toBe(1.5);
      expect(layers.worldContainer.scale.x).toBe(1.5);

      // Zoom out past minimum (0.75x clamp)
      for (let i = 0; i < 15; i++) {
        canvasListeners['wheel']({ deltaY: 100, preventDefault } as any);
      }
      expect(renderSystem.getCameraZoom()).toBe(0.75);
      expect(layers.worldContainer.scale.x).toBe(0.75);

      renderSystem.destroy();
    });

    it('resets camera pan and optical zoom on RECENTER_CAMERA and onDungeonGenerated', () => {
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

      // Pan and zoom
      canvasListeners['pointerdown']({ button: 1, clientX: 10, clientY: 10 } as any);
      windowListeners['pointermove']({ clientX: 60, clientY: 70 } as any);
      renderSystem.setCameraZoom(1.4);

      expect(renderSystem.getCameraPanOffset()).toEqual({ x: 50, y: 60 });
      expect(renderSystem.getCameraZoom()).toBe(1.4);

      // Recenter camera
      renderSystem.recenterCamera();
      expect(renderSystem.getCameraPanOffset()).toEqual({ x: 0, y: 0 });
      expect(renderSystem.getCameraZoom()).toBe(1.0);
      expect(layers.worldContainer.scale.x).toBe(1.0);

      // Pan and zoom again, then generate new dungeon
      canvasListeners['pointerdown']({ button: 2, clientX: 0, clientY: 0 } as any);
      windowListeners['pointermove']({ clientX: 20, clientY: 20 } as any);
      renderSystem.setCameraZoom(0.85);

      renderSystem.onDungeonGenerated();
      expect(renderSystem.getCameraPanOffset()).toEqual({ x: 0, y: 0 });
      expect(renderSystem.getCameraZoom()).toBe(1.0);
      expect(layers.worldContainer.scale.x).toBe(1.0);

      renderSystem.destroy();
    });
  });

  describe('R4: Game Context Scoping and Non-Development Protection', () => {
    it('does not expose window.gameContext in non-development environments', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        const dummyContext = { sessionId: 'prod-session', world, eventBus } as any;

        setActiveGameContext(dummyContext);

        // window.gameContext must be scrubbed in production
        expect((window as any).gameContext).toBeUndefined();

        // But getActiveGameContext() resolves safely
        expect(getActiveGameContext()).toBe(dummyContext);

        // Cleanup
        setActiveGameContext(null);
        expect(getActiveGameContext()).toBeNull();
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
      }
    });
  });
});
