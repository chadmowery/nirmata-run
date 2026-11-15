import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { World } from '../../src/engine/ecs/world';
import { EventBus } from '../../src/engine/events/event-bus';
import { GameEvents } from '../../src/game/events/types';
import { Grid } from '../../src/engine/grid/grid';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { SpriteComponent } from '@shared/components/sprite';
import { AIBehaviorType } from '@shared/components/ai-state';
import { Prop } from '@shared/components/environment';
import {
  ParticlePool,
  ParticleSystem,
} from '../../src/rendering/particles';
import { MAX_MICRO_LIGHTS } from '../../src/rendering/lighting/types';
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
      destroyed: false,
      tint: 0xffffff,
      anchor: { set: vi.fn() },
      scale: { x: 1, y: 1, set: vi.fn() },
      pivot: { x: 0, y: 0, set: vi.fn() },
      rotation: 0,
      filters: null,
      parent: { addChild: vi.fn() },
      removeFromParent: vi.fn(),
      destroy: vi.fn(function (this: { destroyed: boolean }) {
        this.destroyed = true;
      }),
    };
  });
  const Container = vi.fn().mockImplementation(function () {
    return {
      x: 0,
      y: 0,
      destroyed: false,
      scale: { x: 1, y: 1, set: vi.fn() },
      pivot: { x: 0, y: 0, set: vi.fn() },
      filters: null,
      children: [],
      addChild: vi.fn(),
      removeChild: vi.fn(),
      destroy: vi.fn(function (this: { destroyed: boolean }) {
        this.destroyed = true;
      }),
    };
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
  const Texture = {
    EMPTY: { width: 1, height: 1, source: { width: 1, height: 1 } },
    WHITE: { width: 16, height: 16, source: { width: 16, height: 16 } },
    from: vi.fn().mockReturnValue({ width: 32, height: 32 }),
  };
  return {
    Sprite,
    Container,
    Graphics,
    Texture,
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

describe('Pooled Dual-Mode Lit Particle & Micro-Light System [LIGHT-05/07]', () => {
  it('enforces pool capacity and reuses expired slots with zero leaks', () => {
    const pool = new ParticlePool(8);
    for (let i = 0; i < 10; i++) {
      const ok = pool.spawn({
        emitterId: 0,
        mode: 'emissive',
        worldX: 100 + i * 20,
        worldY: 100,
        vx: 0,
        vy: 0,
        gravity: 0,
        bounceFactor: 0,
        bounceFloorY: 200,
        maxLifeMs: 50,
        size: 3,
        colorHex: 0x00f0ff,
        heightPx: 12,
        shadowOpacity: 0,
        microIntensity: 1.0,
        microRadiusPx: 36,
      });
      expect(ok).toBe(i < 8);
    }
    expect(pool.activeCount).toBe(8);

    // Advance past lifetime -> all slots recycle back to free list
    pool.update(80);
    expect(pool.activeCount).toBe(0);

    // Re-spawning succeeds cleanly from recycled pool
    const respawned = pool.spawn({
      emitterId: 0,
      mode: 'normal_lit',
      worldX: 120,
      worldY: 120,
      vx: 0,
      vy: -0.01,
      gravity: 0,
      bounceFactor: 0,
      bounceFloorY: 200,
      maxLifeMs: 400,
      size: 6,
      colorHex: 0x10b981,
      heightPx: 10,
      shadowOpacity: 0.15,
      microIntensity: 0,
      microRadiusPx: 0,
    });
    expect(respawned).toBe(true);
    expect(pool.activeCount).toBe(1);

    pool.destroy();
  });

  it('clusters emissive micro-lights within 12px cells and caps output to 64 uMicroLights', () => {
    const pool = new ParticlePool(128);

    // 4 particles inside same 12x12px cell (x=24..30, y=24..30) -> should merge into 1 micro-light
    for (let i = 0; i < 4; i++) {
      pool.spawn({
        emitterId: 0,
        mode: 'emissive',
        worldX: 25 + i,
        worldY: 25 + i,
        vx: 0,
        vy: 0,
        gravity: 0,
        bounceFactor: 0,
        bounceFloorY: 100,
        maxLifeMs: 500,
        size: 3,
        colorHex: 0xffaa00,
        heightPx: 12,
        shadowOpacity: 0,
        microIntensity: 0.8,
        microRadiusPx: 40,
      });
    }

    const merged = pool.collectRenderDescriptors(0, 0, 1);
    expect(merged.particles).toHaveLength(4);
    expect(merged.microLights).toHaveLength(1);
    expect(merged.microLights[0].intensity).toBeGreaterThan(1.0);

    pool.clearAll();

    // 80 separate cells (> 12px apart) -> clamped strictly to MAX_MICRO_LIGHTS (64)
    for (let i = 0; i < 80; i++) {
      pool.spawn({
        emitterId: 0,
        mode: 'emissive',
        worldX: (i % 20) * 20,
        worldY: Math.floor(i / 20) * 20,
        vx: 0,
        vy: 0,
        gravity: 0,
        bounceFactor: 0,
        bounceFloorY: 200,
        maxLifeMs: 500,
        size: 2,
        colorHex: 0x00f0ff,
        heightPx: 12,
        shadowOpacity: 0,
        microIntensity: 0.5 + (i % 5) * 0.2,
        microRadiusPx: 32,
      });
    }

    const capped = pool.collectRenderDescriptors(0, 0, 1);
    expect(capped.particles).toHaveLength(80);
    expect(capped.microLights).toHaveLength(MAX_MICRO_LIGHTS);

    pool.destroy();
  });

  it('produces dual-mode descriptors for EMISSIVE_LIGHT vs NORMAL_LIT bursts & emitters', () => {
    const ps = new ParticleSystem(256);

    ps.emitDamageBurst(160, 160, 0);
    const dmgOut = ps.getLightingInputs(0, 0, 1);
    expect(dmgOut.particles.every((p) => p.mode === 'emissive')).toBe(true);
    expect(dmgOut.microLights.length).toBeGreaterThan(0);

    ps.disposeAllEmitters();

    ps.emitCryoSpillBurst(160, 160);
    const cryoOut = ps.getLightingInputs(0, 0, 1);
    const emissiveCount = cryoOut.particles.filter((p) => p.mode === 'emissive').length;
    const normalLitCount = cryoOut.particles.filter((p) => p.mode === 'normal_lit').length;
    expect(emissiveCount).toBeGreaterThan(0);
    expect(normalLitCount).toBeGreaterThan(0);
    expect(
      cryoOut.particles.filter((p) => p.mode === 'normal_lit').every((p) => p.shadowOpacity === 0.15 && p.heightPx > 0),
    ).toBe(true);

    const mockSprite = { x: 64, y: 64, visible: true, alpha: 1, destroyed: false, pivot: { x: 0, y: 0 } } as never;
    ps.attachBehaviorEmitter(mockSprite, AIBehaviorType.FRAGMENTER);
    ps.update(110);
    expect(ps.getTelemetry().activeEmitters).toBe(1);

    ps.destroy();
  });

  describe('RenderSystem Particle Event Triggers & Anti-Cheat FOV Gating', () => {
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
      world.addComponent(playerId, Position, { x: 8, y: 8 });
      world.addComponent(playerId, Actor, { isPlayer: true });
      world.addComponent(playerId, SpriteComponent, { key: 'player' });

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
      renderSystem?.destroy();
    });

    it('emits particle bursts on DAMAGE_DEALT, VENT_COMPLETED, and visible PROP_INTERACTED, skipping out-of-FOV props', () => {
      // Out-of-FOV cryo vat interaction should NOT spawn particles (anti-cheat FOW gating)
      const farProp = world.createEntity();
      world.addComponent(farProp, Position, { x: 26, y: 16 });
      world.addComponent(farProp, SpriteComponent, { key: 'prop_cryo_vat' });
      world.addComponent(
        farProp,
        Prop,
        Prop.schema.parse({
          propId: 'vat_far',
          faction: 'sekiguchi',
          propClass: 'volatile_vat',
          isSearched: false,
        }),
      );

      renderSystem.renderSystem();
      const baseParticles = renderSystem.getRenderTelemetry().particles.totalParticles;
      eventBus.emit('PROP_INTERACTED', { propId: farProp, entityId: playerId, action: 'shatter' } as never);
      eventBus.flush();
      expect(renderSystem.getRenderTelemetry().particles.totalParticles).toBe(baseParticles);

      // Visible DAMAGE_DEALT & VENT_COMPLETED populate pooled particles + telemetry
      eventBus.emit('DAMAGE_DEALT', { attackerId: playerId, defenderId: playerId, amount: 4 } as never);
      eventBus.flush();
      expect(renderSystem.getRenderTelemetry().particles.totalParticles).toBeGreaterThan(baseParticles);

      const afterDmg = renderSystem.getRenderTelemetry().particles.totalParticles;
      eventBus.emit('VENT_COMPLETED', { entityId: playerId, oldHeat: 60, newHeat: 30 });
      eventBus.flush();
      expect(renderSystem.getRenderTelemetry().particles.totalParticles).toBeGreaterThan(afterDmg);
    });
  });
});
