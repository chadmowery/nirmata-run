import { World } from '../../engine/ecs/world';
import { Grid } from '../../engine/grid/grid';
import { EntityFactory } from '../../engine/entity/factory';
import { EntityId } from '../../engine/ecs/types';
import { ComponentRegistry } from '../../engine/entity/types';
import { Room } from '../../engine/generation/types';
import depthDistribution from '../entities/templates/spawn-tables/depth-distribution.json';
import lootDistribution from './loot-distribution.json';
import depthConfig from './depth-config.json';
import { getDepthBand, PropAnchor, BespokeRoom, FaradayBounds } from './dungeon-generator';
import { Actor } from '@shared/components/actor';
import { Position } from '@shared/components/position';
import {
  Container,
  SecurityLock,
  CorruptedNode,
  SectorCondition,
  FactionTheme,
} from '@shared/components/environment';

/**
 * Configuration for entity placement in generated dungeons.
 */
export interface PlacementConfig {
  /** Range of enemies per non-spawn room. */
  enemiesPerRoom: { min: number; max: number };
  /** Range of items per non-spawn room. */
  itemsPerRoom: { min: number; max: number };
  /** Template names for enemy entities. */
  enemyTemplates: string[];
  /** Template names for item entities. */
  itemTemplates: string[];
  /** Optional overrides for the player entity. */
  playerOverrides?: Record<string, Record<string, unknown>>;
  /** Current floor depth for depth-based spawning. */
  depth?: number;
  /** Whether to skip spawning the player entity. */
  skipPlayer?: boolean;
  /** Prop anchors detected or authored on the floor. */
  propAnchors?: PropAnchor[];
  /** Stamped bespoke rooms. */
  bespokeRooms?: BespokeRoom[];
  /** Faraday-shielded vault bounds. */
  vaultFaradayBounds?: FaradayBounds[];
  /** Active floor Sector Condition. */
  sectorCondition?: SectorCondition;
  /** Active floor dominant faction theme. */
  factionTheme?: FactionTheme;
}

interface SpawnTableEntry {
  name: string;
  weight: number;
  isPack?: boolean;
  packSize?: { min: number; max: number };
  maxPerFloor?: number;
  minDistanceFromPlayer?: number;
}

interface DepthTable {
  depthRange: { min: number; max: number };
  enemiesPerRoom: { min: number; max: number };
  templates: SpawnTableEntry[];
}

interface LootEntry {
  template: string;
  weight: number;
}

interface LootDepthBand {
  depthRange: { min: number; max: number };
  loot: LootEntry[];
}

const DEFAULT_PLACEMENT: PlacementConfig = {
  enemiesPerRoom: { min: 1, max: 3 },
  itemsPerRoom: { min: 0, max: 2 },
  enemyTemplates: ['goblin'],
  itemTemplates: ['health-potion'],
  playerOverrides: {},
};

/**
 * Result of entity placement.
 */
export interface PlacementResult {
  playerId: EntityId;
  enemyIds: EntityId[];
  itemIds: EntityId[];
  propIds: EntityId[];
}

import { EngineEvents } from '../../engine/events/types';

function getTableForDepth(depth: number): DepthTable | undefined {
  return (depthDistribution.tables as unknown as DepthTable[]).find(
    (table) => depth >= table.depthRange.min && depth <= table.depthRange.max,
  );
}

function getLootForDepth(depth: number): LootEntry[] | undefined {
  const band = (lootDistribution.depthBands as LootDepthBand[]).find(
    (b) => depth >= b.depthRange.min && depth <= b.depthRange.max,
  );
  return band?.loot;
}

function selectWeightedTemplate<T extends { weight: number }>(
  templates: T[],
  rng: { random(): number },
): T | undefined {
  const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
  let random = rng.random() * totalWeight;
  for (const template of templates) {
    if (random < template.weight) {
      return template;
    }
    random -= template.weight;
  }
  return undefined;
}

