import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEngineInstance } from '../engine-factory';
import { GameAction } from '../input/actions';
import { 
  AugmentData, 
  AugmentState, 
  AugmentSlots, 
  Heat, 
  Health, 
  Actor, 
  Position,
  COMPONENTS_REGISTRY 
} from '@shared/components';
import { EntityId } from '@engine/ecs/types';
import { ComponentDef } from '@engine/ecs/types';

describe('Augment Integration', () => {
  let engine: any;
  let playerId: EntityId;
  let componentRegistry: any;

  beforeEach(() => {
    engine = createEngineInstance({
      width: 10,
      height: 10,
      seed: 'test-seed',
      isClient: true
    });
    playerId = engine.playerId;

    const componentsMap: Record<string, ComponentDef<unknown>> = Object.fromEntries(
      COMPONENTS_REGISTRY.map((component) => [component.key, component])
    );
    componentRegistry = {
      get: (key: string) => componentsMap[key],
      has: (key: string) => !!componentsMap[key],
    };
  });

  it('triggers an augment when a firmware ability is activated (ON_ACTIVATION)', () => {
    const { world, systems, eventBus } = engine;
    
    // 1. Create an augment entity
    const augmentId = engine.entityFactory.create(world, 'displacement-venting', componentRegistry);
    
    // 2. Equip it
    const slots = world.getComponent(playerId, AugmentSlots);
    slots.equipped.push(augmentId);
    
    // 3. Add some heat to vent
    const heat = world.getComponent(playerId, Heat);
    heat.current = 20;
    
    // 4. Set up message spy
    const messageSpy = vi.fn();
    eventBus.on('MESSAGE_EMITTED', messageSpy);
    
    // 5. Submit a firmware action
    // We'll simulate FIRMWARE_ACTIVATED event since we don't have real firmware equipped here
    eventBus.emit('FIRMWARE_ACTIVATED', { entityId: playerId, slotIndex: 0, abilityName: 'Test' });
    
    // 6. Submit the action to the turn manager to trigger resolution
    engine.turnManager.submitAction(GameAction.WAIT);
    
    // 7. Verify augment triggered
    // Heat math: 20 - 5 (turn-start dissipation) - 15 (augment vent) = 0
    expect(heat.current).toBe(0);
    expect(messageSpy).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Displacement_Venting.arc TRIGGERED!'
    }));
  });

  it('triggers multiple augments in a single turn (Stacking)', () => {
    const { world, eventBus } = engine;
    
    // 1. Create and equip two augments
    const aug1 = engine.entityFactory.create(world, 'displacement-venting', componentRegistry);
    const aug2 = engine.entityFactory.create(world, 'displacement-venting', componentRegistry);
    
    const slots = world.getComponent(playerId, AugmentSlots);
    slots.equipped.push(aug1, aug2);
    
    // 2. Add heat
    const heat = world.getComponent(playerId, Heat);
    heat.current = 40;
    
    // 3. Activate firmware
    eventBus.emit('FIRMWARE_ACTIVATED', { entityId: playerId, slotIndex: 0, abilityName: 'Test' });
    
    // 4. Submit action
    engine.turnManager.submitAction(GameAction.WAIT);
    
    // 5. Verify both triggered: 40 - 5 (dissipation) - 15 - 15 = 5
    expect(heat.current).toBe(5);
  });

  it('handles compound triggers (Static Siphon: ON_ACTIVATION + ON_KILL)', () => {
    const { world, eventBus } = engine;
    
    const augId = engine.entityFactory.create(world, 'static-siphon', componentRegistry);
    const slots = world.getComponent(playerId, AugmentSlots);
    slots.equipped.push(augId);
    
    // Case 1: Activation but no kill
    eventBus.emit('FIRMWARE_ACTIVATED', { entityId: playerId, slotIndex: 0, abilityName: 'Test' });
    engine.turnManager.submitAction(GameAction.WAIT);
    expect(engine.systems.statusEffect.hasEffect(playerId, 'SHIELD')).toBe(false);
    
    // Case 2: Activation AND kill
    eventBus.emit('FIRMWARE_ACTIVATED', { entityId: playerId, slotIndex: 0, abilityName: 'Test' });
    eventBus.emit('ENTITY_DIED', { entityId: 999, killerId: playerId });
    engine.turnManager.submitAction(GameAction.WAIT);
    expect(engine.systems.statusEffect.hasEffect(playerId, 'SHIELD')).toBe(true);
  });
});

