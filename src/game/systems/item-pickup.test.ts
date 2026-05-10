import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItemPickupSystem, createItemPickupSystem } from './item-pickup';
import { Grid } from '../../engine/grid/grid';
import { World } from '../../engine/ecs/world';
import { EventBus } from '../../engine/events/event-bus';
import { Actor } from '@shared/components/actor';
import { Position } from '@shared/components/position';
import { MovedThisTurn } from '@shared/components/moved-this-turn';
import { Item } from '@shared/components/item';
import { PickupEffect, EffectType } from '@shared/components/pickup-effect';
import { Health } from '@shared/components/health';
import { GameplayEvents } from '@shared/events/types';

describe('ItemPickupSystem', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let itemPickupSystem: ItemPickupSystem<GameplayEvents>;
  let eventHandlers: Record<string, (payload: unknown) => void> = {};

  const PLAYER_ID = 1;
  const ITEM_ID = 2;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);
    // Set all tiles to walkable
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        grid.setTile(x, y, { walkable: true });
      }
    }

    eventHandlers = {};
    eventBus = {
      on: vi.fn().mockImplementation((event, handler) => {
        eventHandlers[event] = handler;
        return () => { delete eventHandlers[event]; };
      }),
      emit: vi.fn(),
    } as unknown as EventBus<GameplayEvents>;

    world = {
      getComponent: vi.fn(),
      hasComponent: vi.fn(),
      destroyEntity: vi.fn(),
      patchComponent: vi.fn(),
      query: vi.fn(),
      registerSystem: vi.fn(),
      unregisterSystem: vi.fn(),
      addComponent: vi.fn(),
    } as unknown as World<GameplayEvents>;

    itemPickupSystem = createItemPickupSystem(world, grid, eventBus);
    itemPickupSystem.init();
  });

  it('should pick up an item when player moves onto its tile', () => {
    // Setup mocks
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === PLAYER_ID && def === Actor) return { isPlayer: true };
      if (id === ITEM_ID && def === Item) return { name: 'Health Potion' };
      return undefined;
    });
    vi.mocked(world.hasComponent).mockImplementation((id, def) => {
      if (id === ITEM_ID && def === Item) return true;
      return false;
    });

    grid.addEntity(PLAYER_ID, 5, 5);
    grid.addItem(ITEM_ID, 6, 5);

    // Trigger ENTITY_MOVED
    vi.mocked(world.query).mockReturnValue([PLAYER_ID]);
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === PLAYER_ID && def === Actor) return { isPlayer: true };
      if (id === PLAYER_ID && def === MovedThisTurn) return { fromX: 5, fromY: 5, toX: 6, toY: 5 };
      if (id === PLAYER_ID && def === Position) return { x: 6, y: 5 };
      if (id === ITEM_ID && def === Item) return { name: 'Health Potion' };
      return undefined;
    });

    itemPickupSystem.update(world);

    // Verification
    expect(eventBus.emit).toHaveBeenCalledWith('ITEM_PICKED_UP', {
      entityId: PLAYER_ID,
      itemId: ITEM_ID,
    });
    expect(grid.getItemsAt(6, 5).has(ITEM_ID)).toBe(false);
    expect(world.addComponent).toHaveBeenCalledWith(ITEM_ID, expect.anything(), expect.objectContaining({ reason: 'pickup' }));
  });

  it('should apply heal effect when picking up a health potion', () => {
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === PLAYER_ID && def === Actor) return { isPlayer: true };
      if (id === PLAYER_ID && def === Health) return { current: 10, max: 20 };
      if (id === ITEM_ID && def === Item) return { name: 'Health Potion' };
      if (id === ITEM_ID && def === PickupEffect) return { type: EffectType.HEAL, value: 5 };
      return undefined;
    });
    vi.mocked(world.hasComponent).mockImplementation((id, def) => {
      if (id === ITEM_ID && def === Item) return true;
      return false;
    });

    grid.addEntity(PLAYER_ID, 5, 5);
    grid.addItem(ITEM_ID, 6, 5);

    vi.mocked(world.query).mockReturnValue([PLAYER_ID]);
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === PLAYER_ID && def === Actor) return { isPlayer: true };
      if (id === PLAYER_ID && def === Health) return { current: 10, max: 20 };
      if (id === PLAYER_ID && def === MovedThisTurn) return { fromX: 5, fromY: 5, toX: 6, toY: 5 };
      if (id === PLAYER_ID && def === Position) return { x: 6, y: 5 };
      if (id === ITEM_ID && def === Item) return { name: 'Health Potion' };
      if (id === ITEM_ID && def === PickupEffect) return { type: EffectType.HEAL, value: 5 };
      return undefined;
    });

    itemPickupSystem.update(world);

    expect(world.patchComponent).toHaveBeenCalledWith(PLAYER_ID, Health, { current: 15 });
    expect(eventBus.emit).toHaveBeenCalledWith('ITEM_PICKED_UP', {
      entityId: PLAYER_ID,
      itemId: ITEM_ID,
    });
  });

  it('should cap healing at max health', () => {
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === PLAYER_ID && def === Actor) return { isPlayer: true };
      if (id === PLAYER_ID && def === Health) return { current: 18, max: 20 };
      if (id === ITEM_ID && def === Item) return { name: 'Health Potion' };
      if (id === ITEM_ID && def === PickupEffect) return { type: EffectType.HEAL, value: 5 };
      return undefined;
    });
    vi.mocked(world.hasComponent).mockImplementation((id, def) => {
      if (id === ITEM_ID && def === Item) return true;
      return false;
    });

    grid.addItem(ITEM_ID, 6, 5);

    vi.mocked(world.query).mockReturnValue([PLAYER_ID]);
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === PLAYER_ID && def === Actor) return { isPlayer: true };
      if (id === PLAYER_ID && def === Health) return { current: 18, max: 20 };
      if (id === PLAYER_ID && def === MovedThisTurn) return { fromX: 5, fromY: 5, toX: 6, toY: 5 };
      if (id === PLAYER_ID && def === Position) return { x: 6, y: 5 };
      if (id === ITEM_ID && def === Item) return { name: 'Health Potion' };
      if (id === ITEM_ID && def === PickupEffect) return { type: EffectType.HEAL, value: 5 };
      return undefined;
    });

    itemPickupSystem.update(world);

    expect(world.patchComponent).toHaveBeenCalledWith(PLAYER_ID, Health, { current: 20 });
  });

  it('should ignore non-player entities moving over items', () => {
    const ENEMY_ID = 3;
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === ENEMY_ID && def === Actor) return { isPlayer: false };
      return undefined;
    });

    grid.addItem(ITEM_ID, 6, 5);

    vi.mocked(world.query).mockReturnValue([ENEMY_ID]);
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === ENEMY_ID && def === Actor) return { isPlayer: false };
      if (id === ENEMY_ID && def === MovedThisTurn) return { fromX: 5, fromY: 5, toX: 6, toY: 5 };
      if (id === ENEMY_ID && def === Position) return { x: 6, y: 5 };
      return undefined;
    });

    itemPickupSystem.update(world);

    expect(eventBus.emit).not.toHaveBeenCalledWith('ITEM_PICKED_UP', expect.anything());
    expect(grid.getItemsAt(6, 5).has(ITEM_ID)).toBe(true);
  });

  it('should ignore non-item entities at destination', () => {
    const DECOR_ID = 4;
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === PLAYER_ID && def === Actor) return { isPlayer: true };
      return undefined;
    });
    vi.mocked(world.hasComponent).mockReturnValue(false); // No Item component
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === PLAYER_ID && def === Actor) return { isPlayer: true };
      if (id === PLAYER_ID && def === MovedThisTurn) return { fromX: 5, fromY: 5, toX: 6, toY: 5 };
      if (id === PLAYER_ID && def === Position) return { x: 6, y: 5 };
      return undefined;
    });

    vi.mocked(world.query).mockReturnValue([PLAYER_ID]);

    itemPickupSystem.update(world);
    grid.addItem(DECOR_ID, 6, 5);


    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(grid.getItemsAt(6, 5).has(DECOR_ID)).toBe(true);
  });

  it('should handle multiple items on one tile', () => {
    const ITEM_ID_2 = 5;
    
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === PLAYER_ID && def === Actor) return { isPlayer: true };
      // Note: In a real world, the health would be updated between items.
      // But in this mock, it will always return 10 unless we use mockReturnValueOnce.
      if (id === PLAYER_ID && def === Health) return { current: 10, max: 20 };
      if (id === ITEM_ID || id === ITEM_ID_2) {
        if (def === Item) return { name: 'Health Potion' };
        if (def === PickupEffect) return { type: EffectType.HEAL, value: 5 };
      }
      return undefined;
    });
    vi.mocked(world.hasComponent).mockImplementation((id, def) => {
      if ((id === ITEM_ID || id === ITEM_ID_2) && def === Item) return true;
      return false;
    });

    grid.addItem(ITEM_ID, 6, 5);
    grid.addItem(ITEM_ID_2, 6, 5);    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === PLAYER_ID && def === Actor) return { isPlayer: true };
      if (id === PLAYER_ID && def === Health) return { current: 10, max: 20 };
      if (id === PLAYER_ID && def === MovedThisTurn) return { fromX: 5, fromY: 5, toX: 6, toY: 5 };
      if (id === PLAYER_ID && def === Position) return { x: 6, y: 5 };
      if (id === ITEM_ID || id === ITEM_ID_2) {
        if (def === Item) return { name: 'Health Potion' };
        if (def === PickupEffect) return { type: EffectType.HEAL, value: 5 };
      }
      return undefined;
    });

    vi.mocked(world.query).mockReturnValue([PLAYER_ID]);

    itemPickupSystem.update(world);


    // Since each pickup starts with health 10 in the mock:
    expect(world.patchComponent).toHaveBeenCalledWith(PLAYER_ID, Health, { current: 15 });
    expect(eventBus.emit).toHaveBeenCalledTimes(2);
    expect(grid.getItemsAt(6, 5).size).toBe(0);
    expect(world.addComponent).toHaveBeenCalledWith(ITEM_ID, expect.anything(), expect.objectContaining({ reason: 'pickup' }));
    expect(world.addComponent).toHaveBeenCalledWith(ITEM_ID_2, expect.anything(), expect.objectContaining({ reason: 'pickup' }));
  });
});