export function getRarityFromTemplate(templateId: string): 'common' | 'uncommon' | 'rare' | 'legendary' {
  if (templateId.includes('-v3')) return 'legendary';
  if (templateId.includes('-v2') || templateId.includes('augment')) return 'rare';
  if (templateId.includes('-v1') || templateId.includes('firmware')) return 'uncommon';
  return 'common';
}

const RARITY_VALUES: Record<'common' | 'uncommon' | 'rare' | 'legendary', number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  legendary: 4,
};

/**
 * Place player, enemies, items, and interactive props in a generated dungeon.
 */
export function placeEntities<T extends EngineEvents>(
  world: World<T>,
  grid: Grid,
  factory: EntityFactory,
  componentRegistry: ComponentRegistry,
  rooms: Room[],
  spawnRoom: Room,
  rng: { random(): number },
  config?: Partial<PlacementConfig>,
): PlacementResult {
  const cfg: PlacementConfig = { ...DEFAULT_PLACEMENT, ...config };
  const enemyIds: EntityId[] = [];
  const itemIds: EntityId[] = [];
  const propIds: EntityId[] = [];
  const depth = cfg.depth || 1;

  const depthTable = getTableForDepth(depth);
  const lootTable = getLootForDepth(depth);
  const bandConfig = getDepthBand(depth);

  const enemiesPerRoom = depthTable ? depthTable.enemiesPerRoom : cfg.enemiesPerRoom;
  const spawnedCountPerTemplate: Record<string, number> = {};

  let playerId: EntityId = -1;

  if (!cfg.skipPlayer) {
    // Place player at spawn room center
    const playerOverrides = {
      ...cfg.playerOverrides,
      position: { x: spawnRoom.centerX, y: spawnRoom.centerY } as unknown as Record<
        string,
        unknown
      >,
    };

    playerId = factory.create(world, 'player', componentRegistry, playerOverrides);
    grid.addEntity(playerId, spawnRoom.centerX, spawnRoom.centerY);
  } else {
    // Find player ID if skipped
    const actors = world.query(Actor);
    for (const id of actors) {
      if (world.getComponent(id, Actor)?.isPlayer) {
        playerId = id;
        break;
      }
    }
  }

  const occupiedPropPositions = new Set<string>();
  occupiedPropPositions.add(`${spawnRoom.centerX},${spawnRoom.centerY}`);

  const vaultBoundsList = cfg.vaultFaradayBounds || [];
  const isInsideAnyVault = (x: number, y: number) => {
    return vaultBoundsList.some(
      (b) => x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height,
    );
  };
  const isVaultDoorTile = (x: number, y: number) => {
    return vaultBoundsList.some((b) => b.doorX === x && b.doorY === y);
  };
  const guaranteedAnchorCoords = new Set(
    (cfg.propAnchors || [])
      .filter((a) => a.guaranteedTemplate)
      .map((a) => `${a.x},${a.y}`),
  );

  const findSafeRoomTile = (targetRoom: Room): { x: number; y: number } => {
    const isSafe = (x: number, y: number) =>
      grid.isWalkable(x, y) &&
      !isInsideAnyVault(x, y) &&
      !isVaultDoorTile(x, y) &&
      !guaranteedAnchorCoords.has(`${x},${y}`) &&
      !occupiedPropPositions.has(`${x},${y}`);

    if (isSafe(targetRoom.centerX, targetRoom.centerY)) {
      return { x: targetRoom.centerX, y: targetRoom.centerY };
    }

    let bestPos: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (let y = targetRoom.y - 1; y <= targetRoom.y + targetRoom.height; y++) {
      for (let x = targetRoom.x - 1; x <= targetRoom.x + targetRoom.width; x++) {
        if (grid.inBounds(x, y) && isSafe(x, y)) {
          const dist = Math.abs(x - targetRoom.centerX) + Math.abs(y - targetRoom.centerY);
          if (dist < bestDist) {
            bestDist = dist;
            bestPos = { x, y };
          }
        }
      }
    }
    if (bestPos) return bestPos;

    for (const r of rooms) {
      if (r === spawnRoom) continue;
      for (let y = r.y; y < r.y + r.height; y++) {
        for (let x = r.x; x < r.x + r.width; x++) {
          if (isSafe(x, y)) return { x, y };
        }
      }
    }
    return { x: targetRoom.centerX, y: targetRoom.centerY };
  };

  // Find furthest room for staircase (D-03), preferring non-vault rooms
  const nonVaultRooms = rooms.filter(
    (r) =>
      r !== spawnRoom &&
      !cfg.bespokeRooms?.some(
        (br) => br.isVaultRoom && br.room.centerX === r.centerX && br.room.centerY === r.centerY,
      ),
  );
  const stairCandidateRooms = nonVaultRooms.length > 0 ? nonVaultRooms : rooms.filter((r) => r !== spawnRoom);

  let furthestRoom = stairCandidateRooms[0] ?? rooms[0];
  let maxDist = -1;
  for (const room of stairCandidateRooms) {
    const dx = room.centerX - spawnRoom.centerX;
    const dy = room.centerY - spawnRoom.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDist) {
      maxDist = dist;
      furthestRoom = room;
    }
  }

  // Place staircase if not on last floor
  if (depth < depthConfig.maxFloor) {
    const stairPos = findSafeRoomTile(furthestRoom);
    const staircaseId = factory.create(world, 'staircase', componentRegistry, {
      position: { x: stairPos.x, y: stairPos.y },
      staircaseMarker: { targetFloor: depth + 1 },
      sprite: { key: 'staircase' },
    });
    grid.addEntity(staircaseId, stairPos.x, stairPos.y);
    occupiedPropPositions.add(`${stairPos.x},${stairPos.y}`);
  }

  // Place Anchor on floors 5, 10, 15 (D-15)
  let anchorRoom: Room | undefined;
  if (depth % 5 === 0 && depth > 0) {
    const candidateRooms = stairCandidateRooms.filter((r) => r !== furthestRoom);
    const pool = candidateRooms.length > 0 ? candidateRooms : rooms.filter((r) => r !== spawnRoom && r !== furthestRoom);
    if (pool.length > 0) {
      anchorRoom = pool[Math.floor(rng.random() * pool.length)];
      const anchorPos = findSafeRoomTile(anchorRoom);
      const anchorId = factory.create(world, 'anchor', componentRegistry, {
        position: { x: anchorPos.x, y: anchorPos.y },
        anchorMarker: { used: false },
        sprite: { key: 'anchor' },
      });
      grid.addEntity(anchorId, anchorPos.x, anchorPos.y);
      occupiedPropPositions.add(`${anchorPos.x},${anchorPos.y}`);
    }
  }

  // Place enemies and loose floor items in non-spawn rooms
  for (const room of rooms) {
    if (room === spawnRoom) continue;

    // Special Room handling (D-25)
    let isTreasureRoom = false;
    let isChallengeRoom = false;
    if (room !== furthestRoom && room !== anchorRoom && bandConfig) {
      const roll = rng.random();
      if (roll < bandConfig.specialRoomProbability.treasure) {
        isTreasureRoom = true;
      } else if (
        roll <
        bandConfig.specialRoomProbability.treasure + bandConfig.specialRoomProbability.challenge
      ) {
        isChallengeRoom = true;
      }
    }

    // Collect walkable positions in this room (excluding positions already occupied)
    const walkablePositions = getWalkablePositions(grid, room);

    // Spawn enemies (None in treasure rooms)
    if (!isTreasureRoom) {
      let enemyCount = randomIntRange(rng, enemiesPerRoom.min, enemiesPerRoom.max);
      if (isChallengeRoom) {
        enemyCount = Math.floor(enemyCount * 1.5) + 1;
      }

      for (let i = 0; i < enemyCount && walkablePositions.length > 0; i++) {
        const entry = depthTable
          ? selectWeightedTemplate(depthTable.templates, rng)
          : {
              name: cfg.enemyTemplates[Math.floor(rng.random() * cfg.enemyTemplates.length)],
              weight: 1,
            };

        if (!entry) continue;

        // Check maxPerFloor constraint
        if (entry.maxPerFloor !== undefined) {
          const currentCount = spawnedCountPerTemplate[entry.name] || 0;
          if (currentCount >= entry.maxPerFloor) continue;
        }

        // Check minDistanceFromPlayer constraint
        if (entry.minDistanceFromPlayer !== undefined) {
          const dx = Math.abs(room.centerX - spawnRoom.centerX);
          const dy = Math.abs(room.centerY - spawnRoom.centerY);
          const dist = dx + dy; // Manhattan distance
          if (dist < entry.minDistanceFromPlayer) continue;
        }

        if (entry.isPack) {
          const packSize = randomIntRange(rng, entry.packSize?.min || 1, entry.packSize?.max || 1);
          const packId = `pack-${room.x}-${room.y}`;

          for (let p = 0; p < packSize && walkablePositions.length > 0; p++) {
            const posIdx = Math.floor(rng.random() * walkablePositions.length);
            const pos = walkablePositions.splice(posIdx, 1)[0];

            const enemyId = factory.create(world, entry.name, componentRegistry, {
              position: { x: pos.x, y: pos.y },
              packMember: { packId, isLeader: p === 0 },
            });
            grid.addEntity(enemyId, pos.x, pos.y);
            enemyIds.push(enemyId);
            spawnedCountPerTemplate[entry.name] = (spawnedCountPerTemplate[entry.name] || 0) + 1;
          }
        } else {
          const posIdx = Math.floor(rng.random() * walkablePositions.length);
          const pos = walkablePositions.splice(posIdx, 1)[0];

          const enemyId = factory.create(world, entry.name, componentRegistry, {
            position: { x: pos.x, y: pos.y },
          });
          grid.addEntity(enemyId, pos.x, pos.y);
          enemyIds.push(enemyId);
          spawnedCountPerTemplate[entry.name] = (spawnedCountPerTemplate[entry.name] || 0) + 1;
        }
      }
    }

    // Spawn loose floor items
    const itemCount = isTreasureRoom
      ? randomIntRange(rng, 2, 3)
      : randomIntRange(rng, cfg.itemsPerRoom.min, cfg.itemsPerRoom.max);

    for (let i = 0; i < itemCount && walkablePositions.length > 0; i++) {
      const posIdx = Math.floor(rng.random() * walkablePositions.length);
      const pos = walkablePositions.splice(posIdx, 1)[0];

      const templateName =
        lootTable && rng.random() > 0.3 // 70% chance to use depth-gated loot if available
          ? selectWeightedTemplate(lootTable, rng)?.template || cfg.itemTemplates[0]
          : cfg.itemTemplates[Math.floor(rng.random() * cfg.itemTemplates.length)];

      const itemId = factory.create(world, templateName, componentRegistry, {
        position: { x: pos.x, y: pos.y },
      });
      grid.addItem(itemId, pos.x, pos.y);
      itemIds.push(itemId);
    }
  }

  // --- Interactive Props Placement ---
  if (cfg.propAnchors && cfg.propAnchors.length > 0) {
    const faction = cfg.factionTheme || 'cyberacme';
    const condition = cfg.sectorCondition || 'NOMINAL';

    // Budget: F1-5: 6-8, F6-10: 8-10, F11-15: 10-12
    const minBudget = depth <= 5 ? 6 : depth <= 10 ? 8 : 10;
    const maxBudget = depth <= 5 ? 8 : depth <= 10 ? 10 : 12;
    const targetPropCount = randomIntRange(rng, minBudget, maxBudget);

    // 1. Guaranteed Authored Anchors (e.g., from Bespoke Rooms)
    const guaranteedAnchors = cfg.propAnchors.filter((a) => a.guaranteedTemplate);
    for (const anchor of guaranteedAnchors) {
      const posKey = `${anchor.x},${anchor.y}`;
      if (occupiedPropPositions.has(posKey)) continue;

      const template = anchor.guaranteedTemplate!.replace(/_/g, '-');
      const propId = factory.create(world, template, componentRegistry, {
        position: { x: anchor.x, y: anchor.y },
      });

      // Only the vault blast door holds a SecurityLock and Faraday bounds inside a vault so 1 Access Key opens the vault
      if (template === 'prop-vault-door' && world.hasComponent(propId, SecurityLock)) {
        const matchingBounds = findMatchingFaradayBounds(
          anchor.x,
          anchor.y,
          cfg.vaultFaradayBounds,
        );
        if (matchingBounds) {
          world.patchComponent(propId, SecurityLock, {
            faradayBounds: matchingBounds,
          });
        }
      } else if (isInsideAnyVault(anchor.x, anchor.y) && world.hasComponent(propId, SecurityLock)) {
        world.removeComponent(propId, SecurityLock);
      }

      // Roll container loot if template has Container component
      if (world.hasComponent(propId, Container)) {
        seedContainerLoot(world, propId, depth, condition, lootTable, rng);
      }

      grid.addEntity(propId, anchor.x, anchor.y);
      propIds.push(propId);
      occupiedPropPositions.add(posKey);
    }

    // 2. Reality Stabilizers on Floors 6-15 (1 base, 2 during OVERCLOCKED_GRID)
    if (depth >= 6) {
      const stabilizerCount = condition === 'OVERCLOCKED_GRID' ? 2 : 1;
      const candidateAnchors = cfg.propAnchors.filter(
        (a) =>
          !occupiedPropPositions.has(`${a.x},${a.y}`) &&
          !a.guaranteedTemplate &&
          !isInsideAnyVault(a.x, a.y) &&
          !wouldPinchWalkability(grid, a.x, a.y, occupiedPropPositions),
      );

      for (let s = 0; s < stabilizerCount && candidateAnchors.length > 0; s++) {
        const anchorIdx = Math.floor(rng.random() * candidateAnchors.length);
        const anchor = candidateAnchors.splice(anchorIdx, 1)[0];
        const posKey = `${anchor.x},${anchor.y}`;
        if (wouldPinchWalkability(grid, anchor.x, anchor.y, occupiedPropPositions)) continue;

        const stabId = factory.create(world, 'prop-stabilizer', componentRegistry, {
          position: { x: anchor.x, y: anchor.y },
        });
        grid.addEntity(stabId, anchor.x, anchor.y);
        propIds.push(stabId);
        occupiedPropPositions.add(posKey);
      }
    }

    // 3. Fill Remaining Prop Budget using Procedural Anchors
    // Balance distribution according to design spec: ~40% scavenge, ~40% tactical, ~20% hazards
    const remainingAnchors = cfg.propAnchors.filter(
      (a) =>
        !occupiedPropPositions.has(`${a.x},${a.y}`) &&
        !a.guaranteedTemplate &&
        !isInsideAnyVault(a.x, a.y),
    );

    const scavengeAnchors = remainingAnchors
      .filter(
        (a) =>
          a.anchorType === 'PROP_LOCKER_WALL' ||
          a.anchorType === 'PROP_DESK_CORNER' ||
          a.anchorType === 'CONTAINER_RARE',
      )
      .sort(() => rng.random() - 0.5);

    const tacticalAnchors = remainingAnchors
      .filter((a) => a.anchorType === 'SURFACE_TABLE_TOP')
      .sort(() => rng.random() - 0.5);

    const rareContainerAnchors = scavengeAnchors.filter(
      (a) => a.anchorType === 'CONTAINER_RARE',
    );
    const standardScavengeAnchors = scavengeAnchors.filter(
      (a) => a.anchorType !== 'CONTAINER_RARE',
    );

    const targetScavengeCount = Math.max(3, Math.round(targetPropCount * 0.45));
    const orderedAnchors: typeof remainingAnchors = [];

    // Prioritize rare container anchors first, then standard scavenge anchors
    while (orderedAnchors.length < targetScavengeCount && rareContainerAnchors.length > 0) {
      orderedAnchors.push(rareContainerAnchors.pop()!);
    }
    while (orderedAnchors.length < targetScavengeCount && standardScavengeAnchors.length > 0) {
      orderedAnchors.push(standardScavengeAnchors.pop()!);
    }

    // Interleave remaining tactical and scavenge anchors
    const remainingScavenge = [...rareContainerAnchors, ...standardScavengeAnchors];
    while (remainingScavenge.length > 0 || tacticalAnchors.length > 0) {
      if (tacticalAnchors.length > 0) orderedAnchors.push(tacticalAnchors.pop()!);
      if (remainingScavenge.length > 0) orderedAnchors.push(remainingScavenge.pop()!);
    }

    // Corruption rates: 10% F1-5, 18% F6-10, 25% F11-15
    const corruptionRate = depth <= 5 ? 0.1 : depth <= 10 ? 0.18 : 0.25;

    for (const anchor of orderedAnchors) {
      if (propIds.length >= targetPropCount) break;
      const posKey = `${anchor.x},${anchor.y}`;
      if (occupiedPropPositions.has(posKey)) continue;
      if (wouldPinchWalkability(grid, anchor.x, anchor.y, occupiedPropPositions)) continue;

      const template = pickTemplateForAnchor(anchor.anchorType, faction, rng, depth);

      const propId = factory.create(world, template, componentRegistry, {
        position: { x: anchor.x, y: anchor.y },
      });

      // Check for CorruptedNode trap
      if (
        (world.hasComponent(propId, Container) || template.includes('workstation')) &&
        rng.random() < corruptionRate
      ) {
        const traps: Array<'hud_glitch' | 'acoustic_alert' | 'thermal_dump'> = [
          'hud_glitch',
          'acoustic_alert',
          'thermal_dump',
        ];
        const trapType = traps[Math.floor(rng.random() * traps.length)];
        const corruptionLevel = Math.min(3, Math.floor(depth / 5) + 1);

        world.addComponent(propId, CorruptedNode, {
          trapType,
          corruptionLevel,
          isDisarmed: false,
          triggered: false,
          revealed: false,
        });
      }

      // Seed Container Loot with client masking
      if (world.hasComponent(propId, Container)) {
        seedContainerLoot(world, propId, depth, condition, lootTable, rng);
      }

      grid.addEntity(propId, anchor.x, anchor.y);
      propIds.push(propId);
      occupiedPropPositions.add(posKey);
    }
  }

  // 4. Guaranteed Access_Key availability whenever SecurityLock exists on floor
  const lockedPropIds = propIds.filter((id) => {
    const lock = world.getComponent(id, SecurityLock);
    return lock?.isLocked === true;
  });
  const numLocks = lockedPropIds.length;

  if (numLocks > 0) {
    // Find accessible containers (not locked, not corrupted, and not inside any locked vault room)
    const accessibleContainers = propIds.filter((id) => {
      if (
        !world.hasComponent(id, Container) ||
        world.hasComponent(id, SecurityLock) ||
        world.hasComponent(id, CorruptedNode)
      ) {
        return false;
      }
      const pos = world.getComponent(id, Position);
      if (!pos) return true;
      return !isInsideAnyVault(pos.x, pos.y);
    });

    let keysGuaranteed = 0;
    // Guarantee keys via accessible containers first
    for (const containerId of accessibleContainers) {
      if (keysGuaranteed >= numLocks) break;
      world.patchComponent(containerId, Container, { grantsAccessKey: true });
      keysGuaranteed++;
    }

    // If accessible containers are fewer than required locks, spawn item-access-key on ground in accessible rooms
    if (keysGuaranteed < numLocks) {
      const candidateRooms = rooms.slice(1).filter((r) => {
        const isBespokeVault = cfg.bespokeRooms?.some(
          (br) => br.isVaultRoom && br.room.centerX === r.centerX && br.room.centerY === r.centerY,
        );
        return !isBespokeVault;
      });

      const targetRooms = candidateRooms.length > 0 ? candidateRooms : [rooms[0]];
      let roomIdx = 0;

      while (keysGuaranteed < numLocks) {
        const room = targetRooms[roomIdx % targetRooms.length];
        roomIdx++;
        const walkable = getWalkablePositions(grid, room).filter(
          (p) =>
            !occupiedPropPositions.has(`${p.x},${p.y}`) &&
            !isInsideAnyVault(p.x, p.y) &&
            grid.getItemsAt(p.x, p.y).size === 0,
        );

        const spawnPos =
          walkable.length > 0
            ? walkable[Math.floor(rng.random() * walkable.length)]
            : findSafeRoomTile(room);

        const keyId = factory.create(world, 'item-access-key', componentRegistry, {
          position: { x: spawnPos.x, y: spawnPos.y },
        });
        grid.addItem(keyId, spawnPos.x, spawnPos.y);
        itemIds.push(keyId);
        keysGuaranteed++;
      }
    }
  }

  return { playerId, enemyIds, itemIds, propIds };
}

