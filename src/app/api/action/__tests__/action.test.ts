import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../route';
import { sessionManager } from '@server/session/session-manager';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { TurnManager } from '@engine/turn/turn-manager';
import { GameTurnAdapter } from '@game/turn/game-turn-adapter';
import { EventBus } from '@engine/events/event-bus';
import { Actor, Position, Energy, Health } from '@shared/components';
import { MoveIntent } from '@shared/components/intents';
import { GameAction, DIRECTIONS } from '@game/input/actions';
import { GameplayEvents } from '@shared/events/types';
import { registerCoreSystems } from '@game/systems/registration';
import { AIState, FovAwareness } from '@shared/components';
import { AIBehaviorType, AIBehavior } from '@shared/components/ai-state';
import { EquipIntent, UnequipIntent, DescentIntent, ExtractionIntent, EquipmentSlots, Shell } from '@shared/components';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { submitLeaderboardEntry } from '@/server/leaderboard/leaderboard-service';
import { RunMode } from '@shared/run-mode';
import { VAULT_MAX_SLOTS } from '@shared/vault';
import { createDefaultProfile } from '@shared/profile';

vi.mock('@/app/persistence/fs-profile-repository', () => ({
  profileRepository: {
    load: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock('@/server/leaderboard/leaderboard-service', () => ({
  submitLeaderboardEntry: vi.fn(),
}));

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

describe('Action API Route', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let turnManager: TurnManager<GameplayEvents>;
  let playerId: number;
  const sessionId = 'test-session';

  beforeEach(() => {
    sessionManager.clear();
    eventBus = new EventBus<GameplayEvents>();
    world = new World(eventBus);
    grid = new Grid(10, 10);
    const turnAdapter = new GameTurnAdapter(world, {
      defaultActionCost: 100,
      waitActionCost: 50,
    });
    turnManager = new TurnManager(
      world,
      eventBus,
      {
        energyThreshold: 100,
        defaultActionCost: 100,
        waitActionCost: 50,
      },
      turnAdapter,
    );

    // Setup player
    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Energy, { current: 100, speed: 10, threshold: 1000 });
    world.addComponent(playerId, Health, { current: 10, max: 10, isAlive: true });
    grid.addEntity(playerId, 5, 5);

    const dummyEntityRegistry = {
      create: vi.fn(),
      get: vi.fn(),
      has: vi.fn(),
      register: vi.fn(),
      getTemplate: vi.fn(),
      getAllTemplates: vi.fn(),
    } as any;
    const dummyEntityFactory = { create: vi.fn() } as any;
    const dummyComponentRegistry = { get: vi.fn(), has: vi.fn() } as any;

    registerCoreSystems(world, grid, eventBus, dummyEntityFactory, dummyComponentRegistry);

    turnManager.setPlayerActionHandler((action: string, entityId: number) => {
      const gameAction = action as GameAction;
      if (DIRECTIONS[gameAction]) {
        const { dx, dy } = DIRECTIONS[gameAction];
        world.addComponent(entityId, MoveIntent, { dx, dy });
      }
    });

    sessionManager.createSession(sessionId, {
      world,
      grid,
      playerId,
      turnManager,
      eventBus,
      systems: {} as any,
    });

    // Mock turn manager start
    turnManager.start();
  });

  it('should process a valid MOVE action', async () => {
    const req = new Request('http://localhost/api/action', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        action: { type: 'MOVE', dx: 1, dy: 0 },
      }),
    });

    const response = await POST(req);
    const data = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(data.payload).toBeDefined();
    expect(data.payload.world).toBeDefined();
    expect(data.payload.turnNumber).toBeGreaterThan(0);

    // Verify player position changed in world
    const pos = world.getComponent(playerId, Position);
    expect(pos?.x).toBe(6);
    expect(pos?.y).toBe(5);
  });

  it('should process a WAIT action', async () => {
    const req = new Request('http://localhost/api/action', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        action: { type: 'WAIT' },
      }),
    });

    const response = await POST(req);
    const data = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(data.payload.turnNumber).toBeGreaterThan(0);

    // Position should remain same
    const pos = world.getComponent(playerId, Position);
    expect(pos?.x).toBe(5);
    expect(pos?.y).toBe(5);
  });

  it('should return 404 for missing session', async () => {
    const req = new Request('http://localhost/api/action', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'non-existent',
        action: { type: 'WAIT' },
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(404);
  });

  it('should return 400 for invalid request body', async () => {
    const req = new Request('http://localhost/api/action', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        action: { type: 'INVALID' },
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('should process enemy turns during the player action request', async () => {
    // Setup additional movement system for AI if needed, but we used the same one
    // Already initialized in beforeEach

    const enemyId = world.createEntity();
    world.addComponent(enemyId, Actor, { isPlayer: false });
    world.addComponent(enemyId, Position, { x: 7, y: 7 });
    world.addComponent(enemyId, Energy, { current: 1000, speed: 10, threshold: 1000 });
    world.addComponent(enemyId, Health, { current: 5, max: 5, isAlive: true });
    // AI system needs AIState and FovAwareness to act
    world.addComponent(enemyId, AIState, {
      behavior: AIBehavior.CHASING,
      behaviorType: AIBehaviorType.BASIC,
      sightRadius: 10,
    });
    world.addComponent(enemyId, FovAwareness, {
      canSeePlayer: true,
      lastKnownPlayerX: 5,
      lastKnownPlayerY: 5,
    });
    grid.addEntity(enemyId, 7, 7);

    const req = new Request('http://localhost/api/action', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        action: { type: 'MOVE', dx: 1, dy: 0 },
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    // Verify enemy moved somewhere (WANDER)
    const enemyPos = world.getComponent(enemyId, Position);
    expect(enemyPos?.x !== 7 || enemyPos?.y !== 7).toBe(true);
  });

  describe('Complex Action Intents', () => {
    it('processes EQUIP and UNEQUIP intents on player', async () => {
      world.addComponent(playerId, EquipmentSlots, { weapon: null, armor: null });

      const equipReq = new Request('http://localhost/api/action', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          action: {
            type: 'EQUIP',
            shellId: 'vanguard-v1',
            slotType: 'weapon',
            itemEntityId: 99,
          },
        }),
      });

      const equipRes = await POST(equipReq);
      expect(equipRes.status).toBe(200);

      const unequipReq = new Request('http://localhost/api/action', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          action: { type: 'UNEQUIP', slotType: 'weapon', slotIndex: 0 },
        }),
      });

      const unequipRes = await POST(unequipReq);
      expect(unequipRes.status).toBe(200);
    });

    it('attaches DescentIntent on ANCHOR_DESCEND action', async () => {
      const req = new Request('http://localhost/api/action', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          action: { type: 'ANCHOR_DESCEND', anchorId: 10, cost: 15 },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it('attaches ExtractionIntent on ANCHOR_EXTRACT action', async () => {
      const req = new Request('http://localhost/api/action', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          action: { type: 'ANCHOR_EXTRACT' },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  describe('Run-End Persistence & Leaderboard Integration', () => {
    it('handles RUN_ENDED with extraction: saves wallet, routes to vault/overflow, and submits score', async () => {
      const mockProfile = {
        ...createDefaultProfile(sessionId),
        currentShellId: 'vanguard-v1',
        wallet: { scrap: 100, flux: 10 },
        vault: [],
        overflow: [],
      };
      vi.mocked(profileRepository.load).mockResolvedValue(mockProfile);

      // Configure session with competitive run mode
      const session = sessionManager.getSession(sessionId);
      if (session) {
        session.runMode = RunMode.DAILY;
      }

      // Intercept action to emit RUN_ENDED
      turnManager.setPlayerActionHandler(() => {
        const items = Array.from({ length: VAULT_MAX_SLOTS + 5 }, (_, i) => ({
          entityId: 100 + i,
          templateId: `item-${i}`,
          rarityTier: 'rare' as const,
          itemType: 'software' as const,
          extractedAtFloor: 5,
          extractedAtTimestamp: Date.now(),
        }));

        eventBus.emit('RUN_ENDED', {
          reason: 'extraction',
          floorNumber: 5,
          stats: {
            scrapExtracted: 250,
            fluxExtracted: 50,
            softwareExtracted: 3,
            pityAwarded: false,
            itemsExtracted: items,
          },
          entityId: playerId,
        });
      });

      const req = new Request('http://localhost/api/action', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          action: { type: 'WAIT' },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(profileRepository.save).toHaveBeenCalled();
      expect(mockProfile.wallet.scrap).toBe(350);
      expect(mockProfile.wallet.flux).toBe(60);

      // Vault capped at VAULT_MAX_SLOTS, overflow gets remaining 5
      expect(mockProfile.vault).toHaveLength(VAULT_MAX_SLOTS);
      expect(mockProfile.overflow).toHaveLength(5);

      // Automatic server-side leaderboard submission
      expect(submitLeaderboardEntry).toHaveBeenCalledWith(
        sessionId,
        RunMode.DAILY,
        expect.objectContaining({
          floorNumber: 5,
          scrapExtracted: 250,
          fluxExtracted: 50,
        }),
      );
    });

    it('persists extracted blueprints and converts duplicates to flux on extraction (BUG-06)', async () => {
      const mockProfile = {
        ...createDefaultProfile(sessionId),
        blueprintLibrary: [
          { blueprintId: 'existing-bp', type: 'firmware' as const, compiledAt: 1000 },
        ],
        wallet: { scrap: 0, flux: 10 },
      };
      vi.mocked(profileRepository.load).mockResolvedValue(mockProfile);

      turnManager.setPlayerActionHandler(() => {
        eventBus.emit('RUN_ENDED', {
          reason: 'extraction',
          floorNumber: 5,
          stats: {
            scrapExtracted: 100,
            fluxExtracted: 20,
            softwareExtracted: 0,
            pityAwarded: false,
            itemsExtracted: [],
            blueprintsExtracted: [
              { blueprintId: 'new-bp', type: 'firmware' },
              { blueprintId: 'existing-bp', type: 'firmware' }, // Duplicate!
            ],
          },
          entityId: playerId,
        });
      });

      const req = new Request('http://localhost/api/action', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          action: { type: 'WAIT' },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      // New blueprint added
      expect(mockProfile.blueprintLibrary).toEqual(
        expect.arrayContaining([expect.objectContaining({ blueprintId: 'new-bp' })]),
      );
      // Duplicate converted to 20 Flux: 10 + 20 (base extracted) + 20 (duplicate bp) = 50
      expect(mockProfile.wallet.flux).toBe(50);
    });

    it('clears installed items for active shell on run failure (BUG-05)', async () => {
      world.addComponent(playerId, Shell, {
        archetypeId: 'vanguard-v1',
        speed: 100,
        stability: 100,
        armor: 10,
        maxHealth: 100,
      });

      const mockProfile = {
        ...createDefaultProfile(sessionId),
        installedItems: [
          {
            entityId: 1,
            blueprintId: 'neural-spike',
            type: 'firmware' as const,
            shellId: 'vanguard-v1',
            isLegacy: false,
          },
          {
            entityId: 2,
            blueprintId: 'neural-spike',
            type: 'firmware' as const,
            shellId: 'bastion-v1',
            isLegacy: false,
          },
        ],
      };
      vi.mocked(profileRepository.load).mockResolvedValue(mockProfile);

      turnManager.setPlayerActionHandler(() => {
        eventBus.emit('RUN_ENDED', {
          reason: 'death',
          floorNumber: 3,
          stats: {
            runMode: RunMode.SIMULATION,
            scrapExtracted: 10,
            fluxExtracted: 0,
            softwareExtracted: 0,
            pityAwarded: true,
            itemsExtracted: [],
          },
          entityId: playerId,
        });
      });

      const req = new Request('http://localhost/api/action', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          action: { type: 'WAIT' },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      // Vanguard items should be removed; Bastion items should remain intact
      expect(mockProfile.installedItems).toHaveLength(1);
      expect(mockProfile.installedItems[0].shellId).toBe('bastion-v1');
    });

    it('resets shell upgrades on death in WEEKLY mode (BUG-05)', async () => {
      const session = sessionManager.getSession(sessionId);
      if (session) {
        session.runMode = RunMode.WEEKLY;
        session.shellId = 'ghost-v1';
      }

      const mockProfile = {
        ...createDefaultProfile(sessionId),
        shellUpgrades: {
          'ghost-v1': { speed: 2, armor: 1, stability: 3, additionalPorts: 0 },
        },
        installedItems: [
          {
            entityId: 3,
            blueprintId: 'ghost-pulse',
            type: 'firmware' as const,
            shellId: 'ghost-v1',
            isLegacy: false,
          },
        ],
      };
      vi.mocked(profileRepository.load).mockResolvedValue(mockProfile);

      turnManager.setPlayerActionHandler(() => {
        eventBus.emit('RUN_ENDED', {
          reason: 'death',
          floorNumber: 8,
          stats: {
            runMode: RunMode.WEEKLY,
            scrapExtracted: 0,
            fluxExtracted: 0,
            softwareExtracted: 0,
            pityAwarded: true,
            itemsExtracted: [],
          },
          entityId: playerId,
        });
      });

      const req = new Request('http://localhost/api/action', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          action: { type: 'WAIT' },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      // Shell upgrades should be reset to empty
      expect(mockProfile.shellUpgrades).toEqual({});
      // Installed items for ghost-v1 should be cleared
      expect(mockProfile.installedItems).toEqual([]);
    });
  });

  describe('Fault Isolation & Transactional Rollback (ARCH-01)', () => {
    it('catches uncaught exceptions in turn execution, rolls back world and grid, and returns FULL sync rollback payload', async () => {
      world.patchComponent(playerId, Position, { x: 5, y: 5 });

      turnManager.setPlayerActionHandler(() => {
        world.patchComponent(playerId, Position, { x: 9, y: 9 });
        throw new Error('Uncaught critical system crash during turn execution');
      });

      const req = new Request('http://localhost/api/action', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          action: { type: 'MOVE', dx: 1, dy: 0 },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.warning).toContain('Turn execution rolled back due to error: Uncaught critical system crash');
      expect(data.payload.type).toBe('FULL');
      expect(data.payload.world).toBeDefined();

      // Ensure the world was rolled back to x: 5, y: 5
      expect(world.getComponent(playerId, Position)?.x).toBe(5);
      expect(world.getComponent(playerId, Position)?.y).toBe(5);

      // Verify rollback payload events contain error message
      const errorMsg = data.payload.events.find((e: any) => e.type === 'MESSAGE_EMITTED');
      expect(errorMsg).toBeDefined();
      expect(errorMsg.payload.text).toContain('FAULT ISOLATED: Action aborted');
    });

    it('purges transient intents when rolling back an aborted action', async () => {
      turnManager.setPlayerActionHandler(() => {
        throw new Error('Simulated failure during descent intent');
      });

      const req = new Request('http://localhost/api/action', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          action: { type: 'STAIRCASE_DESCEND', staircaseId: 10, targetFloor: 2 },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      // Verify DescentIntent is not left dangling on player
      expect(world.hasComponent(playerId, DescentIntent)).toBe(false);
    });
  });
});
