import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as initSession } from '../route';
import { POST as processAction } from '../../action/route';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { sessionManager } from '@engine/session/SessionManager';
import { EventBus } from '@engine/events/event-bus';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

vi.mock('@/app/persistence/fs-profile-repository', () => ({
  profileRepository: {
    load: vi.fn(),
    save: vi.fn(),
    createDefault: (sid: string) => ({
      sessionId: sid,
      wallet: { scrap: 0, flux: 0 },
      blueprintLibrary: [],
      installedItems: [],
      overflow: [],
      vault: [],
      shellUpgrades: {},
      attemptTracking: { dayNumber: 0, weekNumber: 0, dailyAttemptUsed: false, weeklyAttemptUsed: false },
      weekSeed: 0,
      createdAt: Date.now()
    }),
  }
}));

vi.mock('@engine/session/SessionManager', () => ({
  sessionManager: {
    createSession: vi.fn(),
    getSession: vi.fn(),
  },
}));

vi.mock('@game/engine-factory', () => ({
  createEngineInstance: vi.fn(() => ({
    world: {
      getComponent: vi.fn(),
      hasComponent: vi.fn(),
      patchComponent: vi.fn(),
      destroyEntity: vi.fn(),
      query: vi.fn(() => []),
    },
    grid: {
      inBounds: vi.fn(() => true),
      isWalkable: vi.fn(() => true),
      getEntitiesAt: vi.fn(() => new Set()),
      moveEntity: vi.fn(),
    },
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      flush: vi.fn(),
    },
    turnManager: {
      start: vi.fn(),
      submitAction: vi.fn(),
      canAcceptInput: vi.fn(() => true),
      getTurnNumber: vi.fn(() => 1),
      getPhase: vi.fn(() => 'AWAIT_INPUT'),
    },
    playerId: 1,
    systems: {},
  })),
}));

vi.mock('@shared/pipeline', () => ({
  runActionPipeline: vi.fn(() => ({
    world: {},
    grid: {},
    delta: { world: [], grid: [] },
  })),
  setupInternalHandlers: vi.fn(),
}));

vi.mock('@shared/serialization', () => ({
  serializeWorld: vi.fn(() => ({ entities: [], components: {} })),
  serializeGrid: vi.fn(() => ({ width: 10, height: 10, tiles: [] })),
  deserializeWorld: vi.fn((data, bus) => ({ 
    loadSerializableState: vi.fn(),
    getSerializableState: vi.fn(() => data),
    getComponent: vi.fn(),
    hasComponent: vi.fn(),
    patchComponent: vi.fn(),
    query: vi.fn(() => []),
  })),
  deserializeGrid: vi.fn((data) => ({
    width: data.width,
    height: data.height,
    loadSerializableTiles: vi.fn(),
    getSerializableTiles: vi.fn(() => data.tiles),
    moveEntity: vi.fn(),
    addEntity: vi.fn(),
    removeEntity: vi.fn(),
    getEntitiesAt: vi.fn(() => new Set()),
  })),
}));

describe('Profile Persistence Integration', () => {
  const sessionId = 'test-session';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/session', () => {
    it('uses provided sessionId and loads profile', async () => {
      const mockProfile = { sessionId, wallet: { scrap: 100, flux: 10 } };
      (profileRepository.load as any).mockResolvedValue(mockProfile);

      const req = new Request('http://localhost/api/session', {
        method: 'POST',
        body: JSON.stringify({ seed: 'test-seed', width: 20, height: 20, sessionId })
      });

      const res = await initSession(req);
      const data = await res.json();

      expect(data.sessionId).toBe(sessionId);
      expect(profileRepository.load).toHaveBeenCalledWith(sessionId);
    });

    it('uses default-player-session if none provided', async () => {
      (profileRepository.load as any).mockResolvedValue(null);

      const req = new Request('http://localhost/api/session', {
        method: 'POST',
        body: JSON.stringify({ seed: 'test-seed', width: 20, height: 20 })
      });

      const res = await initSession(req);
      const data = await res.json();

      expect(data.sessionId).toBe('default-player-session');
      expect(profileRepository.load).toHaveBeenCalledWith('default-player-session');
    });
  });

  describe('POST /api/action with RUN_ENDED', () => {
    it('saves profile with extraction rewards', async () => {
      const mockProfile = { 
        sessionId, 
        wallet: { scrap: 50, flux: 10 },
        blueprintLibrary: [],
        installedItems: [],
        overflow: [],
        vault: [],
        shellUpgrades: {},
        attemptTracking: { dayNumber: 0, weekNumber: 0, dailyAttemptUsed: false, weeklyAttemptUsed: false },
        weekSeed: 0,
        createdAt: Date.now()
      };
      (profileRepository.load as any).mockResolvedValue(mockProfile);
      
      const eventBus = new EventBus<any>();
      const world = new World<any>(eventBus);
      const grid = new Grid(20, 20);
      const turnManager = { 
        canAcceptInput: () => true, 
        submitAction: vi.fn(), 
        getTurnNumber: () => 1,
        getPhase: () => 'AWAIT_INPUT'
      };
      
      (sessionManager.getSession as any).mockReturnValue({
        world,
        grid,
        eventBus,
        turnManager,
        playerId: 1,
        systems: {}
      });

      const req = new Request('http://localhost/api/action', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          action: { type: 'ANCHOR_EXTRACT' }
        })
      });

      // Simulate the RUN_ENDED event being emitted during the turn
      const originalFlush = eventBus.flush.bind(eventBus);
      eventBus.flush = () => {
        eventBus.emit('RUN_ENDED', { 
          reason: 'extraction', 
          floorNumber: 5, 
          stats: {
            scrapExtracted: 200,
            fluxExtracted: 50
          } 
        });
        originalFlush();
      };

      const res = await processAction(req);
      expect(res.status).toBe(200);

      expect(profileRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        wallet: {
          scrap: 250, // 50 + 200
          flux: 60    // 10 + 50
        }
      }));
    });
  });
});
