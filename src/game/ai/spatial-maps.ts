/**
 * Authoritative AI Spatial System
 * Precomputes and caches shared 80x45 Float32Array Dijkstra distance and influence grids.
 */

import { World } from '@engine/ecs/world';
import type { EngineEvents } from '@engine/events/types';
import { Grid } from '@engine/grid/grid';
import { DijkstraMap, DijkstraSeed, DIJKSTRA_IMPASSABLE } from '@engine/ai/dijkstra-map';
import { Position } from '@shared/components/position';
import { DeadZone } from '@shared/components/dead-zone';
import { CorruptedNode, InteractiveSurface } from '@shared/components/environment';

export interface SpatialMapOptions {
  avoidHazards?: boolean;
}

export function hasLineOfSight(x1: number, y1: number, x2: number, y2: number, grid: Grid): boolean {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;

  let currX = x1;
  let currY = y1;

  while (currX !== x2 || currY !== y2) {
    if (currX !== x1 || currY !== y1) {
      if (!grid.isTransparent(currX, currY)) {
        return false;
      }
    }
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      currX += sx;
    }
    if (e2 < dx) {
      err += dx;
      currY += sy;
    }
  }
  return true;
}

export class AISpatialSystem<T extends EngineEvents = EngineEvents> {
  private world: World<T>;
  private grid: Grid;

  // Cached base maps
  private approachMapAvoidHazards: DijkstraMap | null = null;
  private approachMapIgnoreHazards: DijkstraMap | null = null;
  private fleeMapAvoidHazards: DijkstraMap | null = null;
  private fleeMapIgnoreHazards: DijkstraMap | null = null;
  private kiteCoverMap: DijkstraMap | null = null;
  private packSurroundMap: DijkstraMap | null = null;

  // Cache invalidation state
  private lastTurnNumber = -1;
  private lastPlayerX = -1;
  private lastPlayerY = -1;

  // Reserved cardinal tiles for pack coordination in current turn
  private reservedPackTiles = new Set<string>();

  constructor(world: World<T>, grid: Grid) {
    this.world = world;
    this.grid = grid;
  }

  public resetTurnCache(turnNumber: number, playerX: number, playerY: number): void {
    if (
      this.lastTurnNumber !== turnNumber ||
      this.lastPlayerX !== playerX ||
      this.lastPlayerY !== playerY
    ) {
      this.clearCache();
      this.lastTurnNumber = turnNumber;
      this.lastPlayerX = playerX;
      this.lastPlayerY = playerY;
    }
  }

  public clearCache(): void {
    this.approachMapAvoidHazards = null;
    this.approachMapIgnoreHazards = null;
    this.fleeMapAvoidHazards = null;
    this.fleeMapIgnoreHazards = null;
    this.kiteCoverMap = null;
    this.packSurroundMap = null;
    this.reservedPackTiles.clear();
  }

  public reservePackTile(x: number, y: number): void {
    this.reservedPackTiles.add(`${x},${y}`);
    // Invalidate pack surround map so next pack member sees remaining cardinal spots
    this.packSurroundMap = null;
  }

  /**
   * Returns traversal cost function accounting for static walkability, DeadZones, and traps.
   */
  public getStepCostFn(
    avoidHazards: boolean,
    targetX?: number,
    targetY?: number,
    isFleeing: boolean = false,
  ): (x: number, y: number) => number {
    const deadZoneTiles = new Set<string>();
    const corruptedTiles = new Set<string>();

    if (avoidHazards) {
      const dzEntities = this.world.query(DeadZone, Position);
      for (const id of dzEntities) {
        const pos = this.world.getComponent(id, Position);
        if (pos) deadZoneTiles.add(`${pos.x},${pos.y}`);
      }

      const cnEntities = this.world.query(CorruptedNode, Position);
      for (const id of cnEntities) {
        const node = this.world.getComponent(id, CorruptedNode);
        const pos = this.world.getComponent(id, Position);
        if (node && pos && node.revealed && !node.isDisarmed && !node.triggered) {
          corruptedTiles.add(`${pos.x},${pos.y}`);
        }
      }
    }

    return (x: number, y: number): number => {
      if (!this.grid.inBounds(x, y)) return DIJKSTRA_IMPASSABLE;

      if (isFleeing && targetX !== undefined && targetY !== undefined && x === targetX && y === targetY) {
        return DIJKSTRA_IMPASSABLE; // Cannot flee into the threat tile!
      }

      const isTarget = targetX !== undefined && targetY !== undefined && x === targetX && y === targetY;
      if (!isTarget && !this.grid.isWalkable(x, y)) {
        return DIJKSTRA_IMPASSABLE;
      }

      const key = `${x},${y}`;
      if (deadZoneTiles.has(key)) {
        return 6.0;
      }
      if (corruptedTiles.has(key)) {
        return 4.0;
      }

      return 1.0;
    };
  }

  /**
   * 1. Approach Target Map: rolling downhill leads to target.
   */
  public getApproachTargetMap(
    targetX: number,
    targetY: number,
    avoidHazards: boolean = true,
  ): DijkstraMap {
    if (avoidHazards && this.approachMapAvoidHazards) {
      return this.approachMapAvoidHazards;
    }
    if (!avoidHazards && this.approachMapIgnoreHazards) {
      return this.approachMapIgnoreHazards;
    }

    const map = new DijkstraMap(this.grid.width, this.grid.height);
    const stepCost = this.getStepCostFn(avoidHazards, targetX, targetY, false);
    map.compute([{ x: targetX, y: targetY, value: 0 }], stepCost);

    if (avoidHazards) {
      this.approachMapAvoidHazards = map;
    } else {
      this.approachMapIgnoreHazards = map;
    }
    return map;
  }

