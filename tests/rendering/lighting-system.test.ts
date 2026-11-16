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
import { Prop } from '@shared/components/environment';
import * as PIXI from 'pixi.js';
import {
  DeferredLightFilter,
  GBufferPass,
  LightingSystem,
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
  const GlProgram: { from?: unknown } = {};
  return {
    Sprite,
    Container,
    Graphics,
    Texture,
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
      animation: { type: 'FLICKER', speed: 3, amplitude: 0.6 },
    };
    const fValues = new Set(
      Array.from({ length: 10 }, (_, i) => evaluateLightAnimation(flicker, i * 0.09, 0).intensityMultiplier.toFixed(3)),
    );
    expect(fValues.size).toBeGreaterThan(2);

    const strobe: LightSourceData = {
      ...base,
      animation: { type: 'STROBE', speed: 2, amplitude: 0.5 },
    };
    const stOn = evaluateLightAnimation(strobe, 0.05, 0);
    const stOff = evaluateLightAnimation(strobe, 0.3, 0);
    expect(stOn.intensityMultiplier).toBeGreaterThan(stOff.intensityMultiplier);

    const sweep: LightSourceData = {
      ...base,
      animation: { type: 'RADAR_SWEEP', speed: 1, amplitude: 0.5 },
    };
    const sw0 = evaluateLightAnimation(sweep, 0, 0);
    const swHalf = evaluateLightAnimation(sweep, 0.5, 0);
    expect(sw0.angleOffsetRad).toBe(0);
    expect(swHalf.angleOffsetRad).toBeGreaterThan(3.0);
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

    it('modulates player LightSource for Heat tier, Low Stability (<50), and Extended_Sight.sys', () => {
      // Overload heat tier (>= 80) shifts light toward orange/red with flicker
      world.patchComponent(playerId, Heat, { current: 85 });
      renderSystem.renderSystem();
      const hotLight = world.getComponent(playerId, LightSource)!;
      expect(hotLight.color).toBe('#ff4500');
      expect(hotLight.animation.type).toBe('FLICKER');

      // Cool down & drop stability < 50 -> shrinks radius & flickers
      world.patchComponent(playerId, Heat, { current: 0 });
      world.patchComponent(playerId, Stability, { current: 30 });
      renderSystem.renderSystem();
      const unstableLight = world.getComponent(playerId, LightSource)!;
      expect(unstableLight.radius).toBeLessThan(200);
      expect(unstableLight.animation.type).toBe('FLICKER');

      // Restore stability & grant Extended_Sight.sys firmware -> boosts radius by +48px
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
      const boostedLight = world.getComponent(playerId, LightSource)!;
      expect(boostedLight.radius).toBe(248);
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
  });
});
