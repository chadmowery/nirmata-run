/**
 * Nirmata Runner — Game Audio System Bridge
 * Connects the authoritative ECS World & EventBus to the client AudioEngine.
 * Implements client prediction deduplication, 2D grid spatial audio, and reactive ambiance.
 */

import { World } from '@engine/ecs/world';
import { EntityId } from '@engine/ecs/types';
import { EventBus } from '@engine/events/event-bus';
import { GameEvents } from '@game/events/types';
import { Grid } from '@engine/grid/grid';
import { EventOriginContext } from '@engine/utils/event-context';
import {
  IAudioEngine,
  getAudioEngine,
  AudioEngine,
  PredictionDeduplicator,
  SpatialCoords,
} from '@engine/audio';
import { Position, Shell, AudioProfile, Heat, AmbientEmitter, Prop, FloorState } from '@shared/components';
import { getSoundCue } from './cue-registry';
import { resolveAmbianceForFloor } from '@game/config/ambiance';

export interface GameAudioSystemOptions {
  world: World<GameEvents>;
  eventBus: EventBus<GameEvents>;
  getPlayerEntity: () => EntityId;
  getGrid: () => Grid;
  audioEngine?: IAudioEngine;
}

export interface GameAudioSystem {
  destroy(): void;
  updateAmbianceForFloor(floorNumber: number): void;
}

