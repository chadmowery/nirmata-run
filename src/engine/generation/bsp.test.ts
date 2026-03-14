import { describe, it, expect } from 'vitest';
import { generateBSP } from './bsp';
import { GeneratorConfig } from './types';

function makeConfig(overrides?: Partial<GeneratorConfig>): GeneratorConfig {
  return {
    width: 50,
    height: 50,
    seed: 'test-seed',
    ...overrides,
  };
}

describe('generateBSP', () => {
  describe('seed reproducibility', () => {
    it('should produce identical rooms with the same seed', () => {
      const config = makeConfig();
      const result1 = generateBSP(config);
      const result2 = generateBSP(config);

      expect(result1.rooms.length).toBe(result2.rooms.length);
      for (let i = 0; i < result1.rooms.length; i++) {
        expect(result1.rooms[i]).toEqual(result2.rooms[i]);
      }
    });

    it('should produce different rooms with different seeds', () => {
      const result1 = generateBSP(makeConfig({ seed: 'seed-a' }));
      const result2 = generateBSP(makeConfig({ seed: 'seed-b' }));

      // With different seeds, at minimum positions should differ
      const rooms1Str = JSON.stringify(result1.rooms);
      const rooms2Str = JSON.stringify(result2.rooms);
      expect(rooms1Str).not.toBe(rooms2Str);
    });
  });

  describe('room constraints', () => {
    it('should generate rooms with interior >= 3x3', () => {
      const result = generateBSP(makeConfig());

      for (const room of result.rooms) {
        expect(room.width).toBeGreaterThanOrEqual(3);
        expect(room.height).toBeGreaterThanOrEqual(3);
      }
    });

    it('should keep all rooms within grid bounds', () => {
      const config = makeConfig();
      const result = generateBSP(config);

      for (const room of result.rooms) {
        expect(room.x).toBeGreaterThanOrEqual(1);
        expect(room.y).toBeGreaterThanOrEqual(1);
        expect(room.x + room.width).toBeLessThanOrEqual(config.width - 1);
        expect(room.y + room.height).toBeLessThanOrEqual(config.height - 1);
      }
    });

    it('should generate at least minRooms rooms', () => {
      const result = generateBSP(makeConfig({ minRooms: 5 }));
      expect(result.rooms.length).toBeGreaterThanOrEqual(5);
    });

    it('should not generate overlapping rooms', () => {
      const result = generateBSP(makeConfig());

      for (let i = 0; i < result.rooms.length; i++) {
        for (let j = i + 1; j < result.rooms.length; j++) {
          const a = result.rooms[i];
          const b = result.rooms[j];
          // Check no overlap (rooms are interior coordinates)
          const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
          const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
          expect(overlapX && overlapY).toBe(false);
        }
      }
    });

    it('should compute correct center coordinates', () => {
      const result = generateBSP(makeConfig());

      for (const room of result.rooms) {
        expect(room.centerX).toBe(Math.floor(room.x + room.width / 2));
        expect(room.centerY).toBe(Math.floor(room.y + room.height / 2));
      }
    });
  });

  describe('corridor tests', () => {
    it('should generate corridors connecting rooms', () => {
      const result = generateBSP(makeConfig());
      expect(result.corridors.length).toBeGreaterThan(0);
    });

    it('should keep corridors within grid bounds', () => {
      const config = makeConfig();
      const result = generateBSP(config);

      for (const corridor of result.corridors) {
        for (const pt of corridor.points) {
          expect(pt.x).toBeGreaterThanOrEqual(0);
          expect(pt.y).toBeGreaterThanOrEqual(0);
          expect(pt.x).toBeLessThan(config.width);
          expect(pt.y).toBeLessThan(config.height);
        }
      }
    });
  });

  describe('door tests', () => {
    it('should generate door positions', () => {
      const result = generateBSP(makeConfig());
      expect(result.doors.length).toBeGreaterThan(0);
    });
  });

  describe('configuration tests', () => {
    it('should respect custom minRoomSize', () => {
      const result = generateBSP(makeConfig({ minRoomSize: 7 }));
      // Interior min = 7 - 2 = 5
      for (const room of result.rooms) {
        expect(room.width).toBeGreaterThanOrEqual(5);
        expect(room.height).toBeGreaterThanOrEqual(5);
      }
    });

    it('should respect custom maxRoomSize', () => {
      const result = generateBSP(makeConfig({ maxRoomSize: 8 }));
      // Interior max = 8 - 2 = 6
      for (const room of result.rooms) {
        expect(room.width).toBeLessThanOrEqual(6);
        expect(room.height).toBeLessThanOrEqual(6);
      }
    });

    it('should handle different grid sizes', () => {
      const small = generateBSP(makeConfig({ width: 30, height: 30 }));
      const large = generateBSP(makeConfig({ width: 80, height: 80 }));

      expect(small.rooms.length).toBeGreaterThan(0);
      expect(large.rooms.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should generate at least one room on a 20x20 grid', () => {
      const result = generateBSP(makeConfig({ width: 20, height: 20, minRooms: 1 }));
      expect(result.rooms.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate multiple rooms on a 100x100 grid', () => {
      const result = generateBSP(makeConfig({ width: 100, height: 100 }));
      expect(result.rooms.length).toBeGreaterThan(1);
    });
  });
});
