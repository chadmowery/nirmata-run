export interface RunInventoryItem {
  entityId: number;
  templateId: string;
  rarityTier: string;
  pickedUpAtFloor: number;
  pickedUpAtTimestamp: number;
}

export interface RunInventory {
  sessionId: string;
  maxSlots: number;
  software: RunInventoryItem[];
}

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
  }

  /**
   * Adds a software item to the session's inventory.
   * Returns false if the inventory is full.
   */
  addSoftware(sessionId: string, item: RunInventoryItem): boolean {
    const inventory = this.getOrCreate(sessionId);
    if (inventory.software.length >= inventory.maxSlots) {
      return false;
    }
    inventory.software.push(item);
    return true;
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
   * Clears the entire inventory for a session.
   */
  clear(sessionId: string): void {
    const inventory = this.inventories.get(sessionId);
    if (inventory) {
      inventory.software = [];
    }
  }
}

// Export a singleton instance for shared use
export const runInventoryRegistry = new RunInventoryRegistry();
