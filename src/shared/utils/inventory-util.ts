import { World } from '@engine/ecs/world';
import { EngineEvents } from '@engine/events/types';
import { RunInventory, RunCurrency, RunInventoryItem } from '../components/run-inventory';

/**
 * Pure utility functions for interacting with ECS-based Run Inventory components.
 */

export function getCurrencyAmount<T extends EngineEvents>(
  world: World<T>,
  playerId: number,
  currencyType: 'scrap' | 'blueprint' | 'flux' | 'nanites',
): number {
  const runCurrency = world.getComponent(playerId, RunCurrency);
  if (!runCurrency) return 0;
  return runCurrency.stacks
    .filter((s) => s.currencyType === currencyType)
    .reduce((sum, s) => sum + s.amount, 0);
}

export function addCurrency<T extends EngineEvents>(
  world: World<T>,
  playerId: number,
  currencyType: 'scrap' | 'blueprint' | 'flux' | 'nanites',
  amount: number,
  meta?: { blueprintId?: string; blueprintType?: 'firmware' | 'augment' },
): boolean {
  const runCurrency = world.getComponent(playerId, RunCurrency);
  const runInventory = world.getComponent(playerId, RunInventory);
  if (!runCurrency || !runInventory) return false;

  const stacks = [...runCurrency.stacks];

  // Find existing stack
  const existingIndex = stacks.findIndex((s) => {
    if (s.currencyType !== currencyType) return false;
    if (currencyType === 'blueprint') {
      return s.blueprintId === meta?.blueprintId;
    }
    return true;
  });

  if (existingIndex !== -1) {
    const updatedStacks = [...stacks];
    updatedStacks[existingIndex] = {
      ...updatedStacks[existingIndex],
      amount: updatedStacks[existingIndex].amount + amount,
    };
    world.patchComponent(playerId, RunCurrency, { stacks: updatedStacks });
    return true;
  }

  // No stack found, check for room (software items + currency stacks <= maxSlots)
  if (runInventory.software.length + stacks.length >= runInventory.maxSlots) {
    return false;
  }

  stacks.push({
    currencyType,
    amount,
    blueprintId: meta?.blueprintId,
    blueprintType: meta?.blueprintType,
  });
  world.patchComponent(playerId, RunCurrency, { stacks });
  return true;
}

export function removeCurrency<T extends EngineEvents>(
  world: World<T>,
  playerId: number,
  currencyType: 'scrap' | 'blueprint' | 'flux',
  amount: number,
): boolean {
  const runCurrency = world.getComponent(playerId, RunCurrency);
  if (!runCurrency) return false;

  const currentAmount = getCurrencyAmount(world, playerId, currencyType);
  if (currentAmount < amount) return false;

  let remainingToRemove = amount;
  const stacks = [...runCurrency.stacks];

  for (let i = stacks.length - 1; i >= 0; i--) {
    const stack = stacks[i];
    if (stack.currencyType === currencyType) {
      const toTake = Math.min(stack.amount, remainingToRemove);
      const newAmount = stack.amount - toTake;
      remainingToRemove -= toTake;

      if (newAmount <= 0) {
        stacks.splice(i, 1);
      } else {
        stacks[i] = { ...stack, amount: newAmount };
      }
    }
    if (remainingToRemove <= 0) break;
  }

  world.patchComponent(playerId, RunCurrency, { stacks });
  return true;
}

export function addSoftware<T extends EngineEvents>(
  world: World<T>,
  playerId: number,
  item: RunInventoryItem,
): boolean {
  const runInventory = world.getComponent(playerId, RunInventory);
  const runCurrency = world.getComponent(playerId, RunCurrency);
  if (!runInventory || !runCurrency) return false;

  if (
    runInventory.software.length + runInventory.equipment.length + runCurrency.stacks.length >=
    runInventory.maxSlots
  ) {
    return false;
  }

  // Find first empty gridIndex
  const usedIndices = new Set(
    runInventory.software.map((s) => s.gridIndex).filter((i) => i !== undefined),
  );
  let gridIndex = 0;
  while (usedIndices.has(gridIndex)) {
    gridIndex++;
  }

  world.patchComponent(playerId, RunInventory, {
    software: [...runInventory.software, { ...item, gridIndex }],
  });
  return true;
}

