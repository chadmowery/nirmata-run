import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { createItemPickupSystem, ItemPickupSystem } from '@game/systems/item-pickup';
import {
  Actor,
  Position,
  Health,
  RunInventory,
  RunCurrency,
  PickupIntent,
  DropItemIntent,
  SpriteComponent,
  TemplateId,
  Dying,
} from '@shared/components';
import { Item } from '@shared/components/item';
import { PickupEffect, EffectType } from '@shared/components/pickup-effect';

/**
 * U4: dropping a consumable (whole stack unit or last unit) must produce a ground entity that can be
 * picked up again without losing the item, and must keep a valid atlas sprite key.
 */
describe('U4: consumable drop / re-pickup fidelity', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let system: ItemPickupSystem<GameplayEvents>;
  let playerId: number;

  const TILE = { x: 5, y: 5 };

  function spawnPotion(): number {
    const id = world.createEntity();
    world.addComponent(id, Item, { name: 'Health Potion', type: 'consumable' });
    world.addComponent(id, TemplateId, { id: 'health-potion' });
    world.addComponent(id, PickupEffect, { type: EffectType.HEAL, value: 5 });
    world.addComponent(id, Position, { ...TILE });
    world.addComponent(id, SpriteComponent, { key: 'item_potion' });
    grid.addItem(id, TILE.x, TILE.y);
    return id;
  }

  function pickup(itemId: number) {
    const req = world.createEntity();
    world.addComponent(req, PickupIntent, { actorId: playerId, itemId });
    system.update(world);
    if (world.entityExists(req)) world.removeComponent(req, PickupIntent);
  }

  function drop(itemEntityId: number) {
    const req = world.createEntity();
    world.addComponent(req, DropItemIntent, {
      actorId: playerId,
      itemEntityId,
      targetX: TILE.x,
      targetY: TILE.y,
    });
    system.update(world);
  }

  function groundItems(): number[] {
    return Array.from(grid.getItemsAt(TILE.x, TILE.y));
  }

  function potionStack() {
    return world
      .getComponent(playerId, RunInventory)!
      .equipment.filter((e) => e.templateId === 'health-potion' && e.isConsumable);
  }

  beforeEach(() => {
    const eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) grid.setTile(x, y, { walkable: true });
    }
    system = createItemPickupSystem(world, grid, eventBus);

    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true } as never);
    world.addComponent(playerId, Position, { ...TILE });
    world.addComponent(playerId, Health, { current: 20, max: 20, isAlive: true });
    world.addComponent(playerId, RunInventory, { software: [], equipment: [], maxSlots: 20 });
    world.addComponent(playerId, RunCurrency, { stacks: [] });
  });

  it('dropping one unit from a stack and picking it back up restores the full stack', () => {
    const potions = [spawnPotion(), spawnPotion(), spawnPotion()];
    for (const p of potions) pickup(p);

    expect(potionStack()).toHaveLength(1);
    expect(potionStack()[0].quantity).toBe(3);
    const stackEntityId = potionStack()[0].entityId;

    drop(stackEntityId);

    expect(potionStack()[0].quantity).toBe(2);
    const dropped = groundItems();
    expect(dropped).toHaveLength(1);
    const droppedId = dropped[0];
    expect(droppedId).not.toBe(stackEntityId);

    // The dropped unit must carry everything needed for a re-pickup.
    expect(world.getComponent(droppedId, PickupEffect)).toEqual({ type: EffectType.HEAL, value: 5 });
    expect(world.getComponent(droppedId, TemplateId)?.id).toBe('health-potion');
    expect(world.getComponent(droppedId, Item)?.type).toBe('consumable');
    expect(world.getComponent(droppedId, SpriteComponent)?.key).toBe('item_potion');

    pickup(droppedId);

    expect(potionStack()).toHaveLength(1);
    expect(potionStack()[0].quantity).toBe(3);
    expect(world.hasComponent(droppedId, Dying)).toBe(false);
    expect(groundItems()).toHaveLength(0);
  });

  it('dropping the last unit keeps it a consumable with a valid sprite key on re-pickup', () => {
    const potion = spawnPotion();
    pickup(potion);
    expect(potionStack()[0].quantity).toBe(1);

    // Picking up must not strip the atlas sprite key from the (off-grid) entity.
    expect(world.getComponent(potion, SpriteComponent)?.key).toBe('item_potion');

    drop(potion);
    expect(potionStack()).toHaveLength(0);
    expect(groundItems()).toEqual([potion]);
    expect(world.getComponent(potion, SpriteComponent)?.key).toBe('item_potion');

    pickup(potion);
    expect(potionStack()).toHaveLength(1);
    expect(potionStack()[0].quantity).toBe(1);
    expect(potionStack()[0].isConsumable).toBe(true);
  });

  it('repeatedly dropping and re-picking up never loses units', () => {
    for (let i = 0; i < 4; i++) pickup(spawnPotion());
    const stackEntityId = potionStack()[0].entityId;

    for (let round = 0; round < 3; round++) {
      drop(stackEntityId);
      const [droppedId] = groundItems();
      pickup(droppedId);
      expect(potionStack()[0].quantity).toBe(4);
    }
  });
});
