/**
 * Result of a flood-fill connectivity check.
 */
export interface ConnectivityResult {
  /** Whether all walkable tiles are reachable from the start position. */
  connected: boolean;
  /** Number of walkable tiles reachable from start. */
  reachable: number;
  /** Total number of walkable tiles on the grid. */
  total: number;
  /** One sample tile from each unreachable walkable region. */
  unreachableRegions: Array<{ x: number; y: number }>;
}

/**
 * Validate that all walkable tiles are connected via BFS flood fill.
 *
 * @param width Grid width
 * @param height Grid height
 * @param isWalkable Function returning whether a tile is walkable
 * @param startX Starting x coordinate
 * @param startY Starting y coordinate
 * @returns Connectivity result with reachable/total counts and unreachable samples
 */
export function validateConnectivity(
  width: number,
  height: number,
  isWalkable: (x: number, y: number) => boolean,
  startX: number,
  startY: number
): ConnectivityResult {
  const visited = new Set<string>();

  // BFS from start position
  if (isWalkable(startX, startY)) {
    const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;

      // 4-directional neighbors
      const neighbors = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 },
      ];

      for (const n of neighbors) {
        const key = `${n.x},${n.y}`;
        if (
          n.x >= 0 && n.x < width &&
          n.y >= 0 && n.y < height &&
          !visited.has(key) &&
          isWalkable(n.x, n.y)
        ) {
          visited.add(key);
          queue.push(n);
        }
      }
    }
  }

  const reachable = visited.size;

  // Count total walkable and find unreachable regions
  let total = 0;
  const unreachableRegions: Array<{ x: number; y: number }> = [];
  const globalVisited = new Set(visited);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isWalkable(x, y)) continue;
      total++;

      const key = `${x},${y}`;
      if (!globalVisited.has(key)) {
        // Found an unreachable tile — flood fill this region to mark it
        unreachableRegions.push({ x, y });

        // Mark entire disconnected region as globally visited
        const regionQueue: Array<{ x: number; y: number }> = [{ x, y }];
        globalVisited.add(key);

        while (regionQueue.length > 0) {
          const { x: rx, y: ry } = regionQueue.shift()!;
          const regionNeighbors = [
            { x: rx - 1, y: ry },
            { x: rx + 1, y: ry },
            { x: rx, y: ry - 1 },
            { x: rx, y: ry + 1 },
          ];

          for (const n of regionNeighbors) {
            const nKey = `${n.x},${n.y}`;
            if (
              n.x >= 0 && n.x < width &&
              n.y >= 0 && n.y < height &&
              !globalVisited.has(nKey) &&
              isWalkable(n.x, n.y)
            ) {
              globalVisited.add(nKey);
              regionQueue.push(n);
            }
          }
        }
      }
    }
  }

  return {
    connected: reachable === total,
    reachable,
    total,
    unreachableRegions,
  };
}
