import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebugAPI, SendActionFn } from '../debug-api';
import { GameContext } from '@/game/types';

describe('DebugAPI grantAll & seedVault', () => {
  let mockContext: GameContext;
  let sendActionFn: ReturnType<typeof vi.fn<SendActionFn>>;
  let debugApi: DebugAPI;

  beforeEach(() => {
    mockContext = {
      sessionId: 'test-session-debug-api',
      world: {} as any,
      grid: {} as any,
      eventBus: {} as any,
      turnManager: {} as any,
      fsm: {} as any,
      inputManager: {} as any,
      playerId: 1,
    } as unknown as GameContext;
    sendActionFn = vi.fn<SendActionFn>().mockResolvedValue(undefined as any);
    debugApi = new DebugAPI(mockContext, sendActionFn);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            itemsGranted: 15,
            vaultFull: false,
            scrapAdded: 1000,
            fluxAdded: 1000,
          },
          vaultCount: 15,
          wallet: { scrap: 1000, flux: 1000 },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls /api/admin/grant-all with context sessionId', async () => {
    const result = await debugApi.grantAll();

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/grant-all',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sessionId: 'test-session-debug-api' }),
      }),
    );

    expect(result.success).toBe(true);
    expect(result.result.itemsGranted).toBe(15);
  });

  it('seedVault delegates directly to grantAll', async () => {
    const grantAllSpy = vi.spyOn(debugApi, 'grantAll');
    await debugApi.seedVault('custom-session');

    expect(grantAllSpy).toHaveBeenCalledWith('custom-session');
  });

  it('sends fallback action intent if fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network offline'));

    await debugApi.grantAll();

    expect(sendActionFn).toHaveBeenCalledWith({
      type: 'DEBUG_COMMAND',
      command: 'GRANT_ALL',
      args: { sessionId: 'test-session-debug-api' },
    });
  });

  it('exposes perf controller API methods on debugApi.perf', () => {
    debugApi.perf.setMode('EXPANDED');
    const report = debugApi.perf.getReport();
    expect(typeof report).toBe('string');

    debugApi.perf.toggle();
    const snap = debugApi.perf.snapshot();
    expect(snap).toBeDefined();
    expect(snap.floor).toBe(1);
  });
});
