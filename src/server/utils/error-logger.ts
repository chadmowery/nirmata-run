import { promises as fs } from 'fs';
import path from 'path';
import { EngineEvents } from '@engine/events/types';
import { buildTurnSnapshot, type TurnErrorContext } from './turn-snapshot';

export { type TurnErrorContext };

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
  const snapshot = buildTurnSnapshot(ctx);
  const sanitizedSessionId =
    ctx.sessionId && ctx.sessionId.length > 12
      ? `${ctx.sessionId.slice(0, 8)}...`
      : ctx.sessionId;

  // Format Console Output
  const separator = '═'.repeat(80);
  const thinSeparator = '─'.repeat(80);

  const playerPos = snapshot.player.pos;
  const playerHealth = snapshot.player.health;
  const playerHeat = snapshot.player.heat;
  const playerStability = snapshot.player.stability;
  const playerEnergy = snapshot.player.energy;

  const consoleLines = [
    '',
    `\x1b[31m${separator}\x1b[0m`,
    `\x1b[1;31m[CRITICAL TURN EXECUTION FAILURE] - ${snapshot.timestamp}\x1b[0m`,
    `\x1b[33mSession ID:\x1b[0m   ${ctx.sessionId}`,
    `\x1b[33mAction:\x1b[0m       ${JSON.stringify(ctx.action)}`,
    `\x1b[33mTurn State:\x1b[0m   Turn #${snapshot.turn} | Phase: ${snapshot.phase} | Paused: ${snapshot.isPaused}`,
    `\x1b[33mFloor:\x1b[0m        ${snapshot.floor} / 15 (Seed: ${snapshot.runSeed}, Condition: ${snapshot.sectorCondition})`,
    thinSeparator,
    `\x1b[1;36mPlayer Entity State (ID: ${ctx.playerId}):\x1b[0m`,
    `  Position:   ${playerPos ? `(${playerPos.x}, ${playerPos.y})` : 'None'}`,
    `  Health:     ${playerHealth ? `${playerHealth.current}/${playerHealth.max} (alive: ${playerHealth.isAlive})` : 'None'}`,
    `  Heat:       ${playerHeat ? `${playerHeat.current}/${playerHeat.maxSafe}` : 'None'}`,
    `  Stability:  ${playerStability ? `${playerStability.current}/${playerStability.max}` : 'None'}`,
    `  Energy:     ${playerEnergy ? `${playerEnergy.current} (speed: ${playerEnergy.speed})` : 'None'}`,
    `  Shell:      ${snapshot.player.shell ?? 'unknown'}`,
    `  Inventory:  ${snapshot.player.inventory ? `${snapshot.player.inventory.softwareCount} software, ${snapshot.player.inventory.equipmentCount} equip` : 'None'}`,
    `  Components: ${snapshot.player.componentKeys.join(', ')}`,
    thinSeparator,
    `\x1b[1;35mActive Living Enemies (${snapshot.livingEnemies.length}):\x1b[0m`,
    ...snapshot.livingEnemies.slice(0, 10).map((e) =>
      `  ID ${e.id} [${e.behavior ?? 'enemy'}]: pos=${e.pos ? `(${e.pos.x},${e.pos.y})` : '?'}, hp=${e.hp}/${e.maxHp}, energy=${e.energy}`
    ),
    ...(snapshot.livingEnemies.length > 10 ? [`  ... and ${snapshot.livingEnemies.length - 10} more enemies`] : []),
    thinSeparator,
    `\x1b[1;31mError Details:\x1b[0m`,
    `  Message:    ${snapshot.error.message}`,
    `  Stack Trace:\n${snapshot.error.stack || '  (no stack trace)'}`,
    `\x1b[31m${separator}\x1b[0m`,
    '',
  ];

  console.error(consoleLines.join('\n'));

  // Format File Log Entry (strip ANSI colors & sanitize session ID)
  const fileLogEntry = [
    `\n${separator}`,
    `[TURN EXECUTION FAILURE] - ${snapshot.timestamp}`,
    `Session ID:   ${sanitizedSessionId}`,
    `Action:       ${JSON.stringify(ctx.action, null, 2)}`,
    `Turn State:   Turn #${snapshot.turn} | Phase: ${snapshot.phase} | Paused: ${snapshot.isPaused}`,
    `Floor:        ${snapshot.floor} (Seed: ${snapshot.runSeed}, Condition: ${snapshot.sectorCondition})`,
    `Player ID:    ${ctx.playerId}`,
    `Player State: ${JSON.stringify(
      {
        pos: playerPos,
        health: playerHealth,
        heat: playerHeat,
        stability: playerStability,
        energy: playerEnergy,
        shell: snapshot.player.shell,
      },
      null,
      2,
    )}`,
    `Player All Components: ${JSON.stringify(ctx.world.getEntityComponents(ctx.playerId), null, 2)}`,
    `Enemies:      ${JSON.stringify(snapshot.livingEnemies, null, 2)}`,
    `Error Name:   ${snapshot.error.name}`,
    `Error Msg:    ${snapshot.error.message}`,
    `Stack Trace:\n${snapshot.error.stack || '(no stack trace)'}`,
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
