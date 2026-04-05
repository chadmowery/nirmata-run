import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { EntityRegistry } from '@engine/entity/registry';
import { COMPONENTS_REGISTRY, Actor, Position, LootTable, CurrencyItem, Item } from '@shared/components';
import { createCurrencyDropSystem } from '../currency-drop';
import { GameEvents } from '../../events/types';
import { ComponentRegistry } from '@engine/entity/types';

describe('Currency Drop System', () => {
  let world: World<GameEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameEvents>;
  let entityFactory: EntityFactory;
  let componentRegistry: ComponentRegistry;

  beforeEach(() => {
    eventBus = new EventBus<GameEvents>();
    world = new World<GameEvents>(eventBus);
    grid = new Grid(10, 10);
    
    const registry = new EntityRegistry();
    // Register templates used by drop system
    registry.register({
      name: 'scrap',
      components: {
        item: { name: 'Raw Scrap' },
        currencyItem: { currencyType: 'scrap', amount: 10 },
        position: { x: 0, y: 0 }
      }
    });
    registry.register({
      name: 'blueprint-locked',
      components: {
        item: { name: 'Locked File' },
        currencyItem: { currencyType: 'blueprint', amount: 1 },
        position: { x: 0, y: 0 }
      }
    });
    registry.register({
      name: 'flux',
      components: {
        item: { name: 'Raw Flux' },
        currencyItem: { currencyType: 'flux', amount: 1 },
        position: { x: 0, y: 0 }
      }
    });

    entityFactory = new EntityFactory(registry);

    const componentsMap = Object.fromEntries(
      COMPONENTS_REGISTRY.map((c) => [c.key, c])
    );
    componentRegistry = {
      get: (key) => componentsMap[key],
      has: (key) => !!componentsMap[key]
    };
  });

  it('spawns scrap on Tier 1 enemy death', () => {
    const dropSystem = createCurrencyDropSystem(world, grid, eventBus, entityFactory, componentRegistry);
    dropSystem.init();

    const enemyId = world.createEntity();
    world.addComponent(enemyId, Actor, { isPlayer: false });
    world.addComponent(enemyId, Position, { x: 5, y: 5 });
    world.addComponent(enemyId, LootTable, { tier: 1, drops: [] });

    const droppedSpy = vi.fn();
    eventBus.on('CURRENCY_DROPPED', droppedSpy);

    eventBus.emit('ENTITY_DIED', { entityId: enemyId, killerId: 123, isPlayer: false });
    eventBus.flush();

    // Tier 1 scrap chance is 1.0
    expect(droppedSpy).toHaveBeenCalledWith(expect.objectContaining({
      currencyType: 'scrap',
      x: 5,
      y: 5
    }));

    const droppedAmount = droppedSpy.mock.calls[0][0].amount;
    expect(droppedAmount).toBeGreaterThanOrEqual(5);
    expect(droppedAmount).toBeLessThanOrEqual(15);
  });

  it('may spawn Flux on Tier 2 enemy death', () => {
    // We'll mock Math.random to ensure Flux drops
    const originalRandom = Math.random;
    Math.random = () => 0.1; // Force high success for all checks

    try {
      const dropSystem = createCurrencyDropSystem(world, grid, eventBus, entityFactory, componentRegistry);
      dropSystem.init();

      const enemyId = world.createEntity();
      world.addComponent(enemyId, Actor, { isPlayer: false });
      world.addComponent(enemyId, Position, { x: 5, y: 5 });
      world.addComponent(enemyId, LootTable, { tier: 2, drops: [] });

      const droppedSpy = vi.fn();
      eventBus.on('CURRENCY_DROPPED', droppedSpy);

      eventBus.emit('ENTITY_DIED', { entityId: enemyId, killerId: 123, isPlayer: false });
      eventBus.flush();

      const droppedTypes = droppedSpy.mock.calls.map(call => call[0].currencyType);
      expect(droppedTypes).toContain('scrap');
      expect(droppedTypes).toContain('flux');
      expect(droppedTypes).toContain('blueprint');
    } finally {
      Math.random = originalRandom;
    }
  });
});
