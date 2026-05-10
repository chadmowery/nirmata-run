import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../route';
import { sessionManager } from '@engine/session/SessionManager';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { TurnManager } from '@engine/turn/turn-manager';
import { EventBus } from '@engine/events/event-bus';
import { Actor, Position, Energy, Health } from '@shared/components';
import { MoveIntent } from '@shared/components/intents';
import { GameAction, DIRECTIONS } from '@game/input/actions';
import { GameplayEvents } from '@shared/events/types';
import { registerCoreSystems } from '@game/systems/registration';
import { AIState, FovAwareness } from '@shared/components';
import { AIBehaviorType, AIBehavior } from '@shared/components/ai-state';

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
    turnManager = new TurnManager(world, eventBus, {
      energyThreshold: 100,
      defaultActionCost: 100,
      waitActionCost: 50,
    });

    // Setup player
    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Energy, { current: 100, speed: 10, threshold: 1000 });
    world.addComponent(playerId, Health, { current: 10, max: 10, isAlive: true });
    grid.addEntity(playerId, 5, 5);

    const dummyEntityRegistry = { create: vi.fn(), get: vi.fn(), has: vi.fn(), register: vi.fn(), getTemplate: vi.fn(), getAllTemplates: vi.fn() } as any;
    const dummyEntityFactory = { create: vi.fn() } as any;
    const dummyComponentRegistry = { get: vi.fn(), has: vi.fn() } as any;

    registerCoreSystems(
      world,
      grid,
      eventBus,
      dummyEntityFactory,
      dummyComponentRegistry
    );

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
      systems: {} as any
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
    const data = await response.json() as any;

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
    const data = await response.json() as any;

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
      sightRadius: 10
    });
    world.addComponent(enemyId, FovAwareness, {
      canSeePlayer: true,
      lastKnownPlayerX: 5,
      lastKnownPlayerY: 5
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
});
