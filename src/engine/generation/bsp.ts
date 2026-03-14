import RNG from 'rot-js/lib/rng';
import { GeneratorConfig, GeneratorResult, Room, Corridor } from './types';

// --- Internal BSP Node ---
interface BSPNode {
  x: number;
  y: number;
  w: number;
  h: number;
  left?: BSPNode;
  right?: BSPNode;
  room?: Room;
}

// --- Defaults ---
const DEFAULTS = {
  minRoomSize: 5,
  maxRoomSize: 12,
  minRooms: 5,
  maxSplitDepth: 8,
  corridorWidth: 1,
} as const;

/**
 * Generate a dungeon layout using BSP (Binary Space Partitioning).
 * Same seed always produces identical results.
 */
export function generateBSP(config: GeneratorConfig): GeneratorResult {
  const minRoomSize = config.minRoomSize ?? DEFAULTS.minRoomSize;
  const maxRoomSize = config.maxRoomSize ?? DEFAULTS.maxRoomSize;
  const minRooms = config.minRooms ?? DEFAULTS.minRooms;
  const maxSplitDepth = config.maxSplitDepth ?? DEFAULTS.maxSplitDepth;

  // Seed RNG for deterministic generation (rot-js setSeed requires a number)
  RNG.setSeed(hashSeed(config.seed));

  // Root node spans entire grid minus 1-tile border
  const root: BSPNode = {
    x: 1,
    y: 1,
    w: config.width - 2,
    h: config.height - 2,
  };

  // Recursively split
  splitNode(root, 0, maxSplitDepth, minRoomSize);

  // Carve rooms in leaf nodes
  const rooms: Room[] = [];
  carveRooms(root, rooms, minRoomSize, maxRoomSize);

  // If we didn't get enough rooms, force-split large leaves and retry
  if (rooms.length < minRooms) {
    // Collect all leaves without rooms, try to split further
    forceMoreRooms(root, rooms, minRooms, minRoomSize, maxRoomSize);
  }

  // Connect sibling rooms with L-shaped corridors
  const corridors: Corridor[] = [];
  connectSiblings(root, corridors);

  // Find door positions (where corridors meet room edges)
  const doors = findDoors(rooms, corridors);

  return { rooms, corridors, doors };
}

/**
 * Recursively split a BSP node.
 */
function splitNode(
  node: BSPNode,
  depth: number,
  maxDepth: number,
  minRoomSize: number
): void {
  // Stop conditions
  if (depth >= maxDepth) return;

  // Node must be large enough to fit 2 rooms side by side
  const minSplit = minRoomSize;
  const canSplitH = node.w >= minSplit * 2;
  const canSplitV = node.h >= minSplit * 2;

  if (!canSplitH && !canSplitV) return;

  // Choose split direction based on aspect ratio
  let splitHorizontally: boolean;
  if (!canSplitH) {
    splitHorizontally = true; // Can only split vertically (top/bottom)
  } else if (!canSplitV) {
    splitHorizontally = false; // Can only split horizontally (left/right)
  } else {
    // Split along longer axis
    splitHorizontally = node.h > node.w;
    if (node.h === node.w) {
      splitHorizontally = RNG.getUniform() > 0.5;
    }
  }

  if (splitHorizontally) {
    // Split top/bottom — pick position between 40%-60% of height
    const min = Math.floor(node.h * 0.4);
    const max = Math.floor(node.h * 0.6);
    const splitAt = Math.max(minSplit, Math.min(node.h - minSplit, randomInt(min, max)));

    node.left = { x: node.x, y: node.y, w: node.w, h: splitAt };
    node.right = { x: node.x, y: node.y + splitAt, w: node.w, h: node.h - splitAt };
  } else {
    // Split left/right — pick position between 40%-60% of width
    const min = Math.floor(node.w * 0.4);
    const max = Math.floor(node.w * 0.6);
    const splitAt = Math.max(minSplit, Math.min(node.w - minSplit, randomInt(min, max)));

    node.left = { x: node.x, y: node.y, w: splitAt, h: node.h };
    node.right = { x: node.x + splitAt, y: node.y, w: node.w - splitAt, h: node.h };
  }

  splitNode(node.left, depth + 1, maxDepth, minRoomSize);
  splitNode(node.right, depth + 1, maxDepth, minRoomSize);
}

