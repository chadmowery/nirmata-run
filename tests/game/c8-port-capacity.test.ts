import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Grid } from '@engine/grid/grid';
import { GameplayEvents } from '@shared/events/types';
import {
  Actor,
  RunInventory,
  PortConfig,
  FirmwareSlots,
  AugmentSlots,
  AbilityDef,
  AugmentData,
  Dying,
} from '@shared/components';
import { processAction } from '@game/pipeline/action-pipeline';
import {
  BurnFirmwareActionSchema,
  BurnAugmentActionSchema,
  MoveAndUseFirmwareActionSchema,
} from '@shared/types';

describe('C8 Shell Port Capacity and Burning Invariant', () => {
  let world: World<GameplayEvents>;
  let eventBus: EventBus<GameplayEvents>;
  let grid: Grid;
  let playerId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);

    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    // Default 1 firmware port, 2 augment ports
    world.addComponent(playerId, PortConfig, {
      maxFirmware: 1,
      maxAugment: 2,
      maxSoftware: 2,
    });
    world.addComponent(playerId, FirmwareSlots, { equipped: [] });
    world.addComponent(playerId, AugmentSlots, { equipped: [] });
    world.addComponent(playerId, RunInventory, {
      software: [],
      equipment: [],
      maxSlots: 10,
    });
  });

  describe('Zod Schema Bounds for Upgraded Shells', () => {
    it('accepts slotIndex > 2 for upgraded firmware ports in action schemas', () => {
      const fwAction = {
        type: 'BURN_FIRMWARE',
        firmwareEntityId: 123,
        slotIndex: 3,
      };
      expect(BurnFirmwareActionSchema.safeParse(fwAction).success).toBe(true);

      const moveAction = {
        type: 'MOVE_AND_USE_FIRMWARE',
        dx: 1,
        dy: 0,
        firmwareSlotIndex: 3,
        targetX: 5,
        targetY: 5,
      };
      expect(MoveAndUseFirmwareActionSchema.safeParse(moveAction).success).toBe(true);
    });

    it('accepts slotIndex > 3 for upgraded augment ports in action schemas', () => {
      const agAction = {
        type: 'BURN_AUGMENT',
        augmentEntityId: 456,
        slotIndex: 4,
      };
      expect(BurnAugmentActionSchema.safeParse(agAction).success).toBe(true);
    });
  });

  describe('BURN_FIRMWARE Capacity & Invariants', () => {
    it('rejects burning into a slot that exceeds shell PortConfig.maxFirmware and preserves inventory', () => {
      // Shell has maxFirmware: 1. Slot 1 (2nd slot) should be rejected.
      const fwItem = world.createEntity();
      world.addComponent(
        fwItem,
        AbilityDef,
        AbilityDef.schema.parse({
          name: 'Logic Jam',
          heatCost: 20,
          range: 4,
          effectType: 'stun',
        }),
      );
      world.patchComponent(playerId, RunInventory, {
        equipment: [
          {
            entityId: fwItem,
            templateId: 'firmware-logic-jam',
            rarityTier: 'uncommon',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: Date.now(),
            quantity: 1,
          },
        ],
      });

      const messages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (msg) => {
        messages.push((msg as { text: string }).text);
      });

      const result = processAction(world, grid, eventBus, playerId, {
        type: 'BURN_FIRMWARE',
        firmwareEntityId: fwItem,
        slotIndex: 1, // Exceeds maxFirmware (1)
      });
      eventBus.flush();

      expect(result).toBeNull();
      expect(messages.some((m) => m.includes('exceeds shell capacity'))).toBe(true);

      // Verify item was NOT removed from inventory
      const inv = world.getComponent(playerId, RunInventory);
      expect(inv?.equipment.some((e) => e.entityId === fwItem)).toBe(true);

      // Verify no slots were equipped
      const fwSlots = world.getComponent(playerId, FirmwareSlots);
      expect(fwSlots?.equipped).toEqual([]);
    });

    it('never pushes 0 placeholder entity IDs into equipped slots', () => {
      // Shell with maxFirmware = 3
      world.patchComponent(playerId, PortConfig, { maxFirmware: 3 });

      const fwItem = world.createEntity();
      world.addComponent(
        fwItem,
        AbilityDef,
        AbilityDef.schema.parse({
          name: 'EMP Burst',
          heatCost: 30,
          range: 3,
          effectType: 'melee_attack',
          damageAmount: 10,
        }),
      );
      world.patchComponent(playerId, RunInventory, {
        equipment: [
          {
            entityId: fwItem,
            templateId: 'firmware-emp',
            rarityTier: 'rare',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: Date.now(),
            quantity: 1,
          },
        ],
      });

      // Target slotIndex 2 when equipped array is currently empty []
      const result = processAction(world, grid, eventBus, playerId, {
        type: 'BURN_FIRMWARE',
        firmwareEntityId: fwItem,
        slotIndex: 2,
      });

      expect(result).toBe('BURN_FIRMWARE');

      const fwSlots = world.getComponent(playerId, FirmwareSlots);
      // Must append cleanly without any 0 placeholders!
      expect(fwSlots?.equipped).toEqual([fwItem]);
      expect(fwSlots?.equipped.includes(0)).toBe(false);
    });

    it('overwriting an existing slot condemns old entity with Dying (reason: overwritten)', () => {
      const oldFw = world.createEntity();
      world.addComponent(
        oldFw,
        AbilityDef,
        AbilityDef.schema.parse({
          name: 'Old Ability',
          heatCost: 10,
          range: 1,
          effectType: 'melee_attack',
        }),
      );
      world.patchComponent(playerId, FirmwareSlots, { equipped: [oldFw] });

      const newFw = world.createEntity();
      world.addComponent(
        newFw,
        AbilityDef,
        AbilityDef.schema.parse({
          name: 'New Ability',
          heatCost: 15,
          range: 1,
          effectType: 'melee_attack',
        }),
      );
      world.patchComponent(playerId, RunInventory, {
        equipment: [
          {
            entityId: newFw,
            templateId: 'firmware-new',
            rarityTier: 'common',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: Date.now(),
            quantity: 1,
          },
        ],
      });

      const result = processAction(world, grid, eventBus, playerId, {
        type: 'BURN_FIRMWARE',
        firmwareEntityId: newFw,
        slotIndex: 0,
      });

      expect(result).toBe('BURN_FIRMWARE');

      // Check slot was updated
      const fwSlots = world.getComponent(playerId, FirmwareSlots);
      expect(fwSlots?.equipped).toEqual([newFw]);

      // Check old entity is condemned according to Death Protocol
      const dying = world.getComponent(oldFw, Dying);
      expect(dying).toBeDefined();
      expect(dying?.reason).toBe('overwritten');
      expect(dying?.killerId).toBe(playerId);
    });

    it('rejects burning when item does not exist in player inventory', () => {
      const ghostId = 9999;
      const result = processAction(world, grid, eventBus, playerId, {
        type: 'BURN_FIRMWARE',
        firmwareEntityId: ghostId,
        slotIndex: 0,
      });

      expect(result).toBeNull();
      const fwSlots = world.getComponent(playerId, FirmwareSlots);
      expect(fwSlots?.equipped).toEqual([]);
    });
  });

  describe('BURN_AUGMENT Capacity & Invariants', () => {
    it('rejects burning augment when slotIndex exceeds shell PortConfig.maxAugment', () => {
      // Shell has maxAugment: 2
      const agItem = world.createEntity();
      world.addComponent(
        agItem,
        AugmentData,
        AugmentData.schema.parse({
          name: 'Plating Mod',
          trigger: { type: 'ON_ACTIVATION' },
          payloads: [{ type: 'SHIELD', magnitude: 2 }],
        }),
      );
      world.patchComponent(playerId, RunInventory, {
        equipment: [
          {
            entityId: agItem,
            templateId: 'augment-plating',
            rarityTier: 'uncommon',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: Date.now(),
            quantity: 1,
          },
        ],
      });

      const result = processAction(world, grid, eventBus, playerId, {
        type: 'BURN_AUGMENT',
        augmentEntityId: agItem,
        slotIndex: 2, // Exceeds maxAugment (2, 0-indexed: 0, 1)
      });

      expect(result).toBeNull();

      // Inventory preserved
      const inv = world.getComponent(playerId, RunInventory);
      expect(inv?.equipment.some((e) => e.entityId === agItem)).toBe(true);
    });

    it('rejects burning augment into chassis without slotIndex when all slots are full', () => {
      const ag1 = world.createEntity();
      const ag2 = world.createEntity();
      world.patchComponent(playerId, AugmentSlots, { equipped: [ag1, ag2] });

      const newAg = world.createEntity();
      world.addComponent(
        newAg,
        AugmentData,
        AugmentData.schema.parse({
          name: 'Overcharge Coil',
          trigger: { type: 'ON_ACTIVATION' },
          payloads: [{ type: 'HEAL', magnitude: 5 }],
        }),
      );
      world.patchComponent(playerId, RunInventory, {
        equipment: [
          {
            entityId: newAg,
            templateId: 'augment-coil',
            rarityTier: 'rare',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: Date.now(),
            quantity: 1,
          },
        ],
      });

      // No slotIndex provided -> attempts to append, but slots are full (2/2)
      const result = processAction(world, grid, eventBus, playerId, {
        type: 'BURN_AUGMENT',
        augmentEntityId: newAg,
      });

      expect(result).toBeNull();

      // Inventory preserved
      const inv = world.getComponent(playerId, RunInventory);
      expect(inv?.equipment.some((e) => e.entityId === newAg)).toBe(true);

      // Slots unchanged
      const agSlots = world.getComponent(playerId, AugmentSlots);
      expect(agSlots?.equipped).toEqual([ag1, ag2]);
    });

    it('allows explicit overwrite of augment slot when all slots are full and condemns overwritten entity', () => {
      const ag1 = world.createEntity();
      const ag2 = world.createEntity();
      world.patchComponent(playerId, AugmentSlots, { equipped: [ag1, ag2] });

      const newAg = world.createEntity();
      world.addComponent(
        newAg,
        AugmentData,
        AugmentData.schema.parse({
          name: 'Overcharge Coil',
          trigger: { type: 'ON_ACTIVATION' },
          payloads: [{ type: 'HEAL', magnitude: 5 }],
        }),
      );
      world.patchComponent(playerId, RunInventory, {
        equipment: [
          {
            entityId: newAg,
            templateId: 'augment-coil',
            rarityTier: 'rare',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: Date.now(),
            quantity: 1,
          },
        ],
      });

      // Explicitly overwrite slot 1
      const result = processAction(world, grid, eventBus, playerId, {
        type: 'BURN_AUGMENT',
        augmentEntityId: newAg,
        slotIndex: 1,
      });

      expect(result).toBe('BURN_AUGMENT');

      const agSlots = world.getComponent(playerId, AugmentSlots);
      expect(agSlots?.equipped).toEqual([ag1, newAg]);

      // ag2 was overwritten
      const dying = world.getComponent(ag2, Dying);
      expect(dying).toBeDefined();
      expect(dying?.reason).toBe('overwritten');
      expect(dying?.killerId).toBe(playerId);
    });

    it('honors upgraded shell port capacities dynamically', () => {
      // Shell has been upgraded: maxAugment = 4
      world.patchComponent(playerId, PortConfig, { maxAugment: 4 });

      const ag1 = world.createEntity();
      const ag2 = world.createEntity();
      world.patchComponent(playerId, AugmentSlots, { equipped: [ag1, ag2] });

      const newAg = world.createEntity();
      world.addComponent(
        newAg,
        AugmentData,
        AugmentData.schema.parse({
          name: 'Overcharge Coil',
          trigger: { type: 'ON_ACTIVATION' },
          payloads: [{ type: 'HEAL', magnitude: 5 }],
        }),
      );
      world.patchComponent(playerId, RunInventory, {
        equipment: [
          {
            entityId: newAg,
            templateId: 'augment-coil',
            rarityTier: 'rare',
            pickedUpAtFloor: 1,
            pickedUpAtTimestamp: Date.now(),
            quantity: 1,
          },
        ],
      });

      // Append into 3rd slot (index 2)
      const result = processAction(world, grid, eventBus, playerId, {
        type: 'BURN_AUGMENT',
        augmentEntityId: newAg,
      });

      expect(result).toBe('BURN_AUGMENT');
      const agSlots = world.getComponent(playerId, AugmentSlots);
      expect(agSlots?.equipped).toEqual([ag1, ag2, newAg]);
    });
  });
});
