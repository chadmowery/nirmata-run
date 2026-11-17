import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { TurnManager } from '@engine/turn/turn-manager';
import { EntityRegistry } from '@engine/entity/registry';
import { EntityFactory } from '@engine/entity/factory';
import { sessionManager } from '@server/session/session-manager';
import { registerGameTemplates } from '@game/entities';
import {
  reconcileEntityTemplateAcrossSessions,
  reconcileMixinAcrossSessions,
  reconcileShellAcrossSessions,
  switchPlayerShellInSession,
} from '@/server/dev/hotload-reconciler';
import {
  Position,
  Health,
  Attack,
  Defense,
  SpriteComponent,
  TemplateId,
  Prop,
  BlocksMovement,
  AIState,
  Shell,
  Energy,
  PortConfig,
  Heat,
  LightSource,
  CorruptedNode,
  SecurityLock,
  AbilityDef,
  AugmentData,
  FovAwareness,
} from '@shared/components';
import { globalShellRegistry } from '@/game/shells/server';
import type { EngineEvents } from '@engine/events/types';

function createTestSession(sessionId: string) {
  const eventBus = new EventBus<EngineEvents>();
  const world = new World<EngineEvents>(eventBus, { childComponentKey: 'children' });
  const grid = new Grid(10, 10);
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
    }
  }
  const turnManager = new TurnManager(
    world,
    eventBus,
    { energyThreshold: 1000, defaultActionCost: 1000, waitActionCost: 500 },
    {
      getCandidateActors: () => [],
      isActorActive: () => true,
      canActorAct: () => true,
      accumulateEnergy: () => {},
      deductActionCost: () => {},
      isPrimaryActor: (id) => id === 1,
      getPrimaryActor: () => 1,
    },
  );
  const entityRegistry = new EntityRegistry();
  registerGameTemplates(entityRegistry);
  const entityFactory = new EntityFactory(entityRegistry);

  const playerId = world.createEntity();
  world.addComponent(playerId, Position, { x: 2, y: 2 });
  world.addComponent(playerId, Health, { current: 18, max: 25, isAlive: true });
  world.addComponent(playerId, Defense, { armor: 2 });
  world.addComponent(playerId, Energy, { current: 500, speed: 100, threshold: 1000 });
  world.addComponent(playerId, PortConfig, { maxFirmware: 2, maxAugment: 2, maxSoftware: 2 });
  world.addComponent(playerId, SpriteComponent, { key: 'player_vanguard' });
  world.addComponent(playerId, Shell, {
    archetypeId: 'vanguard-v1',
    speed: 100,
    stability: 10,
    armor: 2,
    maxHealth: 25,
  });

  sessionManager.createSession(sessionId, {
    world,
    grid,
    turnManager,
    eventBus,
    playerId,
    entityRegistry,
    entityFactory,
    shellId: 'vanguard-v1',
  });

  return { world, grid, playerId, entityRegistry };
}

