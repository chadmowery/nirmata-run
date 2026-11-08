import { describe, it, expect } from 'vitest';
import {
  DijkstraMap,
  DIJKSTRA_IMPASSABLE,
  DIJKSTRA_UNSET,
} from '../dijkstra-map';

describe('DijkstraMap', () => {
  it('initializes grid with DIJKSTRA_UNSET', () => {
    const map = new DijkstraMap(5, 5);
    expect(map.width).toBe(5);
    expect(map.height).toBe(5);
    expect(map.get(0, 0)).toBe(DIJKSTRA_UNSET);
    expect(map.get(4, 4)).toBe(DIJKSTRA_UNSET);
    expect(map.get(-1, 0)).toBe(DIJKSTRA_IMPASSABLE);
    expect(map.get(5, 5)).toBe(DIJKSTRA_IMPASSABLE);
  });

  it('computes uniform Dijkstra distance field from single seed', () => {
    const map = new DijkstraMap(5, 5);
    // Seed at (2, 2) with value 0
    map.compute([{ x: 2, y: 2, value: 0 }], () => 1.0);

    expect(map.get(2, 2)).toBe(0);
    // Manhattan distance 1 neighbors
    expect(map.get(2, 1)).toBe(1);
    expect(map.get(2, 3)).toBe(1);
    expect(map.get(1, 2)).toBe(1);
    expect(map.get(3, 2)).toBe(1);
    // Manhattan distance 2
    expect(map.get(0, 2)).toBe(2);
    expect(map.get(2, 0)).toBe(2);
    expect(map.get(4, 2)).toBe(2);
    expect(map.get(2, 4)).toBe(2);
    expect(map.get(1, 1)).toBe(2);
  });

  it('respects impassable walls and routes around obstacles', () => {
    // 3x3 grid with wall at (1, 1) and (1, 0)
    // 0 . 2
    // # # 2
    // . . 1
    const map = new DijkstraMap(3, 3);
    const stepCost = (x: number, y: number) => {
      if ((x === 1 && y === 0) || (x === 1 && y === 1)) return DIJKSTRA_IMPASSABLE;
      return 1.0;
    };

    map.compute([{ x: 0, y: 0, value: 0 }], stepCost);

    expect(map.get(0, 0)).toBe(0);
    expect(map.get(1, 0)).toBe(DIJKSTRA_UNSET);
    expect(map.get(1, 1)).toBe(DIJKSTRA_UNSET);
    expect(map.get(0, 1)).toBe(1);
    expect(map.get(0, 2)).toBe(2);
    expect(map.get(1, 2)).toBe(3);
    expect(map.get(2, 2)).toBe(4);
    expect(map.get(2, 1)).toBe(5);
    expect(map.get(2, 0)).toBe(6);
  });

  it('routes around expensive hazard tiles when cheaper path exists', () => {
    // 3x3 grid:
    // (0,0) seed -> (2,0) destination
    // (1,0) is a hazard with stepCost = 10.0
    // (0,1), (1,1), (2,1) have stepCost = 1.0
    const map = new DijkstraMap(3, 3);
    const stepCost = (x: number, y: number) => {
      if (x === 1 && y === 0) return 10.0;
      return 1.0;
    };

    map.compute([{ x: 0, y: 0, value: 0 }], stepCost);

    // Going through hazard: 0 + 10 = 10
    // Going around via y=1: (0,0)->(0,1)[1]->(1,1)[2]->(2,1)[3]->(2,0)[4]
    expect(map.get(2, 0)).toBe(4);
  });

  it('computes multi-seed attraction map', () => {
    const map = new DijkstraMap(5, 1);
    // Two seeds at ends: (0, 0) and (4, 0)
    map.compute(
      [
        { x: 0, y: 0, value: 0 },
        { x: 4, y: 0, value: 0 },
      ],
      () => 1.0,
    );

    expect(map.get(0, 0)).toBe(0);
    expect(map.get(1, 0)).toBe(1);
    expect(map.get(2, 0)).toBe(2);
    expect(map.get(3, 0)).toBe(1);
    expect(map.get(4, 0)).toBe(0);
  });

  it('generates smooth flee maps that escape corners', () => {
    // 5x5 arena: player at (2, 2)
    const baseMap = new DijkstraMap(5, 5);
    baseMap.compute([{ x: 2, y: 2, value: 0 }], () => 1.0);

    const fleeMap = baseMap.createFleeMap(() => 1.0, -1.2);

    // Tiles further from player should have lower (more negative/attractive) scores
    const cornerScore = fleeMap.get(0, 0);
    const adjacentScore = fleeMap.get(2, 1);
    expect(cornerScore).toBeLessThan(adjacentScore);

    // Stepping downhill from adjacent tile (2, 1) should step away from (2, 2)
    const step = fleeMap.getBestStep(2, 1);
    expect(step).not.toBeNull();
    const nextX = 2 + step!.dx;
    const nextY = 1 + step!.dy;
    const prevDist = Math.abs(2 - 2) + Math.abs(1 - 2); // 1
    const nextDist = Math.abs(nextX - 2) + Math.abs(nextY - 2); // 2
    expect(nextDist).toBeGreaterThan(prevDist);
  });

  it('combines multiple Dijkstra layers with linear weights', () => {
    const mapA = new DijkstraMap(3, 1);
    mapA.set(0, 0, 2);
    mapA.set(1, 0, 4);
    mapA.set(2, 0, 6);

    const mapB = new DijkstraMap(3, 1);
    mapB.set(0, 0, 10);
    mapB.set(1, 0, 5);
    mapB.set(2, 0, 0);

    const combined = DijkstraMap.combine(3, 1, [
      { map: mapA, weight: 1.0 },
      { map: mapB, weight: 0.5 },
    ]);

    // (0,0): 2*1 + 10*0.5 = 7
    // (1,0): 4*1 + 5*0.5 = 6.5
    // (2,0): 6*1 + 0*0.5 = 6
    expect(combined.get(0, 0)).toBeCloseTo(7.0);
    expect(combined.get(1, 0)).toBeCloseTo(6.5);
    expect(combined.get(2, 0)).toBeCloseTo(6.0);
  });

  it('getBestStep selects lowest downhill orthogonal neighbor with dynamic penalty', () => {
    // 5x5 grid with goal at (2, 2)
    const map = new DijkstraMap(5, 5);
    map.compute([{ x: 2, y: 2, value: 0 }], () => 1.0);

    // From (0, 0), neighbors (1, 0) and (0, 1) both have score 3 (downhill from score 4)
    const stepNoPenalty = map.getBestStep(0, 0);
    expect(stepNoPenalty).not.toBeNull();
    expect(stepNoPenalty!.targetScore).toBe(3);

    // With dynamic penalty on (1, 0) of +5, should pick (0, 1)
    const stepWithPenalty = map.getBestStep(0, 0, (nx, ny) => {
      if (nx === 1 && ny === 0) return 5;
      return 0;
    });
    expect(stepWithPenalty).toEqual({ dx: 0, dy: 1, targetScore: 3 });
  });

  it('getBestStep breaks ties deterministically using provided random fn', () => {
    const map = new DijkstraMap(3, 3);
    // Symmetrical distance from (1, 1)
    map.compute([{ x: 1, y: 1, value: 5 }], () => 1.0);
    map.set(1, 0, 2);
    map.set(1, 2, 2);
    map.set(0, 1, 2);
    map.set(2, 1, 2);

    const pickFirst = map.getBestStep(1, 1, undefined, () => 0.0);
    const pickLast = map.getBestStep(1, 1, undefined, () => 0.99);

    expect(pickFirst).not.toBeNull();
    expect(pickLast).not.toBeNull();
    expect(pickFirst!.targetScore).toBe(2);
    expect(pickLast!.targetScore).toBe(2);
  });

  it('computes createFleeMap on cyclic multi-path grid without infinite relaxation or queue explosion', () => {
    // 10x10 open grid with many cycles
    const map = new DijkstraMap(10, 10);
    map.compute([{ x: 5, y: 5, value: 0 }], () => 1.0);

    const fleeMap = map.createFleeMap(() => 1.0, -1.2);
    expect(fleeMap).toBeDefined();

    // Player tile was at 5,5 (score 0), so flee map tile at (5,5) has 0 * -1.2 = 0
    // A tile far away like (0,0) had score 10 in map -> -12 in flee seed
    // Downhill rolling from (5,5) should move towards outer edges
    const step = fleeMap.getBestStep(5, 5);
    expect(step).not.toBeNull();
    expect(Math.abs(step!.dx) + Math.abs(step!.dy)).toBe(1);
    expect(step!.targetScore).toBeLessThan(fleeMap.get(5, 5));
  });
});
