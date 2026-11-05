import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Grid } from '@engine/grid/grid';
import { Phase } from '@engine/ecs/types';
import { GameplayEvents } from '@shared/events/types';
import {
  Health,
  Stability,
  Actor,
  Dying,
  Hostile,
  FloorState,
  RunInventory,
  ApplyStatusEffectIntent,
  StatusEffects,
  HealIntent,
} from '@shared/components';
import { createStabilitySystem } from '@game/systems/stability';
import { createHealSystem, addHealIntent } from '@game/systems/combat';
import { createStatusEffectSystem } from '@game/systems/status-effects';
import { processAction } from '@game/pipeline/action-pipeline';

describe('C7 Reality Stability and HealIntent Collision Resolution', () => {
  let world: World<GameplayEvents>;
  let eventBus: EventBus<GameplayEvents>;
  let grid: Grid;
  let playerId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);

    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Health, { current: 5, max: 20, isAlive: true });
    world.addComponent(playerId, Stability, { current: 50, max: 100 });
    world.addComponent(playerId, FloorState, { currentFloor: 1, maxFloor: 15, runSeed: 'test-c7' });
  });

  describe('HealIntent Additive Stacking & No Collision', () => {
    it('stacks multiple HealIntents additively on the same entity without overwriting', () => {
      // 1. Initial consumable heal (+5)
      addHealIntent(world, playerId, playerId, 5);
      expect(world.getComponent(playerId, HealIntent)?.amount).toBe(5);

      // 2. Regeneration tick (+2)
      addHealIntent(world, playerId, playerId, 2);
      expect(world.getComponent(playerId, HealIntent)?.amount).toBe(7);

      // 3. On-kill reaction or walkover pickup heal (+7)
      addHealIntent(world, playerId, playerId, 7);
      expect(world.getComponent(playerId, HealIntent)?.amount).toBe(14);

      // 4. Resolve via HealSystem
      const healSystem = createHealSystem(world, eventBus);
      healSystem.init();

      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      // Health should be 5 + 14 = 19
      const health = world.getComponent(playerId, Health);
      expect(health?.current).toBe(19);

      // HealIntent should be cleared
      expect(world.hasComponent(playerId, HealIntent)).toBe(false);
    });

    it('resolves PRE_TURN regeneration and subsequent REACTION combat heals independently without loss', () => {
      // Register statusEffectSystem before healSystem so tickDown runs before HealSystem_PreTurn
      const statusEffectSystem = createStatusEffectSystem(world, eventBus);
      statusEffectSystem.init();

      const healSystem = createHealSystem(world, eventBus);
      healSystem.init();

      // Give player regeneration status effect (+2 HP per turn for 2 turns)
      world.addComponent(playerId, StatusEffects, {
        effects: [
          {
            name: 'regeneration',
            duration: 2,
            magnitude: 2,
            source: 'health-potion',
          },
        ],
      });

      // Also simulate a potion used right before PRE_TURN
      addHealIntent(world, playerId, playerId, 5);

      // Run PRE_TURN: StatusEffectSystem ticks regeneration (+2 onto the existing 5 -> total 7)
      // and HealSystem_PreTurn resolves it!
      world.executeSystems(Phase.PRE_TURN);
      eventBus.flush();

      // Player health should have received 5 (potion) + 2 (regen) = 7 HP -> 5 + 7 = 12 HP
      expect(world.getComponent(playerId, Health)?.current).toBe(12);
      expect(world.hasComponent(playerId, HealIntent)).toBe(false);

      // Now simulate REACTION phase combat heal (e.g. Vampire.exe kill)
      addHealIntent(world, playerId, playerId, 6);
      expect(world.getComponent(playerId, HealIntent)?.amount).toBe(6);

      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      // Player health should now be 12 + 6 = 18 HP
      expect(world.getComponent(playerId, Health)?.current).toBe(18);
      expect(world.hasComponent(playerId, HealIntent)).toBe(false);
    });

    it('does not heal an entity marked with Dying component', () => {
      const healSystem = createHealSystem(world, eventBus);
      healSystem.init();

      world.addComponent(playerId, Dying, { killerId: 99, reason: 'lethal_hit' });
      addHealIntent(world, playerId, playerId, 10);

      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      // Health must remain 5 (unchanged) and HealIntent must be cleaned up
      expect(world.getComponent(playerId, Health)?.current).toBe(5);
      expect(world.hasComponent(playerId, HealIntent)).toBe(false);
    });
  });

  describe('Health Potion Regeneration Math Alignment', () => {
    it('applies magnitude: 2 (+2 HP per turn) when using health-potion consumable', () => {
      const potionId = world.createEntity();
      world.addComponent(playerId, RunInventory, {
        software: [],
        equipment: [
          {
            entityId: potionId,
            templateId: 'health-potion',
            rarityTier: 'common',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: Date.now(),
            quantity: 1,
            isConsumable: true,
          },
        ],
        maxSlots: 10,
      });

      processAction(world, grid, eventBus, playerId, {
        type: 'USE_CONSUMABLE',
        inventoryIndex: 0,
      });
      eventBus.flush();

      // Verify immediate heal intent (+5)
      expect(world.getComponent(playerId, HealIntent)?.amount).toBe(5);

      // Verify regeneration status intent has magnitude 2 (matching +2 HP per turn spec)
      const statusIntent = world.getComponent(playerId, ApplyStatusEffectIntent);
      expect(statusIntent?.effect.name).toBe('regeneration');
      expect(statusIntent?.effect.magnitude).toBe(2);
      expect(statusIntent?.effect.duration).toBe(3);
    });
  });

  describe('Reality Stability Threat Purge vs Prop Destruction Invariant', () => {
    it('restores +2% stability when player kills a hostile enemy', () => {
      const stabilitySystem = createStabilitySystem(world, eventBus);
      stabilitySystem.init();

      const enemyId = world.createEntity();
      world.addComponent(enemyId, Actor, { isPlayer: false });
      world.addComponent(enemyId, Hostile, {});
      world.addComponent(enemyId, Dying, { killerId: playerId, reason: 'combat_kill' });

      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      // Stability: 50 -> 52
      expect(world.getComponent(playerId, Stability)?.current).toBe(52);
    });

    it('does NOT restore stability when player destroys a non-hostile destructible prop (crate/cover)', () => {
      const stabilitySystem = createStabilitySystem(world, eventBus);
      stabilitySystem.init();

      const crateId = world.createEntity();
      // Props do NOT have the Hostile component
      world.addComponent(crateId, Dying, { killerId: playerId, reason: 'environmental_destruction' });

      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      // Stability must remain 50
      expect(world.getComponent(playerId, Stability)?.current).toBe(50);
    });
  });
});
