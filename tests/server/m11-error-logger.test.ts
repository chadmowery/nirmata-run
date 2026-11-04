import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import {
  logTurnExecutionError,
  rotateLogFileIfNeeded,
  MAX_LOG_SIZE_BYTES,
} from '../../src/server/utils/error-logger';
import { World } from '../../src/engine/ecs/world';
import { TurnManager } from '../../src/engine/turn/turn-manager';
import { EventBus } from '../../src/engine/events/event-bus';
import { EngineEvents } from '../../src/engine/events/types';
import { Position, Health, Actor } from '@shared/components';

describe('M11: Error Logger Formatting, Rotation & Latency Invariants', () => {
  const testLogsDir = path.join(process.cwd(), 'logs', 'test-m11');
  const testLogFile = path.join(testLogsDir, 'test-game-errors.log');

  beforeEach(async () => {
    await fs.mkdir(testLogsDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testLogsDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
    vi.restoreAllMocks();
  });

  it('rotates log files when file size exceeds MAX_LOG_SIZE_BYTES', async () => {
    // Write simulated large log file
    const largeContent = 'A'.repeat(100);
    await fs.writeFile(testLogFile, largeContent, 'utf-8');

    // Test with mock small threshold by overriding stat or testing rotate logic
    const statSpy = vi.spyOn(fs, 'stat').mockResolvedValueOnce({
      size: MAX_LOG_SIZE_BYTES + 1024,
    } as any);

    await rotateLogFileIfNeeded(testLogFile);

    // Old log should have been rotated to .1
    const rotatedExists = await fs
      .access(`${testLogFile}.1`)
      .then(() => true)
      .catch(() => false);
    expect(rotatedExists).toBe(true);
    statSpy.mockRestore();
  });

  it('formats ANSI output with valid escape code \\x1b[31m and logs diagnostics', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = new EventBus<EngineEvents>();
    const world = new World<EngineEvents>(bus);
    const mockTurnManager = {
      getTurnNumber: () => 1,
      getPhase: () => 'AWAIT_INPUT',
      isPaused: false,
    } as unknown as TurnManager<EngineEvents>;

    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Health, { current: 100, max: 100, isAlive: true });

    await logTurnExecutionError({
      sessionId: 'sess_1234567890abcdef',
      action: { type: 'MOVE', payload: { dx: 1, dy: 0 } },
      playerId,
      world,
      turnManager: mockTurnManager,
      error: new Error('Simulation failed'),
    });

    expect(consoleSpy).toHaveBeenCalled();
    const loggedOutput = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');

    // Invariant: closing line has valid ANSI code \x1b[31m and not broken \x1b[31═══
    expect(loggedOutput).toContain('\x1b[31m');
    expect(loggedOutput).not.toContain('\x1b[31═');

    consoleSpy.mockRestore();
  });
});
