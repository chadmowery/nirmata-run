import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { TurnManager } from '@engine/turn/turn-manager';
import { EventBus } from '@engine/events/event-bus';
import { EngineEvents } from '@engine/events/types';
import { EntityRegistry } from '@engine/entity/registry';
import { EntityFactory } from '@engine/entity/factory';
import { logger } from '@engine/utils/logger';

import { RunMode } from '@shared/run-mode';
import { truncateSessionId } from '@shared/reports/sanitize';

/**
 * WorldState container for sessions.
 */
export interface WorldState<T extends EngineEvents = EngineEvents, S = unknown> {
  world: World<T>;
  grid: Grid;
  turnManager: TurnManager<T>;
  eventBus: EventBus<T>;
  playerId: number;
  systems?: S; // EngineInstance.systems
  runMode?: RunMode;
  shellId?: string;
  seed?: string;
  entityRegistry?: EntityRegistry;
  entityFactory?: EntityFactory;
}

interface SessionEntry<T extends EngineEvents = EngineEvents, S = unknown> {
  state: WorldState<T, S>;
  createdAt: number;
  lastAccessedAt: number;
}

/**
 * High-level manager for game sessions with inactivity TTL and max capacity bounds.
 */
export class SessionManager {
  private static instance: SessionManager;
  private sessions = new Map<string, SessionEntry<EngineEvents, unknown>>();
  private activeSessionLocks = new Set<string>();
  private ttlMs = 60 * 60 * 1000; // 60 minutes default TTL
  private maxSessions = 1000;

  private constructor() {
    this.sessions = new Map();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Set session time-to-live in milliseconds (primarily for testing or tuning).
   */
  public setTTL(ttlMs: number): void {
    this.ttlMs = ttlMs;
  }

  public getTTL(): number {
    return this.ttlMs;
  }

  /**
   * Set maximum concurrent session capacity before LRU eviction.
   */
  public setMaxSessions(max: number): void {
    this.maxSessions = max;
  }

  public getMaxSessions(): number {
    return this.maxSessions;
  }

  public createSession<T extends EngineEvents, S = unknown>(
    sessionId: string,
    state: WorldState<T, S>,
  ): void {
    this.pruneStaleSessions();

    // If still at capacity, evict the oldest accessed session (LRU)
    if (this.sessions.size >= this.maxSessions && !this.sessions.has(sessionId)) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.sessions.entries()) {
        if (entry.lastAccessedAt < oldestTime) {
          oldestTime = entry.lastAccessedAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        logger.info(`Session Evicted (Capacity): ${truncateSessionId(oldestKey)}`, 'SESSION');
        this.sessions.delete(oldestKey);
      }
    }

    const now = Date.now();
    logger.info(`Session Created: ${truncateSessionId(sessionId)}`, 'SESSION');
    this.sessions.set(sessionId, {
      state: state as unknown as WorldState<EngineEvents, unknown>,
      createdAt: now,
      lastAccessedAt: now,
    });
  }

  public getSession<T extends EngineEvents = EngineEvents, S = unknown>(
    sessionId: string,
  ): WorldState<T, S> | undefined {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      logger.debug(`Session Miss: ${truncateSessionId(sessionId)}`, 'SESSION');
      return undefined;
    }

    const now = Date.now();
    if (this.ttlMs > 0 && now - entry.lastAccessedAt > this.ttlMs) {
      logger.info(`Session Expired (TTL): ${truncateSessionId(sessionId)}`, 'SESSION');
      this.sessions.delete(sessionId);
      return undefined;
    }

    // Touch on access
    entry.lastAccessedAt = now;
    return entry.state as unknown as WorldState<T, S>;
  }

  public deleteSession(sessionId: string): void {
    logger.info(`Session Deleted: ${truncateSessionId(sessionId)}`, 'SESSION');
    this.sessions.delete(sessionId);
    this.activeSessionLocks.delete(sessionId);
  }

  public tryAcquireSessionLock(sessionId: string): boolean {
    if (this.activeSessionLocks.has(sessionId)) {
      return false;
    }
    this.activeSessionLocks.add(sessionId);
    return true;
  }

  public releaseSessionLock(sessionId: string): void {
    this.activeSessionLocks.delete(sessionId);
  }

  public isSessionLocked(sessionId: string): boolean {
    return this.activeSessionLocks.has(sessionId);
  }

  public listSessions(): string[] {
    this.pruneStaleSessions();
    return Array.from(this.sessions.keys());
  }

  /**
   * Returns all active non-expired session entries without updating access timestamps.
   */
  public getAllSessionEntries(): Array<{ sessionId: string; state: WorldState<EngineEvents, unknown>; lastAccessedAt: number }> {
    this.pruneStaleSessions();
    const result: Array<{ sessionId: string; state: WorldState<EngineEvents, unknown>; lastAccessedAt: number }> = [];
    for (const [sessionId, entry] of this.sessions.entries()) {
      result.push({
        sessionId,
        state: entry.state,
        lastAccessedAt: entry.lastAccessedAt,
      });
    }
    return result;
  }

  /**
   * Finds the most recently accessed active session matching an optional predicate.
   */
  public getLatestSession(
    predicate?: (sessionId: string, state: WorldState<EngineEvents, unknown>) => boolean,
  ): { sessionId: string; state: WorldState<EngineEvents, unknown> } | undefined {
    this.pruneStaleSessions();
    let best: { sessionId: string; state: WorldState<EngineEvents, unknown>; lastAccessedAt: number } | undefined;
    for (const [sessionId, entry] of this.sessions.entries()) {
      if (predicate && !predicate(sessionId, entry.state)) continue;
      if (!best || entry.lastAccessedAt >= best.lastAccessedAt) {
        best = { sessionId, state: entry.state, lastAccessedAt: entry.lastAccessedAt };
      }
    }
    if (!best) return undefined;
    return { sessionId: best.sessionId, state: best.state };
  }

  public hasSession(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    return session !== undefined;
  }

  public clear(): void {
    logger.info('All Sessions Cleared', 'SESSION');
    this.sessions.clear();
    this.activeSessionLocks.clear();
  }

  /**
   * Prunes all sessions that have exceeded the inactivity TTL window.
   * Returns the count of removed sessions.
   */
  public pruneStaleSessions(now = Date.now()): number {
    if (this.ttlMs <= 0) return 0;

    let prunedCount = 0;
    for (const [key, entry] of this.sessions.entries()) {
      if (now - entry.lastAccessedAt > this.ttlMs) {
        this.sessions.delete(key);
        prunedCount++;
      }
    }

    if (prunedCount > 0) {
      logger.info(`Pruned ${prunedCount} stale session(s)`, 'SESSION');
    }

    return prunedCount;
  }
}

const globalForSession = global as unknown as { sessionManager: SessionManager };

export const sessionManager = globalForSession.sessionManager || SessionManager.getInstance();

if (process.env.NODE_ENV !== 'production') globalForSession.sessionManager = sessionManager;
