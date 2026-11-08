/**
 * AI System (v3.0 Upgrade)
 * Evaluates Stateless Behavior Trees and Shared Dijkstra Maps for enemy actors.
 */

import PreciseShadowcasting from 'rot-js/lib/fov/precise-shadowcasting';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId, Phase } from '@engine/ecs/types';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { AIState, AIBehavior } from '@shared/components/ai-state';
import { FovAwareness } from '@shared/components/fov-awareness';
import { PackMember } from '@shared/components/pack-member';
import { StatusEffects } from '@shared/components/status-effects';
import { Health } from '@shared/components/health';
import { BlocksMovement } from '@shared/components/blocks-movement';
import { MovedThisTurn } from '@shared/components/moved-this-turn';
import { FloorState } from '@shared/components/floor-state';
import { SecurityLock, InteractiveSurface } from '@shared/components/environment';
import { Item } from '@shared/components/item';
import { CurrencyItem } from '@shared/components/currency-item';
import {
  MoveIntent,
  AttackIntent,
  TeleportIntent,
  Acting,
  ApplyStatusEffectIntent,
  AlertIntent,
  SpawnEntityIntent,
} from '@shared/components/intents';
import { GameplayEvents } from '@shared/events/types';
import { logger } from '@engine/utils/logger';
import { EntityFactory } from '@engine/entity/factory';
import { ComponentRegistry } from '@engine/entity/types';

