import { Grid } from '../../engine/grid/grid';
import { Tile } from '../../engine/grid/types';
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

    // Shuffle qualifying prefabs deterministically
    const shuffledPrefabs = shufflePrefabs(qualifyingPrefabs, rng);

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

        // Center prefab within the room footprint, clamped so a 1-tile perimeter walkway fits inside grid bounds
        const offsetX = Math.floor((targetRoom.width - prefab.width) / 2);
        const offsetY = Math.floor((targetRoom.height - prefab.height) / 2);
        const startX = Math.max(2, Math.min(config.width - prefab.width - 2, targetRoom.x + offsetX));
        const startY = Math.max(2, Math.min(config.height - prefab.height - 2, targetRoom.y + offsetY));

        // Ensure no authored propSpawn in this prefab falls within Manhattan distance <= 1 of a BSP door
        const conflictsWithDoor = prefab.propSpawns.some((sp) =>
          doors.some((d) => Math.abs(startX + sp.x - d.x) + Math.abs(startY + sp.y - d.y) <= 1),
        );
        if (conflictsWithDoor) {
          continue;
        }

        // Snapshot existing room and prefab moat tiles so we can roll back if connectivity breaks
        const savedTiles: Array<{ x: number; y: number; tile: Tile }> = [];
        const minSaveX = Math.min(targetRoom.x, startX) - 2;
        const maxSaveX = Math.max(targetRoom.x + targetRoom.width, startX + prefab.width) + 2;
        const minSaveY = Math.min(targetRoom.y, startY) - 2;
        const maxSaveY = Math.max(targetRoom.y + targetRoom.height, startY + prefab.height) + 2;
        for (let y = minSaveY; y <= maxSaveY; y++) {
          for (let x = minSaveX; x <= maxSaveX; x++) {
            if (grid.inBounds(x, y)) {
              savedTiles.push({ x, y, tile: { ...grid.getTile(x, y)! } });
            }
          }
        }

        let vaultDoorPos: { x: number; y: number } | undefined;

        // Seal any unused targetRoom floor tiles outside the prefab+moat box so no isolated floor pockets remain behind prefab walls
        for (let ry = targetRoom.y; ry < targetRoom.y + targetRoom.height; ry++) {
          for (let rx = targetRoom.x; rx < targetRoom.x + targetRoom.width; rx++) {
            const insidePrefabOrMoat =
              rx >= startX - 1 &&
              rx <= startX + prefab.width &&
              ry >= startY - 1 &&
              ry <= startY + prefab.height;
            if (!insidePrefabOrMoat && grid.inBounds(rx, ry)) {
              const isRoomDoor = doors.some((d) => d.x === rx && d.y === ry);
              if (!isRoomDoor) {
                grid.setTile(rx, ry, { terrain: 'wall', walkable: false, transparent: false });
              }
            }
          }
        }

        // Carve a 1-tile walkable perimeter moat around the prefab footprint so corridors/doors can route around it without breaching prefab walls
        for (let py = -1; py <= prefab.height; py++) {
          for (let px = -1; px <= prefab.width; px++) {
            if (py === -1 || py === prefab.height || px === -1 || px === prefab.width) {
              const gx = startX + px;
              const gy = startY + py;
              if (gx >= 1 && gx < config.width - 1 && gy >= 1 && gy < config.height - 1) {
                const existing = grid.getTile(gx, gy);
                if (!existing || !existing.walkable) {
                  grid.setTile(gx, gy, { terrain: 'floor', walkable: true, transparent: true });
                }
              }
            }
          }
        }

        // Stamp prefab layout intact (never skip '#' walls inside the prefab footprint)
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

        // Carve portals on the prefab perimeter
        for (const portal of prefab.portals) {
          const pgx = startX + portal.x;
          const pgy = startY + portal.y;
          if (grid.inBounds(pgx, pgy)) {
            const tile = grid.getTile(pgx, pgy);
            if (!tile || !tile.walkable) {
              grid.setTile(pgx, pgy, { terrain: 'door', walkable: true, transparent: true });
            }
          }
        }

        // Connect room entrance doors to the prefab perimeter moat (never carving inside the prefab footprint)
        const roomDoors = doors.filter(
          (d) =>
            d.x >= targetRoom.x - 1 &&
            d.x <= targetRoom.x + targetRoom.width &&
            d.y >= targetRoom.y - 1 &&
            d.y <= targetRoom.y + targetRoom.height,
        );

        for (const rd of roomDoors) {
          const moatX = rd.x < startX ? startX - 1 : rd.x >= startX + prefab.width ? startX + prefab.width : rd.x;
          const moatY = rd.y < startY ? startY - 1 : rd.y >= startY + prefab.height ? startY + prefab.height : startY - 1;
          carveWalkablePathOutsideBox(
            grid,
            rd.x,
            rd.y,
            moatX,
            moatY,
            startX,
            startY,
            prefab.width,
            prefab.height,
          );
        }

        // Validate attempt-local connectivity: if broken (or if authored blocking props / locked vault doors would disconnect non-vault tiles), revert room and drop prefab
        const authoredPropCoords = new Set<string>(
          prefab.propSpawns.map((sp) => `${startX + sp.x},${startY + sp.y}`),
        );
        const testConnWithoutProps = validateConnectivity(
          config.width,
          config.height,
          (x, y) => grid.isWalkable(x, y),
          playerSpawnRoom.centerX,
          playerSpawnRoom.centerY,
        );
        const testConnWithProps = validateConnectivity(
          config.width,
          config.height,
          (x, y) => {
            if (!grid.isWalkable(x, y)) return false;
            if (authoredPropCoords.has(`${x},${y}`)) return false;
            if (
              vaultDoorPos &&
              x >= startX &&
              x < startX + prefab.width &&
              y >= startY &&
              y <= vaultDoorPos.y
            ) {
              return false;
            }
            return true;
          },
          playerSpawnRoom.centerX,
          playerSpawnRoom.centerY,
        );

        if (!testConnWithoutProps.connected || !testConnWithProps.connected) {
          for (const { x, y, tile } of savedTiles) {
            grid.setTile(x, y, tile);
          }
          continue;
        }

        // Stamping succeeded! Register bespoke room and anchors
        bespokeRoomIndices.add(actualRoomIndex);

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

  // Last-resort fallback: Generate connected pure BSP dungeon without bespoke rooms
  const fallbackConfig = {
    ...config,
    seed: `${floorSeed}_fallback`,
    ...(depthBand ? depthBand.bspConfig : {}),
  };
  const fallbackRng = createSeededRNG(`${floorSeed}_fallback`);
  const { rooms: fRooms, corridors: fCorridors, doors: fDoors } = generateBSP(fallbackConfig);
  if (fRooms.length > 0) {
    const fGrid = new Grid(config.width, config.height);
    initializeWalls(fGrid, config.width, config.height);
    const fSpawnRoom = fRooms[0];
    for (const room of fRooms) {
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          fGrid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }
    }
    for (const corridor of fCorridors) {
      for (const pt of corridor.points) {
        if (fGrid.inBounds(pt.x, pt.y)) {
          fGrid.setTile(pt.x, pt.y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }
    }
    for (const door of fDoors) {
      if (fGrid.inBounds(door.x, door.y)) {
        fGrid.setTile(door.x, door.y, { terrain: 'door', walkable: true, transparent: true });
      }
    }
    const fPropAnchors: PropAnchor[] = [];
    for (let rIdx = 1; rIdx < fRooms.length; rIdx++) {
      const room = fRooms[rIdx];
      const dynamicAnchors = tagProceduralRoomAnchors(fGrid, room, fDoors, rIdx);
      fPropAnchors.push(...dynamicAnchors);
    }
    const fConn = validateConnectivity(
      config.width,
      config.height,
      (x, y) => fGrid.isWalkable(x, y),
      fSpawnRoom.centerX,
      fSpawnRoom.centerY,
    );
    if (fConn.connected) {
      return {
        grid: fGrid,
        rooms: fRooms,
        doors: fDoors,
        playerSpawnRoom: fSpawnRoom,
        sectorCondition: rollSectorCondition(depth, fallbackRng),
        factionTheme: rollFactionTheme(fallbackRng),
        bespokeRooms: [],
        vaultFaradayBounds: [],
        propAnchors: fPropAnchors,
      };
    }
  }

  throw new Error('Failed to generate connected dungeon');
}

