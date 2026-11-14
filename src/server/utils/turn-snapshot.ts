/**
 * Structured turn snapshot capture and redacted preview generator for server crashes.
 * Captured synchronously before turn rollbacks to guarantee ECS fidelity.
 */

import { World } from '@engine/ecs/world';
import { TurnManager } from '@engine/turn/turn-manager';
import { EntityId } from '@engine/ecs/types';
import { EngineEvents } from '@engine/events/types';
import {
  Position,
  Health,
  Heat,
  Stability,
  Energy,
  Shell,
  FloorState,
  RunInventory,
  Actor,
  AIState,
} from '@shared/components';
import { computeCrashFingerprint } from '@/shared/reports/fingerprint';
import type { CrashDraftOffer, RedactedCrashPreview } from '@/shared/reports/schemas';
import { draftStore } from '@/server/reports/draft-store';

export interface TurnErrorContext<TEvents extends EngineEvents = EngineEvents> {
  sessionId: string;
  action: unknown;
  playerId: EntityId;
  world: World<TEvents>;
  turnManager: TurnManager<TEvents>;
  error: unknown;
  source?: 'SERVER_TURN' | 'SERVER_5XX';
  mode?: string;
}

export interface TurnSnapshotData {
  timestamp: string;
  sessionId: string;
  action: unknown;
  actionType: string;
  turn: number;
  phase: string;
  isPaused: boolean;
  floor: number;
  runSeed: number | string;
  sectorCondition: string;
  player: {
    id: number;
    pos?: { x: number; y: number };
    health?: { current: number; max: number; isAlive: boolean };
    heat?: { current: number; maxSafe: number };
    stability?: { current: number; max: number };
    energy?: { current: number; speed: number };
    shell?: string;
    inventory?: { softwareCount: number; equipmentCount: number };
    componentKeys: string[];
  };
  livingEnemies: Array<{
    id: number;
    pos?: { x: number; y: number };
    hp?: number;
    maxHp?: number;
    energy?: number;
    behavior?: string;
  }>;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Builds a structured, complete snapshot of the game and turn state prior to rollback.
 */
export function buildTurnSnapshot<TEvents extends EngineEvents = EngineEvents>(
  ctx: TurnErrorContext<TEvents>
): TurnSnapshotData {
  const timestamp = new Date().toISOString();
  const errorObj = ctx.error instanceof Error ? ctx.error : new Error(String(ctx.error));

  // Player Component Snapshot
  const playerComponents = ctx.world.getEntityComponents(ctx.playerId);
  const playerPos = ctx.world.getComponent(ctx.playerId, Position);
  const playerHealth = ctx.world.getComponent(ctx.playerId, Health);
  const playerHeat = ctx.world.getComponent(ctx.playerId, Heat);
  const playerStability = ctx.world.getComponent(ctx.playerId, Stability);
  const playerEnergy = ctx.world.getComponent(ctx.playerId, Energy);
  const playerShell = ctx.world.getComponent(ctx.playerId, Shell);
  const floorState = ctx.world.getComponent(ctx.playerId, FloorState);
  const inventory = ctx.world.getComponent(ctx.playerId, RunInventory);

  // Active Living Enemies Snapshot
  const actorIds = ctx.world.query(Actor);
  const livingEnemies: TurnSnapshotData['livingEnemies'] = [];

  for (const id of actorIds) {
    if (id === ctx.playerId) continue;
    const pos = ctx.world.getComponent(id, Position);
    const health = ctx.world.getComponent(id, Health);
    const energy = ctx.world.getComponent(id, Energy);
    const aiState = ctx.world.getComponent(id, AIState);

    livingEnemies.push({
      id,
      pos: pos ? { x: pos.x, y: pos.y } : undefined,
      hp: health?.current,
      maxHp: health?.max,
      energy: energy?.current,
      behavior: aiState?.behaviorType,
    });
  }

  const actionObj = typeof ctx.action === 'object' && ctx.action ? (ctx.action as { type?: string }) : {};
  const actionType = actionObj.type || 'UNKNOWN';

  const truncatedSessionId = ctx.sessionId ? `${ctx.sessionId.slice(0, 8)}…` : 'none';

  return {
    timestamp,
    sessionId: truncatedSessionId,
    action: ctx.action,
    actionType,
    turn: ctx.turnManager.getTurnNumber(),
    phase: ctx.turnManager.getPhase(),
    isPaused: ctx.turnManager.isPaused,
    floor: floorState?.currentFloor ?? 1,
    runSeed: floorState?.runSeed ?? 'unknown',
    sectorCondition: floorState?.sectorCondition ?? 'NOMINAL',
    player: {
      id: ctx.playerId,
      pos: playerPos ? { x: playerPos.x, y: playerPos.y } : undefined,
      health: playerHealth ? { current: playerHealth.current, max: playerHealth.max, isAlive: playerHealth.isAlive } : undefined,
      heat: playerHeat ? { current: playerHeat.current, maxSafe: playerHeat.maxSafe } : undefined,
      stability: playerStability ? { current: playerStability.current, max: playerStability.max } : undefined,
      energy: playerEnergy ? { current: playerEnergy.current, speed: playerEnergy.speed } : undefined,
      shell: playerShell?.archetypeId,
      inventory: inventory ? { softwareCount: inventory.software.length, equipmentCount: inventory.equipment.length } : undefined,
      componentKeys: Object.keys(playerComponents),
    },
    livingEnemies,
    error: {
      name: errorObj.name || 'Error',
      message: errorObj.message || 'Unknown error',
      stack: errorObj.stack,
    },
  };
}

/**
 * Builds a redacted, anti-cheat compliant preview for the client prompt modal.
 * Omits seeds, player full hidden state, and server filesystem paths.
 */
export function createRedactedCrashPreview(snapshot: TurnSnapshotData): RedactedCrashPreview {
  const playerBytes = JSON.stringify(snapshot.player).length;
  const enemiesBytes = JSON.stringify(snapshot.livingEnemies).length;
  const stackBytes = (snapshot.error.stack || '').length;

  return {
    errorName: snapshot.error.name,
    errorMessage: snapshot.error.message,
    actionType: snapshot.actionType,
    floor: snapshot.floor,
    turn: snapshot.turn,
    sealedManifest: [
      { label: 'Player Component State', approxBytes: playerBytes },
      { label: 'Living Entities State', approxBytes: enemiesBytes },
      { label: 'Server Stack Trace', approxBytes: stackBytes },
      { label: 'Dungeon Generation Seed', approxBytes: 16 },
    ],
  };
}

/**
 * Creates and stores a sealed crash draft in memory, returning the client offer with redacted preview.
 */
export function createServerCrashDraft<TEvents extends EngineEvents = EngineEvents>(
  ctx: TurnErrorContext<TEvents>
): CrashDraftOffer {
  const source = ctx.source || 'SERVER_TURN';
  const snapshot = buildTurnSnapshot(ctx);
  const fingerprint = computeCrashFingerprint(
    source,
    snapshot.error.name,
    snapshot.error.message,
    snapshot.error.stack
  );
  const preview = createRedactedCrashPreview(snapshot);

  const draft = draftStore.save({
    sessionId: ctx.sessionId,
    source,
    fingerprint,
    preview,
    sealed: {
      errorName: snapshot.error.name,
      errorMessage: snapshot.error.message,
      stack: snapshot.error.stack,
      runSeed: snapshot.runSeed,
      action: snapshot.action,
      phase: snapshot.phase,
      mode: ctx.mode,
      floor: snapshot.floor,
      turn: snapshot.turn,
      isPaused: snapshot.isPaused,
      sectorCondition: snapshot.sectorCondition,
      timestamp: snapshot.timestamp,
      playerComponents: snapshot.player as unknown as Record<string, unknown>,
      livingEnemiesCount: snapshot.livingEnemies.length,
      livingEnemies: snapshot.livingEnemies,
    },
  });

  return {
    draftId: draft.draftId,
    fingerprint,
    source: draft.source,
    preview,
  };
}

/**
 * Builds an allow-listed, credential-free game state snapshot from sealed draft data
 * for inclusion in the GitHub issue Game State Snapshot section.
 * Explicitly omits sessionId, duplicated error stack, and untrusted raw action echoes.
 */
export function buildAllowListedIssueSnapshot(sealed: {
  timestamp?: string;
  turn?: number;
  phase?: string;
  isPaused?: boolean;
  floor?: number;
  runSeed?: number | string;
  sectorCondition?: string;
  playerComponents?: Record<string, unknown>;
  livingEnemiesCount?: number;
  livingEnemies?: Array<{ id: number; name?: string; hp?: number }>;
}): Record<string, unknown> {
  return {
    timestamp: sealed.timestamp,
    turn: sealed.turn,
    phase: sealed.phase,
    isPaused: sealed.isPaused,
    floor: sealed.floor,
    runSeed: sealed.runSeed,
    sectorCondition: sealed.sectorCondition,
    player: sealed.playerComponents,
    livingEnemiesCount: sealed.livingEnemiesCount,
    livingEnemies: sealed.livingEnemies,
  };
}
