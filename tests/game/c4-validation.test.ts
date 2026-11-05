import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { processAction } from '@game/pipeline/action-pipeline';
import { createItemPickupSystem } from '@game/systems/item-pickup';
import {
  Position,
  Actor,
  RunInventory,
  PickupIntent,
  DropItemIntent,
  Dying,
  Item,
  EquipmentDef,
  Stability,
  Health,
  SpriteComponent,
} from '@shared/components';

describe('C4 Server-Side Validation: Range, Position, and Targeting', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let itemPickupSystem: ReturnType<typeof createItemPickupSystem>;
  const PLAYER_ID = 1;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(20, 20);

    // Setup player at (5, 5)
    world.createEntity(); // Entity 1
    world.addComponent(PLAYER_ID, Actor, { isPlayer: true });
    world.addComponent(PLAYER_ID, Position, { x: 5, y: 5 });
    grid.addEntity(PLAYER_ID, 5, 5);

    itemPickupSystem = createItemPickupSystem(world, grid, eventBus);
  });

  describe('PICKUP Validation', () => {
    it('rejects PICKUP when target item is out of range (Manhattan distance > 1)', () => {
      const farItemId = world.createEntity();
      world.addComponent(farItemId, Item, { name: 'Distant Weapon', type: 'equipment' });
      world.addComponent(farItemId, Position, { x: 10, y: 10 });
      grid.addItem(farItemId, 10, 10);

      const messages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (payload) => messages.push(payload.text));

      // Attempt to pick up far item directly
      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'PICKUP',
        itemId: farItemId,
      });
      eventBus.flush();

      expect(actionKey).toBeNull();
      expect(world.hasComponent(PLAYER_ID, PickupIntent)).toBe(false);
      expect(messages).toContain('Cannot pick up: item is out of reach.');
    });

    it('rejects PICKUP when target item is diagonal (Manhattan distance 2)', () => {
      const diagItemId = world.createEntity();
      world.addComponent(diagItemId, Item, { name: 'Diagonal Item', type: 'equipment' });
      world.addComponent(diagItemId, Position, { x: 6, y: 6 }); // dist = |6-5| + |6-5| = 2
      grid.addItem(diagItemId, 6, 6);

      const messages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (payload) => messages.push(payload.text));

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'PICKUP',
        itemId: diagItemId,
      });
      eventBus.flush();

      expect(actionKey).toBeNull();
      expect(world.hasComponent(PLAYER_ID, PickupIntent)).toBe(false);
      expect(messages).toContain('Cannot pick up: item is out of reach.');
    });

    it('rejects PICKUP when target item does not exist or is Dying', () => {
      const deadItemId = world.createEntity();
      world.addComponent(deadItemId, Item, { name: 'Dead Item', type: 'equipment' });
      world.addComponent(deadItemId, Position, { x: 5, y: 5 });
      world.addComponent(deadItemId, Dying, { reason: 'destroyed' });

      const messages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (payload) => messages.push(payload.text));

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'PICKUP',
        itemId: deadItemId,
      });
      eventBus.flush();

      expect(actionKey).toBeNull();
      expect(world.hasComponent(PLAYER_ID, PickupIntent)).toBe(false);
      expect(messages).toContain('Cannot pick up: item does not exist or was removed.');
    });

    it('fails loudly in ItemPickupSystem without substituting another item', () => {
      // Place a legitimate item nearby at (5, 5)
      const nearbyValidItem = world.createEntity();
      world.addComponent(nearbyValidItem, Item, { name: 'Valid Item', type: 'equipment' });
      world.addComponent(nearbyValidItem, EquipmentDef, {
        name: 'Valid Weapon',
        slotType: 'weapon',
      });
      world.addComponent(nearbyValidItem, Position, { x: 5, y: 5 });
      grid.addItem(nearbyValidItem, 5, 5);

      // Create an invalid/dying item that was requested by a stale or forged intent
      const dyingItem = world.createEntity();
      world.addComponent(dyingItem, Dying, { reason: 'pickup' });

      // Directly attach a PickupIntent for dyingItem
      world.addComponent(PLAYER_ID, PickupIntent, {
        actorId: PLAYER_ID,
        itemId: dyingItem,
        targetX: 5,
        targetY: 5,
      });

      world.addComponent(PLAYER_ID, RunInventory, {
        software: [],
        equipment: [],
        maxSlots: 10,
      });

      const messages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (payload) => messages.push(payload.text));

      // Run system update
      itemPickupSystem.update(world);
      eventBus.flush();

      // The valid item at (5, 5) must NOT have been silently substituted and picked up
      expect(grid.getItemsAt(5, 5).has(nearbyValidItem)).toBe(true);
      const inventory = world.getComponent(PLAYER_ID, RunInventory);
      expect(inventory?.equipment).toHaveLength(0);
      expect(messages).toContain('Cannot pick up: item does not exist or was already removed.');
    });

    it('allows valid PICKUP on same tile (Manhattan distance 0)', () => {
      const validItem = world.createEntity();
      world.addComponent(validItem, Item, { name: 'Floor Loot', type: 'equipment' });
      world.addComponent(validItem, Position, { x: 5, y: 5 });
      grid.addItem(validItem, 5, 5);

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'PICKUP',
        itemId: validItem,
      });

      expect(actionKey).toBe('PICKUP');
      expect(world.hasComponent(PLAYER_ID, PickupIntent)).toBe(true);
      const intent = world.getComponent(PLAYER_ID, PickupIntent);
      expect(intent).toEqual({
        actorId: PLAYER_ID,
        itemId: validItem,
        targetX: 5,
        targetY: 5,
      });
    });

    it('allows valid PICKUP on orthogonally adjacent tile (Manhattan distance 1)', () => {
      const validItem = world.createEntity();
      world.addComponent(validItem, Item, { name: 'Adjacent Loot', type: 'equipment' });
      world.addComponent(validItem, Position, { x: 6, y: 5 });
      grid.addItem(validItem, 6, 5);

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'PICKUP',
        itemId: validItem,
      });

      expect(actionKey).toBe('PICKUP');
      expect(world.hasComponent(PLAYER_ID, PickupIntent)).toBe(true);
      const intent = world.getComponent(PLAYER_ID, PickupIntent);
      expect(intent).toEqual({
        actorId: PLAYER_ID,
        itemId: validItem,
        targetX: 6,
        targetY: 5,
      });
    });

    it('rejects PICKUP when item is already in player inventory even if client spoofs targetX/targetY', () => {
      const ownedItem = world.createEntity();
      world.addComponent(ownedItem, Item, { name: 'Owned Weapon', type: 'equipment' });
      world.addComponent(PLAYER_ID, RunInventory, {
        software: [],
        equipment: [
          {
            entityId: ownedItem,
            templateId: 'owned-weapon',
            rarityTier: 'common',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: 1000,
          },
        ],
        maxSlots: 10,
      });

      const messages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (payload) => messages.push(payload.text));

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'PICKUP',
        itemId: ownedItem,
        targetX: 5,
        targetY: 5,
      });
      eventBus.flush();

      expect(actionKey).toBeNull();
      expect(world.hasComponent(PLAYER_ID, PickupIntent)).toBe(false);
      expect(messages).toContain('Cannot pick up: item is already in inventory or equipped.');
    });

    it('rejects PICKUP when item has no Position and is not registered on the grid at targetX/targetY', () => {
      const floatingItem = world.createEntity();
      world.addComponent(floatingItem, Item, { name: 'Detached Item', type: 'equipment' });

      const messages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (payload) => messages.push(payload.text));

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'PICKUP',
        itemId: floatingItem,
        targetX: 5,
        targetY: 5,
      });
      eventBus.flush();

      expect(actionKey).toBeNull();
      expect(world.hasComponent(PLAYER_ID, PickupIntent)).toBe(false);
      expect(messages).toContain('Cannot pick up: item location is unknown.');
    });
  });

  describe('DROP_ITEM Validation', () => {
    it('rejects DROP_ITEM when target tile is out of range (Manhattan distance > 1)', () => {
      const itemId = world.createEntity();
      world.addComponent(PLAYER_ID, RunInventory, {
        software: [],
        equipment: [
          {
            entityId: itemId,
            templateId: 'test-item',
            rarityTier: 'common',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: 1000,
          },
        ],
        maxSlots: 10,
      });

      const messages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (payload) => messages.push(payload.text));

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'DROP_ITEM',
        itemEntityId: itemId,
        targetX: 8,
        targetY: 8,
      });
      eventBus.flush();

      expect(actionKey).toBeNull();
      expect(world.hasComponent(PLAYER_ID, DropItemIntent)).toBe(false);
      expect(messages).toContain('Cannot drop item: target tile is out of reach.');
    });

    it('rejects DROP_ITEM when target tile is a wall (not walkable)', () => {
      const itemId = world.createEntity();
      world.addComponent(PLAYER_ID, RunInventory, {
        software: [],
        equipment: [
          {
            entityId: itemId,
            templateId: 'test-item',
            rarityTier: 'common',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: 1000,
          },
        ],
        maxSlots: 10,
      });

      // Set tile (6, 5) as non-walkable wall
      grid.setTile(6, 5, { walkable: false });

      const messages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (payload) => messages.push(payload.text));

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'DROP_ITEM',
        itemEntityId: itemId,
        targetX: 6,
        targetY: 5,
      });
      eventBus.flush();

      expect(actionKey).toBeNull();
      expect(world.hasComponent(PLAYER_ID, DropItemIntent)).toBe(false);
      expect(messages).toContain('Cannot drop item: target tile is blocked or out of bounds.');
    });

    it('rejects DROP_ITEM when target coordinates are out of bounds', () => {
      const itemId = world.createEntity();
      world.addComponent(PLAYER_ID, RunInventory, {
        software: [],
        equipment: [
          {
            entityId: itemId,
            templateId: 'test-item',
            rarityTier: 'common',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: 1000,
          },
        ],
        maxSlots: 10,
      });

      // Move player to edge (0, 0)
      world.patchComponent(PLAYER_ID, Position, { x: 0, y: 0 });

      const messages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (payload) => messages.push(payload.text));

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'DROP_ITEM',
        itemEntityId: itemId,
        targetX: -1,
        targetY: 0,
      });
      eventBus.flush();

      expect(actionKey).toBeNull();
      expect(world.hasComponent(PLAYER_ID, DropItemIntent)).toBe(false);
      expect(messages).toContain('Cannot drop item: target tile is blocked or out of bounds.');
    });

    it('rejects DROP_ITEM when item is not owned in player inventory', () => {
      const unownedItemId = world.createEntity();
      world.addComponent(PLAYER_ID, RunInventory, {
        software: [],
        equipment: [],
        maxSlots: 10,
      });

      const messages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (payload) => messages.push(payload.text));

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'DROP_ITEM',
        itemEntityId: unownedItemId,
      });
      eventBus.flush();

      expect(actionKey).toBeNull();
      expect(world.hasComponent(PLAYER_ID, DropItemIntent)).toBe(false);
      expect(messages).toContain('Cannot drop item: item is not in inventory.');
    });

    it('allows valid DROP_ITEM, attaching DropItemIntent and resolving it via ItemPickupSystem', () => {
      const itemId = world.createEntity();
      world.addComponent(PLAYER_ID, RunInventory, {
        software: [],
        equipment: [
          {
            entityId: itemId,
            templateId: 'emp-grenade',
            rarityTier: 'common',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: 1000,
          },
        ],
        maxSlots: 10,
      });

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'DROP_ITEM',
        itemEntityId: itemId,
        targetX: 6,
        targetY: 5,
      });

      expect(actionKey).toBe('DROP_ITEM');
      expect(world.hasComponent(PLAYER_ID, DropItemIntent)).toBe(true);

      // System execution phase
      itemPickupSystem.update(world);

      expect(world.hasComponent(PLAYER_ID, DropItemIntent)).toBe(false);
      expect(world.getComponent(itemId, Position)).toEqual({ x: 6, y: 5 });
      expect(world.getComponent(itemId, SpriteComponent)).toBeDefined();
      expect(grid.getItemsAt(6, 5)).toContain(itemId);

      const inv = world.getComponent(PLAYER_ID, RunInventory);
      expect(inv?.equipment).toHaveLength(0);
    });

    it('decrements consumable stack quantity by 1 on DROP_ITEM instead of deleting the entire stack', () => {
      const potionEntityId = world.createEntity();
      world.addComponent(PLAYER_ID, RunInventory, {
        software: [],
        equipment: [
          {
            entityId: potionEntityId,
            templateId: 'health-potion',
            rarityTier: 'common',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: 1000,
            isConsumable: true,
            quantity: 3,
          },
        ],
        maxSlots: 10,
      });

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'DROP_ITEM',
        itemEntityId: potionEntityId,
        targetX: 6,
        targetY: 5,
      });

      expect(actionKey).toBe('DROP_ITEM');
      itemPickupSystem.update(world);

      const inv = world.getComponent(PLAYER_ID, RunInventory);
      expect(inv?.equipment).toHaveLength(1);
      expect(inv?.equipment[0].quantity).toBe(2);

      const droppedItems = Array.from(grid.getItemsAt(6, 5));
      expect(droppedItems).toHaveLength(1);
      const droppedId = droppedItems[0];
      expect(world.getComponent(droppedId, Position)).toEqual({ x: 6, y: 5 });
      expect(world.getComponent(droppedId, Item)).toBeDefined();
    });
  });

  describe('USE_CONSUMABLE Validation', () => {
    it('rejects USE_CONSUMABLE when client specifies a target other than the player', () => {
      const foreignEntityId = world.createEntity();
      world.addComponent(PLAYER_ID, RunInventory, {
        software: [],
        equipment: [
          {
            entityId: 99,
            templateId: 'health-potion',
            rarityTier: 'common',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: 1000,
            isConsumable: true,
            quantity: 1,
          },
        ],
        maxSlots: 10,
      });

      const messages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (payload) => messages.push(payload.text));

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'USE_CONSUMABLE',
        inventoryIndex: 0,
        targetEntityId: foreignEntityId,
      });
      eventBus.flush();

      expect(actionKey).toBeNull();
      expect(messages).toContain('Cannot use consumable on other entities.');
      // Verify item was not consumed
      const inv = world.getComponent(PLAYER_ID, RunInventory);
      expect(inv?.equipment).toHaveLength(1);
    });

    it('rejects USE_CONSUMABLE when specified slot is not a consumable', () => {
      const nonConsumableId = world.createEntity();
      world.addComponent(PLAYER_ID, RunInventory, {
        software: [],
        equipment: [
          {
            entityId: nonConsumableId,
            templateId: 'kinetic-rifle',
            rarityTier: 'common',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: 1000,
            isConsumable: false,
          },
        ],
        maxSlots: 10,
      });

      const messages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (payload) => messages.push(payload.text));

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'USE_CONSUMABLE',
        inventoryIndex: 0,
      });
      eventBus.flush();

      expect(actionKey).toBeNull();
      expect(messages).toContain('Cannot use item: invalid consumable.');
    });

    it('allows valid USE_CONSUMABLE on self', () => {
      world.addComponent(PLAYER_ID, Stability, { current: 50, max: 100 });
      world.addComponent(PLAYER_ID, Health, { current: 5, max: 10, isAlive: true });
      world.addComponent(PLAYER_ID, RunInventory, {
        software: [],
        equipment: [
          {
            entityId: 99,
            templateId: 'health-potion',
            rarityTier: 'common',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: 1000,
            isConsumable: true,
            quantity: 2,
          },
        ],
        maxSlots: 10,
      });

      const actionKey = processAction(world, grid, eventBus, PLAYER_ID, {
        type: 'USE_CONSUMABLE',
        inventoryIndex: 0,
        targetEntityId: PLAYER_ID,
      });

      expect(actionKey).toBe('USE_CONSUMABLE');
      const inv = world.getComponent(PLAYER_ID, RunInventory);
      expect(inv?.equipment[0].quantity).toBe(1);
      expect(world.getComponent(PLAYER_ID, Stability)?.current).toBe(60);
    });
  });
});
