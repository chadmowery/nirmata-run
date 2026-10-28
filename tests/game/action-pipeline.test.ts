import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { runActionPipeline } from '@game/pipeline/action-pipeline';
import {
  Position,
  Health,
  Hostile,
  Attack,
  Defense,
  Actor,
  EquipmentSlots,
  RunInventory,
  DescentIntent,
  ExtractionIntent,
  FirmwareIntent,
  VentIntent,
  BurnSoftwareIntent,
  PickupIntent,
} from '@shared/components';

describe('ActionPipeline', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  const PLAYER_ID = 1;
  const ENEMY_ID = 2;

  beforeEach(() => {
    eventBus = new EventBus();
    world = new World(eventBus);
    grid = new Grid(10, 10);

    // Setup Player
    const pId = world.createEntity(); // Should be 1
    world.addComponent(pId, Position, { x: 5, y: 5 });
    world.addComponent(pId, Health, Health.schema.parse({ current: 10, max: 10 }));
    world.addComponent(pId, Attack, { power: 3 });
    world.addComponent(pId, Actor, { isPlayer: true });
    grid.addEntity(pId, 5, 5);
  });

  it('should process a MOVE action and update state', () => {
    const action = { type: 'MOVE' as const, dx: 1, dy: 0 };
    const {
      world: newWorld,
      grid: newGrid,
      delta,
    } = runActionPipeline(world, grid, PLAYER_ID, action);

    // Verify new state
    const pos = newWorld.getComponent(PLAYER_ID, Position);
    expect(pos).toEqual({ x: 6, y: 5 });
    expect(newGrid.getEntitiesAt(5, 5).size).toBe(0);
    expect(newGrid.getEntitiesAt(6, 5).has(PLAYER_ID)).toBe(true);

    // Verify delta exists
    expect(delta.world.length).toBeGreaterThan(0);
    expect(delta.grid.length).toBeGreaterThan(0);

    // Verify pureness (original state unchanged)
    expect(world.getComponent(PLAYER_ID, Position)).toEqual({ x: 5, y: 5 });
    expect(grid.getEntitiesAt(5, 5).has(PLAYER_ID)).toBe(true);
  });

  it('should process a MOVE action into an enemy as a bump attack', () => {
    // Setup Enemy
    const eId = world.createEntity(); // Should be 2
    world.addComponent(eId, Position, { x: 6, y: 5 });
    world.addComponent(eId, Health, Health.schema.parse({ current: 10, max: 10 }));
    world.addComponent(eId, Hostile, {});
    world.addComponent(eId, Defense, { armor: 1 });
    world.addComponent(eId, Actor, { isPlayer: false });
    grid.addEntity(eId, 6, 5);

    const action = { type: 'MOVE' as const, dx: 1, dy: 0 };
    const { world: newWorld } = runActionPipeline(world, grid, PLAYER_ID, action);

    // Verify combat result
    const enemyHealth = newWorld.getComponent(ENEMY_ID, Health);
    // Player power 3 - Enemy armor 1 = 2 damage. 10 - 2 = 8.
    expect(enemyHealth?.current).toBe(8);

    // Player should NOT have moved
    const playerPos = newWorld.getComponent(PLAYER_ID, Position);
    expect(playerPos).toEqual({ x: 5, y: 5 });
  });

  it('should handle WAIT action with no changes', () => {
    const action = { type: 'WAIT' as const };
    const { delta } = runActionPipeline(world, grid, PLAYER_ID, action);

    expect(delta.world.length).toBe(0);
    expect(delta.grid.length).toBe(0);
  });

  describe('Equipment gear actions (weapon/armor)', () => {
    beforeEach(() => {
      world.addComponent(PLAYER_ID, EquipmentSlots, { weapon: null, armor: null });
    });

    it('should equip a weapon', () => {
      const action = {
        type: 'EQUIP' as const,
        shellId: 'shell',
        slotType: 'weapon' as const,
        itemEntityId: 99,
      };
      const { world: newWorld } = runActionPipeline(world, grid, PLAYER_ID, action);
      const equipment = newWorld.getComponent(PLAYER_ID, EquipmentSlots);
      expect(equipment?.weapon).toBe(99);
    });

    it('should unequip a weapon', () => {
      world.patchComponent(PLAYER_ID, EquipmentSlots, { weapon: 99 });
      const action = { type: 'UNEQUIP' as const, slotType: 'weapon' as const, slotIndex: 0 };
      const { world: newWorld } = runActionPipeline(world, grid, PLAYER_ID, action);
      const equipment = newWorld.getComponent(PLAYER_ID, EquipmentSlots);
      expect(equipment?.weapon).toBe(null);
    });

    it('should equip armor', () => {
      const action = {
        type: 'EQUIP' as const,
        shellId: 'shell',
        slotType: 'armor' as const,
        itemEntityId: 88,
      };
      const { world: newWorld } = runActionPipeline(world, grid, PLAYER_ID, action);
      const equipment = newWorld.getComponent(PLAYER_ID, EquipmentSlots);
      expect(equipment?.armor).toBe(88);
    });

    it('should unequip armor', () => {
      world.patchComponent(PLAYER_ID, EquipmentSlots, { armor: 88 });
      const action = { type: 'UNEQUIP' as const, slotType: 'armor' as const, slotIndex: 0 };
      const { world: newWorld } = runActionPipeline(world, grid, PLAYER_ID, action);
      const equipment = newWorld.getComponent(PLAYER_ID, EquipmentSlots);
      expect(equipment?.armor).toBe(null);
    });
  });

  describe('Extended Action Intents', () => {
    it('should process explicit ATTACK intent', () => {
      const eId = world.createEntity();
      world.addComponent(eId, Position, { x: 7, y: 7 });
      world.addComponent(eId, Health, Health.schema.parse({ current: 10, max: 10 }));
      world.addComponent(eId, Hostile, {});
      grid.addEntity(eId, 7, 7);

      const action = { type: 'ATTACK' as const, targetId: eId };
      const { world: newWorld } = runActionPipeline(world, grid, PLAYER_ID, action);
      const enemyHealth = newWorld.getComponent(eId, Health);
      expect(enemyHealth?.current).toBe(7); // 10 - 3 power = 7
    });

    it('should process VENT intent', () => {
      const action = { type: 'VENT' as const };
      const { world: newWorld } = runActionPipeline(world, grid, PLAYER_ID, action);
      expect(newWorld.hasComponent(PLAYER_ID, VentIntent)).toBe(true);
    });

    it('should process ANCHOR_DESCEND intent', () => {
      const action = { type: 'ANCHOR_DESCEND' as const, anchorId: 1, cost: 10 };
      const { world: newWorld } = runActionPipeline(world, grid, PLAYER_ID, action);
      expect(newWorld.getComponent(PLAYER_ID, Position)).toBeDefined();
    });

    it('should process ANCHOR_EXTRACT intent', () => {
      const action = { type: 'ANCHOR_EXTRACT' as const };
      const { world: newWorld } = runActionPipeline(world, grid, PLAYER_ID, action);
      expect(newWorld.getComponent(PLAYER_ID, Position)).toBeDefined();
    });

    it('should process PICKUP_CURRENCY intent', () => {
      const action = {
        type: 'PICKUP_CURRENCY' as const,
        itemId: 50,
        currencyType: 'scrap' as const,
        amount: 10,
      };
      const { world: newWorld } = runActionPipeline(world, grid, PLAYER_ID, action);
      expect(newWorld.getComponent(PLAYER_ID, Position)).toBeDefined();
    });

    it('should process BURN_SOFTWARE intent when software exists in inventory', () => {
      world.addComponent(PLAYER_ID, RunInventory, {
        software: [
          {
            entityId: 42,
            templateId: 'overclock',
            rarityTier: 'rare',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: 1000,
          },
        ],
        equipment: [],
        maxSlots: 5,
      });

      const action = {
        type: 'BURN_SOFTWARE' as const,
        runInventoryIndex: 0,
        targetSlot: 'weapon' as const,
      };
      const { world: newWorld } = runActionPipeline(world, grid, PLAYER_ID, action);
      expect(newWorld.getComponent(PLAYER_ID, Position)).toBeDefined();
    });
  });
});
