import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Heat, Shell, Actor, FirmwareSlots, AbilityDef } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { createHeatSystem } from './heat';

describe('Heat System', () => {
  let world: World<GameplayEvents>;
  let eventBus: EventBus<GameplayEvents>;
  let heatSystem: ReturnType<typeof createHeatSystem>;
  let playerId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    heatSystem = createHeatSystem(world, eventBus);
    
    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Heat, Heat.schema.parse({ current: 0, maxSafe: 100, baseDissipation: 5 }));
    world.addComponent(playerId, Shell, { speed: 10, stability: 10, armor: 0, maxHealth: 100 });
  });

  describe('Heat Component Schema', () => {
    it('should validate with defaults', () => {
      const data = Heat.schema.parse({});
      expect(data.current).toBe(0);
      expect(data.maxSafe).toBe(100);
      expect(data.baseDissipation).toBe(5);
      expect(data.ventPercentage).toBe(0.5);
      expect(data.isVenting).toBe(false);
    });

    it('should reject negative current values', () => {
      const result = Heat.schema.safeParse({ current: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject ventPercentage > 1', () => {
      const result = Heat.schema.safeParse({ ventPercentage: 1.1 });
      expect(result.success).toBe(false);
    });
  });

  describe('Functional Tests', () => {
    it('dissipate() reduces Heat by baseDissipation + stability * 0.5', () => {
      const heat = world.getComponent(playerId, Heat)!;
      heat.current = 50;
      
      heatSystem.dissipate(playerId);
      
      // 5 + 10 * 0.5 = 10
      expect(heat.current).toBe(40);
    });

    it('dissipate() clears isVenting flag', () => {
      const heat = world.getComponent(playerId, Heat)!;
      heat.isVenting = true;
      
      heatSystem.dissipate(playerId);
      
      expect(heat.isVenting).toBe(false);
    });

    it('dissipate() does not reduce below 0', () => {
      const heat = world.getComponent(playerId, Heat)!;
      heat.current = 5;
      
      heatSystem.dissipate(playerId);
      
      expect(heat.current).toBe(0);
    });

    it('addHeat() increases current Heat accurately', () => {
      const heat = world.getComponent(playerId, Heat)!;
      
      heatSystem.addHeat(playerId, 20);
      
      expect(heat.current).toBe(20);
    });

    it('vent() removes 50% of current Heat', () => {
      const heat = world.getComponent(playerId, Heat)!;
      heat.current = 60;
      
      heatSystem.vent(playerId);
      
      expect(heat.current).toBe(30);
    });

    it('vent() sets isVenting = true', () => {
      const heat = world.getComponent(playerId, Heat)!;
      
      heatSystem.vent(playerId);
      
      expect(heat.isVenting).toBe(true);
    });

    it('isInCorruptionZone returns true when Heat > maxSafe', () => {
      const heat = world.getComponent(playerId, Heat)!;
      heat.current = 110;
      
      expect(heatSystem.isInCorruptionZone(playerId)).toBe(true);
    });

    it('Stability modifier creates differentiated dissipation', () => {
      const strikerId = world.createEntity();
      world.addComponent(strikerId, Heat, Heat.schema.parse({ baseDissipation: 5 }));
      world.addComponent(strikerId, Shell, { speed: 10, stability: 5, armor: 0, maxHealth: 100 });
      
      const bastionId = world.createEntity();
      world.addComponent(bastionId, Heat, Heat.schema.parse({ baseDissipation: 5 }));
      world.addComponent(bastionId, Shell, { speed: 10, stability: 15, armor: 0, maxHealth: 100 });
      
      world.getComponent(strikerId, Heat)!.current = 50;
      world.getComponent(bastionId, Heat)!.current = 50;
      
      heatSystem.dissipate(strikerId); // 5 + 5 * 0.5 = 7.5 -> 42.5
      heatSystem.dissipate(bastionId); // 5 + 15 * 0.5 = 12.5 -> 37.5
      
      expect(world.getComponent(strikerId, Heat)!.current).toBe(42.5);
      expect(world.getComponent(bastionId, Heat)!.current).toBe(37.5);
    });

    it('Handle heatPerTurn for active toggle abilities', () => {
      const firmwareId = world.createEntity();
      world.addComponent(firmwareId, AbilityDef, { 
        name: 'Test', 
        heatCost: 0, 
        range: 0, 
        effectType: 'toggle_vision', 
        isActive: true, 
        heatPerTurn: 10 
      });
      world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
      
      const heat = world.getComponent(playerId, Heat)!;
      heat.current = 50;
      
      heatSystem.dissipate(playerId);
      
      // 50 - 10 (dissipation) + 10 (heatPerTurn) = 50
      expect(heat.current).toBe(50);
    });

    it('subscribes to TURN_START', () => {
      const heat = world.getComponent(playerId, Heat)!;
      heat.current = 50;
      
      heatSystem.init();
      eventBus.emit('TURN_START', { turnNumber: 1 });
      eventBus.flush();
      
      expect(heat.current).toBe(40);
    });
  });
});
