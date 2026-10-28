import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager, WorldState } from '../session-manager';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { TurnManager } from '@engine/turn/turn-manager';
import { EventBus } from '@engine/events/event-bus';
import { EngineEvents } from '@engine/events/types';
import { RunMode } from '@shared/run-mode';

describe('SessionManager Unit Tests', () => {
  let manager: SessionManager;

  const createDummyWorldState = (playerId = 1, runMode = RunMode.SIMULATION): WorldState => {
    const eventBus = new EventBus<EngineEvents>();
    const world = new World<EngineEvents>(eventBus);
    const grid = new Grid(10, 10);
    const turnManager = new TurnManager(
      world,
      eventBus,
      { energyThreshold: 100, defaultActionCost: 100, waitActionCost: 100 },
      {
        getPrimaryActor: () => playerId,
        isActorActive: () => true,
        deductActionCost: vi.fn(),
      } as any,
    );

    return {
      world,
      grid,
      turnManager,
      eventBus,
      playerId,
      runMode,
    };
  };

  beforeEach(() => {
    manager = SessionManager.getInstance();
    manager.clear();
    manager.setTTL(60 * 60 * 1000); // 60 min default
    manager.setMaxSessions(1000);
  });

  it('creates and retrieves a valid session', () => {
    const state = createDummyWorldState(1, RunMode.SIMULATION);
    manager.createSession('session-1', state);

    expect(manager.hasSession('session-1')).toBe(true);
    const retrieved = manager.getSession('session-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.playerId).toBe(1);
    expect(retrieved?.runMode).toBe(RunMode.SIMULATION);
  });

  it('deletes an existing session', () => {
    const state = createDummyWorldState();
    manager.createSession('session-to-delete', state);
    expect(manager.hasSession('session-to-delete')).toBe(true);

    manager.deleteSession('session-to-delete');
    expect(manager.hasSession('session-to-delete')).toBe(false);
    expect(manager.getSession('session-to-delete')).toBeUndefined();
  });

  it('lists active sessions and clears all sessions', () => {
    manager.createSession('s1', createDummyWorldState(1));
    manager.createSession('s2', createDummyWorldState(2));

    expect(manager.listSessions().sort()).toEqual(['s1', 's2']);

    manager.clear();
    expect(manager.listSessions()).toEqual([]);
    expect(manager.hasSession('s1')).toBe(false);
  });

  it('evicts stale sessions based on inactivity TTL', async () => {
    manager.setTTL(50); // 50ms TTL

    manager.createSession('quick-expire', createDummyWorldState());
    expect(manager.hasSession('quick-expire')).toBe(true);

    // Wait past TTL
    await new Promise((resolve) => setTimeout(resolve, 70));

    expect(manager.getSession('quick-expire')).toBeUndefined();
    expect(manager.hasSession('quick-expire')).toBe(false);
    expect(manager.listSessions()).toEqual([]);
  });

  it('touches lastAccessedAt on getSession to extend sliding window TTL', async () => {
    manager.setTTL(80); // 80ms TTL

    manager.createSession('sliding-session', createDummyWorldState());

    // Access at 40ms -> touches session
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(manager.getSession('sliding-session')).toBeDefined();

    // Wait another 50ms (total 90ms since creation, but only 50ms since last access)
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(manager.getSession('sliding-session')).toBeDefined();

    // Wait past 80ms since last access
    await new Promise((resolve) => setTimeout(resolve, 90));
    expect(manager.getSession('sliding-session')).toBeUndefined();
  });

  it('evicts oldest session (LRU) when maxSessions capacity is reached', async () => {
    manager.setMaxSessions(3);

    manager.createSession('s1', createDummyWorldState(1));
    await new Promise((resolve) => setTimeout(resolve, 10));
    manager.createSession('s2', createDummyWorldState(2));
    await new Promise((resolve) => setTimeout(resolve, 10));
    manager.createSession('s3', createDummyWorldState(3));

    // Access s1 so it is no longer the oldest accessed
    await new Promise((resolve) => setTimeout(resolve, 10));
    manager.getSession('s1');

    // Now s2 is the oldest accessed session. Adding s4 should evict s2.
    manager.createSession('s4', createDummyWorldState(4));

    expect(manager.hasSession('s1')).toBe(true);
    expect(manager.hasSession('s2')).toBe(false); // Evicted!
    expect(manager.hasSession('s3')).toBe(true);
    expect(manager.hasSession('s4')).toBe(true);
  });

  it('pruneStaleSessions removes expired sessions and reports pruned count', () => {
    manager.setTTL(1000);
    const now = Date.now();

    manager.createSession('s1', createDummyWorldState(1));
    manager.createSession('s2', createDummyWorldState(2));

    // Simulate time passage 2000ms later
    const pruned = manager.pruneStaleSessions(now + 2500);
    expect(pruned).toBe(2);
    expect(manager.listSessions()).toHaveLength(0);
  });
});
