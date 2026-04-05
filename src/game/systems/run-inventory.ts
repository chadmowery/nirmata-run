import { RunInventory, RunInventoryItem, CurrencyStack } from '@shared/types';

/**
 * Registry for run-scoped software items.
 * Per D-05, max inventory size is 5 items.
 */
export class RunInventoryRegistry {
  private inventories: Map<string, RunInventory> = new Map();
  private stashes: Map<string, RunInventoryItem[]> = new Map();
  private readonly MAX_SLOTS = 5;

  /**
   * Gets or creates a run inventory for the given session.
   */
  getOrCreate(sessionId: string): RunInventory {
    let inventory = this.inventories.get(sessionId);
    if (!inventory) {
      inventory = {
        sessionId,
        maxSlots: this.MAX_SLOTS,
        software: [],
        currency: [],
      };
      this.inventories.set(sessionId, inventory);
    }
    return inventory;
  }

  /**
   * Gets the stash for the given session.
   */
  getStash(sessionId: string): RunInventoryItem[] {
    let stash = this.stashes.get(sessionId);
    if (!stash) {
      stash = [];
      this.stashes.set(sessionId, stash);
    }
    return stash;
  }

  /**
   * Transfers all items from RunInventory to Stash and clears RunInventory.
   */
  transferToStash(sessionId: string): void {
    const inventory = this.getOrCreate(sessionId);
    const stash = this.getStash(sessionId);
    
    stash.push(...inventory.software);
    inventory.software = [];
    inventory.currency = [];
  }

  /**
   * Returns total slots used by both software and currency stacks.
   */
  getTotalSlots(sessionId: string): number {
    const inventory = this.getOrCreate(sessionId);
    return inventory.software.length + inventory.currency.length;
  }

  /**
   * Adds a software item to the session's inventory.
   * Returns false if the inventory is full.
   */
  addSoftware(sessionId: string, item: RunInventoryItem): boolean {
    const inventory = this.getOrCreate(sessionId);
    if (this.getTotalSlots(sessionId) >= inventory.maxSlots) {
      return false;
    }
    inventory.software.push(item);
    return true;
  }

  /**
   * Adds currency to the session's inventory.
   * Stacks if matching currency type exists (or matching blueprintId).
   * Returns false if inventory is full and no matching stack exists.
   */
  addCurrency(
    sessionId: string, 
    currencyType: 'scrap' | 'blueprint' | 'flux', 
    amount: number,
    meta?: { blueprintId?: string, blueprintType?: 'firmware' | 'augment' }
  ): boolean {
    const inventory = this.getOrCreate(sessionId);
    
    // Find existing stack
    const existingStack = inventory.currency.find(s => {
      if (s.currencyType !== currencyType) return false;
      if (currencyType === 'blueprint') {
        return s.blueprintId === meta?.blueprintId;
      }
      return true;
    });

    if (existingStack) {
      existingStack.amount += amount;
      return true;
    }

    // No stack found, check for room
    if (this.getTotalSlots(sessionId) >= inventory.maxSlots) {
      return false;
    }

    inventory.currency.push({
      currencyType,
      amount,
      blueprintId: meta?.blueprintId,
      blueprintType: meta?.blueprintType
    });
    return true;
  }

  /**
   * Returns total amount of a specific currency type.
   */
  getCurrencyAmount(sessionId: string, currencyType: 'scrap' | 'blueprint' | 'flux'): number {
    const inventory = this.getOrCreate(sessionId);
    return inventory.currency
      .filter(s => s.currencyType === currencyType)
      .reduce((sum, s) => sum + s.amount, 0);
  }

  /**
   * Returns all currency stacks in the inventory.
   */
  getCurrencyStacks(sessionId: string): CurrencyStack[] {
    const inventory = this.getOrCreate(sessionId);
    return [...inventory.currency];
  }

  /**
   * Removes currency from the session's inventory.
   * Returns false if not enough currency exists.
   */
  removeCurrency(sessionId: string, currencyType: 'scrap' | 'blueprint' | 'flux', amount: number): boolean {
    const inventory = this.getOrCreate(sessionId);
    const currentAmount = this.getCurrencyAmount(sessionId, currencyType);
    
    if (currentAmount < amount) {
      return false;
    }

    let remainingToRemove = amount;
    // Remove from stacks until exhausted
    for (let i = inventory.currency.length - 1; i >= 0; i--) {
      const stack = inventory.currency[i];
      if (stack.currencyType === currencyType) {
        const toTake = Math.min(stack.amount, remainingToRemove);
        stack.amount -= toTake;
        remainingToRemove -= toTake;
        
        if (stack.amount <= 0) {
          inventory.currency.splice(i, 1);
        }
      }
      if (remainingToRemove <= 0) break;
    }

    return true;
  }

  /**
   * Clears all currency stacks from the inventory.
   */
  clearCurrency(sessionId: string): void {
    const inventory = this.getOrCreate(sessionId);
    inventory.currency = [];
  }

  /**
   * Removes a software item by its index and returns it.
   * Shifts remaining items.
   */
  removeSoftware(sessionId: string, index: number): RunInventoryItem | null {
    const inventory = this.inventories.get(sessionId);
    if (!inventory || index < 0 || index >= inventory.software.length) {
      return null;
    }
    const removed = inventory.software.splice(index, 1);
    return removed[0] || null;
  }

  /**
   * Clears all software items from the inventory.
   */
  clearSoftware(sessionId: string): void {
    const inventory = this.getOrCreate(sessionId);
    inventory.software = [];
  }

  /**
   * Clears the entire inventory for a session.
   */
  clear(sessionId: string): void {
    const inventory = this.inventories.get(sessionId);
    if (inventory) {
      inventory.software = [];
      inventory.currency = [];
    }
  }

  /**
   * Loads a serialized inventory state for a session.
   * Used for client-server state synchronization.
   */
  load(sessionId: string, data: Partial<RunInventory>): void {
    const inventory = this.getOrCreate(sessionId);
    if (data.maxSlots !== undefined) inventory.maxSlots = data.maxSlots;
    if (data.software !== undefined) inventory.software = [...data.software];
    if (data.currency !== undefined) inventory.currency = [...data.currency];
  }
}

// Export a singleton instance for shared use
const globalForInventory = global as unknown as { runInventoryRegistry: RunInventoryRegistry };

export const runInventoryRegistry = globalForInventory.runInventoryRegistry || new RunInventoryRegistry();

if (process.env.NODE_ENV !== 'production') {
  globalForInventory.runInventoryRegistry = runInventoryRegistry;
}