export function createGameAudioSystem(options: GameAudioSystemOptions): GameAudioSystem {
  const {
    world,
    eventBus,
    getPlayerEntity,
    audioEngine = getAudioEngine(),
  } = options;

  const dedup = new PredictionDeduplicator(2000);
  let currentFovSet = new Set<string>();
  const activeEmitters = new Map<EntityId, string>();

  const getPlayerPosition = (): { x: number; y: number } | null => {
    const pId = getPlayerEntity();
    if (!pId) return null;
    const pos = world.getComponent(pId, Position);
    return pos ? { x: pos.x, y: pos.y } : null;
  };

  const getSpatialCoords = (sourceX: number, sourceY: number): SpatialCoords | undefined => {
    const playerPos = getPlayerPosition();
    if (!playerPos) return undefined;

    const tileKey = `${sourceX},${sourceY}`;
    const isOccluded = currentFovSet.size > 0 && !currentFovSet.has(tileKey);

    return {
      listenerX: playerPos.x,
      listenerY: playerPos.y,
      sourceX,
      sourceY,
      isOccluded,
    };
  };

  const playSpatialCue = (
    cueId: string,
    sourceX: number,
    sourceY: number,
    volumeMultiplier = 1.0,
    pitchMultiplier = 1.0,
  ): void => {
    const cue = getSoundCue(cueId);
    if (!cue) return;
    const spatial = getSpatialCoords(sourceX, sourceY);
    audioEngine.playCue(cue, { spatial, volumeMultiplier, pitchMultiplier });
  };

  const playGlobalCue = (
    cueId: string,
    volumeMultiplier = 1.0,
    pitchMultiplier = 1.0,
  ): void => {
    const cue = getSoundCue(cueId);
    if (!cue) return;
    audioEngine.playCue(cue, { volumeMultiplier, pitchMultiplier });
  };

  // Entity Audio Profile & Position Caches for Death & Cleanup SFX
  // Required because the server's GravediggerSystem destroys entities before or during the turn
  // in which ENTITY_DIED events are dispatched to the client audio system.
  const audioProfileCache = new Map<
    EntityId,
    {
      stepCue?: string;
      attackCue?: string;
      hitCue?: string;
      deathCue?: string;
      pitchMultiplier?: number;
      volumeMultiplier?: number;
    }
  >();

  const positionCache = new Map<EntityId, { x: number; y: number }>();

  const syncEntityCaches = (): void => {
    const profileEntities = world.query(AudioProfile);
    for (const id of profileEntities) {
      const p = world.getComponent(id, AudioProfile);
      if (p) audioProfileCache.set(id, { ...p });
    }

    const posEntities = world.query(Position);
    for (const id of posEntities) {
      const pos = world.getComponent(id, Position);
      if (pos) positionCache.set(id, { x: pos.x, y: pos.y });
    }
  };

  // Initial cache synchronization
  syncEntityCaches();

  const updateAmbientEmitters = (): void => {
    const playerPos = getPlayerPosition();
    if (!playerPos) return;

    const inRangeEntities = new Set<EntityId>();

    for (const entityId of world.query(AmbientEmitter, Position)) {
      const emitter = world.getComponent(entityId, AmbientEmitter);
      const pos = world.getComponent(entityId, Position);
      if (!emitter || !pos) continue;

      // If prop is searched, mute emitter if activeOnlyWhenUnsearched is true
      const prop = world.getComponent(entityId, Prop);
      if (emitter.activeOnlyWhenUnsearched && prop?.isSearched) {
        continue;
      }

      // If requiresFov is true, ensure tile is in active visible set
      const tileKey = `${pos.x},${pos.y}`;
      if (emitter.requiresFov && !currentFovSet.has(tileKey)) {
        continue;
      }

      const dx = pos.x - playerPos.x;
      const dy = pos.y - playerPos.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= emitter.radius) {
        inRangeEntities.add(entityId);
        if (!activeEmitters.has(entityId)) {
          const cue = getSoundCue(emitter.cueId);
          if (cue) {
            const spatial = getSpatialCoords(pos.x, pos.y);
            audioEngine.playCue(cue, {
              spatial,
              volumeMultiplier: emitter.baseVolume,
            });
            activeEmitters.set(entityId, emitter.cueId);
          }
        }
      }
    }

    // Stop emitters that moved out of range or were searched/despawned
    for (const [entityId, cueId] of activeEmitters.entries()) {
      if (!inRangeEntities.has(entityId)) {
        audioEngine.stopCue(cueId);
        activeEmitters.delete(entityId);
      }
    }
  };

  // --- Subscriptions ---

  const unsubs: Array<() => void> = [];

  const subscribe = <K extends keyof GameEvents>(
    type: K,
    handler: (payload: GameEvents[K]) => void,
  ) => {
    eventBus.on(type, handler);
    unsubs.push(() => eventBus.off(type, handler));
  };

  // 1. Movement & Footsteps
  subscribe('ENTITY_MOVED', (payload) => {
    positionCache.set(payload.entityId, { x: payload.toX, y: payload.toY });
    const isPlayer = payload.entityId === getPlayerEntity();
      const origin = EventOriginContext.current;

      if (isPlayer) {
        // Resolve shell-specific footstep cue
        const profile = world.getComponent(payload.entityId, AudioProfile);
        const shell = world.getComponent(payload.entityId, Shell);

        let stepCueId = profile?.stepCue;
        if (!stepCueId || stepCueId === 'sfx_step_player') {
          if (shell?.archetypeId === 'bastion-v1') {
            stepCueId = 'sfx_step_bastion';
          } else if (shell?.archetypeId === 'ghost-v1') {
            stepCueId = 'sfx_step_ghost';
          } else {
            stepCueId = 'sfx_step_player';
          }
        }

        const token = `${payload.entityId}:${payload.fromX},${payload.fromY}->${payload.toX},${payload.toY}`;

        if (origin === 'client') {
          // Play immediately for 0ms player feedback
          playGlobalCue(stepCueId, profile?.volumeMultiplier, profile?.pitchMultiplier);
          dedup.recordPredicted('ENTITY_MOVED', token);
          updateAmbientEmitters();
          return;
        }

        if (origin === 'server') {
          // Deduplicate if matching prediction exists
          if (dedup.consumeIfPredicted('ENTITY_MOVED', token)) {
            updateAmbientEmitters();
            return;
          }
          // Misprediction or server-forced move
          playGlobalCue(stepCueId, profile?.volumeMultiplier, profile?.pitchMultiplier);
          updateAmbientEmitters();
        }
      } else {
        // Enemy footstep / movement
        const profile = world.getComponent(payload.entityId, AudioProfile);
        const stepCueId = profile?.stepCue ?? 'sfx_step_enemy';
        playSpatialCue(
          stepCueId,
          payload.toX,
          payload.toY,
          profile?.volumeMultiplier,
          profile?.pitchMultiplier,
        );
      }
    });

  // 2. Enemy Teleport
  subscribe('ENEMY_TELEPORTED', (payload) => {
    positionCache.set(payload.entityId, { x: payload.toX, y: payload.toY });
    playSpatialCue('sfx_teleport_shift', payload.toX, payload.toY);
  });

  // 3. Combat & Damage
  subscribe('DAMAGE_DEALT', (payload) => {
    syncEntityCaches();

    // Attacker attackCue playback
    const attackerProfile =
      world.getComponent(payload.attackerId, AudioProfile) ||
      audioProfileCache.get(payload.attackerId);
    if (attackerProfile?.attackCue) {
      const isPlayerAttacker = payload.attackerId === getPlayerEntity();
      if (isPlayerAttacker) {
        playGlobalCue(
          attackerProfile.attackCue,
          attackerProfile.volumeMultiplier,
          attackerProfile.pitchMultiplier,
        );
      } else {
        const attackerPos =
          world.getComponent(payload.attackerId, Position) ||
          positionCache.get(payload.attackerId);
        if (attackerPos) {
          playSpatialCue(
            attackerProfile.attackCue,
            attackerPos.x,
            attackerPos.y,
            attackerProfile.volumeMultiplier,
            attackerProfile.pitchMultiplier,
          );
        } else {
          playGlobalCue(
            attackerProfile.attackCue,
            attackerProfile.volumeMultiplier,
            attackerProfile.pitchMultiplier,
          );
        }
      }
    }

    const isPlayerDefender = payload.defenderId === getPlayerEntity();
    if (isPlayerDefender) {
      const defProfile =
        world.getComponent(payload.defenderId, AudioProfile) ||
        audioProfileCache.get(payload.defenderId);
      playGlobalCue(
        defProfile?.hitCue ?? 'sfx_player_damaged',
        defProfile?.volumeMultiplier,
        defProfile?.pitchMultiplier,
      );
      return;
    }

    const defPos =
      world.getComponent(payload.defenderId, Position) ||
      positionCache.get(payload.defenderId);
    const profile =
      world.getComponent(payload.defenderId, AudioProfile) ||
      audioProfileCache.get(payload.defenderId);
    const hitCueId = profile?.hitCue ?? 'sfx_melee_hit';

    if (defPos) {
      playSpatialCue(
        hitCueId,
        defPos.x,
        defPos.y,
        profile?.volumeMultiplier,
        profile?.pitchMultiplier,
      );
    } else {
      playGlobalCue(
        hitCueId,
        profile?.volumeMultiplier,
        profile?.pitchMultiplier,
      );
    }
  });

  // 4. Entity Death
  subscribe('ENTITY_DIED', (payload) => {
    const isPlayer = payload.isPlayer || payload.entityId === getPlayerEntity();
    const profile =
      world.getComponent(payload.entityId, AudioProfile) ||
      audioProfileCache.get(payload.entityId);

    if (isPlayer) {
      const deathCueId = profile?.deathCue ?? 'sfx_bsod_fatal';
      playGlobalCue(
        deathCueId,
        profile?.volumeMultiplier,
        profile?.pitchMultiplier,
      );
      audioProfileCache.delete(payload.entityId);
      positionCache.delete(payload.entityId);
      return;
    }

    const pos =
      world.getComponent(payload.entityId, Position) ||
      positionCache.get(payload.entityId);
    const deathCueId = profile?.deathCue ?? 'sfx_enemy_death';

    if (pos) {
      playSpatialCue(
        deathCueId,
        pos.x,
        pos.y,
        profile?.volumeMultiplier,
        profile?.pitchMultiplier,
      );
    } else {
      playGlobalCue(
        deathCueId,
        profile?.volumeMultiplier,
        profile?.pitchMultiplier,
      );
    }

    audioProfileCache.delete(payload.entityId);
    positionCache.delete(payload.entityId);

    if (activeEmitters.has(payload.entityId)) {
      const cueId = activeEmitters.get(payload.entityId);
      if (cueId) audioEngine.stopCue(cueId);
      activeEmitters.delete(payload.entityId);
    }
  });

  // 5. Healing & Augments
  subscribe('HEALED', () => {
    playGlobalCue('sfx_heal_nanite');
  });

  subscribe('AUGMENT_FLASH', () => {
    playGlobalCue('sfx_augment_proc');
  });

  // 6. Targeting System
  subscribe('TARGETING_STARTED', () => {
    playGlobalCue('sfx_targeting_start');
  });

  subscribe('TARGETING_CURSOR_MOVED', () => {
    playGlobalCue('sfx_targeting_cursor');
  });

  subscribe('TARGETING_CONFIRMED', () => {
    playGlobalCue('sfx_targeting_confirm');
  });

  subscribe('TARGETING_CANCELLED', () => {
    playGlobalCue('sfx_targeting_cancel');
  });

  // 7. Firmware & Heat
  subscribe('FIRMWARE_ACTIVATED', () => {
    playGlobalCue('sfx_firmware_cast');
  });

  subscribe('HEAT_CHANGED', (payload) => {
    const isPlayer = payload.entityId === getPlayerEntity();
    if (!isPlayer) return;

    const playerHeat = world.getComponent(payload.entityId, Heat);
    const maxSafe = playerHeat?.maxSafe ?? payload.maxSafe ?? 100;
    const heatVal = payload.newHeat;

    const currentTier = Math.min(5, Math.floor((heatVal / maxSafe) * 5));
    const oldTier = Math.min(5, Math.floor((payload.oldHeat / maxSafe) * 5));

    if (heatVal >= maxSafe) {
      playGlobalCue('sfx_kernel_panic_alarm');
    } else if (currentTier > oldTier && currentTier >= 2) {
      playGlobalCue('sfx_heat_tier_up');
    }

    audioEngine.setAmbianceState({ heatTier: currentTier });
  });

  subscribe('VENT_COMPLETED', () => {
    playGlobalCue('sfx_vent_purge');
    audioEngine.setAmbianceState({ heatTier: 0 });
  });

  // 8. Loot & Pickups
  subscribe('ITEM_PICKED_UP', () => {
    playGlobalCue('sfx_item_pickup');
  });

  subscribe('CURRENCY_PICKED_UP', () => {
    playGlobalCue('sfx_currency_pickup');
  });

  // 9. Prop Interactions & Locks
  subscribe('PROP_INTERACTED', (payload) => {
    const propPos = world.getComponent(payload.propId, Position);
    const profile = world.getComponent(payload.propId, AudioProfile);
    const interactCueId = profile?.interactCue ?? 'sfx_prop_search';

    if (propPos) {
      playSpatialCue(interactCueId, propPos.x, propPos.y);
    } else {
      playGlobalCue(interactCueId);
    }
    updateAmbientEmitters();
  });

  subscribe('LOCK_UNLOCKED', (payload) => {
    if (payload.method === 'key') {
      playGlobalCue('sfx_lock_keycard');
    } else {
      playGlobalCue('sfx_lock_overclock');
    }
  });

  subscribe('DEAD_DROP_TRANSMITTED', () => {
    playGlobalCue('sfx_dead_drop_uplink');
  });

  // 10. Anchor Interactions
  subscribe('ANCHOR_INTERACTION', () => {
    playGlobalCue('sfx_anchor_handshake');
  });

  subscribe('ANCHOR_DESCEND', () => {
    playGlobalCue('sfx_anchor_descend');
  });

  subscribe('ANCHOR_EXTRACT', () => {
    playGlobalCue('sfx_extract_success');
  });

  // 11. Floor Transition & Ambiance
  const updateAmbianceForFloor = (floorNumber: number): void => {
    // Query FloorState from world for active sector condition
    const floorEntity = world.query(FloorState)[0];
    const floorState = floorEntity ? world.getComponent(floorEntity, FloorState) : null;
    const condition =
      floorState?.sectorCondition && floorState.sectorCondition !== 'NOMINAL'
        ? floorState.sectorCondition
        : null;

    const resolved = resolveAmbianceForFloor(floorNumber, condition);

    const cue = getSoundCue(resolved.cueId);
    if (cue && 'playAmbianceCue' in audioEngine) {
      (audioEngine as AudioEngine).playAmbianceCue(cue);
    }
    audioEngine.setAmbianceState({
      depthBand: resolved.depthBand,
      sectorCondition: condition,
    });
    updateAmbientEmitters();
  };

  subscribe('FLOOR_TRANSITION', (payload) => {
    positionCache.clear();
    audioProfileCache.clear();
    syncEntityCaches();
    updateAmbianceForFloor(payload.floorNumber);
  });

  // 12. World Filter Ducking (Stability Anchor grayscale desaturation)
  subscribe('APPLY_WORLD_FILTER', () => {
    audioEngine.setAmbianceState({ isAnchorDucked: true });
  });

  subscribe('REMOVE_WORLD_FILTER', () => {
    audioEngine.setAmbianceState({ isAnchorDucked: false });
  });

  // 13. FOV Tracking for Spatial Occlusion
  subscribe('FOV_UPDATED', (payload) => {
    currentFovSet = payload.visibleSet;
    syncEntityCaches();
    updateAmbientEmitters();
  });

  return {
    destroy: () => {
      for (const unsub of unsubs) {
        unsub();
      }
      unsubs.length = 0;
      for (const cueId of activeEmitters.values()) {
        audioEngine.stopCue(cueId);
      }
      audioProfileCache.clear();
      positionCache.clear();
      activeEmitters.clear();
      dedup.clear();
    },
    updateAmbianceForFloor,
  };
}
