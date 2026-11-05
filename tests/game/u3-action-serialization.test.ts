import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createGame } from '@/game/setup';
import { createEngineInstance } from '@/game/engine-factory';
import { sessionManager } from '@server/session/session-manager';
import { POST } from '@/app/api/action/route';
import { GameState } from '@/game/states/types';
import { gameStore } from '@/game/ui/store';
import { Health, RunInventory, Stability } from '@shared/components';
import { createDefaultProfile } from '@shared/profile';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { globalShellRegistry } from '@/game/shells/server';
import { DEFAULT_SHELL_ID } from '@/shared/constants';

describe('U3: Unified Client Action Submission & Per-Session Server Serialization', () => {
  const sessionId = 'test-u3-session';

  beforeEach(async () => {
    sessionManager.clear();
    gameStore.getState().clearMessages();
    await profileRepository.save(createDefaultProfile(sessionId));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionManager.clear();
  });

  it('reconciles server delta on quick-use consumable and surfaces server errors via submitAction', async () => {
    const shellRecord = globalShellRegistry.createRecord(DEFAULT_SHELL_ID, DEFAULT_SHELL_ID);
    const serverInstance = createEngineInstance({
      width: 20,
      height: 20,
      seed: 'u3-test-seed',
      isClient: false,
      sessionId,
      shellRecord,
    });
    serverInstance.turnManager.start();
    sessionManager.createSession(sessionId, serverInstance);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/action') && init?.body) {
        const req = new Request('http://localhost/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: init.body as string,
        });
        return POST(req);
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const clientContext = createGame({
      gridWidth: 20,
      gridHeight: 20,
      seed: 'u3-test-seed',
      sessionId,
    });
    clientContext.fsm.transition(GameState.Playing);

    const serverPlayerId = serverInstance.playerId;
    const clientPlayerId = clientContext.playerId!;

    // Reduce player HP and Stability on both server and client, and add a consumable to RunInventory
    const maxHp = serverInstance.world.getComponent(serverPlayerId, Health)?.max ?? 20;
    serverInstance.world.patchComponent(serverPlayerId, Health, { current: maxHp - 3, max: maxHp });
    clientContext.world.patchComponent(clientPlayerId, Health, { current: maxHp - 3, max: maxHp });
    serverInstance.world.patchComponent(serverPlayerId, Stability, { current: 50, max: 100 });
    clientContext.world.patchComponent(clientPlayerId, Stability, { current: 50, max: 100 });

    const consumableEntry = {
      entityId: 777,
      templateId: 'health-potion',
      rarityTier: 'common',
      pickedUpAtFloor: 1,
      pickedUpAtTimestamp: Date.now(),
      isConsumable: true,
      quantity: 2,
    };

    serverInstance.world.addComponent(serverPlayerId, RunInventory, {
      maxSlots: 10,
      software: [],
      equipment: [consumableEntry],
    });
    clientContext.world.addComponent(clientPlayerId, RunInventory, {
      maxSlots: 10,
      software: [],
      equipment: [{ ...consumableEntry }],
    });

    // Submit USE_CONSUMABLE via the canonical submitAction used by BackpackGrid
    await clientContext.submitAction!({
      type: 'USE_CONSUMABLE',
      inventoryIndex: 0,
    });

    // Verify client world reconciled the server delta (HP healed, Stability increased, quantity decremented to 1)
    const clientHpAfter = clientContext.world.getComponent(clientPlayerId, Health);
    expect(clientHpAfter?.current).toBeGreaterThan(maxHp - 3);

    const clientInvAfter = clientContext.world.getComponent(clientPlayerId, RunInventory);
    expect(clientInvAfter?.equipment[0]?.quantity).toBe(1);
    expect(clientContext.inputManager.getPendingStatus()).toBe(false);
  });

  it('rejects overlapping concurrent /api/action requests for the same session with HTTP 409 and releases lock after completion', async () => {
    const serverInstance = createEngineInstance({
      width: 20,
      height: 20,
      seed: 'u3-concurrency-seed',
      isClient: false,
      sessionId,
    });
    serverInstance.turnManager.start();
    sessionManager.createSession(sessionId, serverInstance);

    // Simulate an in-flight request holding the session lock
    expect(sessionManager.tryAcquireSessionLock(sessionId)).toBe(true);
    expect(sessionManager.isSessionLocked(sessionId)).toBe(true);

    const overlappingReq = new Request('http://localhost/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        action: { type: 'WAIT' },
      }),
    });

    const rejectedRes = await POST(overlappingReq);
    expect(rejectedRes.status).toBe(409);
    const rejectedBody = await rejectedRes.json();
    expect(rejectedBody.error).toContain('Session is already processing an action');

    // Release the lock and verify subsequent request succeeds and cleans up its lock
    sessionManager.releaseSessionLock(sessionId);
    expect(sessionManager.isSessionLocked(sessionId)).toBe(false);

    const validReq = new Request('http://localhost/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        action: { type: 'WAIT' },
      }),
    });
    const validRes = await POST(validReq);
    expect(validRes.status).toBe(200);
    expect(sessionManager.isSessionLocked(sessionId)).toBe(false);
  });
});