  /**
   * 2. Flee From Target Map: rolling downhill leads away from target smoothly around corners.
   */
  public getFleeFromTargetMap(
    targetX: number,
    targetY: number,
    avoidHazards: boolean = true,
  ): DijkstraMap {
    if (avoidHazards && this.fleeMapAvoidHazards) {
      return this.fleeMapAvoidHazards;
    }
    if (!avoidHazards && this.fleeMapIgnoreHazards) {
      return this.fleeMapIgnoreHazards;
    }

    const approachMap = this.getApproachTargetMap(targetX, targetY, avoidHazards);
    const stepCost = this.getStepCostFn(avoidHazards, targetX, targetY, true);
    const fleeMap = approachMap.createFleeMap(stepCost, -1.2);

    if (avoidHazards) {
      this.fleeMapAvoidHazards = fleeMap;
    } else {
      this.fleeMapIgnoreHazards = fleeMap;
    }
    return fleeMap;
  }

  /**
   * 3. Kite To Cover Map: walkable tiles at range 3..5 with LOS to player.
   * Tiles with adjacent InteractiveSurface between tile and player get -3.0 value.
   */
  public getKiteToCoverMap(
    playerX: number,
    playerY: number,
    avoidHazards: boolean = true,
  ): DijkstraMap {
    if (this.kiteCoverMap) {
      return this.kiteCoverMap;
    }

    const map = new DijkstraMap(this.grid.width, this.grid.height);
    const stepCost = this.getStepCostFn(avoidHazards);
    const seeds: DijkstraSeed[] = [];

    // Query all InteractiveSurface props providing cover
    const coverTiles = new Set<string>();
    const surfaces = this.world.query(InteractiveSurface, Position);
    for (const id of surfaces) {
      const surface = this.world.getComponent(id, InteractiveSurface);
      const pos = this.world.getComponent(id, Position);
      if (surface && pos && surface.providesCover !== false) {
        coverTiles.add(`${pos.x},${pos.y}`);
      }
    }

    // Inspect bounding box around player range 3..5
    for (let dx = -5; dx <= 5; dx++) {
      for (let dy = -5; dy <= 5; dy++) {
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < 3 || dist > 5) continue;

        const tx = playerX + dx;
        const ty = playerY + dy;
        if (!this.grid.inBounds(tx, ty) || !this.grid.isWalkable(tx, ty)) continue;

        if (!hasLineOfSight(tx, ty, playerX, playerY, this.grid)) continue;

        // Check if any orthogonal neighbor of (tx, ty) has cover and is closer to player
        let hasAdjacentCover = false;
        const cardinalDirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];

        for (const [cdx, cdy] of cardinalDirs) {
          const nx = tx + cdx;
          const ny = ty + cdy;
          const nDist = Math.abs(nx - playerX) + Math.abs(ny - playerY);
          if (nDist < dist && coverTiles.has(`${nx},${ny}`)) {
            hasAdjacentCover = true;
            break;
          }
        }

        seeds.push({
          x: tx,
          y: ty,
          value: hasAdjacentCover ? -3.0 : 0.0,
        });
      }
    }

    map.compute(seeds, stepCost);
    this.kiteCoverMap = map;
    return map;
  }

  /**
   * 4. Pack Surround Cardinal Map: surrounds player on 4 cardinal sides.
   */
  public getPackSurroundCardinalMap(
    playerX: number,
    playerY: number,
    avoidHazards: boolean = false,
  ): DijkstraMap {
    if (this.packSurroundMap) {
      return this.packSurroundMap;
    }

    const map = new DijkstraMap(this.grid.width, this.grid.height);
    const stepCost = this.getStepCostFn(avoidHazards);
    const seeds: DijkstraSeed[] = [];

    const cardinalOffsets = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (const [dx, dy] of cardinalOffsets) {
      const sx = playerX + dx;
      const sy = playerY + dy;
      const key = `${sx},${sy}`;

      if (
        this.grid.inBounds(sx, sy) &&
        this.grid.isWalkable(sx, sy) &&
        !this.reservedPackTiles.has(key)
      ) {
        seeds.push({ x: sx, y: sy, value: 0 });
      }
    }

    // If all cardinal seeds are reserved or blocked, fall back to all cardinal walkable tiles
    if (seeds.length === 0) {
      for (const [dx, dy] of cardinalOffsets) {
        const sx = playerX + dx;
        const sy = playerY + dy;
        if (this.grid.inBounds(sx, sy) && this.grid.isWalkable(sx, sy)) {
          seeds.push({ x: sx, y: sy, value: 0 });
        }
      }
    }

    map.compute(seeds, stepCost);
    this.packSurroundMap = map;
    return map;
  }

  /**
   * 5. Investigate Last Known Position Map: computed on demand for memory chase.
   */
  public getInvestigateLastKnownMap(
    lastX: number,
    lastY: number,
    avoidHazards: boolean = true,
  ): DijkstraMap {
    const map = new DijkstraMap(this.grid.width, this.grid.height);
    const stepCost = this.getStepCostFn(avoidHazards, lastX, lastY);
    map.compute([{ x: lastX, y: lastY, value: 0 }], stepCost);
    return map;
  }
}