/**
 * Carve rooms in leaf nodes.
 */
function carveRooms(
  node: BSPNode,
  rooms: Room[],
  minRoomSize: number,
  maxRoomSize: number
): void {
  // If this is a leaf node (no children), carve a room
  if (!node.left && !node.right) {
    const minInterior = minRoomSize - 2; // 3 for default minRoomSize=5
    const maxInteriorW = Math.min(maxRoomSize - 2, node.w - 2);
    const maxInteriorH = Math.min(maxRoomSize - 2, node.h - 2);

    if (maxInteriorW < minInterior || maxInteriorH < minInterior) return;

    const roomW = randomInt(minInterior, maxInteriorW);
    const roomH = randomInt(minInterior, maxInteriorH);

    // Position room randomly within leaf with at least 1-tile padding
    const roomX = node.x + randomInt(1, node.w - roomW - 1);
    const roomY = node.y + randomInt(1, node.h - roomH - 1);

    const room: Room = {
      x: roomX,
      y: roomY,
      width: roomW,
      height: roomH,
      centerX: Math.floor(roomX + roomW / 2),
      centerY: Math.floor(roomY + roomH / 2),
    };

    node.room = room;
    rooms.push(room);
    return;
  }

  if (node.left) carveRooms(node.left, rooms, minRoomSize, maxRoomSize);
  if (node.right) carveRooms(node.right, rooms, minRoomSize, maxRoomSize);
}

/**
 * If not enough rooms were generated, collect large leaves and try to create rooms in them.
 */
function forceMoreRooms(
  node: BSPNode,
  rooms: Room[],
  minRooms: number,
  minRoomSize: number,
  maxRoomSize: number
): void {
  if (rooms.length >= minRooms) return;

  const leaves = getLeaves(node).filter(n => !n.room);
  for (const leaf of leaves) {
    if (rooms.length >= minRooms) break;
    // Try to carve a room in this leaf
    const minInterior = minRoomSize - 2;
    const maxInteriorW = Math.min(maxRoomSize - 2, leaf.w - 2);
    const maxInteriorH = Math.min(maxRoomSize - 2, leaf.h - 2);

    if (maxInteriorW >= minInterior && maxInteriorH >= minInterior) {
      const roomW = randomInt(minInterior, maxInteriorW);
      const roomH = randomInt(minInterior, maxInteriorH);
      const roomX = leaf.x + randomInt(1, Math.max(1, leaf.w - roomW - 1));
      const roomY = leaf.y + randomInt(1, Math.max(1, leaf.h - roomH - 1));

      const room: Room = {
        x: roomX,
        y: roomY,
        width: roomW,
        height: roomH,
        centerX: Math.floor(roomX + roomW / 2),
        centerY: Math.floor(roomY + roomH / 2),
      };

      leaf.room = room;
      rooms.push(room);
    }
  }
}

/**
 * Collect all leaf nodes from the BSP tree.
 */
function getLeaves(node: BSPNode): BSPNode[] {
  if (!node.left && !node.right) return [node];
  const result: BSPNode[] = [];
  if (node.left) result.push(...getLeaves(node.left));
  if (node.right) result.push(...getLeaves(node.right));
  return result;
}

/**
 * Connect sibling rooms with L-shaped corridors, walking up the BSP tree.
 */
function connectSiblings(node: BSPNode, corridors: Corridor[]): void {
  if (!node.left || !node.right) return;

  // Recurse first (bottom-up connection)
  connectSiblings(node.left, corridors);
  connectSiblings(node.right, corridors);

  // Find nearest rooms in left and right subtrees
  const leftRoom = findNearestRoom(node.left, node.right);
  const rightRoom = findNearestRoom(node.right, node.left);

  if (leftRoom && rightRoom) {
    const corridor = carveCorridorBetween(leftRoom, rightRoom);
    corridors.push(corridor);
  }
}

/**
 * Find the room in `source` subtree that is closest to any room in `target` subtree.
 */