/**
 * Deterministically rolls loot for a container at floor gen time,
 * populating highestRarity and storedLoot while keeping itemEntityIds empty.
 */
function seedContainerLoot<T extends EngineEvents>(
  world: World<T>,
  containerEntityId: EntityId,
  depth: number,
  condition: SectorCondition,
  lootTable: LootEntry[] | undefined,
  rng: { random(): number },
) {
  let scrap =
    depth <= 5
      ? randomIntRange(rng, 5, 15)
      : depth <= 10
        ? randomIntRange(rng, 15, 35)
        : randomIntRange(rng, 30, 50);

  let flux =
    depth <= 5
      ? randomIntRange(rng, 0, 5)
      : depth <= 10
        ? randomIntRange(rng, 5, 20)
        : randomIntRange(rng, 20, 50);

  if (condition === 'OVERCLOCKED_GRID') {
    scrap = Math.floor(scrap * 1.5);
    flux = Math.floor(flux * 1.5);
  }

  const storedLoot: Array<{ templateId: string; rarityTier: 'common' | 'uncommon' | 'rare' | 'legendary' }> = [];
  let highestRarity: 'common' | 'uncommon' | 'rare' | 'legendary' = 'common';

  if (lootTable && lootTable.length > 0) {
    const rolledItemCount = randomIntRange(rng, 1, 2);
    for (let i = 0; i < rolledItemCount; i++) {
      const template = selectWeightedTemplate(lootTable, rng)?.template;
      if (template) {
        const rarity = getRarityFromTemplate(template);
        storedLoot.push({ templateId: template, rarityTier: rarity });
        if (RARITY_VALUES[rarity] > RARITY_VALUES[highestRarity]) {
          highestRarity = rarity;
        }
      }
    }
  }

  world.patchComponent(containerEntityId, Container, {
    scrapYield: scrap,
    fluxYield: flux,
    highestRarity,
    storedLoot,
    itemEntityIds: [],
  });
}

