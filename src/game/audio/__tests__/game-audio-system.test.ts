import { describe, it, expect, vi, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { GameEvents } from '@game/events/types';
import { Grid } from '@engine/grid/grid';
import { EventOriginContext } from '@engine/utils/event-context';
import { Position, Shell, AudioProfile, AmbientEmitter, Prop, FloorState } from '@shared/components';
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

  it('plays custom deathCue and hitCue configured in player AudioProfile', () => {
    world.addComponent(playerId, AudioProfile, {
      hitCue: 'sfx_cover_mitigated',
      deathCue: 'sfx_bsod_glitch',
      pitchMultiplier: 1.0,
      volumeMultiplier: 1.0,
    });

    const audioSystem = createGameAudioSystem({
      world,
      eventBus,
      getPlayerEntity: () => playerId,
      getGrid: () => grid,
      audioEngine: mockAudioEngine,
    });

    // Player takes damage with custom hitCue
    eventBus.emit('DAMAGE_DEALT', {
      attackerId: enemyId,
      defenderId: playerId,
      amount: 10,
    });
    eventBus.flush();
    expect(mockAudioEngine.playCue).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'sfx_cover_mitigated' }),
      expect.anything(),
    );

    // Player dies with custom deathCue even after entity is destroyed by GravediggerSystem
    world.destroyEntity(playerId);
    eventBus.emit('ENTITY_DIED', {
      entityId: playerId,
      killerId: enemyId,
      isPlayer: true,
    });
    eventBus.flush();
    expect(mockAudioEngine.playCue).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'sfx_bsod_glitch' }),
      expect.anything(),
    );

    audioSystem.destroy();
  });

  it('triggers spatial loop for nearby AmbientEmitter entities and stops when out of range', () => {
    const ventId = world.createEntity();
    world.addComponent(ventId, Position, { x: 7, y: 5 });
    world.addComponent(ventId, AmbientEmitter, {
      cueId: 'amb_emitter_vent',
      radius: 5,
      baseVolume: 0.4,
      falloff: 'linear',
      requiresFov: false,
      activeOnlyWhenUnsearched: true,
    });

    const audioSystem = createGameAudioSystem({
      world,
      eventBus,
      getPlayerEntity: () => playerId,
      getGrid: () => grid,
      audioEngine: mockAudioEngine,
    });

    // Player at (5, 5), vent at (7, 5) -> distance = 2 <= 5
    EventOriginContext.current = 'client';
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 5,
      fromY: 5,
      toX: 5,
      toY: 5,
    });
    eventBus.flush();

    expect(mockAudioEngine.playCue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'amb_emitter_vent' }),
      expect.objectContaining({
        spatial: expect.objectContaining({ sourceX: 7, sourceY: 5 }),
        volumeMultiplier: 0.4,
      }),
    );

    // Player moves far away to (15, 15) -> distance = ~14 > 5
    world.patchComponent(playerId, Position, { x: 15, y: 15 });
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 5,
      fromY: 5,
      toX: 15,
      toY: 15,
    });
    eventBus.flush();

    expect(mockAudioEngine.stopCue).toHaveBeenCalledWith('amb_emitter_vent');

    audioSystem.destroy();
  });

  it('updates ambiance track and passes active sectorCondition on floor transition', () => {
    const floorEnt = world.createEntity();
    world.addComponent(floorEnt, FloorState, {
      currentFloor: 7,
      maxFloor: 15,
      runSeed: 'seed-42',
      sectorCondition: 'THERMAL_SURGE',
    });

    const audioSystem = createGameAudioSystem({
      world,
      eventBus,
      getPlayerEntity: () => playerId,
      getGrid: () => grid,
      audioEngine: mockAudioEngine,
    });

    eventBus.emit('FLOOR_TRANSITION', {
      floorNumber: 7,
      depthBand: 'STATIC_HORRORS',
    });
    eventBus.flush();

    expect(mockAudioEngine.setAmbianceState).toHaveBeenCalledWith(
      expect.objectContaining({
        depthBand: 'STATIC_HORRORS',
        sectorCondition: 'THERMAL_SURGE',
      }),
    );
    expect(mockAudioEngine.playAmbianceCue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'amb_band_2_static' }),
    );

    audioSystem.destroy();
  });

  it('resolves defender hitCue spatially and attacker attackCue even if defender was destroyed before DAMAGE_DEALT', () => {
    // Enemy has custom hitCue and Position at (8, 8)
    world.addComponent(enemyId, AudioProfile, {
      hitCue: 'sfx_cover_broken',
      deathCue: 'sfx_enemy_death',
      volumeMultiplier: 0.9,
      pitchMultiplier: 1.1,
    });
    world.addComponent(enemyId, Position, { x: 8, y: 8 });

    // Attacker (player) has custom attackCue
    world.addComponent(playerId, AudioProfile, {
      attackCue: 'sfx_melee_hit',
      hitCue: 'sfx_player_damaged',
      deathCue: 'sfx_bsod_fatal',
      pitchMultiplier: 1.0,
      volumeMultiplier: 1.0,
    });

    const audioSystem = createGameAudioSystem({
      world,
      eventBus,
      getPlayerEntity: () => playerId,
      getGrid: () => grid,
      audioEngine: mockAudioEngine,
    });

    // Simulate lethal hit: Gravedigger/applyDelta destroys the defender before DAMAGE_DEALT emits
    world.destroyEntity(enemyId);

    eventBus.emit('DAMAGE_DEALT', {
      attackerId: playerId,
      defenderId: enemyId,
      amount: 50,
    });
    eventBus.flush();

    // Attacker attackCue played globally for player
    expect(mockAudioEngine.playCue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sfx_melee_hit' }),
      expect.objectContaining({ volumeMultiplier: 1.0 }),
    );

    // Defender hitCue resolved from cache and played spatially at (8, 8)
    expect(mockAudioEngine.playCue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sfx_cover_broken' }),
      expect.objectContaining({
        spatial: expect.objectContaining({ sourceX: 8, sourceY: 8 }),
        volumeMultiplier: 0.9,
        pitchMultiplier: 1.1,
      }),
    );

    audioSystem.destroy();
  });

  it('updates positionCache on ENTITY_MOVED and ENEMY_TELEPORTED for subsequent post-mortem combat events', () => {
    world.addComponent(enemyId, AudioProfile, {
      hitCue: 'sfx_cover_broken',
      pitchMultiplier: 1.0,
      volumeMultiplier: 1.0,
    });
    world.addComponent(enemyId, Position, { x: 3, y: 3 });

    const audioSystem = createGameAudioSystem({
      world,
      eventBus,
      getPlayerEntity: () => playerId,
      getGrid: () => grid,
      audioEngine: mockAudioEngine,
    });

    // Enemy moves to (6, 7)
    eventBus.emit('ENTITY_MOVED', {
      entityId: enemyId,
      fromX: 3,
      fromY: 3,
      toX: 6,
      toY: 7,
    });
    eventBus.flush();

    // Destroy enemy entity (killed)
    world.destroyEntity(enemyId);

    // Lethal DAMAGE_DEALT
    eventBus.emit('DAMAGE_DEALT', {
      attackerId: playerId,
      defenderId: enemyId,
      amount: 20,
    });
    eventBus.flush();

    expect(mockAudioEngine.playCue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sfx_cover_broken' }),
      expect.objectContaining({
        spatial: expect.objectContaining({ sourceX: 6, sourceY: 7 }),
      }),
    );

    audioSystem.destroy();
  });
});
