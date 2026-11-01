import { Grid } from '../../engine/grid/grid';
import { GeneratorConfig, Room } from '../../engine/generation/types';
import { generateBSP } from '../../engine/generation/bsp';
import { validateConnectivity } from '../../engine/generation/flood-fill';
import depthConfig from './depth-config.json';
import { SectorCondition, FactionTheme } from '@shared/components/environment';
import { PropAnchorTag, getPrefabsForFloor } from './prefabs';

/**
 * Configuration for game-layer dungeon generation.
 * Extends engine GeneratorConfig with optional depth field.
 */
export interface DungeonConfig extends GeneratorConfig {
  /** Current floor depth for depth-specific parameters. */
  depth?: number;
}

export interface PropAnchor {
  x: number;
  y: number;
  anchorType: PropAnchorTag;
  guaranteedTemplate?: string;
  roomId?: number;
}

export interface FaradayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  doorX: number;
  doorY: number;
}

export interface BespokeRoom {
  prefabId: string;
  name: string;
  room: Room;
  faradayShielded?: boolean;
  isVaultRoom?: boolean;
  faradayBounds?: FaradayBounds;
  propSpawns: Array<{ x: number; y: number; anchorType: PropAnchorTag; guaranteedTemplate?: string }>;
}

/**
 * Result of a dungeon generation.
 */
export interface DungeonResult {
  /** The populated grid with carved rooms, corridors, and doors. */
  grid: Grid;
  /** All rooms generated. */
  rooms: Room[];
  /** Door positions. */
  doors: Array<{ x: number; y: number }>;
  /** The room designated as the player spawn point. */
  playerSpawnRoom: Room;
  /** Active floor Sector Condition. */
  sectorCondition: SectorCondition;
  /** Active floor dominant faction theme. */
  factionTheme: FactionTheme;
  /** Stamped bespoke rooms. */
  bespokeRooms: BespokeRoom[];
  /** Bounding boxes of Faraday-shielded vault rooms. */
  vaultFaradayBounds: FaradayBounds[];
  /** All candidate/authored prop anchor coordinates. */
  propAnchors: PropAnchor[];
}

const MAX_ATTEMPTS = 10;

/**
 * Fast deterministic PRNG (Mulberry32) seeded from string.
 */
