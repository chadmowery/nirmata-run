import { describe, it, expect } from 'vitest';
import { generateDungeon } from '../../generation/dungeon-generator';
import { AISpatialSystem } from '../../ai/spatial-maps';
import { World } from '../../../engine/ecs/world';
import { EventBus } from '../../../engine/events/event-bus';
import { GameplayEvents } from '../../../shared/events/types';

describe('DijkstraMap Flee Map Stability & Bounds (Floor 5 Repro)', () => {
  it('computes flee maps on complex procedural Floor 5 dungeons without heap array length overflow', () => {
    // Test multiple procedural seeds on depth 5 (where complex bespoke rooms and cycles exist)
    const seeds = ['seed_1', 'seed_2', 'seed_3', 'floor5_alpha', 'floor5_beta'];

    for (const seed of seeds) {
      const dungeon = generateDungeon({
        width: 80,
        height: 45,
        seed,
        depth: 5,
      });

      const eventBus = new EventBus<GameplayEvents>();
      const world = new World<GameplayEvents>(eventBus);
      const spatial = new AISpatialSystem(world, dungeon.grid);

      const room = dungeon.rooms[0];
      const px = Math.floor(room.x + room.width / 2);
      const py = Math.floor(room.y + room.height / 2);

      const t0 = performance.now();
      const fleeMap = spatial.getFleeFromTargetMap(px, py, true);
      const duration = performance.now() - t0;

      expect(fleeMap).toBeDefined();
      // Must solve under 50ms without RangeError: Invalid array length
      expect(duration).toBeLessThan(50);

      // Verify that rolling downhill from a tile adjacent to the player moves away from the player
      const step = fleeMap.getBestStep(px + 1, py);
      if (step && dungeon.grid.isWalkable(px + 1 + step.dx, py + step.dy)) {
        const nextX = px + 1 + step.dx;
        const nextY = py + step.dy;
        const oldDist = Math.abs((px + 1) - px) + Math.abs(py - py); // 1
        const newDist = Math.abs(nextX - px) + Math.abs(nextY - py);
        expect(newDist).toBeGreaterThanOrEqual(oldDist);
      }
    }
  });
});
