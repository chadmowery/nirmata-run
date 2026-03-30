import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { StatusEffects, Actor } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { createStatusEffectSystem } from './status-effects';

describe('Status Effects System', () => {
  let world: World<GameplayEvents>;
  let eventBus: EventBus<GameplayEvents>;
  let statusEffectSystem: ReturnType<typeof createStatusEffectSystem>;
  let playerId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    statusEffectSystem = createStatusEffectSystem(world, eventBus);
    
    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, StatusEffects, { effects: [] });
  });

  describe('StatusEffects Component Schema', () => {
    it('should validate empty effects array', () => {
      const data = StatusEffects.schema.parse({ effects: [] });
      expect(data.effects).toEqual([]);
    });

    it('should validate array with valid effect entry', () => {
      const entry = { name: 'HUD_GLITCH', duration: 2, magnitude: 1 };
      const data = StatusEffects.schema.parse({ effects: [entry] });
      expect(data.effects).toHaveLength(1);
      expect(data.effects[0].name).toBe('HUD_GLITCH');
    });

    it('should reject negative duration', () => {
      const result = StatusEffects.schema.safeParse({
        effects: [{ name: 'TEST', duration: -1 }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Functional Tests', () => {
    it('applyEffect adds an effect to the effects array', () => {
      statusEffectSystem.applyEffect(playerId, { name: 'CORRUPTION', duration: 3 });
      
      const status = world.getComponent(playerId, StatusEffects)!;
      expect(status.effects).toHaveLength(1);
      expect(status.effects[0].name).toBe('CORRUPTION');
      expect(status.effects[0].duration).toBe(3);
    });

    it('tickDown decrements duration by 1', () => {
      statusEffectSystem.applyEffect(playerId, { name: 'LAG', duration: 2 });
      
      statusEffectSystem.tickDown(playerId);
      
      const status = world.getComponent(playerId, StatusEffects)!;
      expect(status.effects[0].duration).toBe(1);
    });

    it('tickDown removes effects at duration 0', () => {
      statusEffectSystem.applyEffect(playerId, { name: 'STUN', duration: 1 });
      
      statusEffectSystem.tickDown(playerId);
      
      const status = world.getComponent(playerId, StatusEffects)!;
      expect(status.effects).toHaveLength(0);
    });

    it('hasEffect returns true for applied effects', () => {
      statusEffectSystem.applyEffect(playerId, { name: 'TEST', duration: 1 });
      expect(statusEffectSystem.hasEffect(playerId, 'TEST')).toBe(true);
    });

    it('hasEffect returns false for expired effects', () => {
      statusEffectSystem.applyEffect(playerId, { name: 'TEST', duration: 1 });
      statusEffectSystem.tickDown(playerId);
      expect(statusEffectSystem.hasEffect(playerId, 'TEST')).toBe(false);
    });

    it('getMagnitude returns the highest magnitude for overlapping effects', () => {
      statusEffectSystem.applyEffect(playerId, { name: 'SLOW', duration: 3, magnitude: 10 });
      statusEffectSystem.applyEffect(playerId, { name: 'SLOW', duration: 2, magnitude: 20 });
      statusEffectSystem.applyEffect(playerId, { name: 'SLOW', duration: 5, magnitude: 5 });

      expect(statusEffectSystem.getMagnitude(playerId, 'SLOW')).toBe(20);
    });

    it('getMagnitude returns 0 when no effect exists', () => {
      expect(statusEffectSystem.getMagnitude(playerId, 'NON_EXISTENT')).toBe(0);
    });

    it('getEffectiveCount returns the number of active instances', () => {
      statusEffectSystem.applyEffect(playerId, { name: 'POISON', duration: 3, magnitude: 5 });
      statusEffectSystem.applyEffect(playerId, { name: 'POISON', duration: 2, magnitude: 5 });
      
      expect(statusEffectSystem.getEffectiveCount(playerId, 'POISON')).toBe(2);
      expect(statusEffectSystem.getEffectiveCount(playerId, 'STUN')).toBe(0);
    });

    it('getTotalMagnitude returns the sum of all magnitudes', () => {
      statusEffectSystem.applyEffect(playerId, { name: 'CORRUPTION', duration: 3, magnitude: 10 });
      statusEffectSystem.applyEffect(playerId, { name: 'CORRUPTION', duration: 2, magnitude: 15 });
      
      expect(statusEffectSystem.getTotalMagnitude(playerId, 'CORRUPTION')).toBe(25);
    });

    it('applyEffect emits STATUS_EFFECT_APPLIED event', () => {
      const spy = vi.fn();
      eventBus.on('STATUS_EFFECT_APPLIED', spy);

      statusEffectSystem.applyEffect(playerId, { 
        name: 'GLITCH', 
        duration: 3, 
        magnitude: 5, 
        source: 'TEST_SOURCE' 
      });

      eventBus.flush();

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        entityId: playerId,
        effectName: 'GLITCH',
        duration: 3,
        magnitude: 5,
        source: 'TEST_SOURCE'
      }));
    });

    it('tickDown emits STATUS_EFFECT_EXPIRED event', () => {
      const spy = vi.fn();
      eventBus.on('STATUS_EFFECT_EXPIRED', spy);

      statusEffectSystem.applyEffect(playerId, { name: 'EXPIRING', duration: 1 });
      statusEffectSystem.tickDown(playerId);

      eventBus.flush();

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        entityId: playerId,
        effectName: 'EXPIRING'
      }));
    });

    it('no longer automatically ticks down on TURN_START', () => {
      statusEffectSystem.applyEffect(playerId, { name: 'TEST', duration: 2 });
      
      statusEffectSystem.init();
      eventBus.emit('TURN_START', { turnNumber: 1 });
      eventBus.flush();
      
      const status = world.getComponent(playerId, StatusEffects)!;
      // Should still be 2 because it's no longer subscribed to TURN_START
      expect(status.effects[0].duration).toBe(2);
    });
  });
});