function findNearestRoom(source: BSPNode, target: BSPNode): Room | null {
  const sourceRooms = getAllRooms(source);
  const targetRooms = getAllRooms(target);

  if (sourceRooms.length === 0 || targetRooms.length === 0) return null;

  let bestRoom: Room | null = null;
  let bestDist = Infinity;

  for (const sr of sourceRooms) {
    for (const tr of targetRooms) {
      const dist = Math.abs(sr.centerX - tr.centerX) + Math.abs(sr.centerY - tr.centerY);
      if (dist < bestDist) {
        bestDist = dist;
        bestRoom = sr;
      }
    }
  }

  return bestRoom;
}

/**
 * Get all rooms in a subtree.
 */
function getAllRooms(node: BSPNode): Room[] {
  if (node.room) return [node.room];
  const rooms: Room[] = [];
  if (node.left) rooms.push(...getAllRooms(node.left));
  if (node.right) rooms.push(...getAllRooms(node.right));
  return rooms;
}

/**
 * Carve an L-shaped corridor between two rooms (horizontal then vertical).
 */
function carveCorridorBetween(a: Room, b: Room): Corridor {
  const points: Array<{ x: number; y: number }> = [];
  const ax = a.centerX;
  const ay = a.centerY;
  const bx = b.centerX;
  const by = b.centerY;

  // Horizontal segment from a.center to (b.centerX, a.centerY)
  const xStart = Math.min(ax, bx);
  const xEnd = Math.max(ax, bx);
  for (let x = xStart; x <= xEnd; x++) {
    points.push({ x, y: ay });
  }

  // Vertical segment from (b.centerX, a.centerY) to b.center
  const yStart = Math.min(ay, by);
  const yEnd = Math.max(ay, by);
  for (let y = yStart; y <= yEnd; y++) {
    // Avoid duplicate at the corner
    if (y !== ay) {
      points.push({ x: bx, y });
    }
  }

  return { points };
}

/**
 * Find door positions where corridors transition into room interiors.
 */
function findDoors(rooms: Room[], corridors: Corridor[]): Array<{ x: number; y: number }> {
  const doors: Array<{ x: number; y: number }> = [];
  const doorSet = new Set<string>();

  // Build a set of room interior positions for fast lookup
  const roomInterior = new Set<string>();
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        roomInterior.add(`${x},${y}`);
      }
    }
  }

  // Build set of room edge positions (one tile outside interior)
  const roomEdge = new Set<string>();
  for (const room of rooms) {
    // Top and bottom edges
    for (let x = room.x - 1; x <= room.x + room.width; x++) {
      roomEdge.add(`${x},${room.y - 1}`);
      roomEdge.add(`${x},${room.y + room.height}`);
    }
    // Left and right edges
    for (let y = room.y; y < room.y + room.height; y++) {
      roomEdge.add(`${room.x - 1},${y}`);
      roomEdge.add(`${room.x + room.width},${y}`);
    }
  }

  // A door is a corridor point that sits on a room edge and is adjacent to room interior
  for (const corridor of corridors) {
    for (const pt of corridor.points) {
      const key = `${pt.x},${pt.y}`;
      if (roomEdge.has(key) && !roomInterior.has(key) && !doorSet.has(key)) {
        // Check if adjacent to room interior
        const neighbors = [
          `${pt.x - 1},${pt.y}`,
          `${pt.x + 1},${pt.y}`,
          `${pt.x},${pt.y - 1}`,
          `${pt.x},${pt.y + 1}`,
        ];
        if (neighbors.some(n => roomInterior.has(n))) {
          doors.push({ x: pt.x, y: pt.y });
          doorSet.add(key);
        }
      }
    }
  }

  return doors;
}

/**
 * Hash a string seed into a numeric value for rot-js RNG.setSeed().
 * Uses a simple djb2-like hash that produces consistent results.
 */
function hashSeed(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Generate a random integer in [min, max] (inclusive) using the seeded RNG.
 */
function randomInt(min: number, max: number): number {
  if (min >= max) return min;
  return min + Math.floor(RNG.getUniform() * (max - min + 1));
}