export function createSeededRNG(seedStr: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  return {
    random(): number {
      h += 0x6d2b79f5;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/**
 * Get the depth band configuration for a given floor depth.
 */
export function getDepthBand(depth: number) {
  return depthConfig.depthBands.find((band) => depth >= band.range.min && depth <= band.range.max);
}

/**
 * Roll floor-wide Sector Condition deterministically.
 * - Floors 1-5: Always NOMINAL.
 * - Floors 6, 10, 15: Guaranteed active (THERMAL_SURGE, DARK_SUBNET, or OVERCLOCKED_GRID).
 * - Other floors in 6-15 (7-9, 11-14): 25% chance of an active condition.
 */
export function rollSectorCondition(depth: number, rng: { random(): number }): SectorCondition {
  if (depth < 6) {
    return 'NOMINAL';
  }

  // Floors 6, 10, 15: Guaranteed active condition
  if (depth === 6 || depth === 10 || depth === 15) {
    const roll = rng.random();
    if (roll < 0.4) {
      return 'THERMAL_SURGE'; // 10 / 25
    } else if (roll < 0.72) {
      return 'DARK_SUBNET'; // 8 / 25
    } else {
      return 'OVERCLOCKED_GRID'; // 7 / 25
    }
  }

  // Remaining floors in 6-15: 25% chance of active condition
  const roll = rng.random();
  if (roll < 0.75) {
    return 'NOMINAL';
  } else if (roll < 0.85) {
    return 'THERMAL_SURGE'; // 10%
  } else if (roll < 0.93) {
    return 'DARK_SUBNET'; // 8%
  } else {
    return 'OVERCLOCKED_GRID'; // 7%
  }
}

/**
 * Roll dominant corporate faction theme deterministically.
 */
export function rollFactionTheme(rng: { random(): number }): FactionTheme {
  const factions: FactionTheme[] = ['traxus', 'cyberacme', 'sekiguchi', 'nucaloric'];
  const index = Math.floor(rng.random() * factions.length);
  return factions[index];
}

/**
 * Get maximum allowed bespoke rooms for a depth.
 */
export function getMaxBespokeRooms(depth: number): number {
  if (depth <= 5) return 1;
  if (depth <= 10) return 2;
  return 3;
}

/**
 * Generate a dungeon: create a Grid, run BSP, carve terrain, validate connectivity,
 * roll sector conditions, stamp bespoke prefabs, and tag dynamic prop anchors.
 */
export function generateDungeon(config: DungeonConfig): DungeonResult {
  const depth = config.depth ?? 1;
  const depthBand = getDepthBand(depth);
  const floorSeed = config.seed;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const attemptSeed = attempt === 0 ? floorSeed : `${floorSeed}_${attempt}`;
    const rng = createSeededRNG(attemptSeed);

    // Roll Sector Condition and Faction Theme
    const sectorCondition = rollSectorCondition(depth, rng);
    const factionTheme = rollFactionTheme(rng);

    // Merge BSP parameters from depth band if available
    const attemptConfig = {
      ...config,
      seed: attemptSeed,
      ...(depthBand ? depthBand.bspConfig : {}),
    };

    // Run BSP algorithm
    const { rooms, corridors, doors } = generateBSP(attemptConfig);
    if (rooms.length === 0) continue;

    // Create grid and initialize all tiles as walls
    const grid = new Grid(config.width, config.height);
    initializeWalls(grid, config.width, config.height);

    // Player spawn room is the first room (deterministic from seed)
    const playerSpawnRoom = rooms[0];

    // Carve room interiors as floors
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }
    }

    // Carve corridors as floors
    for (const corridor of corridors) {
      for (const pt of corridor.points) {
        if (grid.inBounds(pt.x, pt.y)) {
          grid.setTile(pt.x, pt.y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }
    }

    // Carve doors
    for (const door of doors) {
      if (grid.inBounds(door.x, door.y)) {
        grid.setTile(door.x, door.y, { terrain: 'door', walkable: true, transparent: true });
      }
    }

    // 2. Bespoke Room Stamping
    const maxBespoke = getMaxBespokeRooms(depth);
    const qualifyingPrefabs = getPrefabsForFloor(depth, factionTheme);
    const bespokeRooms: BespokeRoom[] = [];
    const vaultFaradayBounds: FaradayBounds[] = [];
    const propAnchors: PropAnchor[] = [];
    const bespokeRoomIndices = new Set<number>();

    // Shuffle qualifying prefabs with attempt RNG
    const shuffledPrefabs = [...qualifyingPrefabs].sort(() => rng.random() - 0.5);

    // Eligible rooms are non-spawn rooms (index >= 1)
    const nonSpawnRooms = rooms.slice(1);

    for (const prefab of shuffledPrefabs) {
      if (bespokeRooms.length >= maxBespoke) break;

      // Find an eligible room that can accommodate the prefab
      const candidateRoomIndex = nonSpawnRooms.findIndex(
        (room, idx) =>
          !bespokeRoomIndices.has(idx + 1) &&
          room.width >= prefab.width &&
          room.height >= prefab.height,
      );

      if (candidateRoomIndex !== -1) {
        const actualRoomIndex = candidateRoomIndex + 1;
        const targetRoom = rooms[actualRoomIndex];
        bespokeRoomIndices.add(actualRoomIndex);

        // Center prefab within the room footprint
        const offsetX = Math.floor((targetRoom.width - prefab.width) / 2);
        const offsetY = Math.floor((targetRoom.height - prefab.height) / 2);
        const startX = targetRoom.x + offsetX;
        const startY = targetRoom.y + offsetY;

        let vaultDoorPos: { x: number; y: number } | undefined;

        // Stamp prefab layout
        for (let py = 0; py < prefab.height; py++) {
          for (let px = 0; px < prefab.width; px++) {
            const char = prefab.layout[py]?.[px] || '#';
            const gx = startX + px;
            const gy = startY + py;

            if (!grid.inBounds(gx, gy)) continue;

            if (char === '#') {
              grid.setTile(gx, gy, { terrain: 'wall', walkable: false, transparent: false });
            } else if (char === '.') {
              grid.setTile(gx, gy, { terrain: 'floor', walkable: true, transparent: true });
            } else if (char === '+') {
              grid.setTile(gx, gy, { terrain: 'door', walkable: true, transparent: true });
            } else if (char === 'V') {
              // Encrypted vault blast door: door terrain, initial transparent: false
              grid.setTile(gx, gy, { terrain: 'door', walkable: true, transparent: false });
              vaultDoorPos = { x: gx, y: gy };
            } else if (char === '~') {
              grid.setTile(gx, gy, { terrain: 'floor', walkable: true, transparent: true });
            }
          }
        }

        // Handle Faraday bounds for vault prefabs
        let faradayBounds: FaradayBounds | undefined;
        if (prefab.faradayShielded || prefab.isVaultRoom) {
          const doorX = vaultDoorPos?.x ?? startX + (prefab.portals[0]?.x ?? 0);
          const doorY = vaultDoorPos?.y ?? startY + (prefab.portals[0]?.y ?? 0);

          faradayBounds = {
            x: startX + 1,
            y: startY + 1,
            width: prefab.width - 2,
            height: prefab.height - 2,
            doorX,
            doorY,
          };
          vaultFaradayBounds.push(faradayBounds);
        }

        // Add authored prop spawns with absolute coordinates
        for (const spawn of prefab.propSpawns) {
          propAnchors.push({
            x: startX + spawn.x,
            y: startY + spawn.y,
            anchorType: spawn.anchorType,
            guaranteedTemplate: spawn.guaranteedTemplate,
            roomId: actualRoomIndex,
          });
        }

        bespokeRooms.push({
          prefabId: prefab.id,
          name: prefab.name,
          room: targetRoom,
          faradayShielded: prefab.faradayShielded,
          isVaultRoom: prefab.isVaultRoom,
          faradayBounds,
          propSpawns: prefab.propSpawns,
        });
      }
    }

    // 3. Dynamic Prop Anchor Tagging for Algorithmic (Non-Bespoke) Rooms
    for (let rIdx = 1; rIdx < rooms.length; rIdx++) {
      if (bespokeRoomIndices.has(rIdx)) continue;
      const room = rooms[rIdx];
      const dynamicAnchors = tagProceduralRoomAnchors(grid, room, doors, rIdx);
      propAnchors.push(...dynamicAnchors);
    }

    // Validate connectivity from spawn room center
    const connectivity = validateConnectivity(
      config.width,
      config.height,
      (x, y) => grid.isWalkable(x, y),
      playerSpawnRoom.centerX,
      playerSpawnRoom.centerY,
    );

    if (connectivity.connected) {
      return {
        grid,
        rooms,
        doors,
        playerSpawnRoom,
        sectorCondition,
        factionTheme,
        bespokeRooms,
        vaultFaradayBounds,
        propAnchors,
      };
    }
  }

  throw new Error('Failed to generate connected dungeon');
}

/**
 * Initialize all grid tiles as walls.
 */
function initializeWalls(grid: Grid, width: number, height: number): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      grid.setTile(x, y, { terrain: 'wall', walkable: false, transparent: false });
    }
  }
}

