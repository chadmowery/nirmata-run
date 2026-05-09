import { World } from '@engine/ecs/world';
import { RunInventory, RunCurrency, RunInventoryItem, CurrencyStack } from '../components/run-inventory';

/**
 * Pure utility functions for interacting with ECS-based Run Inventory components.
 */

export function getCurrencyAmount(world: World<any>, playerId: number, currencyType: 'scrap' | 'blueprint' | 'flux'): number {
  const runCurrency = world.getComponent(playerId, RunCurrency);
  if (!runCurrency) return 0;
  return runCurrency.stacks
    .filter(s => s.currencyType === currencyType)
    .reduce((sum, s) => sum + s.amount, 0);
}

export function addCurrency(
  world: World<any>,
  playerId: number,
  currencyType: 'scrap' | 'blueprint' | 'flux',
  amount: number,
  meta?: { blueprintId?: string, blueprintType?: 'firmware' | 'augment' }
): boolean {
  const runCurrency = world.getComponent(playerId, RunCurrency);
  const runInventory = world.getComponent(playerId, RunInventory);
  if (!runCurrency || !runInventory) return false;

  const stacks = [...runCurrency.stacks];
  
  // Find existing stack
  const existingIndex = stacks.findIndex(s => {
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
      amount: updatedStacks[existingIndex].amount + amount
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
    blueprintType: meta?.blueprintType
  });
  world.patchComponent(playerId, RunCurrency, { stacks });
  return true;
}

export function removeCurrency(
  world: World<any>,
  playerId: number,
  currencyType: 'scrap' | 'blueprint' | 'flux',
  amount: number
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

export function addSoftware(
  world: World<any>,
  playerId: number,
  item: RunInventoryItem
): boolean {
  const runInventory = world.getComponent(playerId, RunInventory);
  const runCurrency = world.getComponent(playerId, RunCurrency);
  if (!runInventory || !runCurrency) return false;

  if (runInventory.software.length + runCurrency.stacks.length >= runInventory.maxSlots) {
    return false;
  }

  world.patchComponent(playerId, RunInventory, {
    software: [...runInventory.software, item]
  });
  return true;
}

export function removeSoftware(
  world: World<any>,
  playerId: number,
  index: number
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

export function clearInventory(world: World<any>, playerId: number): void {
  if (world.hasComponent(playerId, RunInventory)) {
    world.patchComponent(playerId, RunInventory, { software: [] });
  }
  if (world.hasComponent(playerId, RunCurrency)) {
    world.patchComponent(playerId, RunCurrency, { stacks: [] });
  }
}