/**
 * Deterministically shuffles an array using Fisher-Yates with the provided RNG.
 */
function shufflePrefabs<T>(array: T[], rng: { random(): number }): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Carves an L-shaped walkable floor corridor between two points without overwriting tiles inside [boxX..boxX+boxW-1, boxY..boxY+boxH-1].
 */
function carveWalkablePathOutsideBox(
  grid: Grid,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): void {
  const isInsideBox = (x: number, y: number) =>
    x >= boxX && x < boxX + boxW && y >= boxY && y < boxY + boxH;

  const xStart = Math.min(x1, x2);
  const xEnd = Math.max(x1, x2);
  for (let x = xStart; x <= xEnd; x++) {
    if (grid.inBounds(x, y1) && !isInsideBox(x, y1)) {
      const tile = grid.getTile(x, y1);
      if (!tile || !tile.walkable) {
        grid.setTile(x, y1, { terrain: 'floor', walkable: true, transparent: true });
      }
    }
  }
  const yStart = Math.min(y1, y2);
  const yEnd = Math.max(y1, y2);
  for (let y = yStart; y <= yEnd; y++) {
    if (grid.inBounds(x2, y) && !isInsideBox(x2, y)) {
      const tile = grid.getTile(x2, y);
      if (!tile || !tile.walkable) {
        grid.setTile(x2, y, { terrain: 'floor', walkable: true, transparent: true });
      }
    }
  }
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

  // Center tile for large room CONTAINER_RARE (area >= 48)
  const area = room.width * room.height;
  const nearAnyDoor = (tx: number, ty: number) =>
    doors.some((d) => Math.abs(d.x - tx) + Math.abs(d.y - ty) <= 1);

  if (area >= 48 && grid.isWalkable(room.centerX, room.centerY) && !nearAnyDoor(room.centerX, room.centerY)) {
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
      if (nearAnyDoor(x, y)) continue;

      // Do not duplicate center rare container tile
      if (area >= 48 && x === room.centerX && y === room.centerY) continue;

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