/**
 * Select a prop template based on anchor classification and floor faction.
 */
function pickTemplateForAnchor(
  anchorType: string,
  faction: FactionTheme,
  rng: { random(): number },
  depth: number = 1,
): string {
  switch (anchorType) {
    case 'PROP_DESK_CORNER':
      if (faction === 'cyberacme' && rng.random() < 0.4) {
        return 'prop-subnet-console';
      }
      return 'prop-workstation';

    case 'PROP_LOCKER_WALL':
      if (faction === 'sekiguchi') return 'prop-biocabinet';
      if (faction === 'nucaloric') return rng.random() < 0.5 ? 'prop-cooling-vent' : 'prop-locker';
      return 'prop-locker';

    case 'SURFACE_TABLE_TOP':
      if (faction === 'sekiguchi' && rng.random() < 0.4) {
        return 'prop-cryo-vat';
      }
      if (faction === 'cyberacme' && rng.random() < 0.4) {
        return 'prop-capacitor-bank';
      }
      return 'prop-crate-cover';

    case 'CONTAINER_RARE':
      if (depth < 6) {
        return faction === 'sekiguchi' ? 'prop-biocabinet' : 'prop-locker';
      }
      return 'prop-safe-locked';

    default:
      return 'prop-locker';
  }
}

/**
 * Matches a coordinate against authored vault Faraday bounds.
 */
