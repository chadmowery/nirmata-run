import { describe, it, expect, vi, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Grid } from '@engine/grid/grid';
import { EntityRegistry } from '@engine/entity/registry';
import { EntityFactory } from '@engine/entity/factory';
import { registerGameTemplates } from '@/game/entities';
import { TemplateId, SpriteComponent, LightSource, Shell } from '@shared/components';
import type { GameContext } from '@/game/types';
import type { GameEvents } from '@/game/events/types';
import type { RenderSystem } from '@/rendering/render-system';
import { ClientHotloadBridge } from '../client-hotload-bridge';

function createTestContext() {
  const eventBus = new EventBus<GameEvents>();
  const world = new World<GameEvents>(eventBus);
  const grid = new Grid(10, 10);
  const registry = new EntityRegistry();
  registerGameTemplates(registry);
  registry.upsert({
    name: 'test-grunt',
    mixins: ['physical', 'combatant'],
    components: {
      sprite: { key: 'enemy_null_pointer' },
    },
  });
  const entityFactory = new EntityFactory(registry);
  const applyHotloadSpriteUpdate = vi.fn();

  const ctx = {
    world,
    grid,
    eventBus,
    entityFactory,
    playerId: -1,
  } as unknown as GameContext;

  const rs = {
    applyHotloadSpriteUpdate,
  } as unknown as RenderSystem;

  const bridge = new ClientHotloadBridge({
    getContext: () => ctx,
    getRenderSystem: () => rs,
    getGameAudioSystem: () => null,
  });

  return { world, ctx, rs, bridge, applyHotloadSpriteUpdate };
}

describe('ClientHotloadBridge Presentation PREVIEW/REVERT (HIGH-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches mixin-inheriting entities on mixin PREVIEW and removes added LightSource on REVERT', async () => {
    const { world, bridge, applyHotloadSpriteUpdate } = createTestContext();
    const enemy = world.createEntity();
    world.addComponent(enemy, TemplateId, { id: 'test-grunt' });
    world.addComponent(enemy, SpriteComponent, {
      key: 'enemy_null_pointer',
      speedMultiplier: 1,
      paused: false,
      desyncPhase: false,
    });

    await bridge.handleEnvelope({
      id: 'preview-mixin-1',
      timestamp: Date.now(),
      mode: 'PREVIEW',
      domain: 'mixin',
      targetId: 'combatant',
      payload: {
        name: 'combatant',
        components: {
          health: { current: 10, max: 10, isAlive: true },
          lightSource: {
            enabled: true,
            color: '#00ffaa',
            intensity: 1.2,
            radius: 128,
            height: 18,
            falloff: 1.8,
            castsShadows: false,
            offsetX: 0,
            offsetY: 0,
          },
        },
      },
    });

    expect(world.hasComponent(enemy, LightSource)).toBe(true);
    expect(world.getComponent(enemy, LightSource)?.color).toBe('#00ffaa');

    await bridge.handleEnvelope({
      id: 'revert-mixin-1',
      timestamp: Date.now(),
      mode: 'REVERT',
      domain: 'mixin',
      targetId: 'combatant',
      payload: {
        name: 'combatant',
        components: {
          health: { current: 10, max: 10, isAlive: true },
        },
      },
    });

    expect(world.hasComponent(enemy, LightSource)).toBe(false);
    expect(applyHotloadSpriteUpdate).toHaveBeenCalledWith(enemy);
  });

  it('preserves player facing direction on shell PREVIEW and removes LightSource on REVERT', async () => {
    const { world, ctx, bridge, applyHotloadSpriteUpdate } = createTestContext();
    const player = world.createEntity();
    ctx.playerId = player;
    world.addComponent(player, Shell, {
      archetypeId: 'bastion-v1',
      speed: 100,
      stability: 100,
      armor: 2,
      maxHealth: 30,
      directionalSprites: {
        north: 'bastion_v1_n',
        east: 'bastion_v1_e',
        south: 'bastion_v1_s',
        west: 'bastion_v1_w',
      },
      defaultDirection: 'south',
    });
    world.addComponent(player, SpriteComponent, {
      key: 'bastion_v1_n',
      speedMultiplier: 1,
      paused: false,
      desyncPhase: false,
    });

    await bridge.handleEnvelope({
      id: 'preview-shell-1',
      timestamp: Date.now(),
      mode: 'PREVIEW',
      domain: 'shell',
      targetId: 'bastion-v1',
      payload: {
        id: 'bastion-v1',
        sprite: 'bastion_v1_s',
        directionalSprites: {
          north: 'bastion_v1_n_alt',
          east: 'bastion_v1_e_alt',
          south: 'bastion_v1_s_alt',
          west: 'bastion_v1_w_alt',
        },
        defaultDirection: 'south',
        lightSource: {
          enabled: true,
          color: '#ffaa00',
          intensity: 1,
          radius: 160,
          height: 18,
          falloff: 1.8,
          castsShadows: false,
          offsetX: 0,
          offsetY: 0,
        },
      },
    });

    expect(world.getComponent(player, SpriteComponent)?.key).toBe('bastion_v1_n_alt');
    expect(world.hasComponent(player, LightSource)).toBe(true);
    expect(applyHotloadSpriteUpdate).toHaveBeenCalledWith(player);

    await bridge.handleEnvelope({
      id: 'revert-shell-1',
      timestamp: Date.now(),
      mode: 'REVERT',
      domain: 'shell',
      targetId: 'bastion-v1',
      payload: {
        id: 'bastion-v1',
        sprite: 'bastion_v1_s',
        directionalSprites: {
          north: 'bastion_v1_n',
          east: 'bastion_v1_e',
          south: 'bastion_v1_s',
          west: 'bastion_v1_w',
        },
        defaultDirection: 'south',
      },
    });

    expect(world.getComponent(player, SpriteComponent)?.key).toBe('bastion_v1_n');
    expect(world.hasComponent(player, LightSource)).toBe(false);
  });
});
