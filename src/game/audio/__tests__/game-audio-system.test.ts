import { describe, it, expect, vi, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { GameEvents } from '@game/events/types';
import { Grid } from '@engine/grid/grid';
import { EventOriginContext } from '@engine/utils/event-context';
import { Position, Shell, AudioProfile, AmbientEmitter, Prop, FloorState, CorruptedNode } from '@shared/components';
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

    let voiceSeq = 100;
    mockAudioEngine = {
      init: vi.fn(),
      destroy: vi.fn(),
      playCue: vi.fn(() => ++voiceSeq),
      playAmbianceCue: vi.fn(),
      stopCue: vi.fn(),
      stopVoice: vi.fn(),
      updateVoiceSpatial: vi.fn(),
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

  it('plays custom shell step cue for Bastion chassis even when player AudioProfile defaults to sfx_step_player', () => {
    // Attach AudioProfile with player.json default 'sfx_step_player'
    world.addComponent(playerId, AudioProfile, {
      stepCue: 'sfx_step_player',
      pitchMultiplier: 1.0,
      volumeMultiplier: 1.0,
    });
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

  it('plays custom shell step cue for Ghost chassis and preserves custom non-default stepCue overrides', () => {
    world.addComponent(playerId, AudioProfile, {
      stepCue: 'sfx_step_player',
      pitchMultiplier: 1.0,
      volumeMultiplier: 1.0,
    });
    world.patchComponent(playerId, Shell, { archetypeId: 'ghost-v1' });

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
    expect((mockAudioEngine.playCue as ReturnType<typeof vi.fn>).mock.calls[0][0].id).toBe('sfx_step_ghost');

    // Now test custom override
    world.patchComponent(playerId, AudioProfile, {
      stepCue: 'sfx_step_enemy',
    });
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 5,
      fromY: 4,
      toX: 5,
      toY: 3,
    });
    eventBus.flush();

    expect(mockAudioEngine.playCue).toHaveBeenCalledTimes(2);
    expect((mockAudioEngine.playCue as ReturnType<typeof vi.fn>).mock.calls[1][0].id).toBe('sfx_step_enemy');

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

    expect(mockAudioEngine.stopVoice).toHaveBeenCalledWith(expect.any(Number), 0.25);

    audioSystem.destroy();
  });

  it('updates spatial parameters dynamically while moving inside AmbientEmitter radius', () => {
    const ventId = world.createEntity();
    world.addComponent(ventId, Position, { x: 7, y: 5 });
    world.addComponent(ventId, AmbientEmitter, {
      cueId: 'amb_emitter_vent',
      radius: 8,
      baseVolume: 0.5,
      falloff: 'linear',
      requiresFov: false,
      activeOnlyWhenUnsearched: false,
    });

    const audioSystem = createGameAudioSystem({
      world,
      eventBus,
      getPlayerEntity: () => playerId,
      getGrid: () => grid,
      audioEngine: mockAudioEngine,
    });

    // Step 1: Player moves to (5, 5) -> emitter starts
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
      expect.anything(),
    );
    const ventCallIndex = (mockAudioEngine.playCue as ReturnType<typeof vi.fn>).mock.calls.findIndex(
      (c) => c[0].id === 'amb_emitter_vent',
    );
    const startVoiceId = (mockAudioEngine.playCue as ReturnType<typeof vi.fn>).mock.results[ventCallIndex].value;

    // Step 2: Player moves closer to (6, 5) -> spatial should update in real-time
    world.patchComponent(playerId, Position, { x: 6, y: 5 });
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 5,
      fromY: 5,
      toX: 6,
      toY: 5,
    });
    eventBus.flush();

    // Should NOT start another vent cue (only footstep for player move)
    const ventCallsAfter = (mockAudioEngine.playCue as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0].id === 'amb_emitter_vent',
    );
    expect(ventCallsAfter.length).toBe(1);

    // Should call updateVoiceSpatial with updated coordinates
    expect(mockAudioEngine.updateVoiceSpatial).toHaveBeenCalledWith(
      startVoiceId,
      expect.objectContaining({ listenerX: 6, listenerY: 5, sourceX: 7, sourceY: 5, maxRadius: 8, falloff: 'linear' }),
      0.5,
    );

    audioSystem.destroy();
  });

  it('isolates stopVoice when two emitters share the same cueId so remaining emitter continues', () => {
    const vent1 = world.createEntity();
    world.addComponent(vent1, Position, { x: 5, y: 6 });
    world.addComponent(vent1, AmbientEmitter, {
      cueId: 'amb_emitter_vent',
      radius: 4,
      baseVolume: 0.4,
      falloff: 'linear',
      requiresFov: false,
      activeOnlyWhenUnsearched: false,
    });

    const vent2 = world.createEntity();
    world.addComponent(vent2, Position, { x: 5, y: 12 });
    world.addComponent(vent2, AmbientEmitter, {
      cueId: 'amb_emitter_vent',
      radius: 4,
      baseVolume: 0.4,
      falloff: 'linear',
      requiresFov: false,
      activeOnlyWhenUnsearched: false,
    });

    const audioSystem = createGameAudioSystem({
      world,
      eventBus,
      getPlayerEntity: () => playerId,
      getGrid: () => grid,
      audioEngine: mockAudioEngine,
    });

    // Player at (5, 5): within vent1 (dist 1 <= 4), out of vent2 (dist 7 > 4)
    EventOriginContext.current = 'client';
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 5,
      fromY: 5,
      toX: 5,
      toY: 5,
    });
    eventBus.flush();

    const vent1Index = (mockAudioEngine.playCue as ReturnType<typeof vi.fn>).mock.calls.findIndex(
      (c) => c[0].id === 'amb_emitter_vent',
    );
    expect(vent1Index).toBeGreaterThanOrEqual(0);
    const vent1Voice = (mockAudioEngine.playCue as ReturnType<typeof vi.fn>).mock.results[vent1Index].value;

    // Player moves to (5, 10): now within vent2 (dist 2 <= 4) and within vent1 (dist 4 <= 4)
    world.patchComponent(playerId, Position, { x: 5, y: 10 });
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 5,
      fromY: 5,
      toX: 5,
      toY: 10,
    });
    eventBus.flush();

    const ventCallsStep2 = (mockAudioEngine.playCue as ReturnType<typeof vi.fn>).mock.calls
      .map((c, i) => ({ cue: c[0], index: i }))
      .filter((item) => item.cue.id === 'amb_emitter_vent');
    expect(ventCallsStep2.length).toBe(2);
    const vent2Voice = (mockAudioEngine.playCue as ReturnType<typeof vi.fn>).mock.results[ventCallsStep2[1].index].value;

    // Player moves to (5, 13): out of vent1 (dist 7 > 4), still within vent2 (dist 1 <= 4)
    world.patchComponent(playerId, Position, { x: 5, y: 13 });
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 5,
      fromY: 10,
      toX: 5,
      toY: 13,
    });
    eventBus.flush();

    // vent1 should be stopped by its voice ID, NOT via stopCue('amb_emitter_vent')
    expect(mockAudioEngine.stopVoice).toHaveBeenCalledWith(vent1Voice, 0.25);
    expect(mockAudioEngine.stopVoice).not.toHaveBeenCalledWith(vent2Voice, expect.anything());

    audioSystem.destroy();
  });

  it('stops ambient emitter when CorruptedNode is disarmed or prop is searched', () => {
    const nodeEntity = world.createEntity();
    world.addComponent(nodeEntity, Position, { x: 6, y: 5 });
    world.addComponent(nodeEntity, AmbientEmitter, {
      cueId: 'amb_emitter_corrupted',
      radius: 6,
      baseVolume: 0.5,
      falloff: 'linear',
      requiresFov: false,
      activeOnlyWhenUnsearched: true,
    });
    world.addComponent(nodeEntity, CorruptedNode, {
      trapType: 'acoustic_alert',
      corruptionLevel: 1,
      isDisarmed: false,
      triggered: false,
      revealed: true,
    });

    const audioSystem = createGameAudioSystem({
      world,
      eventBus,
      getPlayerEntity: () => playerId,
      getGrid: () => grid,
      audioEngine: mockAudioEngine,
    });

    // Player at (5, 5) -> node in range (dist 1 <= 6)
    EventOriginContext.current = 'client';
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 5,
      fromY: 5,
      toX: 5,
      toY: 5,
    });
    eventBus.flush();

    const nodeIndex = (mockAudioEngine.playCue as ReturnType<typeof vi.fn>).mock.calls.findIndex(
      (c) => c[0].id === 'amb_emitter_corrupted',
    );
    expect(nodeIndex).toBeGreaterThanOrEqual(0);
    const nodeVoice = (mockAudioEngine.playCue as ReturnType<typeof vi.fn>).mock.results[nodeIndex].value;

    // Disarm the CorruptedNode
    world.patchComponent(nodeEntity, CorruptedNode, { isDisarmed: true });

    // Player moves slightly -> updateAmbientEmitters runs and stops disarmed node
    eventBus.emit('ENTITY_MOVED', {
      entityId: playerId,
      fromX: 5,
      fromY: 5,
      toX: 5,
      toY: 5,
    });
    eventBus.flush();

    expect(mockAudioEngine.stopVoice).toHaveBeenCalledWith(nodeVoice, 0.25);

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