function findMatchingFaradayBounds(
  x: number,
  y: number,
  boundsList?: FaradayBounds[],
): FaradayBounds | undefined {
  if (!boundsList || boundsList.length === 0) return undefined;
  return boundsList.find(
    (b) =>
      (b.doorX === x && b.doorY === y) ||
      (x >= b.x - 1 && x <= b.x + b.width && y >= b.y - 1 && y <= b.y + b.height),
  );
}

/**
 * Checks whether placing a blocking prop at (px, py) would pinch or disconnect adjacent walkable tiles.
 */
function wouldPinchWalkability(
  grid: Grid,
  px: number,
  py: number,
  occupiedPropPositions: Set<string>,
): boolean {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const isPassable = (x: number, y: number) =>
    grid.inBounds(x, y) &&
    grid.isWalkable(x, y) &&
    !(x === px && y === py) &&
    !occupiedPropPositions.has(`${x},${y}`);

  // Never place a procedural prop on or orthogonally adjacent to a door tile
  if (grid.getTile(px, py)?.terrain === 'door') return true;
  for (const [dx, dy] of dirs) {
    if (grid.getTile(px + dx, py + dy)?.terrain === 'door') {
      return true;
    }
  }

  const openNeighbors: Array<{ x: number; y: number }> = [];
  for (const [dx, dy] of dirs) {
    const nx = px + dx;
    const ny = py + dy;
    if (isPassable(nx, ny)) {
      openNeighbors.push({ x: nx, y: ny });
    }
  }
  if (openNeighbors.length <= 1) return false;

  // Verify all open cardinal neighbors remain mutually reachable on the grid
  const remainingTargets = new Set<string>(openNeighbors.slice(1).map((n) => `${n.x},${n.y}`));
  const start = openNeighbors[0];
  const visited = new Set<string>([`${start.x},${start.y}`]);
  const queue: Array<{ x: number; y: number }> = [start];

  while (queue.length > 0 && remainingTargets.size > 0) {
    const curr = queue.shift()!;
    for (const [dx, dy] of dirs) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      const key = `${nx},${ny}`;
      if (!visited.has(key) && isPassable(nx, ny)) {
        visited.add(key);
        remainingTargets.delete(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return remainingTargets.size > 0;
}

/**
 * Get all walkable positions within a room.
 */
function getWalkablePositions(grid: Grid, room: Room): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (grid.isWalkable(x, y)) {
        positions.push({ x, y });
      }
    }
  }
  return positions;
}

/**
 * Random integer in [min, max] inclusive.
 */
function randomIntRange(rng: { random(): number }, min: number, max: number): number {
  if (min >= max) return min;
  return min + Math.floor(rng.random() * (max - min + 1));
}
