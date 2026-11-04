import { promises as fs } from 'fs';
import path from 'path';
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

export interface TurnErrorContext<TEvents extends EngineEvents = EngineEvents> {
  sessionId: string;
  action: unknown;
  playerId: EntityId;
  world: World<TEvents>;
  turnManager: TurnManager<TEvents>;
  error: unknown;
}

export const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_BACKUP_FILES = 2;

/**
 * Checks if the error log file exceeds MAX_LOG_SIZE_BYTES and rotates backup files.
 */
export async function rotateLogFileIfNeeded(logFilePath: string): Promise<void> {
  try {
    const stats = await fs.stat(logFilePath);
    if (stats.size >= MAX_LOG_SIZE_BYTES) {
      for (let i = MAX_BACKUP_FILES - 1; i >= 1; i--) {
        const src = `${logFilePath}.${i}`;
        const dest = `${logFilePath}.${i + 1}`;
        try {
          await fs.rename(src, dest);
        } catch {
          // Backup file might not exist yet
        }
      }
      try {
        await fs.rename(logFilePath, `${logFilePath}.1`);
      } catch {
        // Ignore rename error
      }
    }
  } catch {
    // File does not exist yet; no rotation needed
  }
}

/**
 * Formats rich diagnostic information for turn execution exceptions,
 * logs it with full component and game state to the console, and appends to logs/game-errors.log.
 */
export async function logTurnExecutionError<TEvents extends EngineEvents = EngineEvents>(
  ctx: TurnErrorContext<TEvents>,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const errorObj = ctx.error instanceof Error ? ctx.error : new Error(String(ctx.error));
  const sanitizedSessionId =
    ctx.sessionId && ctx.sessionId.length > 12
      ? `${ctx.sessionId.slice(0, 8)}...`
      : ctx.sessionId;

  // Extract Player Component Snapshot
  const playerComponents = ctx.world.getEntityComponents(ctx.playerId);
  const playerPos = ctx.world.getComponent(ctx.playerId, Position);
  const playerHealth = ctx.world.getComponent(ctx.playerId, Health);
  const playerHeat = ctx.world.getComponent(ctx.playerId, Heat);
  const playerStability = ctx.world.getComponent(ctx.playerId, Stability);
  const playerEnergy = ctx.world.getComponent(ctx.playerId, Energy);
  const playerShell = ctx.world.getComponent(ctx.playerId, Shell);
  const floorState = ctx.world.getComponent(ctx.playerId, FloorState);
  const inventory = ctx.world.getComponent(ctx.playerId, RunInventory);

  // Extract Active Actors Snapshot
  const actorIds = ctx.world.query(Actor);
  const livingEnemies: Array<{
    id: EntityId;
    pos?: { x: number; y: number };
    hp?: number;
    maxHp?: number;
    energy?: number;
    behavior?: string;
  }> = [];

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

  // Format Console Output
  const separator = '═'.repeat(80);
  const thinSeparator = '─'.repeat(80);

  const consoleLines = [
    '',
    `\x1b[31m${separator}\x1b[0m`,
    `\x1b[1;31m[CRITICAL TURN EXECUTION FAILURE] - ${timestamp}\x1b[0m`,
    `\x1b[33mSession ID:\x1b[0m   ${ctx.sessionId}`,
    `\x1b[33mAction:\x1b[0m       ${JSON.stringify(ctx.action)}`,
    `\x1b[33mTurn State:\x1b[0m   Turn #${ctx.turnManager.getTurnNumber()} | Phase: ${ctx.turnManager.getPhase()} | Paused: ${ctx.turnManager.isPaused}`,
    `\x1b[33mFloor:\x1b[0m        ${floorState?.currentFloor ?? 1} / 15 (Seed: ${floorState?.runSeed ?? 'unknown'}, Condition: ${floorState?.sectorCondition ?? 'NOMINAL'})`,
    thinSeparator,
    `\x1b[1;36mPlayer Entity State (ID: ${ctx.playerId}):\x1b[0m`,
    `  Position:   ${playerPos ? `(${playerPos.x}, ${playerPos.y})` : 'None'}`,
    `  Health:     ${playerHealth ? `${playerHealth.current}/${playerHealth.max} (alive: ${playerHealth.isAlive})` : 'None'}`,
    `  Heat:       ${playerHeat ? `${playerHeat.current}/${playerHeat.maxSafe}` : 'None'}`,
    `  Stability:  ${playerStability ? `${playerStability.current}/${playerStability.max}` : 'None'}`,
    `  Energy:     ${playerEnergy ? `${playerEnergy.current} (speed: ${playerEnergy.speed})` : 'None'}`,
    `  Shell:      ${playerShell?.archetypeId ?? 'unknown'}`,
    `  Inventory:  ${inventory ? `${inventory.software.length} software, ${inventory.equipment.length} equip` : 'None'}`,
    `  Components: ${Object.keys(playerComponents).join(', ')}`,
    thinSeparator,
    `\x1b[1;35mActive Living Enemies (${livingEnemies.length}):\x1b[0m`,
    ...livingEnemies.slice(0, 10).map((e) =>
      `  ID ${e.id} [${e.behavior ?? 'enemy'}]: pos=${e.pos ? `(${e.pos.x},${e.pos.y})` : '?'}, hp=${e.hp}/${e.maxHp}, energy=${e.energy}`
    ),
    ...(livingEnemies.length > 10 ? [`  ... and ${livingEnemies.length - 10} more enemies`] : []),
    thinSeparator,
    `\x1b[1;31mError Details:\x1b[0m`,
    `  Message:    ${errorObj.message}`,
    `  Stack Trace:\n${errorObj.stack || '  (no stack trace)'}`,
    `\x1b[31m${separator}\x1b[0m`,
    '',
  ];

  console.error(consoleLines.join('\n'));

  // Format File Log Entry (strip ANSI colors & sanitize session ID)
  const fileLogEntry = [
    `\n${separator}`,
    `[TURN EXECUTION FAILURE] - ${timestamp}`,
    `Session ID:   ${sanitizedSessionId}`,
    `Action:       ${JSON.stringify(ctx.action, null, 2)}`,
    `Turn State:   Turn #${ctx.turnManager.getTurnNumber()} | Phase: ${ctx.turnManager.getPhase()} | Paused: ${ctx.turnManager.isPaused}`,
    `Floor:        ${floorState?.currentFloor ?? 1} (Seed: ${floorState?.runSeed ?? 'unknown'}, Condition: ${floorState?.sectorCondition ?? 'NOMINAL'})`,
    `Player ID:    ${ctx.playerId}`,
    `Player State: ${JSON.stringify(
      {
        pos: playerPos,
        health: playerHealth,
        heat: playerHeat,
        stability: playerStability,
        energy: playerEnergy,
        shell: playerShell?.archetypeId,
      },
      null,
      2,
    )}`,
    `Player All Components: ${JSON.stringify(playerComponents, null, 2)}`,
    `Enemies:      ${JSON.stringify(livingEnemies, null, 2)}`,
    `Error Name:   ${errorObj.name}`,
    `Error Msg:    ${errorObj.message}`,
    `Stack Trace:\n${errorObj.stack || '(no stack trace)'}`,
    `${separator}\n`,
  ].join('\n');

  try {
    const logsDir = path.join(process.cwd(), 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    const logFilePath = path.join(logsDir, 'game-errors.log');
    await rotateLogFileIfNeeded(logFilePath);
    await fs.appendFile(logFilePath, fileLogEntry, 'utf-8');
  } catch (fsErr) {
    console.error('Failed to write to logs/game-errors.log:', fsErr);
  }
}
