import { describe, it, expect } from 'vitest';
import { isEntityVisible } from '../../src/rendering/fov';

describe('Entity Visibility Gating Rules', () => {
  const fovSet = new Set(['3,3', '4,4']);
  const exploredSet = new Set(['3,3', '4,4', '5,5', '6,6']);

  describe('Player Visibility', () => {
    it('should always be visible at full brightness', () => {
      // Player in FOV
      expect(isEntityVisible({ x: 3, y: 3 }, 'player', fovSet, exploredSet))
        .toEqual({ visible: true, alpha: 1.0 });
      
      // Player not in FOV but explored
      expect(isEntityVisible({ x: 5, y: 5 }, 'player', fovSet, exploredSet))
        .toEqual({ visible: true, alpha: 1.0 });
      
      // Player in neither
      expect(isEntityVisible({ x: 10, y: 10 }, 'player', fovSet, exploredSet))
        .toEqual({ visible: true, alpha: 1.0 });
    });
  });

  describe('Enemy Visibility', () => {
    it('should be visible only in current FOV', () => {
      // Enemy in FOV
      expect(isEntityVisible({ x: 3, y: 3 }, 'enemy', fovSet, exploredSet))
        .toEqual({ visible: true, alpha: 1.0 });

      // Enemy in explored but NOT FOV
      expect(isEntityVisible({ x: 5, y: 5 }, 'enemy', fovSet, exploredSet))
        .toEqual({ visible: false, alpha: 0 });

      // Enemy in neither
      expect(isEntityVisible({ x: 10, y: 10 }, 'enemy', fovSet, exploredSet))
        .toEqual({ visible: false, alpha: 0 });
    });
  });

  describe('Item Visibility', () => {
    it('should be visible in FOV at full brightness', () => {
      expect(isEntityVisible({ x: 3, y: 3 }, 'item', fovSet, exploredSet))
        .toEqual({ visible: true, alpha: 1.0 });
    });

    it('should be visible on explored tiles dimmed (0.3)', () => {
      expect(isEntityVisible({ x: 5, y: 5 }, 'item', fovSet, exploredSet))
        .toEqual({ visible: true, alpha: 0.3 });
    });

    it('should be hidden if neither in FOV nor explored', () => {
      expect(isEntityVisible({ x: 10, y: 10 }, 'item', fovSet, exploredSet))
        .toEqual({ visible: false, alpha: 0 });
    });
  });
});