import {
  BTStatus,
  BTEvaluationContext,
  BTNode,
} from '@engine/ai/types';
import { evaluateBehaviorTree } from '@engine/ai/behavior-tree';
import {
  AICondition,
  AIAction,
  UtilityConsideration,
  BehaviorTreeNode,
} from '@shared/components/ai-tree';
import { AIBehaviorRegistry } from '../ai/tree-registry';
import { AISpatialSystem } from '../ai/spatial-maps';

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function createDeterministicRng(seed: number | string): () => number {
  let s = typeof seed === 'number' ? seed : hashString(seed);
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createAISystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _entityFactory: EntityFactory,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _componentRegistry: ComponentRegistry,
) {
  const spatialSystem = new AISpatialSystem(world, grid);
  const alertedThisTurn = new Set<EntityId>();
  const packAlerted = new Set<EntityId>();
  let lastProcessedTurn = -1;

  let updateHandler: ((w: World<T>) => void) | null = null;

  function isPackAlerted(packId: string): boolean {
    const packMembers = world.query(PackMember, FovAwareness);
    for (const id of packMembers) {
      const memberPack = world.getComponent(id, PackMember)!;
      if (memberPack.packId !== packId) continue;
      const awareness = world.getComponent(id, FovAwareness)!;
      if (
        awareness.canSeePlayer ||
        alertedThisTurn.has(id) ||
        world.hasComponent(id, AlertIntent)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Finds the player entity in the world.
   */
  function findPlayerEntity(): { id: EntityId; x: number; y: number } | null {
    const actors = world.query(Actor, Position);
    for (const id of actors) {
      const actor = world.getComponent(id, Actor);
      if (actor?.isPlayer) {
        const pos = world.getComponent(id, Position)!;
        return { id, x: pos.x, y: pos.y };
      }
    }
    return null;
  }

  /**
   * Computes FOV for an entity using PreciseShadowcasting.
   */
  function computeEnemyFov(x: number, y: number, radius: number): Set<string> {
    const fov = new PreciseShadowcasting((tx, ty) => grid.isTransparent(tx, ty));
    const visible = new Set<string>();
    fov.compute(x, y, radius, (tx, ty, _r, visibility) => {
      if (visibility > 0) {
        visible.add(`${tx},${ty}`);
      }
    });
    return visible;
  }

  /**
   * Checks if two positions are adjacent (Manhattan distance <= 1).
   */
  function isAdjacent(x1: number, y1: number, x2: number, y2: number): boolean {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }

  /**
   * Finds a valid, Faraday-shield-safe ambush tile behind the player.
   */
  function findValidAmbushTile(
    pos: { x: number; y: number },
    player: { id: EntityId; x: number; y: number },
    minRange: number,
    maxRange: number,
    searchRadius: number = 3,
  ): { x: number; y: number } | null {
    // 1. Calculate facing / behind vector
    const playerMoved = world.getComponent(player.id, MovedThisTurn);
    let behindDx = 0;
    let behindDy = 0;

    if (playerMoved && (playerMoved.toX !== playerMoved.fromX || playerMoved.toY !== playerMoved.fromY)) {
      const mdx = Math.sign(playerMoved.toX - playerMoved.fromX);
      const mdy = Math.sign(playerMoved.toY - playerMoved.fromY);
      behindDx = -mdx;
      behindDy = -mdy;
    } else {
      behindDx = Math.sign(player.x - pos.x);
      behindDy = Math.sign(player.y - pos.y);
    }

    const targetX = player.x + behindDx;
    const targetY = player.y + behindDy;

    // 2. Query active Faraday shield bounds protecting Zero-Day Vaults
    const faradayShields: Array<{ x: number; y: number; width: number; height: number }> = [];
    const locks = world.query(SecurityLock);
    for (const lockId of locks) {
      const lock = world.getComponent(lockId, SecurityLock);
      if (lock && lock.isLocked && lock.faradayBounds) {
        faradayShields.push(lock.faradayBounds);
      }
    }

    // 3. Search candidate tiles in concentric rings
    for (let r = 0; r <= searchRadius; r++) {
      for (let tx = -r; tx <= r; tx++) {
        for (let ty = -r; ty <= r; ty++) {
          if (Math.abs(tx) + Math.abs(ty) !== r) continue;

          const cx = targetX + tx;
          const cy = targetY + ty;

          if (!grid.inBounds(cx, cy)) continue;
          if (!grid.isWalkable(cx, cy)) continue;
          if (grid.getEntitiesAt(cx, cy).size > 0) continue;

          // Range check from self to candidate tile
          const distToCandidate = Math.abs(cx - pos.x) + Math.abs(cy - pos.y);
          if (distToCandidate < minRange || distToCandidate > maxRange) continue;

          // Faraday shield bounds check
          const insideFaraday = faradayShields.some(
            (b) => cx >= b.x && cx < b.x + b.width && cy >= b.y && cy < b.y + b.height,
          );
          if (insideFaraday) continue;

          return { x: cx, y: cy };
        }
      }
    }

    return null;
  }

  return {
    getSpatialSystem(): AISpatialSystem<T> {
      return spatialSystem;
    },

    update(w: World<T>): void {
      const floorStates = w.query(FloorState);
      const floor = floorStates.length > 0 ? w.getComponent(floorStates[0], FloorState) : null;
      const turnNumber = floor?.turnNumber ?? 0;

      if (turnNumber !== lastProcessedTurn) {
        lastProcessedTurn = turnNumber;
        alertedThisTurn.clear();
        packAlerted.clear();
      }

      // 1. Process pending AlertIntents
      const alertedEntities = w.query(AlertIntent);
      for (const id of alertedEntities) {
        const alert = w.getComponent(id, AlertIntent)!;
        alertedThisTurn.add(id);
        if (w.hasComponent(id, FovAwareness)) {
          w.patchComponent(id, FovAwareness, {
            canSeePlayer: true,
            lastKnownPlayerX: alert.sourceX,
            lastKnownPlayerY: alert.sourceY,
          });
        }
        if (w.hasComponent(id, AIState)) {
          w.patchComponent(id, AIState, {
            behavior: AIBehavior.CHASING,
            remainingMemoryTurns: 5,
          });
        }
        w.removeComponent(id, AlertIntent);
      }

      const actingEntities = w.query(Acting, AIState);
      for (const entityId of actingEntities) {
        this.processEnemyTurn(entityId);
      }
    },

    /**
     * Stateless Behavior Tree evaluation for a single enemy turn.
     */
    processEnemyTurn(entityId: EntityId): void {
      const pos = world.getComponent(entityId, Position);
      const ai = world.getComponent(entityId, AIState);
      const awareness = world.getComponent(entityId, FovAwareness);

      if (!pos || !ai || !awareness) return;

      const player = findPlayerEntity();
      if (!player) return;

      const floorStates = world.query(FloorState);
      const floor = floorStates.length > 0 ? world.getComponent(floorStates[0], FloorState) : null;
      const turnNumber = floor?.turnNumber ?? 0;

      spatialSystem.resetTurnCache(turnNumber, player.x, player.y);

      // Consume AlertIntent if attached directly to this entity
      if (world.hasComponent(entityId, AlertIntent)) {
        const alert = world.getComponent(entityId, AlertIntent)!;
        alertedThisTurn.add(entityId);
        world.patchComponent(entityId, FovAwareness, {
          canSeePlayer: true,
          lastKnownPlayerX: alert.sourceX,
          lastKnownPlayerY: alert.sourceY,
        });
        world.patchComponent(entityId, AIState, {
          behavior: AIBehavior.CHASING,
          remainingMemoryTurns: 5,
        });
        world.removeComponent(entityId, AlertIntent);
      }

      const packMember = world.getComponent(entityId, PackMember);
      const packIsAlerted = packMember ? isPackAlerted(packMember.packId) : false;
      if (packIsAlerted) {
        packAlerted.add(entityId);
      }

      // Decrement server cooldown timers at start of turn
      const cooldowns = { ...(ai.cooldowns ?? {}) };
      for (const [key, val] of Object.entries(cooldowns)) {
        if (val > 0) {
          cooldowns[key] = val - 1;
        }
      }
      world.patchComponent(entityId, AIState, { cooldowns });

      // 1. Update FOV awareness
      const visibleTiles = computeEnemyFov(pos.x, pos.y, ai.sightRadius ?? 6);
      const playerKey = `${player.x},${player.y}`;
      const isVisibleInFov = visibleTiles.has(playerKey);
      const canSeePlayer = isVisibleInFov || alertedThisTurn.has(entityId) || packIsAlerted;

      let remainingMemory = ai.remainingMemoryTurns ?? 0;
      if (isVisibleInFov) {
        remainingMemory = ai.memoryTurns ?? 5;
        world.patchComponent(entityId, FovAwareness, {
          canSeePlayer: true,
          lastKnownPlayerX: player.x,
          lastKnownPlayerY: player.y,
        });
      } else {
        if (remainingMemory > 0) {
          remainingMemory--;
        }
        world.patchComponent(entityId, FovAwareness, {
          canSeePlayer,
        });
      }
      world.patchComponent(entityId, AIState, { remainingMemoryTurns: remainingMemory });

      // 2. Resolve Behavior Tree AST
      let tree: BehaviorTreeNode | undefined = ai.inlineTree;
      if (!tree && ai.treeId) {
        tree = AIBehaviorRegistry.getTree(ai.treeId);
      }
      if (!tree && ai.behaviorType) {
        tree = AIBehaviorRegistry.getTree(ai.behaviorType);
      }
      if (!tree) {
        tree = AIBehaviorRegistry.getTree('basic');
      }
      if (!tree) {
        logger.error(`No behavior tree found for entity ${entityId}`, 'AI');
        return;
      }

      // 3. Construct deterministic PRNG
      const seedStr = `${floor?.runSeed ?? 'ai_seed'}_${floor?.turnNumber ?? 0}_${entityId}`;
      const rng = createDeterministicRng(seedStr);

      // 4. Construct BTEvaluationContext
      const ctx: BTEvaluationContext<
        BTNode<AICondition, AIAction, UtilityConsideration['metric']>,
        AICondition,
        AIAction,
        UtilityConsideration['metric']
      > = {
        evaluateCondition: (cond: AICondition): boolean => {
          const updatedAwareness = world.getComponent(entityId, FovAwareness) ?? awareness;
          const updatedAi = world.getComponent(entityId, AIState) ?? ai;

          switch (cond.check) {
            case 'CAN_SEE_TARGET':
              return updatedAwareness.canSeePlayer;

            case 'HAS_LAST_KNOWN_TARGET_POS':
              return (
                updatedAwareness.lastKnownPlayerX !== undefined &&
                updatedAwareness.lastKnownPlayerY !== undefined &&
                (updatedAi.remainingMemoryTurns ?? 0) > 0
              );

            case 'IS_ALERTED':
              return (
                alertedThisTurn.has(entityId) ||
                packAlerted.has(entityId) ||
                updatedAwareness.canSeePlayer
              );

            case 'TARGET_DISTANCE_LTE': {
              const dist =
                cond.metric === 'chebyshev'
                  ? Math.max(Math.abs(pos.x - player.x), Math.abs(pos.y - player.y))
                  : Math.abs(pos.x - player.x) + Math.abs(pos.y - player.y);
              return dist <= cond.distance;
            }

            case 'TARGET_DISTANCE_GTE': {
              const dist =
                cond.metric === 'chebyshev'
                  ? Math.max(Math.abs(pos.x - player.x), Math.abs(pos.y - player.y))
                  : Math.abs(pos.x - player.x) + Math.abs(pos.y - player.y);
              return dist >= cond.distance;
            }

            case 'TARGET_DISTANCE_BETWEEN': {
              const dist =
                cond.metric === 'chebyshev'
                  ? Math.max(Math.abs(pos.x - player.x), Math.abs(pos.y - player.y))
                  : Math.abs(pos.x - player.x) + Math.abs(pos.y - player.y);
              return dist >= cond.min && dist <= cond.max;
            }

            case 'SELF_HP_BELOW_PERCENT': {
              const health = world.getComponent(entityId, Health);
              if (!health || health.max <= 0) return false;
              return (health.current / health.max) * 100 <= cond.percent;
            }

            case 'HAS_STATUS_EFFECT': {
              const targetId = cond.target === 'target' ? player.id : entityId;
              const status = world.getComponent(targetId, StatusEffects);
              return status ? status.effects.some((e) => e.name === cond.statusName) : false;
            }

            case 'IS_PACK_LEADER': {
              const pack = world.getComponent(entityId, PackMember);
              return pack ? pack.isLeader === true : false;
            }

            case 'PACK_MEMBERS_ADJACENT_GTE': {
              const pack = world.getComponent(entityId, PackMember);
              if (!pack) return false;
              let adjacentCount = 0;
              const dirs = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ];
              for (const [dx, dy] of dirs) {
                const nx = pos.x + dx;
                const ny = pos.y + dy;
                const eids = grid.getEntitiesAt(nx, ny);
                for (const eid of eids) {
                  const m = world.getComponent(eid, PackMember);
                  if (m && m.packId === pack.packId) {
                    adjacentCount++;
                  }
                }
              }
              return adjacentCount >= cond.count;
            }

            case 'IN_DIRECTIONAL_COVER_FROM_TARGET': {
              // Checks if cover prop exists between self and player
              const dist = Math.abs(pos.x - player.x) + Math.abs(pos.y - player.y);
              const dirs = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ];
              for (const [dx, dy] of dirs) {
                const nx = pos.x + dx;
                const ny = pos.y + dy;
                const nDist = Math.abs(nx - player.x) + Math.abs(ny - player.y);
                if (nDist < dist) {
                  const eids = grid.getEntitiesAt(nx, ny);
                  for (const eid of eids) {
                    const surface = world.getComponent(eid, InteractiveSurface);
                    if (surface && surface.providesCover !== false) {
                      return true;
                    }
                  }
                }
              }
              return false;
            }

            case 'HAS_VALID_TELEPORT_AMBUSH_TILE': {
              const tile = findValidAmbushTile(pos, player, cond.minRange, cond.maxRange, 3);
              return tile !== null;
            }

            default:
              return false;
          }
        },

        executeAction: (action: AIAction): BTStatus => {
          switch (action.action) {
            case 'WAIT': {
              if (action.message) {
                eventBus.emit('MESSAGE_EMITTED', { text: action.message, type: 'combat' });
              }
              return BTStatus.SUCCESS;
            }

            case 'MELEE_BUMP_TARGET': {
              const dx = player.x - pos.x;
              const dy = player.y - pos.y;
              world.addComponent(entityId, MoveIntent, { dx, dy });
              world.patchComponent(entityId, AIState, { behavior: AIBehavior.ATTACKING });
              return BTStatus.SUCCESS;
            }

            case 'RANGED_ATTACK_TARGET': {
              world.addComponent(entityId, AttackIntent, { targetId: player.id });
              if (action.statusEffect) {
                world.addComponent(entityId, ApplyStatusEffectIntent, {
                  targetId: player.id,
                  effect: action.statusEffect,
                });
              }
              if (action.combatMessage) {
                eventBus.emit('MESSAGE_EMITTED', { text: action.combatMessage, type: 'combat' });
              }
              world.patchComponent(entityId, AIState, { behavior: AIBehavior.ATTACKING });
              return BTStatus.SUCCESS;
            }

            case 'MOVE_DIJKSTRA': {
              let map;
              const avoidHazards = action.avoidHazards !== false;

              switch (action.mapType) {
                case 'approach_target':
                  map = spatialSystem.getApproachTargetMap(
                    player.x,
                    player.y,
                    avoidHazards,
                    action.canCrushProps,
                  );
                  break;
                case 'flee_from_target':
                  map = spatialSystem.getFleeFromTargetMap(player.x, player.y, avoidHazards);
                  break;
                case 'kite_to_cover':
                  map = spatialSystem.getKiteToCoverMap(
                    player.x,
                    player.y,
                    avoidHazards,
                    action.optimalRangeMin ?? 3,
                    action.optimalRangeMax ?? 5,
                  );
                  break;
                case 'pack_surround_cardinal':
                  map = spatialSystem.getPackSurroundCardinalMap(player.x, player.y, avoidHazards);
                  break;
                case 'scavenge_nearest_loot':
                  map = spatialSystem.getScavengeLootMap(avoidHazards);
                  break;
                case 'patrol_anchors':
                  map = spatialSystem.getPatrolAnchorsMap(avoidHazards);
                  break;
                case 'investigate_last_known': {
                  const updatedAwareness = world.getComponent(entityId, FovAwareness) ?? awareness;
                  if (
                    updatedAwareness.lastKnownPlayerX === undefined ||
                    updatedAwareness.lastKnownPlayerY === undefined
                  ) {
                    return BTStatus.FAILURE;
                  }
                  map = spatialSystem.getInvestigateLastKnownMap(
                    updatedAwareness.lastKnownPlayerX,
                    updatedAwareness.lastKnownPlayerY,
                    avoidHazards,
                  );
                  break;
                }
                default:
                  map = spatialSystem.getApproachTargetMap(
                    player.x,
                    player.y,
                    avoidHazards,
                    action.canCrushProps,
                  );
                  break;
              }

              // Dynamic penalty for neighbor allies and props
              const dynamicPenaltyFn = (nx: number, ny: number): number => {
                const occupants = grid.getEntitiesAt(nx, ny);
                for (const eid of occupants) {
                  if (eid === player.id || eid === entityId) continue;

                  if (action.canCrushProps) {
                    const surface = world.getComponent(eid, InteractiveSurface);
                    const health = world.getComponent(eid, Health);
                    if (surface && surface.destructible !== false && health && health.isAlive !== false) {
                      return 0.1; // Crushable obstacle: small penalty so open tile is preferred if tied, but rolls downhill
                    }
                  }

                  if (world.hasComponent(eid, BlocksMovement)) {
                    return Infinity; // Impassable obstacle / ally: cannot step into occupied tile
                  }
                }
                return 0.0;
              };

              const step = map.getBestStep(pos.x, pos.y, dynamicPenaltyFn, rng);
              if (!step) {
                return BTStatus.FAILURE;
              }

              if (step.dx === 0 && step.dy === 0) {
                return BTStatus.FAILURE;
              }

              const nextX = pos.x + step.dx;
              const nextY = pos.y + step.dy;

              // Prop crushing: if target tile has destructible cover, emit AttackIntent on prop
              if (action.canCrushProps) {
                const occupants = grid.getEntitiesAt(nextX, nextY);
                for (const eid of occupants) {
                  const surface = world.getComponent(eid, InteractiveSurface);
                  const health = world.getComponent(eid, Health);
                  if (surface && surface.destructible !== false && health && health.isAlive !== false) {
                    world.addComponent(entityId, AttackIntent, { targetId: eid });
                    if (action.combatMessage) {
                      eventBus.emit('MESSAGE_EMITTED', { text: action.combatMessage, type: 'combat' });
                    }
                    return BTStatus.SUCCESS;
                  }
                }
              }

              if (action.mapType === 'pack_surround_cardinal') {
                spatialSystem.reservePackTile(nextX, nextY);
              }

              world.addComponent(entityId, MoveIntent, { dx: step.dx, dy: step.dy });
              world.patchComponent(entityId, AIState, { behavior: AIBehavior.CHASING });
              if (action.combatMessage) {
                eventBus.emit('MESSAGE_EMITTED', { text: action.combatMessage, type: 'combat' });
              }
              return BTStatus.SUCCESS;
            }

            case 'TELEPORT_AMBUSH_BEHIND_TARGET': {
              const ambushTile = findValidAmbushTile(
                pos,
                player,
                action.minRange,
                action.maxRange,
                action.searchRadius,
              );

              if (ambushTile) {
                world.addComponent(entityId, TeleportIntent, { x: ambushTile.x, y: ambushTile.y });
                if (action.combatMessage) {
                  eventBus.emit('MESSAGE_EMITTED', { text: action.combatMessage, type: 'combat' });
                }
                world.patchComponent(entityId, AIState, { behavior: AIBehavior.CHASING });
                return BTStatus.SUCCESS;
              }
              return BTStatus.FAILURE;
            }

            case 'SPAWN_ENTITIES_AROUND_SELF': {
              const patternOffsets =
                action.pattern === 'cardinal_4'
                  ? [
                      [1, 0],
                      [-1, 0],
                      [0, 1],
                      [0, -1],
                    ]
                  : [
                      [0, 3],
                      [0, -3],
                      [3, 0],
                      [-3, 0],
                    ];

              const spawns: Array<{
                templateName: string;
                x: number;
                y: number;
                overrides?: Record<string, Record<string, unknown>>;
              }> = [];

              const maxCount = action.count ?? patternOffsets.length;

              for (const [dx, dy] of patternOffsets) {
                if (spawns.length >= maxCount) break;
                const tx = pos.x + dx;
                const ty = pos.y + dy;
                if (grid.inBounds(tx, ty) && grid.isWalkable(tx, ty)) {
                  spawns.push({
                    templateName: action.templateName,
                    x: tx,
                    y: ty,
                    overrides: action.deadZoneConfig
                      ? { deadZone: { ...action.deadZoneConfig, creatorId: entityId } }
                      : undefined,
                  });
                }
              }

              if (spawns.length > 0) {
                world.addComponent(entityId, SpawnEntityIntent, {
                  spawnerId: entityId,
                  spawns,
                });
              }

              // Bump player if adjacent
              if (isAdjacent(pos.x, pos.y, player.x, player.y)) {
                world.addComponent(entityId, MoveIntent, {
                  dx: player.x - pos.x,
                  dy: player.y - pos.y,
                });
              }

              if (action.combatMessage) {
                eventBus.emit('MESSAGE_EMITTED', { text: action.combatMessage, type: 'combat' });
              }
              return BTStatus.SUCCESS;
            }

            default:
              return BTStatus.FAILURE;
          }
        },

        resolveSubtree: (ref: string) => {
          return AIBehaviorRegistry.getSubtree(ref) as
            | BTNode<AICondition, AIAction, UtilityConsideration['metric']>
            | undefined;
        },

        getConsiderationInput: (metric: UtilityConsideration['metric']): number => {
          switch (metric) {
            case 'self_hp_ratio': {
              const health = world.getComponent(entityId, Health);
              return health && health.max > 0 ? health.current / health.max : 1.0;
            }
            case 'target_distance': {
              const dist = Math.abs(pos.x - player.x) + Math.abs(pos.y - player.y);
              return Math.min(1.0, dist / 10);
            }
            case 'target_visible': {
              const updatedAwareness = world.getComponent(entityId, FovAwareness) ?? awareness;
              return updatedAwareness.canSeePlayer ? 1.0 : 0.0;
            }
            case 'pack_adjacent_count': {
              const pack = world.getComponent(entityId, PackMember);
              if (!pack) return 0.0;
              let count = 0;
              const dirs = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ];
              for (const [dx, dy] of dirs) {
                const nx = pos.x + dx;
                const ny = pos.y + dy;
                const eids = grid.getEntitiesAt(nx, ny);
                for (const eid of eids) {
                  const m = world.getComponent(eid, PackMember);
                  if (m && m.packId === pack.packId) count++;
                }
              }
              return Math.min(1.0, count / 4);
            }
            case 'nearby_loot_value': {
              const sightRadius = ai.sightRadius ?? 10;
              let totalValue = 0;
              for (const itemId of world.query(Position, Item)) {
                const ip = world.getComponent(itemId, Position);
                if (ip && Math.abs(ip.x - pos.x) + Math.abs(ip.y - pos.y) <= sightRadius) {
                  totalValue += 10;
                }
              }
              for (const currId of world.query(Position, CurrencyItem)) {
                const cp = world.getComponent(currId, Position);
                if (cp && Math.abs(cp.x - pos.x) + Math.abs(cp.y - pos.y) <= sightRadius) {
                  const c = world.getComponent(currId, CurrencyItem);
                  totalValue += c?.amount ?? 5;
                }
              }
              return Math.min(1.0, totalValue / 50);
            }
            case 'in_cover': {
              return ctx.evaluateCondition({ check: 'IN_DIRECTIONAL_COVER_FROM_TARGET' }) ? 1.0 : 0.0;
            }
            default:
              return 0.5;
          }
        },

        isCooldownReady: (cooldownId: string): boolean => {
          const updatedAi = world.getComponent(entityId, AIState) ?? ai;
          return (updatedAi.cooldowns?.[cooldownId] ?? 0) <= 0;
        },

        startCooldown: (cooldownId: string, turns: number): void => {
          const updatedAi = world.getComponent(entityId, AIState) ?? ai;
          const updatedCooldowns = { ...(updatedAi.cooldowns ?? {}), [cooldownId]: turns };
          world.patchComponent(entityId, AIState, { cooldowns: updatedCooldowns });
        },

        random: rng,
        recordTrace: (step: string) => {
          executionTrace.push(step);
        },
      };

      const executionTrace: string[] = [];

      // 5. Evaluate tree
      evaluateBehaviorTree(
        tree as unknown as BTNode<AICondition, AIAction, UtilityConsideration['metric']>,
        ctx,
      );

      if (executionTrace.length > 0) {
        const lastEvaluatedPath = ['root', ...executionTrace].join(' > ');
        world.patchComponent(entityId, AIState, { lastEvaluatedPath });
      }

      // 6. Posture update for HUD tooltips and inspector
      const finalAwareness = world.getComponent(entityId, FovAwareness) ?? awareness;
      const finalAi = world.getComponent(entityId, AIState) ?? ai;
      const adjacent = isAdjacent(pos.x, pos.y, player.x, player.y);

      if (finalAwareness.canSeePlayer) {
        if (adjacent) {
          world.patchComponent(entityId, AIState, { behavior: AIBehavior.ATTACKING });
        } else if (finalAi.behavior !== AIBehavior.ATTACKING) {
          world.patchComponent(entityId, AIState, { behavior: AIBehavior.CHASING });
        }
      } else if ((finalAi.remainingMemoryTurns ?? 0) === 0) {
        world.patchComponent(entityId, AIState, { behavior: AIBehavior.IDLE });
      }
    },

    // Backward-compatibility delegators for unit tests
    processBasicTurn(entityId: EntityId): void {
      this.processEnemyTurn(entityId);
    },
    processNullPointerTurn(entityId: EntityId): void {
      this.processEnemyTurn(entityId);
    },
    processBufferOverflowTurn(entityId: EntityId): void {
      this.processEnemyTurn(entityId);
    },
    processFragmenterTurn(entityId: EntityId): void {
      this.processEnemyTurn(entityId);
    },
    processLogicLeakerTurn(entityId: EntityId): void {
      this.processEnemyTurn(entityId);
    },
    processSystemAdminTurn(entityId: EntityId): void {
      this.processEnemyTurn(entityId);
    },
    processSeedEaterTurn(entityId: EntityId): void {
      this.processEnemyTurn(entityId);
    },

    init() {
      updateHandler = (w: World<T>) => this.update(w);
      world.registerSystem(Phase.GATHER_INTENT, updateHandler, 'AISystem');
    },
    dispose() {
      if (updateHandler) {
        world.unregisterSystem(Phase.GATHER_INTENT, updateHandler);
        updateHandler = null;
      }
    },
  };
}

export type AISystem<T extends GameplayEvents = GameplayEvents> = ReturnType<
  typeof createAISystem<T>
>;
