import { TILE_SIZE, VIEWPORT_W, VIEWPORT_H } from './constants';

/**
 * Computes the worldContainer offset that centers the player in the viewport.
 * Formula: x = VIEWPORT_W / 2 - playerGridX * TILE_SIZE - TILE_SIZE / 2
 */
export function computeCameraTarget(
  playerGridX: number,
  playerGridY: number,
  zoom: number = 1.0,
): { x: number; y: number } {
  const x = VIEWPORT_W / 2 - (playerGridX * TILE_SIZE + TILE_SIZE / 2) * zoom;
  const y = VIEWPORT_H / 2 - (playerGridY * TILE_SIZE + TILE_SIZE / 2) * zoom;
  return { x, y };
}

/**
 * Smooth exponential lerp with ~50ms response.
 * Round to integer pixels to prevent sub-pixel jitter.
 */
export function lerpCamera(
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  deltaMs: number,
): { x: number; y: number } {
  if (deltaMs <= 0) {
    return { x: currentX, y: currentY };
  }

  // factor = 1 - Math.pow(0.001, deltaMs / 1000)
  // Reaches ~99.9% of target per second.
  const factor = 1 - Math.pow(0.001, deltaMs / 1000);

  const newX = currentX + (targetX - currentX) * factor;
  const newY = currentY + (targetY - currentY) * factor;

  return {
    x: Math.round(newX),
    y: Math.round(newY),
  };
}

/**
 * Computes visible tile range from camera offset.
 * Includes padding for smooth scrolling.
 */
export function getVisibleTileRange(
  cameraX: number,
  cameraY: number,
  zoom: number = 1.0,
): { startX: number; startY: number; endX: number; endY: number } {
  const effectiveTileSize = TILE_SIZE * zoom;
  const startX = Math.floor(-cameraX / effectiveTileSize) - 1;
  const startY = Math.floor(-cameraY / effectiveTileSize) - 1;
  const endX = startX + Math.ceil(VIEWPORT_W / effectiveTileSize) + 2;
  const endY = startY + Math.ceil(VIEWPORT_H / effectiveTileSize) + 2;

  return { startX, startY, endX, endY };
}