/**
 * Dynamic anchor classification for procedural rooms:
 * - PROP_DESK_CORNER: Corner floor tiles (2 perpendicular wall faces)
 * - PROP_LOCKER_WALL: Floor tiles against straight wall with clear front
 * - SURFACE_TABLE_TOP: Interior tiles at least 2 tiles from walls
 * - CONTAINER_RARE: Center tile of large rooms (area >= 100)
 */
export function tagProceduralRoomAnchors(
  grid: Grid,
  room: Room,
  doors: Array<{ x: number; y: number }>,
  roomId: number,
): PropAnchor[] {
  const anchors: PropAnchor[] = [];

  // Center tile for large room CONTAINER_RARE
  const area = room.width * room.height;
  if (area >= 100) {
    anchors.push({
      x: room.centerX,
      y: room.centerY,
      anchorType: 'CONTAINER_RARE',
      roomId,
    });
  }

  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (!grid.isWalkable(x, y)) continue;

      // Skip tiles adjacent to any door (Manhattan distance <= 1) to prevent doorway blockages
      const nearDoor = doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1);
      if (nearDoor) continue;

      // Do not duplicate center rare container tile
      if (area >= 100 && x === room.centerX && y === room.centerY) continue;

      const northWall = grid.getTile(x, y - 1)?.terrain === 'wall';
      const southWall = grid.getTile(x, y + 1)?.terrain === 'wall';
      const eastWall = grid.getTile(x + 1, y)?.terrain === 'wall';
      const westWall = grid.getTile(x - 1, y)?.terrain === 'wall';

      const wallCount = (northWall ? 1 : 0) + (southWall ? 1 : 0) + (eastWall ? 1 : 0) + (westWall ? 1 : 0);

      // Check perpendicular wall corner
      const isPerpendicularCorner =
        (northWall && eastWall) ||
        (northWall && westWall) ||
        (southWall && eastWall) ||
        (southWall && westWall);

      if (isPerpendicularCorner) {
        anchors.push({
          x,
          y,
          anchorType: 'PROP_DESK_CORNER',
          roomId,
        });
      } else if (wallCount === 1) {
        // Floor tile adjacent to a straight wall with an unobstructed opposite tile
        anchors.push({
          x,
          y,
          anchorType: 'PROP_LOCKER_WALL',
          roomId,
        });
      } else if (wallCount === 0) {
        // Interior tile away from walls
        const farFromWalls =
          grid.isWalkable(x - 1, y - 1) &&
          grid.isWalkable(x + 1, y - 1) &&
          grid.isWalkable(x - 1, y + 1) &&
          grid.isWalkable(x + 1, y + 1);

        if (farFromWalls) {
          anchors.push({
            x,
            y,
            anchorType: 'SURFACE_TABLE_TOP',
            roomId,
          });
        }
      }
    }
  }

  return anchors;
}