export function addEquipment<T extends EngineEvents>(
  world: World<T>,
  playerId: number,
  item: RunInventoryItem,
): boolean {
  const runInventory = world.getComponent(playerId, RunInventory);
  const runCurrency = world.getComponent(playerId, RunCurrency);
  if (!runInventory || !runCurrency) return false;

  if (
    runInventory.software.length + runInventory.equipment.length + runCurrency.stacks.length >=
    runInventory.maxSlots
  ) {
    return false;
  }

  // Find first empty gridIndex
  const usedIndices = new Set(
    runInventory.equipment.map((s) => s.gridIndex).filter((i) => i !== undefined),
  );
  let gridIndex = 0;
  while (usedIndices.has(gridIndex)) {
    gridIndex++;
  }

  world.patchComponent(playerId, RunInventory, {
    equipment: [...runInventory.equipment, { ...item, gridIndex }],
  });
  return true;
}

export function removeSoftware<T extends EngineEvents>(
  world: World<T>,
  playerId: number,
  index: number,
): RunInventoryItem | null {
  const runInventory = world.getComponent(playerId, RunInventory);
  if (!runInventory || index < 0 || index >= runInventory.software.length) {
    return null;
  }

  const software = [...runInventory.software];
  const [removed] = software.splice(index, 1);

  world.patchComponent(playerId, RunInventory, { software });
  return removed;
}

export function removeEquipment<T extends EngineEvents>(
  world: World<T>,
  playerId: number,
  index: number,
): RunInventoryItem | null {
  const runInventory = world.getComponent(playerId, RunInventory);
  if (!runInventory || index < 0 || index >= runInventory.equipment.length) {
    return null;
  }

  const equipment = [...runInventory.equipment];
  const [removed] = equipment.splice(index, 1);

  world.patchComponent(playerId, RunInventory, { equipment });
  return removed;
}

export function removeItemByEntityId<T extends EngineEvents>(
  world: World<T>,
  playerId: number,
  entityId: number,
): RunInventoryItem | null {
  const runInventory = world.getComponent(playerId, RunInventory);
  if (!runInventory) return null;

  const swIdx = runInventory.software.findIndex((s) => s.entityId === entityId);
  if (swIdx !== -1) {
    return removeSoftware(world, playerId, swIdx);
  }

  const eqIdx = runInventory.equipment.findIndex((e) => e.entityId === entityId);
  if (eqIdx !== -1) {
    return removeEquipment(world, playerId, eqIdx);
  }

  return null;
}

export function clearInventory<T extends EngineEvents>(world: World<T>, playerId: number): void {
  if (world.hasComponent(playerId, RunInventory)) {
    world.patchComponent(playerId, RunInventory, { software: [], equipment: [] });
  }
  if (world.hasComponent(playerId, RunCurrency)) {
    world.patchComponent(playerId, RunCurrency, { stacks: [] });
  }
}

export function addConsumable<T extends EngineEvents>(
  world: World<T>,
  playerId: number,
  item: {
    entityId: number;
    templateId: string;
    rarityTier: string;
    pickedUpAtFloor: number;
    pickedUpAtTimestamp: number;
  },
  maxStackSize: number = 10,
): boolean {
  const inv = world.getComponent(playerId, RunInventory);
  if (!inv) return false;

  const equipment = [...inv.equipment];
  // Look for existing consumable stack with the same templateId and room (< maxStackSize)
  const existingIdx = equipment.findIndex(
    (e) => e.templateId === item.templateId && e.isConsumable && (e.quantity ?? 1) < maxStackSize,
  );

  if (existingIdx !== -1) {
    const existing = equipment[existingIdx];
    equipment[existingIdx] = {
      ...existing,
      quantity: (existing.quantity ?? 1) + 1,
    };
    world.patchComponent(playerId, RunInventory, { equipment });
    return true;
  }

  // Check capacity against maxSlots
  const totalItems = inv.software.length + equipment.length;
  if (totalItems >= (inv.maxSlots ?? 30)) {
    return false;
  }

  equipment.push({
    ...item,
    quantity: 1,
    isConsumable: true,
  });
  world.patchComponent(playerId, RunInventory, { equipment });
  return true;
}

export function consumeConsumable<T extends EngineEvents>(
  world: World<T>,
  playerId: number,
  index: number,
): RunInventoryItem | null {
  const inv = world.getComponent(playerId, RunInventory);
  if (!inv || index < 0 || index >= inv.equipment.length) return null;

  const equipment = [...inv.equipment];
  const item = equipment[index];
  if (!item || !item.isConsumable) return null;

  const currentQty = item.quantity ?? 1;
  if (currentQty > 1) {
    equipment[index] = {
      ...item,
      quantity: currentQty - 1,
    };
    world.patchComponent(playerId, RunInventory, { equipment });
    return item;
  } else {
    const [removed] = equipment.splice(index, 1);
    world.patchComponent(playerId, RunInventory, { equipment });
    return removed;
  }
}
