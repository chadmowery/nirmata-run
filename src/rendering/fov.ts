import PreciseShadowcasting from 'rot-js/lib/fov/precise-shadowcasting';

/**
 * Computes the Field of View (FOV) for a player at a given position.
 * @param playerX The X coordinate of the player.
 * @param playerY The Y coordinate of the player.
 * @param radius The radius of the FOV.
 * @param lightPasses A callback function that returns true if light can pass through a tile.
 * @param exploredSet A Set containing strings of "x,y" coordinates of explored tiles.
 * @returns A Set containing strings of "x,y" coordinates of visible tiles.
 */
export function computeFov(
  playerX: number,
  playerY: number,
  radius: number,
  lightPasses: (x: number, y: number) => boolean,
  exploredSet: Set<string>
): Set<string> {
  const fov = new PreciseShadowcasting(lightPasses);
  const visibleSet = new Set<string>();

  fov.compute(playerX, playerY, radius, (x, y, r, visibility) => {
    if (visibility > 0) {
      const key = `${x},${y}`;
      visibleSet.add(key);
      exploredSet.add(key);
    }
  });

  return visibleSet;
}

/**
 * Calculates the alpha value for a tile based on its distance from the player.
 * @param x The X coordinate of the tile.
 * @param y The Y coordinate of the tile.
 * @param playerX The X coordinate of the player.
 * @param playerY The Y coordinate of the player.
 * @param radius The FOV radius.
 * @returns An alpha value between 0.5 and 1.0.
 */
export function computeFovAlpha(
  x: number,
  y: number,
  playerX: number,
  playerY: number,
  radius: number
): number {
  const dist = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
  // alpha = Math.max(0.5, 1.0 - (dist / radius) * 0.5)
  // full brightness at center (1.0), ~0.5 at edge (dist = radius)
  return Math.max(0.5, 1.0 - (dist / radius) * 0.5);
}

/**
 * Creates a new empty explored set.
 */
export function createExploredSet(): Set<string> {
  return new Set<string>();
}

/**
 * Updates the explored set with newly visible tiles.
 * @param exploredSet The set to update.
 * @param fovSet The set of currently visible tiles.
 */
export function updateExplored(exploredSet: Set<string>, fovSet: Set<string>): void {
  for (const key of fovSet) {
    exploredSet.add(key);
  }
}

/**
 * Clears the explored set.
 * @param exploredSet The set to clear.
 */
export function clearExplored(exploredSet: Set<string>): void {
  exploredSet.clear();
}

/**
 * Entity types that have different visibility rules.
 */
export type EntityVisibilityType = 'player' | 'enemy' | 'item';

/**
 * Determines if an entity is visible and what its alpha should be.
 * @param pos The position of the entity.
 * @param entityType The type of the entity.
 * @param fovSet The current FOV set.
 * @param exploredSet The current explored set.
 */
export function isEntityVisible(
  pos: { x: number; y: number },
  entityType: EntityVisibilityType,
  fovSet: Set<string>,
  exploredSet: Set<string>
): { visible: boolean; alpha: number } {
  const key = `${pos.x},${pos.y}`;

  if (entityType === 'player') {
    return { visible: true, alpha: 1.0 };
  }

  const inFov = fovSet.has(key);
  if (inFov) {
    return { visible: true, alpha: 1.0 };
  }

  if (entityType === 'item' && exploredSet.has(key)) {
    return { visible: true, alpha: 0.3 };
  }

  return { visible: false, alpha: 0 };
}
