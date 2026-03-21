import { Container, Sprite, Texture } from 'pixi.js';
import { Grid } from '../engine/grid/grid';
import { TILE_SIZE } from './constants';

export interface BuildTilemapOptions {
  visibleRange?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
  fovSet?: Set<string>;
  exploredSet?: Set<string>;
  playerPos?: { x: number; y: number };
}

function tileTerrainToFrame(terrain: string): string {
  switch (terrain) {
    case 'wall': return 'wall';
    case 'floor': return 'floor';
    case 'door': return 'door';
    default: return 'floor';
  }
}

function computeAlpha(
  x: number,
  y: number,
  options?: BuildTilemapOptions
): number {
  if (!options || (!options.fovSet && !options.exploredSet)) {
    return 1.0;
  }

  const key = `${x},${y}`;

  if (options.fovSet?.has(key)) {
    return 1.0;
  }

  if (options.exploredSet?.has(key)) {
    return 0.3;
  }

  return 0.0;
}

const spritePool: Map<string, Sprite> = new Map();

/**
 * Syncs the terrain layer using a pool of sprites.
 */
export function buildTilemap(
  grid: Grid,
  container: Container,
  options?: BuildTilemapOptions
): void {
  const startX = Math.max(0, options?.visibleRange?.startX ?? 0);
  const startY = Math.max(0, options?.visibleRange?.startY ?? 0);
  const endX = Math.min(grid.width - 1, options?.visibleRange?.endX ?? grid.width - 1);
  const endY = Math.min(grid.height - 1, options?.visibleRange?.endY ?? grid.height - 1);

  // Mark all current sprites as inactive
  for (const sprite of spritePool.values()) {
    sprite.visible = false;
  }

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const tile = grid.getTile(x, y);
      if (!tile) continue;

      const alpha = computeAlpha(x, y, options);
      if (alpha <= 0) continue;

      const key = `${x},${y}`;
      let sprite = spritePool.get(key);

      if (!sprite) {
        sprite = new Sprite();
        sprite.x = x * TILE_SIZE;
        sprite.y = y * TILE_SIZE;
        container.addChild(sprite);
        spritePool.set(key, sprite);
      }

      const frame = tileTerrainToFrame(tile.terrain);
      sprite.texture = Texture.from(frame);
      sprite.alpha = alpha;
      sprite.visible = true;
    }
  }
}

/**
 * Clears the sprite pool (call on dungeon change).
 */
export function clearTilemap(container: Container) {
  for (const sprite of spritePool.values()) {
    container.removeChild(sprite);
    sprite.destroy();
  }
  spritePool.clear();
}
