import { describe, it, expect, beforeEach } from 'vitest';
import { gameStore } from './store';

describe('gameStore', () => {
  beforeEach(() => {
    gameStore.setState({
      inventoryVisible: false,
      inventoryRevision: 0,
    });
  });

  it('should start with inventoryVisible false', () => {
    expect(gameStore.getState().inventoryVisible).toBe(false);
  });

  it('should toggle inventoryVisible', () => {
    gameStore.getState().toggleInventory();
    expect(gameStore.getState().inventoryVisible).toBe(true);
    gameStore.getState().toggleInventory();
    expect(gameStore.getState().inventoryVisible).toBe(false);
  });
});
