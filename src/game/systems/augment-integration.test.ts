import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEngineInstance } from '../engine-factory';
import { GameAction } from '../input/actions';
import { 
  AugmentData, 
  AugmentSlots, 
  Heat, 
  Dying,
  FirmwareActivatedThisTurn,
  COMPONENTS_REGISTRY 
} from '@shared/components';
import { EntityId } from '@engine/ecs/types';
import { ComponentDef } from '@engine/ecs/types';
import { ApplyStatusEffectIntent, HeatIntent } from '@shared/components';

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
    const { world, eventBus } = engine;
    
    // 1. Create an augment entity
    const augmentId = engine.entityFactory.create(world, 'displacement-venting', componentRegistry);
    
    // 2. Equip it
    const slots = world.getComponent(playerId, AugmentSlots);
    slots.equipped.push(augmentId);
    
    // 3. Add some heat to vent
    world.patchComponent(playerId, Heat, { current: 20 });
    
    // 4. Set up message spy
    const messageSpy = vi.fn();
    eventBus.on('MESSAGE_EMITTED', messageSpy);
    
    // 5. Simulate firmware activation via tag
    world.addComponent(playerId, FirmwareActivatedThisTurn, { slotIndex: 0 });
    
    // 6. Submit the action to the turn manager to trigger phase resolution
    engine.turnManager.submitAction(GameAction.WAIT);
    
    // 7. Verify augment triggered
    // Heat is now an intent, resolution happens in ACTION phase of NEXT turn
    // (Wait, actually it happens in ACTION of THIS turn if we run a full turn?)
    // No, turn manager runs ACTION then REACTION.
    // AugmentSystem runs in REACTION. So it adds HeatIntent in REACTION.
    // That intent won't be resolved until the NEXT turn's ACTION.
    expect(world.hasComponent(playerId, HeatIntent)).toBe(true);
    const heatIntent = world.getComponent(playerId, HeatIntent);
    expect(heatIntent?.amount).toBe(-15);
  });

  it('triggers multiple augments in a single turn (Stacking)', () => {
    const { world } = engine;
    
    // 1. Create and equip two augments
    const aug1 = engine.entityFactory.create(world, 'displacement-venting', componentRegistry);
    const aug2 = engine.entityFactory.create(world, 'displacement-venting', componentRegistry);
    
    const slots = world.getComponent(playerId, AugmentSlots);
    slots.equipped.push(aug1, aug2);
    
    // 2. Add heat
    world.patchComponent(playerId, Heat, { current: 40 });
    
    // 3. Activate firmware via tag
    world.addComponent(playerId, FirmwareActivatedThisTurn, { slotIndex: 0 });
    
    // 4. Submit action
    engine.turnManager.submitAction(GameAction.WAIT);
    
    // 5. Verify intent added (dissipation is immediate in PRE_TURN, but vent is deferred)
    expect(world.hasComponent(playerId, HeatIntent)).toBe(true);
    const heatIntent = world.getComponent(playerId, HeatIntent);
    // 15 * 2 = 30
    expect(heatIntent?.amount).toBe(-30);
  });

  it('handles compound triggers (Static Siphon: ON_ACTIVATION + ON_KILL)', () => {
    const { world } = engine;
    
    const augId = engine.entityFactory.create(world, 'static-siphon', componentRegistry);
    const slots = world.getComponent(playerId, AugmentSlots);
    slots.equipped.push(augId);
    
    // Case 1: Activation but no kill
    world.addComponent(playerId, FirmwareActivatedThisTurn, { slotIndex: 0 });
    engine.turnManager.submitAction(GameAction.WAIT);
    expect(engine.systems.statusEffect.hasEffect(playerId, 'SHIELD')).toBe(false);
    
    // Case 2: Activation AND kill
    world.addComponent(playerId, FirmwareActivatedThisTurn, { slotIndex: 0 });
    const targetId = world.createEntity();
    world.addComponent(targetId, Dying, { killerId: playerId, reason: 'test' });
    
    engine.turnManager.submitAction(GameAction.WAIT);
    // Resolution happens in PRE_TURN of next turn, so we check for intent
    expect(world.hasComponent(playerId, ApplyStatusEffectIntent)).toBe(true);
  });
});
