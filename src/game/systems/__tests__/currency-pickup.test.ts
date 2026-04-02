import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { EntityRegistry } from '@engine/entity/registry';
import { COMPONENTS_REGISTRY, Actor, Position, LootTable, CurrencyItem, Item } from '@shared/components';
import { createCurrencyDropSystem } from '../currency-drop';
import { createItemPickupSystem } from '../item-pickup';
import { runInventoryRegistry } from '../run-inventory';
import { GameEvents } from '../../events/types';
import { ComponentRegistry } from '@engine/entity/types';

describe('Currency Pickup System', () => {
  let world: World<GameEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameEvents>;
  let entityFactory: EntityFactory;
  let componentRegistry: ComponentRegistry;
  let sessionId = 'test-session';

  beforeEach(() => {
    eventBus = new EventBus<GameEvents>();
    world = new World<GameEvents>(eventBus);
    grid = new Grid(10, 10);
    
    const registry = new EntityRegistry();
    // Register basic templates
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

    entityFactory = new EntityFactory(registry);

    const componentsMap = Object.fromEntries(
      COMPONENTS_REGISTRY.map((c) => [c.key, c])
    );
    componentRegistry = {
      get: (key) => componentsMap[key],
      has: (key) => !!componentsMap[key]
    };

    runInventoryRegistry.clear(sessionId);
  });

  it('walking over Scrap adds it to run inventory', () => {
    const pickupSystem = createItemPickupSystem(world, grid, eventBus, sessionId);
    pickupSystem.init();

    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 1, y: 1 });

    const scrapId = entityFactory.create(world, 'scrap', componentRegistry, {
      position: { x: 2, y: 1 },
      currencyItem: { currencyType: 'scrap', amount: 15 }
    });
    grid.addEntity(scrapId, 2, 1);
    grid.addItem(scrapId, 2, 1);

    // Move player onto scrap
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 1,
      fromY: 1,
      toX: 2,
      toY: 1
    });
    eventBus.flush();

    expect(runInventoryRegistry.getCurrencyAmount(sessionId, 'scrap')).toBe(15);
    expect(world.entityExists(scrapId)).toBe(false);
  });

  it('emits error message if inventory is full', () => {
    const pickupSystem = createItemPickupSystem(world, grid, eventBus, sessionId);
    pickupSystem.init();

    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 1, y: 1 });

    // Fill inventory with software (max 5)
    for (let i = 0; i < 5; i++) {
      runInventoryRegistry.addSoftware(sessionId, {
        entityId: 999 + i,
        templateId: 'test',
        rarityTier: 'common',
        pickedUpAtFloor: 1,
        pickedUpAtTimestamp: Date.now()
      });
    }

    const scrapId = entityFactory.create(world, 'scrap', componentRegistry, {
      position: { x: 2, y: 1 },
      currencyItem: { currencyType: 'scrap', amount: 15 }
    });
    grid.addEntity(scrapId, 2, 1);
    grid.addItem(scrapId, 2, 1);

    const messageSpy = vi.fn();
    eventBus.on('MESSAGE_EMITTED', messageSpy);

    // Move player onto scrap
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 1,
      fromY: 1,
      toX: 2,
      toY: 1
    });
    eventBus.flush();

    expect(runInventoryRegistry.getCurrencyAmount(sessionId, 'scrap')).toBe(0);
    expect(world.entityExists(scrapId)).toBe(true);
    expect(messageSpy).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining('Inventory full'),
      type: 'error'
    }));
  });

  it('allows stacking currency even if software inventory is full', () => {
    const pickupSystem = createItemPickupSystem(world, grid, eventBus, sessionId);
    pickupSystem.init();

    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 1, y: 1 });

    // Add some scrap first
    runInventoryRegistry.addCurrency(sessionId, 'scrap', 10);

    // Fill remaining slots with software (total 5 slots)
    for (let i = 0; i < 4; i++) {
      runInventoryRegistry.addSoftware(sessionId, {
        entityId: 999 + i,
        templateId: 'test',
        rarityTier: 'common',
        pickedUpAtFloor: 1,
        pickedUpAtTimestamp: Date.now()
      });
    }
    // Now we have 1 scrap stack + 4 software = 5 slots.

    const scrapId = entityFactory.create(world, 'scrap', componentRegistry, {
      position: { x: 2, y: 1 },
      currencyItem: { currencyType: 'scrap', amount: 15 }
    });
    grid.addEntity(scrapId, 2, 1);
    grid.addItem(scrapId, 2, 1);

    // Move player onto scrap
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 1,
      fromY: 1,
      toX: 2,
      toY: 1
    });
    eventBus.flush();

    // Should succeed because it stacks
    expect(runInventoryRegistry.getCurrencyAmount(sessionId, 'scrap')).toBe(25);
    expect(world.entityExists(scrapId)).toBe(false);
  });
});
