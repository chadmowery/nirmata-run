import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { createAugmentSystem } from './augment';
import {
  AugmentData,
  AugmentState,
  AugmentSlots,
  Health,
  Heat,
  Actor,
  FirmwareActivatedThisTurn,
  HealIntent
} from '@shared/components';
import { Phase } from '@engine/ecs/types';
import { GameplayEvents } from '@shared/events/types';

describe('AugmentSystem', () => {
  let world: any;
  let eventBus: any;
  let augmentSystem: any;
  let playerId: any;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);

    augmentSystem = createAugmentSystem(world, eventBus);
    augmentSystem.init();

    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Health, { current: 10, max: 20 });
    world.addComponent(playerId, Heat, { current: 0, maxSafe: 50, baseDissipation: 1, ventPercentage: 0.5 });
    world.addComponent(playerId, AugmentSlots, { equipped: [] });
    world.addComponent(playerId, AugmentState, { activationsThisTurn: {}, cooldownsRemaining: {} });
  });

  describe('evaluateCondition', () => {
    it('returns true for ON_ACTIVATION when firmwareActivated is true', () => {
      const node = { type: 'ON_ACTIVATION' } as const;
      const ctx = { firmwareActivated: true, damageDealt: 0, killCount: 0, heatAboveMax: false, currentHeat: 0, hpPercent: 100 };
      expect(augmentSystem.evaluateCondition(node, ctx)).toBe(true);
    });

    it('returns false for ON_ACTIVATION when firmwareActivated is false', () => {
      const node = { type: 'ON_ACTIVATION' } as const;
      const ctx = { firmwareActivated: false, damageDealt: 0, killCount: 0, heatAboveMax: false, currentHeat: 0, hpPercent: 100 };
      expect(augmentSystem.evaluateCondition(node, ctx)).toBe(false);
    });

    // ... (other condition tests are still valid as they test the pure function)
  });

  describe('system integration', () => {
    it('triggers augment when FirmwareActivatedThisTurn tag is present', () => {
      const augmentId = world.createEntity();
      world.addComponent(augmentId, AugmentData, {
        name: 'Test Augment',
        trigger: { type: 'ON_ACTIVATION' },
        payloads: [{ type: 'HEAL', magnitude: 5 }],
        maxTriggersPerTurn: 1,
        cooldownTurns: 0
      });

      const slots = world.getComponent(playerId, AugmentSlots);
      slots.equipped.push(augmentId);

      // Add tag instead of emitting event
      world.addComponent(playerId, FirmwareActivatedThisTurn, { slotIndex: 0 });

      // Execute phase
      world.executeSystems(Phase.REACTION);

      // Check for HealIntent
      const intent = world.getComponent(playerId, HealIntent);
      expect(intent).toBeDefined();
      expect(intent?.amount).toBe(5);

      const state = world.getComponent(playerId, AugmentState);
      expect(state.activationsThisTurn[augmentId.toString()]).toBe(1);
    });

    it('respects maxTriggersPerTurn', () => {
      const augmentId = world.createEntity();
      world.addComponent(augmentId, AugmentData, {
        name: 'Limited Augment',
        trigger: { type: 'ON_ACTIVATION' },
        payloads: [{ type: 'HEAL', magnitude: 1 }],
        maxTriggersPerTurn: 1,
        cooldownTurns: 0
      });

      const slots = world.getComponent(playerId, AugmentSlots);
      slots.equipped.push(augmentId);

      // First trigger
      world.addComponent(playerId, FirmwareActivatedThisTurn, { slotIndex: 0 });
      world.executeSystems(Phase.REACTION);

      // Second trigger (should be ignored due to maxTriggersPerTurn)
      world.executeSystems(Phase.REACTION);

      // We don't check health, we check that only ONE intent was ever processed
      // Wait, if it triggers again, it would ADD another component?
      // Actually, addComponent overwrites if it already exists.
      // But in this case, it shouldn't even call addComponent.

      const state = world.getComponent(playerId, AugmentState);
      expect(state.activationsThisTurn[augmentId.toString()]).toBe(1);
    });

    it('respects cooldownTurns', () => {
      const augmentId = world.createEntity();
      world.addComponent(augmentId, AugmentData, {
        name: 'Cooldown Augment',
        trigger: { type: 'ON_ACTIVATION' },
        payloads: [{ type: 'HEAL', magnitude: 1 }],
        maxTriggersPerTurn: 1,
        cooldownTurns: 2
      });

      const slots = world.getComponent(playerId, AugmentSlots);
      slots.equipped.push(augmentId);

      // Trigger 1
      world.addComponent(playerId, FirmwareActivatedThisTurn, { slotIndex: 0 });
      world.executeSystems(Phase.REACTION);

      const state = world.getComponent(playerId, AugmentState);
      expect(state.cooldownsRemaining[augmentId.toString()]).toBe(2);

      // Reset turn manually (simulating TurnManager call)
      augmentSystem.resetTurnState(playerId);
      const updatedState = world.getComponent(playerId, AugmentState);
      expect(updatedState.cooldownsRemaining[augmentId.toString()]).toBe(1);

      // Try to trigger while on cooldown
      world.executeSystems(Phase.REACTION);

      const updatedIntent = world.getComponent(playerId, HealIntent);
      // It should NOT have added an intent if it's on cooldown
      // Wait, the first trigger added an intent. We should remove it to check if a second one is added.
      world.removeComponent(playerId, HealIntent);
      world.executeSystems(Phase.REACTION);
      expect(world.hasComponent(playerId, HealIntent)).toBe(false);
    });

    it('resets activationsThisTurn via resetTurnState', () => {
      const augmentId = world.createEntity();
      world.addComponent(augmentId, AugmentData, {
        name: 'Daily Augment',
        trigger: { type: 'ON_ACTIVATION' },
        payloads: [{ type: 'HEAL', magnitude: 1 }],
        maxTriggersPerTurn: 1,
        cooldownTurns: 0
      });

      const slots = world.getComponent(playerId, AugmentSlots);
      slots.equipped.push(augmentId);

      world.addComponent(playerId, FirmwareActivatedThisTurn, { slotIndex: 0 });
      world.executeSystems(Phase.REACTION);

      const state = world.getComponent(playerId, AugmentState);
      expect(state.activationsThisTurn[augmentId.toString()]).toBe(1);

      augmentSystem.resetTurnState(playerId);
      const updatedState = world.getComponent(playerId, AugmentState);
      expect(Object.keys(updatedState.activationsThisTurn).length).toBe(0);
    });
  });
});
