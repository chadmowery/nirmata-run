import { World } from '../ecs/world';
import { Grid } from '../grid/grid';
import { TurnManager } from '../turn/turn-manager';
import { EventBus } from '../events/event-bus';
import { EngineEvents } from '@engine/events/types';

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
}

import { logger } from '../utils/logger';

/**
 * High-level manager for game sessions.
 */
export class SessionManager {
  private static instance: SessionManager;
  private sessions = new Map<string, unknown>();

  private constructor() {
    this.sessions = new Map();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public createSession<T extends EngineEvents, S = unknown>(sessionId: string, state: WorldState<T, S>): void {
    logger.info(`Session Created: ${sessionId}`, 'SESSION');
    this.sessions.set(sessionId, state);
  }

  public getSession<T extends EngineEvents = EngineEvents, S = unknown>(sessionId: string): WorldState<T, S> | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.debug(`Session Miss: ${sessionId}`, 'SESSION');
    }
    return session as WorldState<T, S> | undefined;
  }

  public deleteSession(sessionId: string): void {
    logger.info(`Session Deleted: ${sessionId}`, 'SESSION');
    this.sessions.delete(sessionId);
  }

  public listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  public hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  public clear(): void {
    logger.info('All Sessions Cleared', 'SESSION');
    this.sessions.clear();
  }
}

const globalForSession = global as unknown as { sessionManager: SessionManager };

export const sessionManager = globalForSession.sessionManager || SessionManager.getInstance();

if (process.env.NODE_ENV !== 'production') globalForSession.sessionManager = sessionManager;
