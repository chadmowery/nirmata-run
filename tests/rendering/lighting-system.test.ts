import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { World } from '../../src/engine/ecs/world';
import { EventBus } from '../../src/engine/events/event-bus';
import { GameEvents } from '../../src/game/events/types';
import { Grid } from '../../src/engine/grid/grid';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { SpriteComponent } from '@shared/components/sprite';
import { LightSource, LightSourceData } from '@shared/components/light-source';
import { Heat } from '@shared/components/heat';
import { Stability } from '@shared/components/stability';
import { FloorState } from '@shared/components/floor-state';
import { FirmwareSlots } from '@shared/components/firmware-slots';
import { AbilityDef } from '@shared/components/ability-def';
import { Prop, CorruptedNode } from '@shared/components/environment';
import * as PIXI from 'pixi.js';
import {
  DeferredLightFilter,
  GBufferPass,
  LightingSystem,
  SelectiveBloomFilter,
  evaluateLightAnimation,
  resolveFactionAmbientProfile,
} from '../../src/rendering/lighting';
import { createRenderSystem, RenderSystem } from '../../src/rendering/render-system';

vi.mock('pixi.js', () => {
  const Sprite = vi.fn().mockImplementation(function () {
    return {
      x: 0,
      y: 0,
      width: 32,
      height: 32,
      alpha: 1.0,
      visible: true,
      tint: 0xffffff,
      anchor: { set: vi.fn() },
      scale: { x: 1, y: 1, set: vi.fn() },
      pivot: { x: 0, y: 0, set: vi.fn() },
      rotation: 0,
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
      visible: true,
      rotation: 0,
      position: { set: vi.fn() },
      scale: { x: 1, y: 1, set: vi.fn() },
      pivot: { x: 0, y: 0, set: vi.fn() },
      filters: null,
      children: [],
      addChild: vi.fn(),
      removeChild: vi.fn(),
      destroy: vi.fn(),
    };
  });
  const RenderTexture = {
    create: vi.fn().mockImplementation((opts?: Record<string, unknown>) => ({
      ...(opts ?? {}),
      source: { scaleMode: 'nearest', autoGenerateMipmaps: false },
      resize: vi.fn(),
      destroy: vi.fn(),
    })),
  };
  const Buffer = vi.fn().mockImplementation(function (opts?: Record<string, unknown>) {
    return { ...(opts ?? {}), update: vi.fn(), destroy: vi.fn() };
  });
  const Geometry = vi.fn().mockImplementation(function (opts?: Record<string, unknown>) {
    return { ...(opts ?? {}), topology: 'triangle-list', destroy: vi.fn() };
  });
  const Shader = vi.fn().mockImplementation(function (opts?: Record<string, unknown>) {
    return { ...(opts ?? {}), resources: opts?.resources ?? {}, destroy: vi.fn() };
  });
  const State = {
    for2d: vi.fn().mockImplementation(() => ({
      blend: true,
      blendMode: 'normal',
    })),
  };
  const Mesh = vi.fn().mockImplementation(function (opts?: Record<string, unknown>) {
    return { ...(opts ?? {}), blendMode: 'inherit', destroy: vi.fn() };
  });
  const Graphics = vi.fn().mockImplementation(function () {
    return {
      clear: vi.fn().mockReturnThis(),
      rect: vi.fn().mockReturnThis(),
      fill: vi.fn().mockReturnThis(),
      stroke: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
  });
  const Texture = Object.assign(
    vi.fn().mockImplementation(function (opts?: Record<string, unknown>) {
      return { ...(opts ?? {}), width: 32, height: 32, destroy: vi.fn() };
    }),
    {
      EMPTY: { width: 1, height: 1, source: { width: 1, height: 1 } },
      WHITE: { width: 16, height: 16, source: { width: 16, height: 16 } },
      from: vi.fn().mockReturnValue({ width: 32, height: 32 }),
    },
  );
  const BufferImageSource = vi.fn().mockImplementation(function (opts: Record<string, unknown>) {
    return { ...opts, update: vi.fn(), destroy: vi.fn() };
  });
  const UniformGroup = vi.fn().mockImplementation(function (defs: Record<string, { value: unknown }>) {
    const uniforms: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(defs)) {
      uniforms[k] = v.value;
    }
    return { uniforms, update: vi.fn() };
  });
  const Filter = class {
    public resources: Record<string, unknown>;
    constructor(opts?: Record<string, unknown>) {
      this.resources = (opts?.resources as Record<string, unknown>) ?? {};
    }
    public apply(..._args: unknown[]): void {}
    public destroy(_options?: boolean): void {}
  };
  const TexturePool = {
    getOptimalTexture: vi.fn((w: number, h: number, resolution: number) => ({
      width: w,
      height: h,
      source: { width: w / resolution, height: h / resolution, _resolution: resolution },
    })),
    returnTexture: vi.fn(),
  };
  const GlProgram: { from?: unknown } = {};
  return {
    Sprite,
    Container,
    Graphics,
    Texture,
    TexturePool,
    Filter,
    BufferImageSource,
    UniformGroup,
    GlProgram,
    RenderTexture,
    Buffer,
    BufferUsage: { VERTEX: 1, INDEX: 2, COPY_DST: 4 },
    Geometry,
    Shader,
    State,
    Mesh,
    defaultFilterVert: 'void main() {}',
    Assets: {
      add: vi.fn(),
      load: vi.fn().mockResolvedValue({ textures: {} }),
      unload: vi.fn().mockResolvedValue(undefined),
      cache: { has: vi.fn().mockReturnValue(false), get: vi.fn() },
    },
    ColorMatrixFilter: vi.fn().mockImplementation(function () {
      return { enabled: true, desaturate: vi.fn(), destroy: vi.fn() };
    }),
  };
});

