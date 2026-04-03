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
  COMPONENTS_REGISTRY 
} from '@shared/components';
import { GameplayEvents } from '@shared/events/types';

describe('AugmentSystem', () => {
  let world: any;
  let eventBus: any;
  let statusEffectSystem: any;
  let heatSystem: any;
  let augmentSystem: any;
  let playerId: any;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    
    statusEffectSystem = {
      applyEffect: vi.fn(),
      hasEffect: vi.fn(),
    };
    
    heatSystem = {
      addHeat: vi.fn(),
      getHeatPercentage: vi.fn().mockReturnValue(0),
    };

    augmentSystem = createAugmentSystem(world, eventBus, statusEffectSystem, heatSystem);
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

    it('handles AND conditions', () => {
      const node = { 
        type: 'AND', 
        conditions: [{ type: 'ON_ACTIVATION' }, { type: 'ON_KILL' }] 
      } as any;
      
      const ctx1 = { firmwareActivated: true, damageDealt: 0, killCount: 1, heatAboveMax: false, currentHeat: 0, hpPercent: 100 };
      expect(augmentSystem.evaluateCondition(node, ctx1)).toBe(true);
      
      const ctx2 = { firmwareActivated: true, damageDealt: 0, killCount: 0, heatAboveMax: false, currentHeat: 0, hpPercent: 100 };
      expect(augmentSystem.evaluateCondition(node, ctx2)).toBe(false);
    });

    it('handles OR conditions', () => {
      const node = { 
        type: 'OR', 
        conditions: [{ type: 'ON_ACTIVATION' }, { type: 'ON_KILL' }] 
      } as any;
      
      const ctx1 = { firmwareActivated: true, damageDealt: 0, killCount: 0, heatAboveMax: false, currentHeat: 0, hpPercent: 100 };
      expect(augmentSystem.evaluateCondition(node, ctx1)).toBe(true);
      
      const ctx2 = { firmwareActivated: false, damageDealt: 0, killCount: 1, heatAboveMax: false, currentHeat: 0, hpPercent: 100 };
      expect(augmentSystem.evaluateCondition(node, ctx2)).toBe(true);
      
      const ctx3 = { firmwareActivated: false, damageDealt: 0, killCount: 0, heatAboveMax: false, currentHeat: 0, hpPercent: 100 };
      expect(augmentSystem.evaluateCondition(node, ctx3)).toBe(false);
    });

    it('handles NOT conditions', () => {
      const node = { type: 'NOT', conditions: [{ type: 'ON_ACTIVATION' }] } as any;
      
      const ctx1 = { firmwareActivated: true, damageDealt: 0, killCount: 0, heatAboveMax: false, currentHeat: 0, hpPercent: 100 };
      expect(augmentSystem.evaluateCondition(node, ctx1)).toBe(false);
      
      const ctx2 = { firmwareActivated: false, damageDealt: 0, killCount: 0, heatAboveMax: false, currentHeat: 0, hpPercent: 100 };
      expect(augmentSystem.evaluateCondition(node, ctx2)).toBe(true);
    });

    it('prevents infinite recursion with depth limit', () => {
      const deepNode: any = { type: 'AND', conditions: [] };
      let current = deepNode;
      for (let i = 0; i < 15; i++) {
        const next = { type: 'AND', conditions: [] };
        current.conditions.push(next);
        current = next;
      }
      current.conditions.push({ type: 'ON_ACTIVATION' });

      const ctx = { firmwareActivated: true, damageDealt: 0, killCount: 0, heatAboveMax: false, currentHeat: 0, hpPercent: 100 };
      expect(augmentSystem.evaluateCondition(deepNode, ctx)).toBe(false);
    });
  });

  describe('system integration', () => {
    it('triggers augment on FIRMWARE_ACTIVATED and PLAYER_ACTION', () => {
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

      eventBus.emit('FIRMWARE_ACTIVATED', { 
        entityId: playerId, 
        firmwareEntityId: 999,
        slotIndex: 0,
        abilityName: 'Test Ability',
        heatCost: 10,
        targetX: 0,
        targetY: 0
      });
      eventBus.flush();

      eventBus.emit('PLAYER_ACTION', { action: 'USE_FIRMWARE', entityId: playerId });
      eventBus.flush();

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
      eventBus.emit('FIRMWARE_ACTIVATED', { entityId: playerId });
      eventBus.flush();
      eventBus.emit('PLAYER_ACTION', { action: 'ACTION', entityId: playerId });
      eventBus.flush();
      
      // Second trigger (should be ignored)
      eventBus.emit('FIRMWARE_ACTIVATED', { entityId: playerId });
      eventBus.flush();
      eventBus.emit('PLAYER_ACTION', { action: 'ACTION', entityId: playerId });
      eventBus.flush();

      const health = world.getComponent(playerId, Health);
      expect(health.current).toBe(11);
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
      eventBus.emit('FIRMWARE_ACTIVATED', { entityId: playerId });
      eventBus.flush();
      eventBus.emit('PLAYER_ACTION', { action: 'ACTION', entityId: playerId });
      eventBus.flush();
      
      const state = world.getComponent(playerId, AugmentState);
      expect(state.cooldownsRemaining[augmentId.toString()]).toBe(2);

      // Next turn
      eventBus.emit('TURN_START', {});
      eventBus.flush();
      expect(state.cooldownsRemaining[augmentId.toString()]).toBe(1);

      // Try to trigger while on cooldown
      eventBus.emit('FIRMWARE_ACTIVATED', { entityId: playerId });
      eventBus.flush();
      eventBus.emit('PLAYER_ACTION', { action: 'ACTION', entityId: playerId });
      eventBus.flush();

      const health = world.getComponent(playerId, Health);
      expect(health.current).toBe(11); // Still 11
    });

    it('resets activationsThisTurn on TURN_START', () => {
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

      eventBus.emit('FIRMWARE_ACTIVATED', { entityId: playerId });
      eventBus.flush();
      eventBus.emit('PLAYER_ACTION', { action: 'ACTION', entityId: playerId });
      eventBus.flush();
      
      const state = world.getComponent(playerId, AugmentState);
      expect(state.activationsThisTurn[augmentId.toString()]).toBe(1);

      eventBus.emit('TURN_START', {});
      eventBus.flush();
      expect(state.activationsThisTurn[augmentId.toString()]).toBeUndefined();
    });
  });
});
