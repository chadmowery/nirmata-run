import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { EntityRegistry } from '@engine/entity/registry';
import { COMPONENTS_REGISTRY, Actor, Position, LootTable, CurrencyItem, Item, Dying } from '@shared/components';
import { createRewardDropSystem } from '../reward-drop';
import { GameEvents } from '../../events/types';
import { ComponentRegistry } from '@engine/entity/types';
import { Phase } from '@engine/ecs/types';

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
    const rewardDropSystem = createRewardDropSystem(world, grid, eventBus, entityFactory, componentRegistry);
    rewardDropSystem.init();

    const enemyId = world.createEntity();
    world.addComponent(enemyId, Actor, { isPlayer: false });
    world.addComponent(enemyId, Position, { x: 5, y: 5 });
    world.addComponent(enemyId, LootTable, { tier: 1, drops: [] });

    world.addComponent(enemyId, Dying, { killerId: 123 });
    world.executeSystems(Phase.CLEANUP);
    eventBus.flush();

    // Verify state: should have a scrap entity at (5, 5)
    const entities = Array.from(grid.getItemsAt(5, 5));
    const scrapEntity = entities.find(id => world.getComponent(id, CurrencyItem)?.currencyType === 'scrap');
    
    expect(scrapEntity).toBeDefined();
    const ci = world.getComponent(scrapEntity!, CurrencyItem)!;
    expect(ci.amount).toBeGreaterThanOrEqual(5);
    expect(ci.amount).toBeLessThanOrEqual(15);
  });

  it('may spawn Flux on Tier 2 enemy death', () => {
    // We'll mock Math.random to ensure Flux drops
    const originalRandom = Math.random;
    Math.random = () => 0.1; // Force high success for all checks

    try {
      const dropSystem = createRewardDropSystem(world, grid, eventBus, entityFactory, componentRegistry);
      dropSystem.init();

      const enemyId = world.createEntity();
      world.addComponent(enemyId, Actor, { isPlayer: false });
      world.addComponent(enemyId, Position, { x: 5, y: 5 });
      world.addComponent(enemyId, LootTable, { tier: 2, drops: [] });

      world.addComponent(enemyId, Dying, { killerId: 123 });
      world.executeSystems(Phase.CLEANUP);
      eventBus.flush();

      const entities = Array.from(grid.getItemsAt(5, 5));
      const types = entities.map(id => world.getComponent(id, CurrencyItem)?.currencyType).filter(Boolean);
      
      expect(types).toContain('scrap');
      expect(types).toContain('flux');
      expect(types).toContain('blueprint');
    } finally {
      Math.random = originalRandom;
    }
  });
});