describe('Live ECS World & Server Session Reconciliation (HOTLOAD-06)', () => {
  beforeEach(() => {
    sessionManager.clear();
  });

  it('reconciles live entity templates while preserving Position, Health damageTaken, Prop flags, and AI cooldowns', () => {
    const { world, grid, entityRegistry } = createTestSession('rec-sess-1');

    const enemyId = world.createEntity();
    world.addComponent(enemyId, TemplateId, { id: 'null-pointer' });
    world.addComponent(enemyId, Position, { x: 5, y: 6 });
    world.addComponent(enemyId, Health, { current: 12, max: 20, isAlive: true }); // damageTaken = 8
    world.addComponent(enemyId, Attack, { power: 4 });
    world.addComponent(enemyId, SpriteComponent, { key: 'enemy_null_pointer' });
    world.addComponent(enemyId, AIState, {
      behavior: 'chasing' as never,
      behaviorType: 'null_pointer' as never,
      sightRadius: 6,
      cooldowns: { dash: 2 },
      remainingMemoryTurns: 3,
    });

    const propId = world.createEntity();
    world.addComponent(propId, TemplateId, { id: 'prop-workstation' });
    world.addComponent(propId, Position, { x: 4, y: 4 });
    world.addComponent(propId, Prop, {
      propId: 'prop-workstation',
      faction: 'cyberacme',
      propClass: 'workstation',
      ventAmount: 10,
      isSearched: true,
    });
    world.addComponent(propId, CorruptedNode, {
      trapType: 'hud_glitch',
      revealed: false,
      triggered: false,
      isDisarmed: false,
    });

    const baseEnemy = entityRegistry.get('null-pointer')!;
    const updatedEnemy = {
      ...baseEnemy,
      components: {
        ...(baseEnemy.components ?? {}),
        health: { current: 30, max: 30, isAlive: true },
        attack: { power: 9 },
        sprite: { key: 'enemy_null_pointer_v2' },
        aiState: {
          behavior: 'idle',
          behaviorType: 'null_pointer',
          sightRadius: 9,
        },
        blocksMovement: {},
      },
      overrides: {
        ...(baseEnemy.overrides ?? {}),
        health: { current: 30, max: 30 },
        attack: { power: 9 },
      },
    };

    const patches = reconcileEntityTemplateAcrossSessions('null-pointer', updatedEnemy as never);
    const patch = patches['rec-sess-1'];
    expect(patch).toBeDefined();

    // Position preserved
    expect(world.getComponent(enemyId, Position)).toEqual({ x: 5, y: 6 });
    // Damage taken preserved: 30 - (20 - 12) = 22
    expect(world.getComponent(enemyId, Health)).toEqual({ current: 22, max: 30, isAlive: true });
    // Stats & sprite updated
    expect(world.getComponent(enemyId, Attack)?.power).toBe(9);
    expect(world.getComponent(enemyId, SpriteComponent)?.key).toBe('enemy_null_pointer_v2');
    // AI runtime behavior & cooldowns preserved on server, redacted on client patch
    const ai = world.getComponent(enemyId, AIState)!;
    expect(ai.behavior).toBe('chasing');
    expect(ai.sightRadius).toBe(9);
    expect(ai.cooldowns).toEqual({ dash: 2 });

    const clientEntry = patch.updatedEntities.find((e) => e.entityId === enemyId)!;
    expect((clientEntry.componentsSet.aiState as Record<string, unknown>).cooldowns).toBeUndefined();

    // BlocksMovement synchronized grid walkability
    expect(grid.isWalkable(5, 6)).toBe(false);
    expect(patch.gridWalkabilityUpdates).toEqual([{ x: 5, y: 6, walkable: false }]);

    // Prop runtime flags preserved & unrevealed trapType redacted
    const baseProp = entityRegistry.get('prop-workstation')!;
    const propPatches = reconcileEntityTemplateAcrossSessions('prop-workstation', {
      ...baseProp,
      components: {
        ...(baseProp.components ?? {}),
        prop: {
          propId: 'prop-workstation',
          faction: 'cyberacme',
          propClass: 'workstation',
          ventAmount: 25,
          isSearched: false,
        },
        corruptedNode: {
          trapType: 'hud_glitch',
          revealed: false,
          triggered: false,
          isDisarmed: false,
        },
      },
    } as never);
    expect(world.getComponent(propId, Prop)?.ventAmount).toBe(25);
    expect(world.getComponent(propId, Prop)?.isSearched).toBe(true);
    const propPatch = propPatches['rec-sess-1'].updatedEntities.find((e) => e.entityId === propId)!;
    expect((propPatch.componentsSet.corruptedNode as Record<string, unknown>).trapType).toBeUndefined();
  });

  it('reconciles mixin edits across inheriting entities', () => {
    const { world, entityRegistry } = createTestSession('rec-sess-mixin');
    entityRegistry.upsert({
      name: 'test-grunt',
      mixins: ['physical', 'combatant'],
      components: {},
    });
    const enemyId = world.createEntity();
    world.addComponent(enemyId, TemplateId, { id: 'test-grunt' });
    world.addComponent(enemyId, Health, { current: 10, max: 10, isAlive: true });
    world.addComponent(enemyId, Defense, { armor: 1 });

    const patches = reconcileMixinAcrossSessions('combatant', {
      name: 'combatant',
      components: {
        health: { current: 10, max: 10, isAlive: true },
        attack: { power: 3 },
        defense: { armor: 7 },
      },
    });
    expect(patches['rec-sess-mixin']).toBeDefined();
    expect(world.getComponent(enemyId, Defense)?.armor).toBe(7);
  });

  it('reconciles active player Shell edits and supports mid-run switchPlayerShellInSession', () => {
    const { world, playerId } = createTestSession('rec-sess-shell');
    const vanguardTpl = globalShellRegistry.getTemplates().find((t) => t.id === 'vanguard-v1')!;

    const patches = reconcileShellAcrossSessions({
      ...vanguardTpl,
      baseStats: { ...vanguardTpl.baseStats, maxHealth: 40, armor: 5, speed: 120 },
      lightSource: {
        enabled: true,
        color: '#00ffaa',
        intensity: 2.0,
        radius: 180,
        height: 20,
        falloff: 1.5,
        castsShadows: true,
        offsetX: 0,
        offsetY: 0,
      },
    });

    expect(patches['rec-sess-shell']).toBeDefined();
    // Player had 25 max, 18 current (damageTaken = 7) -> 40 - 7 = 33
    expect(world.getComponent(playerId, Health)?.max).toBe(40);
    expect(world.getComponent(playerId, Health)?.current).toBe(33);
    expect(world.getComponent(playerId, Defense)?.armor).toBe(5);
    expect(world.getComponent(playerId, Energy)?.speed).toBe(120);
    expect(world.getComponent(playerId, LightSource)?.color).toBe('#00ffaa');

    // Switch mid-run to ghost-v1
    const switchPatch = switchPlayerShellInSession('rec-sess-shell', 'ghost-v1');
    expect(switchPatch).not.toBeNull();
    expect(world.getComponent(playerId, Shell)?.archetypeId).toBe('ghost-v1');

    // Restore original vanguard-v1 in global registry so other tests are unaffected
    globalShellRegistry.upsertTemplate(vanguardTpl);
  });

  it('clears deleted optional fields, applies Zod defaults, removes deleted components, and preserves faradayBounds/isLegacy (HIGH-03)', () => {
    const { world, entityRegistry } = createTestSession('rec-sess-high03');

    const doorId = world.createEntity();
    world.addComponent(doorId, TemplateId, { id: 'prop-vault-door' });
    world.addComponent(doorId, Position, { x: 3, y: 3 });
    world.addComponent(doorId, SpriteComponent, {
      key: 'prop_vault_door',
      animationSet: 'vault_pulse',
      initialState: 'locked',
      speedMultiplier: 1,
      paused: false,
      desyncPhase: false,
    });
    world.addComponent(doorId, SecurityLock, {
      isLocked: true,
      keyIdRequired: 'access-key',
      faradayBounds: { x: 1, y: 1, width: 5, height: 5 },
    });
    world.addComponent(doorId, FovAwareness, { canSeePlayer: false });

    const baseDoor = entityRegistry.get('prop-vault-door')!;
    const nextDoorComps = { ...(baseDoor.components ?? {}) } as Record<string, unknown>;
    delete nextDoorComps.fovAwareness;
    nextDoorComps.sprite = { key: 'prop_vault_door_v2' }; // animationSet, initialState removed; speedMultiplier omitted -> Zod default 1
    nextDoorComps.lightSource = { color: '#ff00ff' }; // enabled/radius/etc omitted -> Zod defaults populated

    const patches = reconcileEntityTemplateAcrossSessions('prop-vault-door', {
      ...baseDoor,
      components: nextDoorComps,
    } as never);

    expect(patches['rec-sess-high03']).toBeDefined();
    const updatedSprite = world.getComponent(doorId, SpriteComponent)!;
    expect(updatedSprite.key).toBe('prop_vault_door_v2');
    expect(updatedSprite.animationSet).toBeUndefined();
    expect(updatedSprite.initialState).toBeUndefined();
    expect(updatedSprite.speedMultiplier).toBe(1);

    const updatedLight = world.getComponent(doorId, LightSource)!;
    expect(updatedLight.enabled).toBe(true);
    expect(updatedLight.color).toBe('#ff00ff');

    expect(world.hasComponent(doorId, FovAwareness)).toBe(false);
    expect(world.getComponent(doorId, SecurityLock)?.faradayBounds).toEqual({
      x: 1,
      y: 1,
      width: 5,
      height: 5,
    });

    // AbilityDef & AugmentData preserve runtime isLegacy flag
    const fwId = world.createEntity();
    world.addComponent(fwId, TemplateId, { id: 'phase-shift' });
    world.addComponent(fwId, AbilityDef, {
      name: 'Phase Shift',
      heatCost: 15,
      range: 4,
      cooldown: 3,
      currentCooldown: 2,
      isActive: true,
      isLegacy: true,
      trigger: 'ON_ACTIVATE',
      payloads: [],
    } as never);

    const augId = world.createEntity();
    world.addComponent(augId, TemplateId, { id: 'displacement-venting' });
    world.addComponent(augId, AugmentData, {
      name: 'Displacement Venting',
      trigger: 'ON_MOVE',
      payloads: [],
      isLegacy: true,
    } as never);

    const baseFw = entityRegistry.get('phase-shift')!;
    reconcileEntityTemplateAcrossSessions('phase-shift', baseFw);
    expect(world.getComponent(fwId, AbilityDef)?.isLegacy).toBe(true);
    expect(world.getComponent(fwId, AbilityDef)?.isActive).toBe(true);

    const baseAug = entityRegistry.get('displacement-venting')!;
    reconcileEntityTemplateAcrossSessions('displacement-venting', baseAug);
    expect(world.getComponent(augId, AugmentData)?.isLegacy).toBe(true);
  });

  it('applies profile shell upgrades, updates Heat.baseDissipation, and preserves facing direction on Shell reconcile (HIGH-04)', () => {
    const { world, playerId } = createTestSession('rec-sess-high04');
    const bastionTpl = globalShellRegistry.getTemplates().find((t) => t.id === 'bastion-v1')!;

    // Attach shellUpgrades to session state and Heat component to player
    const sessionState = sessionManager.getSession('rec-sess-high04')!;
    sessionState.shellUpgrades = {
      'bastion-v1': { speed: 2, armor: 1, stability: 2, additionalPorts: 1 },
    };
    world.addComponent(playerId, Heat, {
      current: 10,
      maxSafe: 100,
      baseDissipation: 5,
      ventPercentage: 0.5,
      isVenting: false,
    });
    world.addComponent(playerId, Shell, {
      archetypeId: 'bastion-v1',
      speed: bastionTpl.baseStats.speed,
      stability: bastionTpl.baseStats.stability,
      armor: bastionTpl.baseStats.armor,
      maxHealth: bastionTpl.baseStats.maxHealth,
      directionalSprites: {
        north: 'bastion-v1-north',
        east: 'bastion-v1-east',
        south: 'bastion-v1-south',
        west: 'bastion-v1-west',
      },
      defaultDirection: 'south',
    });
    // Player is currently facing north
    world.addComponent(playerId, SpriteComponent, { key: 'bastion-v1-north' });

    const patches = reconcileShellAcrossSessions({
      ...bastionTpl,
      baseStats: { speed: 100, armor: 3, stability: 20, maxHealth: 35 },
      basePorts: { maxFirmware: 2, maxAugment: 2, maxSoftware: 2 },
      directionalSprites: {
        north: 'bastion-v1-north-v2',
        east: 'bastion-v1-east-v2',
        south: 'bastion-v1-south-v2',
        west: 'bastion-v1-west-v2',
      },
      defaultDirection: 'south',
    });

    expect(patches['rec-sess-high04']).toBeDefined();
    // Upgraded stats: speed = 100 + 2*5 = 110, armor = 3 + 1 = 4, stability = 20 + 2*10 = 40
    expect(world.getComponent(playerId, Shell)?.speed).toBe(110);
    expect(world.getComponent(playerId, Defense)?.armor).toBe(4);
    expect(world.getComponent(playerId, Energy)?.speed).toBe(110);
    expect(world.getComponent(playerId, PortConfig)).toEqual({
      maxFirmware: 3,
      maxAugment: 3,
      maxSoftware: 3,
    });
    // Heat.baseDissipation = 5 + 40 * 0.1 = 9
    expect(world.getComponent(playerId, Heat)?.baseDissipation).toBe(9);
    // Preserved north facing direction instead of snapping to defaultDirection ('south')
    expect(world.getComponent(playerId, SpriteComponent)?.key).toBe('bastion-v1-north-v2');

    globalShellRegistry.upsertTemplate(bastionTpl);
  });
});
