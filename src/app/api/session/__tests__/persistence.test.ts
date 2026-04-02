import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as initSession } from '../route';
import { POST as processAction } from '../../action/route';
import * as persistence from '@game/systems/profile-persistence';
import { sessionManager } from '@engine/session/SessionManager';
import { runInventoryRegistry } from '@game/systems/run-inventory';
import { EventBus } from '@engine/events/event-bus';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';

vi.mock('@game/systems/profile-persistence', () => ({
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
  createDefaultProfile: (sid: string) => ({
    sessionId: sid,
    wallet: { scrap: 0, flux: 0 },
    blueprintLibrary: [],
    installedItems: [],
    shellUpgrades: {},
    weekSeed: 0,
    createdAt: Date.now()
  }),
}));

vi.mock('@engine/session/SessionManager', () => ({
  sessionManager: {
    createSession: vi.fn(),
    getSession: vi.fn(),
  },
}));

vi.mock('@shared/serialization', () => ({
  serializeWorld: vi.fn(() => ({})),
  serializeGrid: vi.fn(() => ({})),
}));

describe('Profile Persistence Integration', () => {
  const sessionId = 'test-session';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/session', () => {
    it('uses provided sessionId and loads profile', async () => {
      const mockProfile = { sessionId, wallet: { scrap: 100, flux: 10 } };
      (persistence.loadProfile as any).mockResolvedValue(mockProfile);

      const req = new Request('http://localhost/api/session', {
        method: 'POST',
        body: JSON.stringify({ seed: 'test-seed', width: 20, height: 20, sessionId })
      });

      const res = await initSession(req);
      const data = await res.json();

      expect(data.sessionId).toBe(sessionId);
      expect(persistence.loadProfile).toHaveBeenCalledWith(sessionId);
    });

    it('uses default-player-session if none provided', async () => {
      (persistence.loadProfile as any).mockResolvedValue(null);

      const req = new Request('http://localhost/api/session', {
        method: 'POST',
        body: JSON.stringify({ seed: 'test-seed', width: 20, height: 20 })
      });

      const res = await initSession(req);
      const data = await res.json();

      expect(data.sessionId).toBe('default-player-session');
      expect(persistence.loadProfile).toHaveBeenCalledWith('default-player-session');
    });
  });

  describe('POST /api/action with RUN_ENDED', () => {
    it('saves profile with extraction rewards', async () => {
      const mockProfile = { 
        sessionId, 
        wallet: { scrap: 50, flux: 10 },
        blueprintLibrary: [],
        installedItems: [],
        shellUpgrades: {},
        weekSeed: 0,
        createdAt: Date.now()
      };
      (persistence.loadProfile as any).mockResolvedValue(mockProfile);
      
      const eventBus = new EventBus<any>();
      const world = new World<any>(eventBus);
      const grid = new Grid(20, 20);
      const turnManager = { canAcceptInput: () => true, submitAction: vi.fn(), getTurnNumber: () => 1 };
      
      (sessionManager.getSession as any).mockReturnValue({
        world,
        grid,
        eventBus,
        turnManager,
        playerId: 1,
        systems: {}
      });

      // Mock runInventoryRegistry to return some rewards
      vi.spyOn(runInventoryRegistry, 'getCurrencyAmount').mockImplementation((sid, type) => {
        if (type === 'scrap') return 200;
        if (type === 'flux') return 50;
        return 0;
      });

      const req = new Request('http://localhost/api/action', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          action: { type: 'ANCHOR_EXTRACT' }
        })
      });

      // Manually emit the RUN_ENDED event during processing
      // In the real app, this happens via handleAnchorExtract in RunEnderSystem
      const originalFlush = eventBus.flush.bind(eventBus);
      eventBus.flush = () => {
        eventBus.emit('RUN_ENDED', { reason: 'extraction', floorNumber: 5, stats: {} });
        originalFlush();
      };

      const res = await processAction(req);
      expect(res.status).toBe(200);

      expect(persistence.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
        wallet: {
          scrap: 250, // 50 + 200
          flux: 60    // 10 + 50
        }
      }));
    });
  });
});