describe('Deferred Lighting System & Render Integration [LIGHT-03/04/07]', () => {
  it('encodes Active FOV (255), Explored Memory (64), and Unexplored Void (0) into FOV mask data', () => {
    const gbuffer = new GBufferPass(10, 8);
    expect(gbuffer.fovDimensions).toEqual({ width: 10, height: 8 });

    const fovSet = new Set(['2,3', '3,3']);
    const exploredSet = new Set(['1,1', '2,3']);
    gbuffer.updateFovMask(10, 8, fovSet, exploredSet);

    const internalData = (gbuffer as unknown as { fovMaskData: Uint8Array }).fovMaskData;
    const at = (x: number, y: number) => internalData[(y * 10 + x) * 4];

    expect(at(2, 3)).toBe(255); // Active FOV takes priority over explored
    expect(at(3, 3)).toBe(255); // Active FOV
    expect(at(1, 1)).toBe(64); // Explored memory
    expect(at(0, 0)).toBe(0); // Unexplored void

    gbuffer.destroy();
  });

  it('evaluates all 5 light animation modes (STATIC, PULSE, FLICKER, STROBE, RADAR_SWEEP)', () => {
    const base: LightSourceData = {
      enabled: true,
      color: '#ff0000',
      intensity: 1.0,
      radius: 128,
      height: 18,
      falloff: 1.5,
      castsShadows: true,
      offsetX: 0,
      offsetY: 0,
      animation: { type: 'STATIC', speed: 2, amplitude: 0.4 },
    };

    const s0 = evaluateLightAnimation(base, 0, 0);
    const s1 = evaluateLightAnimation(base, 1.37, 0);
    expect(s0.intensityMultiplier).toBe(1.0);
    expect(s1.intensityMultiplier).toBe(1.0);
    expect(s0.colorRgb[0]).toBeCloseTo(1, 2);

    const pulseDual: LightSourceData = {
      ...base,
      animation: { type: 'PULSE', speed: 1, amplitude: 0.5, secondaryColor: '#0000ff' },
    };
    const pTrough = evaluateLightAnimation(pulseDual, 0.75, 0);
    const pPeak = evaluateLightAnimation(pulseDual, 0.25, 0);
    expect(pTrough.intensityMultiplier).toBeLessThan(pPeak.intensityMultiplier);
    expect(pPeak.colorRgb[2]).toBeGreaterThan(0.8);

    const flicker: LightSourceData = {
      ...base,
      animation: { type: 'FLICKER', speed: 3, amplitude: 0.6, secondaryColor: '#00ff00' },
    };
    const fEvals = Array.from({ length: 12 }, (_, i) => evaluateLightAnimation(flicker, i * 0.09, 0));
    const fValues = new Set(fEvals.map((e) => e.intensityMultiplier.toFixed(3)));
    expect(fValues.size).toBeGreaterThan(2);
    expect(fEvals.some((e) => e.colorRgb[1] > 0.1)).toBe(true);

    const strobe: LightSourceData = {
      ...base,
      animation: { type: 'STROBE', speed: 2, amplitude: 0.5, secondaryColor: '#0000ff' },
    };
    const stOn = evaluateLightAnimation(strobe, 0.05, 0);
    const stOff = evaluateLightAnimation(strobe, 0.3, 0);
    expect(stOn.intensityMultiplier).toBeGreaterThan(stOff.intensityMultiplier);
    expect(stOn.colorRgb[0]).toBeCloseTo(1, 2);
    expect(stOff.colorRgb[2]).toBeCloseTo(1, 2);

    const sweep: LightSourceData = {
      ...base,
      animation: { type: 'RADAR_SWEEP', speed: 1, amplitude: 0.5, secondaryColor: '#00ff00' },
    };
    const sw0 = evaluateLightAnimation(sweep, 0, 0);
    const swQuarter = evaluateLightAnimation(sweep, 0.25, 0);
    const swHalf = evaluateLightAnimation(sweep, 0.5, 0);
    expect(sw0.angleOffsetRad).toBe(0);
    expect(swHalf.angleOffsetRad).toBeGreaterThan(3.0);
    expect(swQuarter.colorRgb[1]).toBeCloseTo(1, 2);
  });

  it('tracks transient lights, decays/expires them over deltaMs, and resolves faction themes', () => {
    const lighting = new LightingSystem(20, 15);
    lighting.setEnvironmentTheme('traxus', 'THERMAL_SURGE');
    expect(lighting.getEnvironmentTheme()).toEqual({
      factionTheme: 'traxus',
      sectorCondition: 'THERMAL_SURGE',
    });
    expect(resolveFactionAmbientProfile('traxus').colorHex).toBe('#261109');

    lighting.spawnTransientLight({
      worldX: 160,
      worldY: 160,
      color: '#00f0ff',
      intensity: 2.0,
      radiusPx: 200,
      durationMs: 100,
    });

    const dummyWorld = {
      query: () => [],
      getComponent: () => undefined,
    };
    const container = { x: 0, y: 0, scale: { x: 1, y: 1 }, filters: null };
    const ctx = {
      world: dummyWorld,
      worldContainer: container as never,
      terrainLayer: { children: [] } as never,
      itemLayer: { children: [] } as never,
      entityLayer: { children: [] } as never,
      renderer: {} as never,
      spriteMap: new Map(),
      gridWidth: 20,
      gridHeight: 15,
      deltaMs: 50,
      enabled: true,
    };

    lighting.update(ctx);
    expect(lighting.getTelemetry().primaryLightCount).toBe(1);

    lighting.update({ ...ctx, deltaMs: 60 });
    expect(lighting.getTelemetry().primaryLightCount).toBe(0);

    lighting.destroy();
  });

  describe('RenderSystem Dynamic Light Modulation, Beacon Pings, and Bisection Flag', () => {
    let world: World<GameEvents>;
    let eventBus: EventBus<GameEvents>;
    let grid: Grid;
    let renderSystem: RenderSystem;
    let playerId: number;

    beforeEach(() => {
      eventBus = new EventBus<GameEvents>();
      world = new World<GameEvents>(eventBus);
      grid = new Grid(30, 20);
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 30; x++) {
          if (x === 0 || y === 0 || x === 29 || y === 19) {
            grid.setTile(x, y, { terrain: 'wall', transparent: false, walkable: false });
          } else {
            grid.setTile(x, y, { terrain: 'floor', transparent: true, walkable: true });
          }
        }
      }

      playerId = world.createEntity();
      world.addComponent(playerId, Position, { x: 10, y: 10 });
      world.addComponent(playerId, Actor, { isPlayer: true });
      world.addComponent(playerId, SpriteComponent, { key: 'player' });
      world.addComponent(playerId, Heat, Heat.schema.parse({ current: 0, maxSafe: 100 }));
      world.addComponent(playerId, Stability, { current: 100, max: 100 });
      world.addComponent(playerId, LightSource, {
        enabled: true,
        color: '#00f0ff',
        intensity: 1.4,
        radius: 200,
        height: 20,
        falloff: 1.4,
        castsShadows: true,
        offsetX: 0,
        offsetY: 0,
        animation: { type: 'STATIC', speed: 2, amplitude: 0.2 },
      });

      const app = {
        stage: { addChild: vi.fn(), removeChild: vi.fn(), filters: null },
        renderer: {},
        ticker: { add: vi.fn(), remove: vi.fn() },
        canvas: null,
      } as never;

      const layers = {
        worldContainer: { x: 0, y: 0, scale: { x: 1, y: 1, set: vi.fn() }, pivot: { x: 0, y: 0, set: vi.fn() }, filters: null, addChild: vi.fn() },
        terrainLayer: { children: [], addChild: vi.fn(), removeChild: vi.fn(), visible: true },
        itemLayer: { children: [], addChild: vi.fn(), removeChild: vi.fn(), visible: true },
        entityLayer: { children: [], addChild: vi.fn(), removeChild: vi.fn(), visible: true },
        effectsLayer: { children: [], addChild: vi.fn(), removeChild: vi.fn(), visible: true },
        debugLayer: { children: [], addChild: vi.fn(), removeChild: vi.fn(), visible: true },
      } as never;

      renderSystem = createRenderSystem({
        app,
        layers,
        world,
        eventBus,
        getGrid: () => grid,
        getPlayerEntity: () => playerId,
        lightPasses: (x, y) => grid.isTransparent(x, y),
      });
      renderSystem.init();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      renderSystem?.destroy();
    });

    it('modulates player LightSource per Spec §5.3 (Heat tiers, Low Stability, Extended_Sight.sys) without mutating ECS World', () => {
      // Heat 61-99% smoothly interpolates toward Safety Amber (#ff9500) with 3 Hz PULSE (amp 0.15)
      world.patchComponent(playerId, Heat, { current: 80 });
      renderSystem.renderSystem();
      const warmLight = renderSystem.getEffectiveEntityLight(playerId)!;
      expect(warmLight.color).not.toBe('#00f0ff');
      expect(warmLight.color).not.toBe('#ff9500'); // mid-interpolation at 80%
      expect(warmLight.animation).toEqual({ type: 'PULSE', speed: 3.0, amplitude: 0.15 });
      // ECS LightSource component on World remains immutable (read-only renderer mandate)
      expect(world.getComponent(playerId, LightSource)!.color).toBe('#00f0ff');
      expect(world.getComponent(playerId, LightSource)!.animation.type).toBe('STATIC');

      // Heat >= 100% shifts to Electric Crimson (#ff0055) with 14 Hz FLICKER + #a855f7 secondary
      world.patchComponent(playerId, Heat, { current: 105 });
      renderSystem.renderSystem();
      const panicLight = renderSystem.getEffectiveEntityLight(playerId)!;
      expect(panicLight.color).toBe('#ff0055');
      expect(panicLight.animation).toEqual({
        type: 'FLICKER',
        speed: 14.0,
        amplitude: 0.45,
        secondaryColor: '#a855f7',
      });

      // Floor transition while overheated, followed by cooling down, preserves clean baseline
      renderSystem.onDungeonGenerated();
      world.patchComponent(playerId, Heat, { current: 0 });
      renderSystem.renderSystem();
      const cooledLight = renderSystem.getEffectiveEntityLight(playerId)!;
      expect(cooledLight.color).toBe('#00f0ff');
      expect(cooledLight.radius).toBe(200);
      expect(cooledLight.height).toBe(20);
      expect(cooledLight.animation.type).toBe('STATIC');

      // Drop stability < 50 -> radius * mix(0.75, 1.0, stability/50) + ultraviolet (#a855f7) pulse
      world.patchComponent(playerId, Stability, { current: 25 });
      renderSystem.renderSystem();
      const unstableLight = renderSystem.getEffectiveEntityLight(playerId)!;
      expect(unstableLight.radius).toBe(175); // 200 * (0.75 + 0.25 * 0.5)
      expect(unstableLight.animation.secondaryColor).toBe('#a855f7');

      // Restore stability & grant Extended_Sight.sys firmware -> visionRadius * 32 (384px) & height 28px
      world.patchComponent(playerId, Stability, { current: 100 });
      const fwId = world.createEntity();
      world.addComponent(
        fwId,
        AbilityDef,
        AbilityDef.schema.parse({
          name: 'Extended_Sight.sys',
          heatCost: 0,
          range: 0,
          effectType: 'toggle_vision',
          visionRadius: 12,
          isActive: true,
          isToggle: true,
        }),
      );
      world.addComponent(playerId, FirmwareSlots, { equipped: [fwId] });
      renderSystem.renderSystem();
      const boostedLight = renderSystem.getEffectiveEntityLight(playerId)!;
      expect(boostedLight.radius).toBe(384);
      expect(boostedLight.height).toBe(28);
    });

    it('emits GHOST_PULSE transient flare and DARK_SUBNET unsearched prop beacon pings', () => {
      vi.spyOn(performance, 'now').mockReturnValue(200);

      const floorEnt = world.createEntity();
      world.addComponent(
        floorEnt,
        FloorState,
        FloorState.schema.parse({
          currentFloor: 1,
          maxFloor: 15,
          runSeed: 'seed-subnet',
          factionTheme: 'system',
          sectorCondition: 'DARK_SUBNET',
        }),
      );

      const hiddenProp = world.createEntity();
      world.addComponent(hiddenProp, Position, { x: 25, y: 15 }); // Outside player FOV radius
      world.addComponent(
        hiddenProp,
        Prop,
        Prop.schema.parse({
          propId: 'locker_1',
          faction: 'system',
          propClass: 'locker',
          isSearched: false,
        }),
      );

      eventBus.emit('FIRMWARE_ACTIVATED', {
        entityId: playerId,
        firmwareEntityId: playerId,
        slotIndex: 0,
        abilityName: 'GHOST_PULSE.exe',
        heatCost: 15,
        targetX: 10,
        targetY: 10,
      });
      eventBus.flush();

      renderSystem.renderSystem();
      const telemetry = renderSystem.getRenderTelemetry().lighting!;
      expect(telemetry.activeSectorCondition).toBe('DARK_SUBNET');
      // 1 (player) + 1 (GHOST_PULSE transient) + 1 (DARK_SUBNET unsearched prop beacon)
      expect(telemetry.primaryLightCount).toBe(3);

      // Disabling deferred lighting via bisection flag zeroes active light counts & sets enabled: false
      renderSystem.setDevRenderFlags({ disableDeferredLighting: true });
      const offTelemetry = renderSystem.getRenderTelemetry().lighting!;
      expect(offTelemetry.enabled).toBe(false);
      expect(offTelemetry.primaryLightCount).toBe(0);
    });

    it('skips LightSource entities whose sprites are hidden by FOV (sprite.visible === false)', () => {
      const hiddenEnemy = world.createEntity();
      world.addComponent(hiddenEnemy, Position, { x: 25, y: 15 }); // Outside player FOV at (10, 10)
      world.addComponent(hiddenEnemy, SpriteComponent, { key: 'enemy_null_pointer' });
      world.addComponent(hiddenEnemy, LightSource, {
        enabled: true,
        color: '#a855f7',
        intensity: 1.2,
        radius: 120,
        height: 18,
        falloff: 1.5,
        castsShadows: false,
        offsetX: 0,
        offsetY: 0,
        animation: { type: 'STATIC', speed: 2, amplitude: 0.2 },
      });

      const visibleProp = world.createEntity();
      world.addComponent(visibleProp, Position, { x: 11, y: 10 }); // Inside player FOV at (10, 10)
      world.addComponent(visibleProp, SpriteComponent, { key: 'prop_workstation' });
      world.addComponent(visibleProp, LightSource, {
        enabled: true,
        color: '#00f0ff',
        intensity: 1.1,
        radius: 88,
        height: 18,
        falloff: 1.8,
        castsShadows: false,
        offsetX: 0,
        offsetY: 0,
        animation: { type: 'STATIC', speed: 2, amplitude: 0.2 },
      });

      renderSystem.renderSystem();
      const telemetry = renderSystem.getRenderTelemetry().lighting!;
      // Only player (10,10) + visibleProp (11,10) should be active; hiddenEnemy (25,15) has sprite.visible = false
      expect(telemetry.primaryLightCount).toBe(2);
    });

    it('skips explored out-of-FOV props so they cannot starve MAX_PRIMARY_LIGHTS and keeps prop overrides U1-compliant (HIGH-01)', () => {
      const lighting = new LightingSystem(30, 20);
      const spriteMap = new Map<number, PIXI.Sprite>();
      const makeVisibleSprite = (x: number, y: number) =>
        ({
          visible: true,
          alpha: 1,
          x: x * 32,
          y: y * 32,
          pivot: { x: 0, y: 0 },
        }) as unknown as PIXI.Sprite;

      spriteMap.set(playerId, makeVisibleSprite(10, 10));

      // Create 70 explored out-of-FOV props with visible=true sprites (Fog-of-War behavior)
      for (let i = 0; i < 70; i++) {
        const outProp = world.createEntity();
        const px = 2 + (i % 10);
        const py = 2 + Math.floor(i / 10);
        world.addComponent(outProp, Position, { x: px, y: py });
        world.addComponent(
          outProp,
          LightSource,
          LightSource.schema.parse({ color: '#00f0ff', intensity: 1.0, radius: 96 }),
        );
        spriteMap.set(outProp, makeVisibleSprite(px, py));
      }

      // Create 1 in-FOV prop with higher entity ID than all 70 out-of-FOV props
      const inFovProp = world.createEntity();
      world.addComponent(inFovProp, Position, { x: 11, y: 10 });
      world.addComponent(
        inFovProp,
        LightSource,
        LightSource.schema.parse({ color: '#10b981', intensity: 1.3, radius: 120 }),
      );
      spriteMap.set(inFovProp, makeVisibleSprite(11, 10));

      // Spawn a transient flash
      lighting.spawnTransientLight({
        worldX: 10 * 32 + 16,
        worldY: 10 * 32 + 16,
        color: '#ff9500',
        intensity: 2.0,
        radiusPx: 140,
        durationMs: 300,
      });

      const fovSet = new Set(['10,10', '11,10']);
      lighting.update({
        world,
        worldContainer: { x: 0, y: 0, scale: { x: 1, y: 1 }, filters: null } as never,
        terrainLayer: { children: [] } as never,
        itemLayer: { children: [] } as never,
        entityLayer: { children: [] } as never,
        spriteMap,
        fovSet,
        gridWidth: 30,
        gridHeight: 20,
        deltaMs: 16,
        enabled: true,
        playerEntityId: playerId,
      });

      // Out-of-FOV props are culled; only player + transient + in-FOV prop remain
      expect(lighting.getPrimaryLights()).toHaveLength(3);
      lighting.destroy();

      // U1 Anti-cheat: out-of-FOV prop light overrides reflect rememberedProps, not live unseen World state
      const memProp = world.createEntity();
      world.addComponent(memProp, Position, { x: 11, y: 10 }); // initially in FOV
      world.addComponent(memProp, SpriteComponent, { key: 'prop_workstation' });
      world.addComponent(
        memProp,
        Prop,
        Prop.schema.parse({
          propId: 'ws_mem',
          faction: 'cyberacme',
          propClass: 'workstation',
          isSearched: false,
        }),
      );
      world.addComponent(
        memProp,
        LightSource,
        LightSource.schema.parse({ color: '#00f0ff', intensity: 1.5, radius: 96 }),
      );
      renderSystem.renderSystem();
      expect(renderSystem.getEffectiveEntityLight(memProp)!.intensity).toBe(1.5);

      // Move prop out of FOV and mutate live isSearched=true -> override still reflects remembered unsearched state
      world.patchComponent(memProp, Position, { x: 26, y: 16 });
      world.patchComponent(memProp, Prop, { isSearched: true });
      renderSystem.renderSystem();
      expect(renderSystem.getEffectiveEntityLight(memProp)!.intensity).toBe(1.5);
    });

    it('configures DeferredLightFilter float data textures with alphaMode no-premultiply-alpha and exact screen coordinates', () => {
      const bufferSourceMock = vi.mocked(PIXI.BufferImageSource);
      bufferSourceMock.mockClear();
      const glProg = PIXI.GlProgram as unknown as { from?: unknown };
      glProg.from = vi.fn().mockReturnValue({});

      try {
        const dummyTex = PIXI.Texture.EMPTY;
        const filter = new DeferredLightFilter(dummyTex, dummyTex, dummyTex);
        expect(bufferSourceMock).toHaveBeenCalledTimes(2);
        const primaryOpts = bufferSourceMock.mock.calls[0][0] as unknown as Record<string, unknown>;
        const microOpts = bufferSourceMock.mock.calls[1][0] as unknown as Record<string, unknown>;
        expect(primaryOpts.alphaMode).toBe('no-premultiply-alpha');
        expect(microOpts.alphaMode).toBe('no-premultiply-alpha');

        filter.uploadUniforms({
          cameraX: 233,
          cameraY: 137,
          cameraZoom: 1.5,
          gridWidth: 80,
          gridHeight: 45,
          timeSec: 1.0,
          ambientRgb: [0.06, 0.1, 0.14],
          ambientIntensity: 0.22,
          shadowTintRgb: [0.05, 0.08, 0.16],
          conditionTintRgb: [1, 1, 1],
          floorPulseAmp: 0,
          floorPulseRgb: [0, 0, 0],
          primaryLights: [
            {
              screenX: 473,
              screenY: 313,
              radiusPx: 192,
              intensity: 1.5,
              colorRgb: [0.88, 0.97, 1.0],
              heightPx: 22,
              falloff: 1.8,
              castsShadows: true,
              isBeaconPing: false,
            },
          ],
          microLights: [
            {
              screenX: 500,
              screenY: 340,
              radiusPx: 24,
              intensity: 0.8,
              colorRgb: [1.0, 0.5, 0.1],
            },
          ],
        });

        const lightBuf = primaryOpts.resource as Float32Array;
        expect(lightBuf[0]).toBeCloseTo(473, 3);
        expect(lightBuf[1]).toBeCloseTo(313, 3);
        expect(lightBuf[2]).toBeCloseTo(192, 3);
        expect(lightBuf[3]).toBeCloseTo(1.5, 3);

        filter.destroy(true);
      } finally {
        delete glProg.from;
      }
    });

    it('configures GBufferPass normalMesh and materialMesh with blendMode none to preserve unblended normal/material channels', () => {
      const glProg = PIXI.GlProgram as unknown as { from?: unknown };
      glProg.from = vi.fn().mockReturnValue({});

      try {
        const gbuffer = new GBufferPass(10, 8) as unknown as {
          gpuReady: boolean;
          normalMesh?: { blendMode: string; state?: { blend: boolean; blendMode: string } };
          materialMesh?: { blendMode: string; state?: { blend: boolean; blendMode: string } };
          destroy: () => void;
        };
        expect(gbuffer.gpuReady).toBe(true);
        expect(gbuffer.normalMesh?.blendMode).toBe('none');
        expect(gbuffer.materialMesh?.blendMode).toBe('none');
        expect(gbuffer.normalMesh?.state?.blend).toBe(false);
        expect(gbuffer.normalMesh?.state?.blendMode).toBe('none');
        expect(gbuffer.materialMesh?.state?.blend).toBe(false);
        expect(gbuffer.materialMesh?.state?.blendMode).toBe('none');
        gbuffer.destroy();
      } finally {
        delete glProg.from;
      }
    });

    it('keeps Active FOV ambient brighter than Explored Memory and omits flat background lift in DeferredLightFilter shader', () => {
      const glProg = PIXI.GlProgram as unknown as { from?: ReturnType<typeof vi.fn> };
      const fromMock = vi.fn().mockReturnValue({});
      glProg.from = fromMock;

      try {
        const dummyTex = PIXI.Texture.EMPTY;
        const filter = new DeferredLightFilter(dummyTex, dummyTex, dummyTex);
        const shaderOpts = fromMock.mock.calls[0]?.[0] as { fragment?: string } | undefined;
        const frag = shaderOpts?.fragment ?? '';

        expect(frag).toContain('activeAmbientLevel');
        expect(frag).toContain('memoryScale');
        expect(frag).not.toContain('+ vec3(0.015, 0.026, 0.052)');
        filter.destroy(true);
      } finally {
        delete glProg.from;
      }
    });

    it('skips sprites with destroyed TextureSource and unbinds atlas resources back to Texture.EMPTY.source after capture', () => {
      const glProg = PIXI.GlProgram as unknown as { from?: unknown };
      glProg.from = vi.fn().mockReturnValue({});

      try {
        const gbuffer = new GBufferPass(10, 8);
        const destroyedSrc = { width: 512, height: 512, destroyed: true };
        const validSrc = { width: 512, height: 512, destroyed: false };

        const makeSprite = (source: Record<string, unknown>) =>
          ({
            visible: true,
            alpha: 1,
            x: 32,
            y: 32,
            width: 32,
            height: 32,
            scale: { x: 1, y: 1 },
            pivot: { x: 0, y: 0 },
            rotation: 0,
            filters: null,
            texture: {
              source,
              frame: { x: 0, y: 0, width: 32, height: 32 },
            },
          }) as unknown as PIXI.Sprite;

        const boundSourcesDuringRender: Array<unknown> = [];
        const gbInternal = gbuffer as unknown as {
          normalShader: { resources: Record<string, unknown> };
          materialShader: { resources: Record<string, unknown> };
        };
        const fakeRenderer = {
          render: vi.fn(() => {
            boundSourcesDuringRender.push(gbInternal.normalShader.resources.uDiffuseAtlas);
          }),
        } as unknown as PIXI.Renderer;

        const wc = new PIXI.Container();
        const terrain = new PIXI.Container();
        const items = new PIXI.Container();
        const entities = new PIXI.Container();
        (terrain.children as unknown[]).push(makeSprite(destroyedSrc), makeSprite(validSrc));

        gbuffer.capture(fakeRenderer, wc, {
          terrainLayer: terrain,
          itemLayer: items,
          entityLayer: entities,
        });

        expect(gbuffer.quadCount).toBe(1);
        expect(boundSourcesDuringRender[0]).toBe(validSrc);
        expect(gbInternal.normalShader.resources.uDiffuseAtlas).toBe(PIXI.Texture.EMPTY.source);
        expect(gbInternal.normalShader.resources.uNormalAtlas).toBe(PIXI.Texture.EMPTY.source);
        expect(gbInternal.materialShader.resources.uDiffuseAtlas).toBe(PIXI.Texture.EMPTY.source);
        expect(gbInternal.materialShader.resources.uMaterialAtlas).toBe(PIXI.Texture.EMPTY.source);

        gbuffer.destroy();
      } finally {
        delete glProg.from;
      }
    });

    it('renders particles in a separate MAX-blend material pass & height-clipped normal pass (CRIT-02)', () => {
      const glProg = PIXI.GlProgram as unknown as { from?: unknown };
      glProg.from = vi.fn().mockReturnValue({});

      try {
        const gbuffer = new GBufferPass(10, 8);
        const validSrc = { width: 512, height: 512, destroyed: false };
        const sprite = {
          visible: true,
          alpha: 1,
          x: 32,
          y: 32,
          width: 32,
          height: 32,
          scale: { x: 1, y: 1 },
          pivot: { x: 0, y: 0 },
          rotation: 0,
          filters: null,
          texture: { source: validSrc, frame: { x: 0, y: 0, width: 32, height: 32 } },
        } as unknown as PIXI.Sprite;

        const gbInternal = gbuffer as unknown as {
          rtMaterialHeight: { source: unknown };
          particleMaterialMesh: { blendMode: string; state: { blend: boolean; blendMode: string } };
          particleNormalShader: { resources: Record<string, unknown> };
          particleMaterialContainer: unknown;
          particleNormalContainer: unknown;
        };

        expect(gbInternal.particleMaterialMesh.blendMode).toBe('max');
        expect(gbInternal.particleMaterialMesh.state.blend).toBe(true);
        expect(gbInternal.particleMaterialMesh.state.blendMode).toBe('max');

        const renderCalls: Array<{ container: unknown; clear: boolean; boundMatHeight: unknown }> = [];
        const fakeRenderer = {
          render: vi.fn((opts: { container: unknown; clear: boolean }) => {
            renderCalls.push({
              container: opts.container,
              clear: opts.clear,
              boundMatHeight: gbInternal.particleNormalShader.resources.uMaterialHeight,
            });
          }),
        } as unknown as PIXI.Renderer;

        const wc = new PIXI.Container();
        const terrain = new PIXI.Container();
        (terrain.children as unknown[]).push(sprite);

        gbuffer.capture(fakeRenderer, wc, {
          terrainLayer: terrain,
          itemLayer: new PIXI.Container(),
          entityLayer: new PIXI.Container(),
          particles: [
            {
              worldX: 48,
              worldY: 48,
              size: 8,
              colorRgb: [0, 1, 1],
              alpha: 0.9,
              mode: 'emissive',
              heightPx: 10,
              shadowOpacity: 0,
            },
          ],
        });

        expect(gbuffer.quadCount).toBe(2);
        expect(gbuffer.particleQuadCount).toBe(1);
        expect(renderCalls).toHaveLength(4);
        // Particle passes do not clear solid G-buffer targets
        expect(renderCalls[1].container).toBe(gbInternal.particleMaterialContainer);
        expect(renderCalls[1].clear).toBe(false);
        expect(renderCalls[3].container).toBe(gbInternal.particleNormalContainer);
        expect(renderCalls[3].clear).toBe(false);
        expect(renderCalls[3].boundMatHeight).toBe(gbInternal.rtMaterialHeight.source);
        // Unbound back to Texture.EMPTY.source after capture
        expect(gbInternal.particleNormalShader.resources.uMaterialHeight).toBe(
          PIXI.Texture.EMPTY.source,
        );

        gbuffer.destroy();
      } finally {
        delete glProg.from;
      }
    });

    it('applies LightSource offsetX/offsetY and uploads RADAR_SWEEP sweepAngleRad into p2.w (HIGH-02)', () => {
      const bufferSourceMock = vi.mocked(PIXI.BufferImageSource);
      bufferSourceMock.mockClear();
      const glProg = PIXI.GlProgram as unknown as { from?: ReturnType<typeof vi.fn> };
      const fromMock = vi.fn().mockReturnValue({});
      glProg.from = fromMock;

      try {
        const lighting = new LightingSystem(20, 15);
        const consoleEnt = world.createEntity();
        world.addComponent(consoleEnt, Position, { x: 5, y: 5 });
        world.addComponent(
          consoleEnt,
          LightSource,
          LightSource.schema.parse({
            color: '#10b981',
            intensity: 1.2,
            radius: 112,
            offsetX: 12,
            offsetY: -8,
            animation: { type: 'RADAR_SWEEP', speed: 2, amplitude: 0.4, secondaryColor: '#00f0ff' },
          }),
        );

        lighting.update({
          world,
          worldContainer: { x: 0, y: 0, scale: { x: 1, y: 1 }, filters: null } as never,
          terrainLayer: { children: [] } as never,
          itemLayer: { children: [] } as never,
          entityLayer: { children: [] } as never,
          spriteMap: new Map(),
          gridWidth: 20,
          gridHeight: 15,
          deltaMs: 250,
          enabled: true,
          playerEntityId: playerId,
        });

        const lights = lighting.getPrimaryLights();
        const sweepLight = lights.find((l) => typeof l.sweepAngleRad === 'number');
        expect(sweepLight).toBeDefined();
        expect(sweepLight!.screenX).toBe(5 * 32 + 16 + 12);
        expect(sweepLight!.screenY).toBe(5 * 32 + 16 - 8);
        expect(sweepLight!.sweepAngleRad).toBeGreaterThanOrEqual(0);

        const filter = new DeferredLightFilter(
          PIXI.Texture.EMPTY,
          PIXI.Texture.EMPTY,
          PIXI.Texture.EMPTY,
        );
        const shaderOpts = fromMock.mock.calls.find((c) =>
          String((c[0] as { fragment?: string })?.fragment ?? '').includes('uLightDataTex'),
        )?.[0] as { fragment?: string } | undefined;
        expect(shaderOpts?.fragment ?? '').toContain('p2.w >= 0.0');

        const lightBuf = (
          bufferSourceMock.mock.calls.find((c) => (c[0] as { height?: number }).height === 3)?.[0] as
            | { resource: Float32Array }
            | undefined
        )?.resource;
        expect(lightBuf).toBeDefined();

        filter.uploadUniforms({
          cameraX: 0,
          cameraY: 0,
          cameraZoom: 1,
          gridWidth: 20,
          gridHeight: 15,
          timeSec: 0.25,
          ambientRgb: [0.05, 0.08, 0.14],
          ambientIntensity: 0.18,
          shadowTintRgb: [0.05, 0.08, 0.14],
          conditionTintRgb: [1, 1, 1],
          floorPulseAmp: 0,
          floorPulseRgb: [0, 0, 0],
          primaryLights: [...lights],
          microLights: [],
        });

        // Row 2 channel W for non-sweep player light (index 0) is -1.0, and sweepLight (index 1) is >= 0
        expect(lightBuf![64 * 4 * 2 + 0 * 4 + 3]).toBe(-1.0);
        expect(lightBuf![64 * 4 * 2 + 1 * 4 + 3]).toBeCloseTo(sweepLight!.sweepAngleRad!, 4);

        filter.destroy(true);
        lighting.destroy();
      } finally {
        delete glProg.from;
      }
    });

    it('aligns GHOST_PULSE expanding wave (320px/650ms) and corrupted prop !triggered FLICKER 12Hz with Spec §5.3 (HIGH-03)', () => {
      const lighting = new LightingSystem(20, 15);
      lighting.spawnTransientLight({
        worldX: 160,
        worldY: 160,
        color: '#00f0ff',
        intensity: 2.8,
        startRadiusPx: 32,
        radiusPx: 320,
        durationMs: 650,
      });

      const dummyCtx = {
        world,
        worldContainer: { x: 0, y: 0, scale: { x: 1, y: 1 }, filters: null } as never,
        terrainLayer: { children: [] } as never,
        itemLayer: { children: [] } as never,
        entityLayer: { children: [] } as never,
        spriteMap: new Map(),
        gridWidth: 20,
        gridHeight: 15,
        enabled: true,
        playerEntityId: playerId,
      };

      lighting.update({ ...dummyCtx, deltaMs: 0 });
      const rStart = lighting.getPrimaryLights().find((l) => !l.castsShadows)!.radiusPx;
      lighting.update({ ...dummyCtx, deltaMs: 325 });
      const rMid = lighting.getPrimaryLights().find((l) => !l.castsShadows)!.radiusPx;
      expect(rStart).toBeCloseTo(32, 1);
      expect(rMid).toBeCloseTo(176, 1);
      lighting.update({ ...dummyCtx, deltaMs: 400 });
      expect(lighting.getPrimaryLights().some((l) => !l.castsShadows)).toBe(false);
      lighting.destroy();

      // Corrupted prop modulation: FLICKER 12Hz amp 0.4 while untriggered, stops when triggered
      const cProp = world.createEntity();
      world.addComponent(cProp, Position, { x: 11, y: 10 });
      world.addComponent(cProp, SpriteComponent, { key: 'prop_workstation' });
      world.addComponent(
        cProp,
        Prop,
        Prop.schema.parse({
          propId: 'ws_corr',
          faction: 'cyberacme',
          propClass: 'workstation',
          isSearched: false,
        }),
      );
      world.addComponent(
        cProp,
        CorruptedNode,
        CorruptedNode.schema.parse({
          corruptionLevel: 2,
          revealed: true,
          isDisarmed: false,
          triggered: false,
        }),
      );
      world.addComponent(
        cProp,
        LightSource,
        LightSource.schema.parse({ color: '#00f0ff', intensity: 1.0, radius: 96 }),
      );

      renderSystem.renderSystem();
      const activeCorr = renderSystem.getEffectiveEntityLight(cProp)!;
      expect(activeCorr.color).toBe('#ff0055');
      expect(activeCorr.animation).toEqual({ type: 'FLICKER', speed: 12.0, amplitude: 0.4 });

      world.patchComponent(cProp, CorruptedNode, { triggered: true });
      renderSystem.renderSystem();
      const detonatedCorr = renderSystem.getEffectiveEntityLight(cProp)!;
      expect(detonatedCorr.color).toBe('#00f0ff');
    });

    it('downsamples SelectiveBloomFilter via 0.5x/0.25x optimal textures and wires faction/condition bloom multipliers (MED-02)', () => {
      const glProg = PIXI.GlProgram as unknown as { from?: unknown };
      glProg.from = vi.fn().mockReturnValue({});
      const getOptMock = vi.mocked(PIXI.TexturePool.getOptimalTexture);
      const returnMock = vi.mocked(PIXI.TexturePool.returnTexture);
      getOptMock.mockClear();
      returnMock.mockClear();

      try {
        const bloom = new SelectiveBloomFilter(PIXI.Texture.EMPTY);
        const inputTex = { width: 960, height: 640, source: { width: 1024, height: 1024 } } as unknown as PIXI.Texture;
        const fakeFilterManager = { applyFilter: vi.fn() } as unknown as PIXI.FilterSystem;

        bloom.apply(fakeFilterManager, inputTex, PIXI.Texture.EMPTY, true);
        expect(getOptMock).toHaveBeenNthCalledWith(1, 960, 640, 0.5, false);
        expect(getOptMock).toHaveBeenNthCalledWith(2, 960, 640, 0.25, false);
        expect(returnMock).toHaveBeenCalledTimes(2);
        bloom.destroy(true);

        const lighting = new LightingSystem(20, 15);
        lighting.setEnvironmentTheme('traxus', 'THERMAL_SURGE');
        lighting.update({
          world,
          worldContainer: { x: 0, y: 0, scale: { x: 1, y: 1 }, filters: null } as never,
          terrainLayer: { children: [] } as never,
          itemLayer: { children: [] } as never,
          entityLayer: { children: [] } as never,
          spriteMap: new Map(),
          gridWidth: 20,
          gridHeight: 15,
          deltaMs: 16,
          enabled: true,
        });

        const internalBloom = (lighting as unknown as { bloomFilter: SelectiveBloomFilter | null })
          .bloomFilter;
        expect(internalBloom).not.toBeNull();
        // 0.72 base * 1.15 (Traxus) * 1.35 (THERMAL_SURGE) = 1.1178
        expect(internalBloom!.getIntensity()).toBeCloseTo(0.72 * 1.15 * 1.35, 4);
        lighting.destroy();
      } finally {
        delete glProg.from;
      }
    });

    it('applies OVERCLOCKED_GRID harmonic light jitter and NuCaloric #1a0d1e ambient profile (MED-03)', () => {
      expect(resolveFactionAmbientProfile('nucaloric').colorHex).toBe('#1a0d1e');

      const lighting = new LightingSystem(20, 15);
      lighting.setEnvironmentTheme('nucaloric', 'OVERCLOCKED_GRID');

      const staticProp = world.createEntity();
      world.addComponent(staticProp, Position, { x: 11, y: 10 });
      world.addComponent(
        staticProp,
        LightSource,
        LightSource.schema.parse({
          color: '#00f0ff',
          intensity: 1.0,
          radius: 100,
          animation: { type: 'STATIC', speed: 2, amplitude: 0 },
        }),
      );

      const intensities = new Set<string>();
      for (let i = 0; i < 6; i++) {
        lighting.update({
          world,
          worldContainer: { x: 0, y: 0, scale: { x: 1, y: 1 }, filters: null } as never,
          terrainLayer: { children: [] } as never,
          itemLayer: { children: [] } as never,
          entityLayer: { children: [] } as never,
          spriteMap: new Map(),
          gridWidth: 20,
          gridHeight: 15,
          deltaMs: 17,
          enabled: true,
          playerEntityId: playerId,
        });
        const propLight = lighting.getPrimaryLights()[1];
        expect(propLight).toBeDefined();
        intensities.add(propLight.intensity.toFixed(4));
      }
      expect(intensities.size).toBeGreaterThan(2);
      lighting.destroy();
    });

    it('omits unused rtAlbedo, skips heat-ghost shadow casters, and packs GlitchFilter slice offsets into G-Buffer quads (MED-04)', () => {
      const rtCreateMock = vi.mocked(PIXI.RenderTexture.create);
      rtCreateMock.mockClear();
      const glProg = PIXI.GlProgram as unknown as { from?: ReturnType<typeof vi.fn> };
      const fromMock = vi.fn().mockReturnValue({});
      glProg.from = fromMock;

      try {
        const gbuffer = new GBufferPass(10, 8);
        // Only rtNormalSpec and rtMaterialHeight allocated (no unused rtAlbedo)
        expect(rtCreateMock).toHaveBeenCalledTimes(2);
        expect((gbuffer as unknown as Record<string, unknown>).rtAlbedo).toBeUndefined();

        const validSrc = { width: 512, height: 512, destroyed: false };
        const ghostSprite = {
          label: 'heatGhost',
          visible: true,
          alpha: 0.4,
          x: 32,
          y: 32,
          width: 32,
          height: 32,
          scale: { x: 1, y: 1 },
          pivot: { x: 0, y: 0 },
          rotation: 0,
          filters: null,
          texture: { source: validSrc, frame: { x: 0, y: 0, width: 32, height: 32 } },
        } as unknown as PIXI.Sprite;

        const glitchedEnemy = {
          visible: true,
          alpha: 1.0,
          x: 64,
          y: 64,
          width: 32,
          height: 32,
          scale: { x: 1, y: 1 },
          pivot: { x: 0, y: 0 },
          rotation: 0,
          filters: [{ slices: 8, offset: 10 }],
          texture: { source: validSrc, frame: { x: 32, y: 0, width: 32, height: 32 } },
        } as unknown as PIXI.Sprite;

        const entityLayer = new PIXI.Container();
        (entityLayer.children as unknown[]).push(ghostSprite, glitchedEnemy);

        gbuffer.capture(
          { render: vi.fn() } as unknown as PIXI.Renderer,
          new PIXI.Container(),
          {
            terrainLayer: new PIXI.Container(),
            itemLayer: new PIXI.Container(),
            entityLayer,
          },
          1.25,
        );

        // Only glitchedEnemy should be packed (heatGhost skipped)
        expect(gbuffer.quadCount).toBe(1);
        const vdata = (gbuffer as unknown as { vertexData: Float32Array }).vertexData;
        expect(vdata[8]).toBe(8); // aMeta.z = glitchSlices
        expect(vdata[9]).toBe(10); // aMeta.w = glitchOffsetPx

        const shaderFrags = fromMock.mock.calls.map(
          (c) => (c[0] as { fragment?: string })?.fragment ?? '',
        );
        expect(shaderFrags.some((f) => f.includes('applyGlitchSliceUV'))).toBe(true);
        expect(shaderFrags.some((f) => f.includes('mat.g * vColor.a'))).toBe(true);

        gbuffer.destroy();
      } finally {
        delete glProg.from;
      }
    });
  });
});
