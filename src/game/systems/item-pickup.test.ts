import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItemPickupSystem, createItemPickupSystem } from './item-pickup';
import { Grid } from '../../engine/grid/grid';
import { World } from '../../engine/ecs/world';
import { EventBus } from '../../engine/events/event-bus';
import { Actor } from '../components/actor';
import { Item } from '../components/item';
import { PickupEffect, EffectType } from '../components/pickup-effect';
import { Health } from '../components/health';
import { GameEvents } from '../events/types';

describe('ItemPickupSystem', () => {
  let world: World;
  let grid: Grid;
  let eventBus: EventBus<GameEvents>;
  let itemPickupSystem: ItemPickupSystem;
  let eventHandlers: Record<string, (payload: unknown) => void> = {};

  const PLAYER_ID = 1;
  const ITEM_ID = 2;

  beforeEach(() => {
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
    } as unknown as EventBus<GameEvents>;

    world = {
      getComponent: vi.fn(),
      hasComponent: vi.fn(),
      destroyEntity: vi.fn(),
    } as unknown as World;

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
    eventHandlers['ENTITY_MOVED']({
      entityId: PLAYER_ID,
      fromX: 5,
      fromY: 5,
      toX: 6,
      toY: 5,
    });

    // Verification
    expect(eventBus.emit).toHaveBeenCalledWith('ITEM_PICKED_UP', {
      entityId: PLAYER_ID,
      itemId: ITEM_ID,
    });
    expect(grid.getItemsAt(6, 5).has(ITEM_ID)).toBe(false);
    expect(world.destroyEntity).toHaveBeenCalledWith(ITEM_ID);
  });

  it('should apply heal effect when picking up a health potion', () => {
    const playerHealth = { current: 10, max: 20 };
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === PLAYER_ID && def === Actor) return { isPlayer: true };
      if (id === PLAYER_ID && def === Health) return playerHealth;
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

    eventHandlers['ENTITY_MOVED']({
      entityId: PLAYER_ID,
      fromX: 5,
      fromY: 5,
      toX: 6,
      toY: 5,
    });

    expect(playerHealth.current).toBe(15);
    expect(eventBus.emit).toHaveBeenCalledWith('ITEM_PICKED_UP', {
      entityId: PLAYER_ID,
      itemId: ITEM_ID,
    });
  });

  it('should cap healing at max health', () => {
    const playerHealth = { current: 18, max: 20 };
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === PLAYER_ID && def === Actor) return { isPlayer: true };
      if (id === PLAYER_ID && def === Health) return playerHealth;
      if (id === ITEM_ID && def === Item) return { name: 'Health Potion' };
      if (id === ITEM_ID && def === PickupEffect) return { type: EffectType.HEAL, value: 5 };
      return undefined;
    });
    vi.mocked(world.hasComponent).mockImplementation((id, def) => {
      if (id === ITEM_ID && def === Item) return true;
      return false;
    });

    grid.addItem(ITEM_ID, 6, 5);

    eventHandlers['ENTITY_MOVED']({
      entityId: PLAYER_ID,
      fromX: 5,
      fromY: 5,
      toX: 6,
      toY: 5,
    });

    expect(playerHealth.current).toBe(20);
  });

  it('should ignore non-player entities moving over items', () => {
    const ENEMY_ID = 3;
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === ENEMY_ID && def === Actor) return { isPlayer: false };
      return undefined;
    });

    grid.addItem(ITEM_ID, 6, 5);

    eventHandlers['ENTITY_MOVED']({
      entityId: ENEMY_ID,
      fromX: 5,
      fromY: 5,
      toX: 6,
      toY: 5,
    });

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

    grid.addItem(DECOR_ID, 6, 5);

    eventHandlers['ENTITY_MOVED']({
      entityId: PLAYER_ID,
      fromX: 5,
      fromY: 5,
      toX: 6,
      toY: 5,
    });

    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(grid.getItemsAt(6, 5).has(DECOR_ID)).toBe(true);
  });

  it('should handle multiple items on one tile', () => {
    const ITEM_ID_2 = 5;
    const playerHealth = { current: 10, max: 20 };
    
    vi.mocked(world.getComponent).mockImplementation((id, def) => {
      if (id === PLAYER_ID && def === Actor) return { isPlayer: true };
      if (id === PLAYER_ID && def === Health) return playerHealth;
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
    grid.addItem(ITEM_ID_2, 6, 5);

    eventHandlers['ENTITY_MOVED']({
      entityId: PLAYER_ID,
      fromX: 5,
      fromY: 5,
      toX: 6,
      toY: 5,
    });

    expect(playerHealth.current).toBe(20); // 10 + 5 + 5
    expect(eventBus.emit).toHaveBeenCalledTimes(2);
    expect(grid.getItemsAt(6, 5).size).toBe(0);
    expect(world.destroyEntity).toHaveBeenCalledWith(ITEM_ID);
    expect(world.destroyEntity).toHaveBeenCalledWith(ITEM_ID_2);
  });
});
