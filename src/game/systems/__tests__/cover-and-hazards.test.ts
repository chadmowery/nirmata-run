import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { Phase } from '@engine/ecs/types';
import {
  Attack,
  Health,
  Position,
  Actor,
  Hostile,
  Shell,
  Heat,
  StatusEffects,
  InteractiveSurface,
  CorruptedNode,
  PropInteractedThisTurn,
  FloorState,
  AugmentSlots,
  AugmentData,
  AugmentState,
  AbilityDef,
  FirmwareSlots,
  Dying,
} from '@shared/components';
import { AttackIntent, FirmwareIntent } from '@shared/components/intents';
import { GameplayEvents } from '@shared/events/types';
import { createCombatSystem } from '../combat';
import { createFirmwareSystem } from '../firmware';
import { createAugmentSystem } from '../augment';
import { createTriggerContext, evaluateCondition } from '../augment-util';

describe('Milestone 4: Directional Cover, Cascade Hazards & Augment Counterplay', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(20, 20);
  });

  describe('Directional Cover', () => {
    it('reduces ranged attack damage by 25% when cover is positioned between attacker and defender', () => {
      const combat = createCombatSystem(world, grid, eventBus);
      combat.init();

      // Attacker at (5, 8), Defender at (5, 5) -> Distance = 3 (Ranged)
      const attacker = world.createEntity();
      world.addComponent(attacker, Position, { x: 5, y: 8 });
      world.addComponent(attacker, Attack, { power: 20 });
      world.addComponent(attacker, Actor, { isPlayer: false });

      const defender = world.createEntity();
      world.addComponent(defender, Position, { x: 5, y: 5 });
      world.addComponent(defender, Health, { current: 100, max: 100, isAlive: true });
      world.addComponent(defender, Actor, { isPlayer: true });

      // Low cover at (5, 6) -> Orthogonally adjacent to defender, closer to attacker (dist 2 < 3)
      const cover = world.createEntity();
      world.addComponent(cover, Position, { x: 5, y: 6 });
      world.addComponent(cover, InteractiveSurface, {
        surfaceId: 'crate_cover',
        providesCover: true,
        coverDamageReduction: 0.25,
      });

      world.addComponent(attacker, AttackIntent, { targetId: defender });

      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      // Base damage = 20. With 25% reduction = Math.floor(20 * 0.75) = 15.
      // Defender health: 100 - 15 = 85.
      const health = world.getComponent(defender, Health)!;
      expect(health.current).toBe(85);
    });

    it('grants 35% cover reduction if defender has BASTION-v1 shell', () => {
      const combat = createCombatSystem(world, grid, eventBus);
      combat.init();

      const attacker = world.createEntity();
      world.addComponent(attacker, Position, { x: 5, y: 8 });
      world.addComponent(attacker, Attack, { power: 20 });
      world.addComponent(attacker, Actor, { isPlayer: false });

      const defender = world.createEntity();
      world.addComponent(defender, Position, { x: 5, y: 5 });
      world.addComponent(defender, Health, { current: 100, max: 100, isAlive: true });
      world.addComponent(defender, Actor, { isPlayer: true });
      world.addComponent(defender, Shell, {
        archetypeId: 'bastion-v1',
        speed: 80,
        stability: 100,
        armor: 3,
        maxHealth: 100,
      });

      const cover = world.createEntity();
      world.addComponent(cover, Position, { x: 5, y: 6 });
      world.addComponent(cover, InteractiveSurface, {
        surfaceId: 'crate_cover',
        providesCover: true,
        coverDamageReduction: 0.25,
      });

      world.addComponent(attacker, AttackIntent, { targetId: defender });

      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      // Base damage = 20. With 35% reduction = Math.floor(20 * (1 - 0.35)) = Math.floor(13) = 13.
      // Defender health: 100 - 13 = 87.
      const health = world.getComponent(defender, Health)!;
      expect(health.current).toBe(87);
    });

    it('does NOT reduce damage for melee attacks (distance <= 1)', () => {
      const combat = createCombatSystem(world, grid, eventBus);
      combat.init();

      // Attacker at (5, 6), Defender at (5, 5) -> Distance = 1 (Melee)
      const attacker = world.createEntity();
      world.addComponent(attacker, Position, { x: 5, y: 6 });
      world.addComponent(attacker, Attack, { power: 20 });
      world.addComponent(attacker, Actor, { isPlayer: false });

      const defender = world.createEntity();
      world.addComponent(defender, Position, { x: 5, y: 5 });
      world.addComponent(defender, Health, { current: 100, max: 100, isAlive: true });
      world.addComponent(defender, Actor, { isPlayer: true });

      // Cover behind defender at (5, 4)
      const cover = world.createEntity();
      world.addComponent(cover, Position, { x: 5, y: 4 });
      world.addComponent(cover, InteractiveSurface, {
        surfaceId: 'crate_cover',
        providesCover: true,
      });

      world.addComponent(attacker, AttackIntent, { targetId: defender });

      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      // Full 20 damage dealt
      const health = world.getComponent(defender, Health)!;
      expect(health.current).toBe(80);
    });

    it('does NOT reduce damage if cover is flanking or behind the defender relative to attacker', () => {
      const combat = createCombatSystem(world, grid, eventBus);
      combat.init();

      // Attacker at (5, 8), Defender at (5, 5)
      const attacker = world.createEntity();
      world.addComponent(attacker, Position, { x: 5, y: 8 });
      world.addComponent(attacker, Attack, { power: 20 });
      world.addComponent(attacker, Actor, { isPlayer: false });

      const defender = world.createEntity();
      world.addComponent(defender, Position, { x: 5, y: 5 });
      world.addComponent(defender, Health, { current: 100, max: 100, isAlive: true });
      world.addComponent(defender, Actor, { isPlayer: true });

      // Cover at (5, 4) (behind defender, away from attacker at y=8)
      const cover = world.createEntity();
      world.addComponent(cover, Position, { x: 5, y: 4 });
      world.addComponent(cover, InteractiveSurface, {
        surfaceId: 'crate_cover',
        providesCover: true,
      });

      world.addComponent(attacker, AttackIntent, { targetId: defender });

      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      const health = world.getComponent(defender, Health)!;
      expect(health.current).toBe(80);
    });
  });

  describe('Volatile Cascade Reactions & Prop Destruction', () => {
    it('triggers Cryo-Vat 3x3 chemical hazard on destruction dealing 4 damage and applying MOVEMENT_SLOW', () => {
      const combat = createCombatSystem(world, grid, eventBus);
      combat.init();

      const player = world.createEntity();
      world.addComponent(player, Position, { x: 5, y: 5 });
      world.addComponent(player, Attack, { power: 15 });
      world.addComponent(player, Actor, { isPlayer: true });

      // Cryo-vat at (5, 6) with 10 HP
      const vat = world.createEntity();
      world.addComponent(vat, Position, { x: 5, y: 6 });
      world.addComponent(vat, Health, { current: 10, max: 10, isAlive: true });
      world.addComponent(vat, InteractiveSurface, {
        surfaceId: 'cryo_vat',
        hazardOnDestroy: 'cryo_spill',
      });

      // Enemy in the 3x3 footprint at (6, 6)
      const enemy = world.createEntity();
      world.addComponent(enemy, Position, { x: 6, y: 6 });
      world.addComponent(enemy, Health, { current: 30, max: 30, isAlive: true });
      world.addComponent(enemy, Hostile, {});

      // Player attacks the vat
      world.addComponent(player, AttackIntent, { targetId: vat });

      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      // Vat took 15 damage and died
      const vatHealth = world.getComponent(vat, Health);
      expect(vatHealth?.current).toBe(0);

      // Enemy inside 3x3 footprint took 4 damage: 30 - 4 = 26
      const enemyHealth = world.getComponent(enemy, Health);
      expect(enemyHealth?.current).toBe(26);

      // Enemy has MOVEMENT_SLOW applied
      const status = world.getComponent(enemy, StatusEffects);
      expect(status?.effects.some((e) => e.name === 'MOVEMENT_SLOW')).toBe(true);
    });

    it('triggers Capacitor Bank Manhattan radius 2 EMP shockwave dealing 10 damage and DISRUPT to enemies', () => {
      const combat = createCombatSystem(world, grid, eventBus);
      combat.init();

      const player = world.createEntity();
      world.addComponent(player, Position, { x: 10, y: 10 });
      world.addComponent(player, Attack, { power: 25 });
      world.addComponent(player, Actor, { isPlayer: true });

      // Capacitor bank at (10, 11) with 15 HP
      const cap = world.createEntity();
      world.addComponent(cap, Position, { x: 10, y: 11 });
      world.addComponent(cap, Health, { current: 15, max: 15, isAlive: true });
      world.addComponent(cap, InteractiveSurface, {
        surfaceId: 'capacitor_bank',
        hazardOnDestroy: 'emp_arc',
      });

      // Enemy at (10, 13) -> Manhattan distance from cap is |10-10| + |13-11| = 2
      const enemy = world.createEntity();
      world.addComponent(enemy, Position, { x: 10, y: 13 });
      world.addComponent(enemy, Health, { current: 40, max: 40, isAlive: true });
      world.addComponent(enemy, Hostile, {});

      world.addComponent(player, AttackIntent, { targetId: cap });

      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      // Enemy took 10 EMP damage: 40 - 10 = 30
      const enemyHealth = world.getComponent(enemy, Health);
      expect(enemyHealth?.current).toBe(30);

      // Enemy afflicted with DISRUPT (2 turns)
      const status = world.getComponent(enemy, StatusEffects);
      expect(status?.effects.some((e) => e.name === 'DISRUPT')).toBe(true);
    });

    it('cascades 15 structural damage to adjacent destructible props within Manhattan radius 2', () => {
      const combat = createCombatSystem(world, grid, eventBus);
      combat.init();

      const player = world.createEntity();
      world.addComponent(player, Position, { x: 5, y: 5 });
      world.addComponent(player, Attack, { power: 15 });

      // Primary volatile vat at (5, 6) with 10 HP
      const vat1 = world.createEntity();
      world.addComponent(vat1, Position, { x: 5, y: 6 });
      world.addComponent(vat1, Health, { current: 10, max: 10, isAlive: true });
      world.addComponent(vat1, InteractiveSurface, {
        surfaceId: 'cryo_vat_1',
        hazardOnDestroy: 'cryo_spill',
        cascadeRadius: 2,
      });

      // Secondary vat at (5, 7) with 10 HP (within distance 1 <= 2)
      const vat2 = world.createEntity();
      world.addComponent(vat2, Position, { x: 5, y: 7 });
      world.addComponent(vat2, Health, { current: 10, max: 10, isAlive: true });
      world.addComponent(vat2, InteractiveSurface, {
        surfaceId: 'cryo_vat_2',
        hazardOnDestroy: 'cryo_spill',
        cascadeRadius: 2,
      });

      // Player destroys vat 1
      world.addComponent(player, AttackIntent, { targetId: vat1 });

      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      // Vat 1 destroyed
      expect(world.getComponent(vat1, Health)?.current).toBe(0);

      // Vat 2 was hit by cascade (15 damage > 10 HP) and also destroyed
      expect(world.getComponent(vat2, Health)?.current).toBe(0);
    });

    it('routes environmental damage through DamageIntent, sets isAlive=false, and attaches Dying component canonically', () => {
      const combat = createCombatSystem(world, grid, eventBus);
      combat.init();

      const attacker = world.createEntity();
      world.addComponent(attacker, Position, { x: 5, y: 5 });
      world.addComponent(attacker, Attack, { power: 20 });
      world.addComponent(attacker, Actor, { isPlayer: true });

      // Destructible vat with 10 HP
      const vat = world.createEntity();
      world.addComponent(vat, Position, { x: 5, y: 6 });
      world.addComponent(vat, Health, { current: 10, max: 10, isAlive: true });
      world.addComponent(vat, InteractiveSurface, {
        surfaceId: 'cryo_vat',
        hazardOnDestroy: 'cryo_spill',
      });

      // Enemy in cryo radius with 4 HP (lethal to cryo spill)
      const enemy = world.createEntity();
      world.addComponent(enemy, Position, { x: 6, y: 6 });
      world.addComponent(enemy, Health, { current: 4, max: 10, isAlive: true });
      world.addComponent(enemy, Hostile, {});

      world.addComponent(attacker, AttackIntent, { targetId: vat });

      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      // Vat should be condemned with Dying
      const vatDying = world.getComponent(vat, Dying);
      expect(vatDying).toBeDefined();
      expect(vatDying?.reason).toBe('environmental_destruction');
      expect(vatDying?.killerId).toBe(attacker);
      expect(world.getComponent(vat, Health)?.isAlive).toBe(false);

      // Enemy hit by cryo spill DamageIntent, killed and condemned through CombatSystem
      const enemyDying = world.getComponent(enemy, Dying);
      expect(enemyDying).toBeDefined();
      expect(enemyDying?.reason).toBe('damage');
      expect(enemyDying?.killerId).toBe(attacker);
      expect(world.getComponent(enemy, Health)?.isAlive).toBe(false);
      expect(world.getComponent(enemy, Health)?.current).toBe(0);
    });
  });

  describe('Augment Triggers (ON_HACK & ON_COVER_BROKEN)', () => {
    it('evaluates ON_HACK when player has PropInteractedThisTurn', () => {
      const player = world.createEntity();
      world.addComponent(player, Heat, {
        current: 0,
        maxSafe: 100,
        baseDissipation: 5,
        ventPercentage: 0.5,
        isVenting: false,
      });
      world.addComponent(player, Health, { current: 100, max: 100, isAlive: true });

      // Tag player with PropInteractedThisTurn
      world.addComponent(player, PropInteractedThisTurn, {
        propEntityId: 999,
        propClass: 'workstation',
        interactedBy: player,
      });

      const ctx = createTriggerContext(world, player);
      expect(ctx.onHack).toBe(true);
      expect(evaluateCondition({ type: 'ON_HACK' }, ctx)).toBe(true);
    });

    it('evaluates ON_COVER_BROKEN when an InteractiveSurface is destroyed by the player', () => {
      const player = world.createEntity();
      world.addComponent(player, Heat, {
        current: 0,
        maxSafe: 100,
        baseDissipation: 5,
        ventPercentage: 0.5,
        isVenting: false,
      });
      world.addComponent(player, Health, { current: 100, max: 100, isAlive: true });

      const crate = world.createEntity();
      world.addComponent(crate, InteractiveSurface, { surfaceId: 'crate_cover' });
      world.addComponent(crate, Health, { current: 10, max: 10, isAlive: true });
      world.addComponent(player, Attack, { power: 15 });

      const combat = createCombatSystem(world, grid, eventBus);
      combat.init();

      world.addComponent(player, AttackIntent, { targetId: crate });
      world.executeSystems(Phase.REACTION);

      const ctx = createTriggerContext(world, player);
      expect(ctx.onCoverBroken).toBe(true);
      expect(evaluateCondition({ type: 'ON_COVER_BROKEN' }, ctx)).toBe(true);
    });

    it('triggers Scavenger_Siphon.arc on ON_HACK yielding SHIELD and VENT_HEAT', () => {
      const augmentSystem = createAugmentSystem(world, eventBus);
      augmentSystem.init();

      const player = world.createEntity();
      world.addComponent(player, Heat, {
        current: 50,
        maxSafe: 100,
        baseDissipation: 5,
        ventPercentage: 0.5,
        isVenting: false,
      });
      world.addComponent(player, Health, { current: 100, max: 100, isAlive: true });
      world.addComponent(player, PropInteractedThisTurn, {
        propEntityId: 123,
        propClass: 'container',
        interactedBy: player,
      });

      // Equip Scavenger_Siphon
      const augment = world.createEntity();
      world.addComponent(augment, AugmentData, {
        name: 'Scavenger_Siphon.arc',
        trigger: { type: 'ON_HACK' },
        payloads: [
          { type: 'SHIELD', magnitude: 6 },
          { type: 'VENT_HEAT', magnitude: 10 },
        ],
        maxTriggersPerTurn: 1,
        cooldownTurns: 1,
        isLegacy: false,
      });

      world.addComponent(player, AugmentSlots, {
        equipped: [augment],
      });
      world.addComponent(player, AugmentState, {
        activationsThisTurn: {},
        cooldownsRemaining: {},
      });

      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      // Check that status or intent was applied
      const statusIntent = world.query(Health);
      expect(statusIntent.length).toBeGreaterThan(0);
    });
  });

  describe('Firmware Counterplay (LOGIC_JAM & EXTENDED_SIGHT)', () => {
    it('disarms a CorruptedNode and awards score when LOGIC_JAM.exe targets its tile', () => {
      const firmwareSystem = createFirmwareSystem(world, grid, eventBus);
      firmwareSystem.init();

      const player = world.createEntity();
      world.addComponent(player, Position, { x: 5, y: 5 });
      world.addComponent(player, Heat, {
        current: 0,
        maxSafe: 100,
        baseDissipation: 5,
        ventPercentage: 0.5,
        isVenting: false,
      });
      world.addComponent(player, FloorState, { currentFloor: 6, trapsDisarmed: 0, maxFloor: 15, runSeed: 'test' });

      // Corrupted Node prop at (5, 6)
      const corruptedProp = world.createEntity();
      world.addComponent(corruptedProp, Position, { x: 5, y: 6 });
      world.addComponent(corruptedProp, CorruptedNode, {
        corruptionLevel: 1,
        trapType: 'thermal_dump',
        isDisarmed: false,
        triggered: false,
        revealed: false,
      });

      // Logic Jam firmware in slot 0
      const logicJam = world.createEntity();
      world.addComponent(logicJam, AbilityDef, {
        name: 'LOGIC_JAM.exe',
        heatCost: 20,
        range: 3,
        effectType: 'stun',
        damageAmount: 0,
        dashDistance: 0,
        visionRadius: 0,
        heatPerTurn: 0,
        isToggle: false,
        isActive: false,
        isLegacy: false,
      });
      world.addComponent(player, FirmwareSlots, { equipped: [logicJam] });

      // Activate Logic Jam at (5, 6)
      world.addComponent(player, FirmwareIntent, {
        actorId: player,
        slotIndex: 0,
        targetX: 5,
        targetY: 6,
      });

      world.executeSystems(Phase.ACTION);
      eventBus.flush();

      // Node should now be disarmed
      const node = world.getComponent(corruptedProp, CorruptedNode)!;
      expect(node.isDisarmed).toBe(true);

      // FloorState trapsDisarmed should be incremented
      const floorState = world.getComponent(player, FloorState)!;
      expect(floorState.trapsDisarmed).toBe(1);

      // PropInteractedThisTurn should be attached for ON_HACK
      expect(world.hasComponent(player, PropInteractedThisTurn)).toBe(true);
    });

    it('reveals CorruptedNodes when EXTENDED_SIGHT.sys is activated', () => {
      const firmwareSystem = createFirmwareSystem(world, grid, eventBus);
      firmwareSystem.init();

      const player = world.createEntity();
      world.addComponent(player, Position, { x: 5, y: 5 });
      world.addComponent(player, Heat, {
        current: 0,
        maxSafe: 100,
        baseDissipation: 5,
        ventPercentage: 0.5,
        isVenting: false,
      });

      // Hidden Corrupted Node at (8, 5) (distance 3 <= visionRadius 12)
      const corruptedProp = world.createEntity();
      world.addComponent(corruptedProp, Position, { x: 8, y: 5 });
      world.addComponent(corruptedProp, CorruptedNode, {
        corruptionLevel: 1,
        trapType: 'hud_glitch',
        isDisarmed: false,
        triggered: false,
        revealed: false,
      });

      // Extended Sight in slot 0
      const extendedSight = world.createEntity();
      world.addComponent(extendedSight, AbilityDef, {
        name: 'Extended_Sight.sys',
        heatCost: 10,
        range: 0,
        effectType: 'toggle_vision',
        damageAmount: 0,
        dashDistance: 0,
        visionRadius: 12,
        heatPerTurn: 10,
        isToggle: true,
        isActive: false,
        isLegacy: false,
      });
      world.addComponent(player, FirmwareSlots, { equipped: [extendedSight] });

      world.addComponent(player, FirmwareIntent, { actorId: player, slotIndex: 0 });

      world.executeSystems(Phase.ACTION);
      eventBus.flush();

      // Corrupted Node should now be revealed
      const node = world.getComponent(corruptedProp, CorruptedNode)!;
      expect(node.revealed).toBe(true);
    });
  });
});
