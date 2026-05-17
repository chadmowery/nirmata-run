import { describe, it, expect } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EngineEvents } from '@engine/events/types';
import { Energy } from '@shared/components/energy';
import { InventorySwapIntent } from '@shared/components/inventory-intent';
import { handleInventorySwap } from './inventory-intent';

describe('Inventory Swap Intent', () => {
  it('should add InventorySwapIntent and deduct energy', () => {
    const eventBus = new EventBus<EngineEvents>();
    const world = new World(eventBus);
    const actorId = world.createEntity();
    world.addComponent(actorId, Energy, { current: 1100, speed: 100, threshold: 1000 });

    handleInventorySwap(world, actorId, 0, 1);

    const intent = world.getComponent(actorId, InventorySwapIntent);
    expect(intent).toBeDefined();
    expect(intent?.sourceIndex).toBe(0);
    expect(intent?.destinationIndex).toBe(1);

    const energy = world.getComponent(actorId, Energy);
    expect(energy?.current).toBe(100);
  });
});
