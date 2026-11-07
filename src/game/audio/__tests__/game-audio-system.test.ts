import { describe, it, expect, vi, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { GameEvents } from '@game/events/types';
import { Grid } from '@engine/grid/grid';
import { EventOriginContext } from '@engine/utils/event-context';
import { Position, Shell, AudioProfile } from '@shared/components';
import { createGameAudioSystem } from '../game-audio-system';
import { IAudioEngine } from '@engine/audio';

describe('GameAudioSystem Bridge', () => {
  let world: World<GameEvents>;
  let eventBus: EventBus<GameEvents>;
  let grid: Grid;
  let mockAudioEngine: IAudioEngine;
  let playerId: number;
  let enemyId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameEvents>();
    world = new World<GameEvents>(eventBus);
    grid = new Grid(20, 20);

    mockAudioEngine = {
      init: vi.fn(),
      destroy: vi.fn(),
      playCue: vi.fn(),
      playAmbianceCue: vi.fn(),
      stopCue: vi.fn(),
      stopAllAudio: vi.fn(),
      startHoldRamp: vi.fn(() => 'voice-1'),
      updateHoldRamp: vi.fn(),
      stopHoldRamp: vi.fn(),
      setAmbianceState: vi.fn(),
      getAmbianceState: vi.fn(() => ({
        depthBand: 'MAIN_MENU',
        sectorCondition: null,
        heatTier: 0,
        isAnchorDucked: false,
        isPaused: false,
      })),
      stopAmbiance: vi.fn(),
      updateSettings: vi.fn(),
      getSettings: vi.fn(() => ({
        muted: false,
        masterVolume: 0.8,
        ambianceVolume: 0.6,
        sfxVolume: 0.85,
        uiVolume: 0.75,
      })),
      isMuted: vi.fn(() => false),
    };

    playerId = world.createEntity();
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Shell, {
      archetypeId: 'vanguard-v1',
      speed: 100,
      stability: 100,
      armor: 2,
      maxHealth: 100,
    });

    enemyId = world.createEntity();
    world.addComponent(enemyId, Position, { x: 8, y: 5 });

    EventOriginContext.current = 'client';
  });

  it('plays footstep immediately on client-origin player move and deduplicates matching server replay', () => {
    const audioSystem = createGameAudioSystem({
      world,
      eventBus,
      getPlayerEntity: () => playerId,
      getGrid: () => grid,
      audioEngine: mockAudioEngine,
    });

    // 1. Client prediction: player moves (5,5 -> 5,4)
    EventOriginContext.current = 'client';
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 5,
      fromY: 5,
      toX: 5,
      toY: 4,
    });
    eventBus.flush();

    expect(mockAudioEngine.playCue).toHaveBeenCalledTimes(1);
    const firstCallArgs = (mockAudioEngine.playCue as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(firstCallArgs[0].id).toBe('sfx_step_player');

    // 2. Server reconciliation replay with matching coordinates
    EventOriginContext.current = 'server';
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 5,
      fromY: 5,
      toX: 5,
      toY: 4,
    });
    eventBus.flush();

    // Should NOT play second sound (deduplicated)
    expect(mockAudioEngine.playCue).toHaveBeenCalledTimes(1);

    audioSystem.destroy();
  });

  it('plays custom shell step cue for Bastion chassis', () => {
    world.patchComponent(playerId, Shell, { archetypeId: 'bastion-v1' });

    const audioSystem = createGameAudioSystem({
      world,
      eventBus,
      getPlayerEntity: () => playerId,
      getGrid: () => grid,
      audioEngine: mockAudioEngine,
    });

    EventOriginContext.current = 'client';
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 5,
      fromY: 5,
      toX: 5,
      toY: 4,
    });
    eventBus.flush();

    expect(mockAudioEngine.playCue).toHaveBeenCalledTimes(1);
    const args = (mockAudioEngine.playCue as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args[0].id).toBe('sfx_step_bastion');

    audioSystem.destroy();
  });

  it('plays spatial audio for enemy movement', () => {
    const audioSystem = createGameAudioSystem({
      world,
      eventBus,
      getPlayerEntity: () => playerId,
      getGrid: () => grid,
      audioEngine: mockAudioEngine,
    });

    EventOriginContext.current = 'server';
    eventBus.emit('ENTITY_MOVED', {
      entityId: enemyId,
      fromX: 8,
      fromY: 5,
      toX: 9,
      toY: 5,
    });
    eventBus.flush();

    expect(mockAudioEngine.playCue).toHaveBeenCalledTimes(1);
    const args = (mockAudioEngine.playCue as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args[0].id).toBe('sfx_step_enemy');
    expect(args[1].spatial).toBeDefined();
    expect(args[1].spatial.sourceX).toBe(9);
    expect(args[1].spatial.sourceY).toBe(5);

    audioSystem.destroy();
  });

  it('plays combat damage and death sounds', () => {
    const audioSystem = createGameAudioSystem({
      world,
      eventBus,
      getPlayerEntity: () => playerId,
      getGrid: () => grid,
      audioEngine: mockAudioEngine,
    });

    // Player takes damage
    eventBus.emit('DAMAGE_DEALT', {
      attackerId: enemyId,
      defenderId: playerId,
      amount: 5,
    });
    eventBus.flush();
    expect(mockAudioEngine.playCue).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'sfx_player_damaged' }),
      expect.anything(),
    );

    // Enemy dies
    eventBus.emit('ENTITY_DIED', {
      entityId: enemyId,
      killerId: playerId,
      isPlayer: false,
    });
    eventBus.flush();
    expect(mockAudioEngine.playCue).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'sfx_enemy_death' }),
      expect.anything(),
    );

    // Player dies
    eventBus.emit('ENTITY_DIED', {
      entityId: playerId,
      killerId: enemyId,
      isPlayer: true,
    });
    eventBus.flush();
    expect(mockAudioEngine.playCue).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'sfx_bsod_fatal' }),
      expect.anything(),
    );

    audioSystem.destroy();
  });

  it('ducks ambiance on APPLY_WORLD_FILTER and restores on REMOVE_WORLD_FILTER', () => {
    const audioSystem = createGameAudioSystem({
      world,
      eventBus,
      getPlayerEntity: () => playerId,
      getGrid: () => grid,
      audioEngine: mockAudioEngine,
    });

    eventBus.emit('APPLY_WORLD_FILTER', { filterType: 'desaturation' });
    eventBus.flush();
    expect(mockAudioEngine.setAmbianceState).toHaveBeenCalledWith({ isAnchorDucked: true });

    eventBus.emit('REMOVE_WORLD_FILTER', { filterType: 'desaturation' });
    eventBus.flush();
    expect(mockAudioEngine.setAmbianceState).toHaveBeenCalledWith({ isAnchorDucked: false });

    audioSystem.destroy();
  });

  it('triggers kernel panic alarm when heat exceeds maxSafe', () => {
    const audioSystem = createGameAudioSystem({
      world,
      eventBus,
      getPlayerEntity: () => playerId,
      getGrid: () => grid,
      audioEngine: mockAudioEngine,
    });

    eventBus.emit('HEAT_CHANGED', {
      entityId: playerId,
      oldHeat: 90,
      newHeat: 105,
      maxSafe: 100,
    });
    eventBus.flush();

    expect(mockAudioEngine.playCue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sfx_kernel_panic_alarm' }),
      expect.anything(),
    );

    audioSystem.destroy();
  });
});
