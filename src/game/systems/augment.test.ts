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
  FirmwareActivatedThisTurn
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

      const health = world.getComponent(playerId, Health);
      expect(health.current).toBe(15);
      
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
      // Note: In real game, FirmwareActivatedThisTurn would still be there unless cleaned up.
      // But activationsThisTurn is already 1.
      world.executeSystems(Phase.REACTION);

      const health = world.getComponent(playerId, Health);
      expect(health.current).toBe(11); // Only healed once
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

      const updatedHealth = world.getComponent(playerId, Health);
      expect(updatedHealth.current).toBe(11); // Still 11
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
