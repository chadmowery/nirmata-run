import { describe, it, expect } from 'vitest';
import { generateDungeon } from './dungeon-generator';
import { DungeonConfig } from './dungeon-generator';
import { validateConnectivity } from '../../engine/generation/flood-fill';

function makeConfig(overrides?: Partial<DungeonConfig>): DungeonConfig {
  return {
    width: 50,
    height: 50,
    seed: 'test-dungeon-seed',
    ...overrides,
  };
}

describe('generateDungeon', () => {
  describe('grid output', () => {
    it('should create a grid with correct dimensions', () => {
      const config = makeConfig();
      const result = generateDungeon(config);

      expect(result.grid.width).toBe(config.width);
      expect(result.grid.height).toBe(config.height);
    });

    it('should have walkable room interiors', () => {
      const result = generateDungeon(makeConfig());

      for (const room of result.rooms) {
        for (let y = room.y; y < room.y + room.height; y++) {
          for (let x = room.x; x < room.x + room.width; x++) {
            expect(result.grid.isWalkable(x, y)).toBe(true);
          }
        }
      }
    });

    it('should have non-walkable walls (grid border)', () => {
      const config = makeConfig();
      const result = generateDungeon(config);

      // Top and bottom borders should be walls
      for (let x = 0; x < config.width; x++) {
        expect(result.grid.isWalkable(x, 0)).toBe(false);
        expect(result.grid.isWalkable(x, config.height - 1)).toBe(false);
      }

      // Left and right borders should be walls
      for (let y = 0; y < config.height; y++) {
        expect(result.grid.isWalkable(0, y)).toBe(false);
        expect(result.grid.isWalkable(config.width - 1, y)).toBe(false);
      }
    });

    it('should have doors with terrain "door" and walkable', () => {
      const result = generateDungeon(makeConfig());

      for (const door of result.doors) {
        const tile = result.grid.getTile(door.x, door.y);
        expect(tile?.terrain).toBe('door');
        expect(tile?.walkable).toBe(true);
      }
    });
  });

  describe('connectivity', () => {
    it('should produce a fully connected dungeon', () => {
      const result = generateDungeon(makeConfig());

      const connectivity = validateConnectivity(
        result.grid.width,
        result.grid.height,
        (x, y) => result.grid.isWalkable(x, y),
        result.playerSpawnRoom.centerX,
        result.playerSpawnRoom.centerY
      );

      expect(connectivity.connected).toBe(true);
    });
  });

  describe('reproducibility', () => {
    it('should produce identical grid with same seed', () => {
      const config = makeConfig();
      const result1 = generateDungeon(config);
      const result2 = generateDungeon(config);

      expect(result1.rooms.length).toBe(result2.rooms.length);
      for (let i = 0; i < result1.rooms.length; i++) {
        expect(result1.rooms[i]).toEqual(result2.rooms[i]);
      }

      // Verify identical tile terrain at sample positions
      for (const room of result1.rooms) {
        const tile1 = result1.grid.getTile(room.centerX, room.centerY);
        const tile2 = result2.grid.getTile(room.centerX, room.centerY);
        expect(tile1?.terrain).toBe(tile2?.terrain);
      }
    });

    it('should produce different layout with different seed', () => {
      const result1 = generateDungeon(makeConfig({ seed: 'alpha' }));
      const result2 = generateDungeon(makeConfig({ seed: 'beta' }));

      const rooms1 = JSON.stringify(result1.rooms);
      const rooms2 = JSON.stringify(result2.rooms);
      expect(rooms1).not.toBe(rooms2);
    });
  });

  describe('configuration', () => {
    it('should work with small grid size (30x30)', () => {
      const result = generateDungeon(makeConfig({ width: 30, height: 30, minRooms: 2 }));
      expect(result.rooms.length).toBeGreaterThanOrEqual(2);
    });

    it('should work with large grid size (80x80)', () => {
      const result = generateDungeon(makeConfig({ width: 80, height: 80 }));
      expect(result.rooms.length).toBeGreaterThanOrEqual(5);
    });

    it('should have a player spawn room', () => {
      const result = generateDungeon(makeConfig());
      expect(result.playerSpawnRoom).toBeDefined();
      expect(result.rooms).toContain(result.playerSpawnRoom);
    });
  });
});
