import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { TurnManager } from '@engine/turn/turn-manager';
import { EventBus } from '@engine/events/event-bus';
import { EngineEvents } from '@engine/events/types';
import { Position, Health, FloorState, Actor } from '@shared/components';
import {
  buildTurnSnapshot,
  createRedactedCrashPreview,
  createServerCrashDraft,
  createMinimalServer5xxDraft,
} from '../turn-snapshot';
import { draftStore } from '@/server/reports/draft-store';

describe('turn-snapshot & server crash capture', () => {
  let bus: EventBus<EngineEvents>;
  let world: World<EngineEvents>;
  let turnManager: TurnManager<EngineEvents>;
  let playerId: number;

  beforeEach(() => {
    draftStore.clear();
    bus = new EventBus<EngineEvents>();
    world = new World<EngineEvents>(bus);
    turnManager = {
      getTurnNumber: () => 1,
      getPhase: () => 'ACTION',
      isPaused: false,
    } as unknown as TurnManager<EngineEvents>;

    playerId = world.createEntity();
    world.addComponent(playerId, Position, { x: 5, y: 10 });
    world.addComponent(playerId, Health, { current: 80, max: 100, isAlive: true });
    world.addComponent(playerId, FloorState, {
      currentFloor: 3,
      maxFloor: 15,
      runSeed: '987654321',
      sectorCondition: 'THERMAL_SURGE',
    });
  });

  it('builds full turn snapshot with seed and components', () => {
    const enemyId = world.createEntity();
    world.addComponent(enemyId, Actor, { isPlayer: false });
    world.addComponent(enemyId, Position, { x: 6, y: 10 });
    world.addComponent(enemyId, Health, { current: 30, max: 30, isAlive: true });

    const ctx = {
      sessionId: 'sess_snap_test',
      action: { type: 'MOVE', direction: 'EAST' },
      playerId,
      world,
      turnManager,
      error: new TypeError('Cannot read properties of undefined'),
    };

    const snapshot = buildTurnSnapshot(ctx);
    expect(snapshot.runSeed).toBe('987654321');
    expect(snapshot.floor).toBe(3);
    expect(snapshot.player.pos).toEqual({ x: 5, y: 10 });
    expect(snapshot.player.health?.current).toBe(80);
    expect(snapshot.livingEnemies.length).toBe(1);
    expect(snapshot.livingEnemies[0].id).toBe(enemyId);
    expect(snapshot.error.name).toBe('TypeError');
  });

  it('generates redacted crash preview omitting run seed and hidden details', () => {
    const ctx = {
      sessionId: 'sess_snap_test',
      action: { type: 'MOVE' },
      playerId,
      world,
      turnManager,
      error: new Error('Simulation fault'),
    };

    const snapshot = buildTurnSnapshot(ctx);
    const preview = createRedactedCrashPreview(snapshot);

    expect(preview.errorName).toBe('Error');
    expect(preview.errorMessage).toBe('Simulation fault');
    expect(preview.floor).toBe(3);
    // Seed MUST NOT be in preview
    expect((preview as Record<string, unknown>).runSeed).toBeUndefined();
    expect(preview.sealedManifest.length).toBeGreaterThan(0);
  });

  it('creates server crash draft, stores in DraftStore, and returns offer', () => {
    const ctx = {
      sessionId: 'sess_draft_create',
      action: { type: 'ATTACK' },
      playerId,
      world,
      turnManager,
      error: new RangeError('Index out of bounds'),
    };

    const offer = createServerCrashDraft(ctx);
    expect(offer.draftId).toBeDefined();
    expect(offer.fingerprint.length).toBe(16);
    expect(offer.preview.errorName).toBe('RangeError');

    // Retrieve from store to ensure sealed runSeed is preserved
    const retrieved = draftStore.get(offer.draftId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.sealed.runSeed).toBe('987654321');
  });

  it('creates minimal SERVER_5XX draft when full ECS snapshot is unavailable (H-1)', () => {
    const offer = createMinimalServer5xxDraft({
      sessionId: 'sess_5xx_minimal',
      action: { type: 'WAIT' },
      error: new Error('Session lock acquisition failed'),
    });

    expect(offer.source).toBe('SERVER_5XX');
    expect(offer.preview.actionType).toBe('WAIT');
    const saved = draftStore.get(offer.draftId);
    expect(saved?.source).toBe('SERVER_5XX');
  });
});
