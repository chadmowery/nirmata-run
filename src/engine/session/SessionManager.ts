import { World } from '../ecs/World';
import { Grid } from '../grid/Grid';
import { TurnManager } from '../turn/turn-manager';
import { EventBus } from '../events/event-bus';

export interface WorldState {
  world: World;
  grid: Grid;
  playerId: number;
  turnManager: TurnManager;
  eventBus: EventBus<any>;
}

/**
 * Singleton class to manage in-memory game sessions.
 */
export class SessionManager {
  private static instance: SessionManager;
  private sessions: Map<string, WorldState>;

  private constructor() {
    this.sessions = new Map();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public createSession(sessionId: string, state: WorldState): void {
    this.sessions.set(sessionId, state);
  }

  public getSession(sessionId: string): WorldState | undefined {
    return this.sessions.get(sessionId);
  }

  public updateSession(sessionId: string, state: WorldState): void {
    if (this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, state);
    }
  }

  public deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  public clear(): void {
    this.sessions.clear();
  }
}

export const sessionManager = SessionManager.getInstance();
