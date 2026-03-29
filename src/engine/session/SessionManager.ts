import { World } from '../ecs/world';
import { Grid } from '../grid/grid';
import { TurnManager } from '../turn/turn-manager';
import { EventBus } from '../events/event-bus';
import { EngineEvents } from '@engine/events/types';

/**
 * WorldState container for sessions.
 */
export interface WorldState<T extends EngineEvents = EngineEvents> {
  world: World<T>;
  grid: Grid;
  turnManager: TurnManager<T>;
  eventBus: EventBus<T>;
  playerId: number;
  systems?: any; // EngineInstance.systems
}

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

  public createSession<T extends EngineEvents>(sessionId: string, state: WorldState<T>): void {
    this.sessions.set(sessionId, state);
  }

  public getSession<T extends EngineEvents = EngineEvents>(sessionId: string): WorldState<T> | undefined {
    return this.sessions.get(sessionId) as WorldState<T> | undefined;
  }

  public deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  public listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  public hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  public clear(): void {
    this.sessions.clear();
  }
}

const globalForSession = global as unknown as { sessionManager: SessionManager };

export const sessionManager = globalForSession.sessionManager || SessionManager.getInstance();

if (process.env.NODE_ENV !== 'production') globalForSession.sessionManager = sessionManager;
