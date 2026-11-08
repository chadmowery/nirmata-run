import { Assets, Sprite } from 'pixi.js';
import { EntityId } from '../engine/ecs/types';
import {
  AnimationClipDef,
  AnimationStateKey,
  ThemedTilesetManifest,
} from '@shared/tileset-types';
import { getTextureForSpriteKey, resolveFallbackSpriteKey } from './sprite-map';
import { getActiveThemeId } from './assets';
import baseTilesetJson from '../../public/assets/tileset.json';

export interface EntityAnimRuntimeState {
  entityId: EntityId;
  baseSpriteKey: string;
  animationSetKey: string;
  /** Ambient looping state derived from ECS components ('idle' | 'locked' | 'searched' | 'corrupted' | 'open'). */
  ambientState: AnimationStateKey;
  /** Optional one-shot override state ('move' | 'attack' | 'hit' | 'interact' | 'death'). */
  transientState: AnimationStateKey | null;
  elapsedMs: number;
  lastRenderedFrameKey: string;
  speedMultiplier: number;
  paused: boolean;
  desyncPhase: boolean;
  phaseOffsetMs: number;
}

export interface StepResult {
  frameKey: string;
  frameIndex: number;
  isFinished: boolean;
}

const STATE_PRIORITIES: Record<AnimationStateKey, number> = {
  death: 5,
  attack: 4,
  hit: 3,
  move: 2,
  interact: 1,
  idle: 0,
  locked: 0,
  open: 0,
  searched: 0,
  corrupted: 0,
};

/**
 * Checks if the user has requested reduced motion.
 */
export function isPrefersReducedMotion(): boolean {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return false;
}

/**
 * Mathematical frame progression for an animation clip supporting loop, pingpong, and once modes.
 */
export function stepAnimationClip(
  clip: AnimationClipDef,
  elapsedMs: number,
  entityId: number = 0,
  desyncPhase: boolean = true,
): StepResult {
  const frames = clip.frames;
  const N = frames.length;
  if (N <= 1) {
    return { frameKey: frames[0] ?? '', frameIndex: 0, isFinished: true };
  }

  // Construct effective frame sequence seq
  let seq: number[];
  if (clip.loop === 'pingpong') {
    if (N === 2) {
      seq = [0, 1];
    } else {
      seq = [];
      for (let i = 0; i < N; i++) seq.push(i);
      for (let i = N - 2; i >= 1; i--) seq.push(i);
    }
  } else {
    // 'loop' or 'once'
    seq = frames.map((_, i) => i);
  }

  const M = seq.length;
  const durations: number[] = new Array(M);
  let totalCycleDuration = 0;
  const defaultDuration = 1000 / (clip.fps > 0 ? clip.fps : 6);

  for (let k = 0; k < M; k++) {
    const origFrameIdx = seq[k];
    const dur = clip.frameDurationsMs?.[origFrameIdx] ?? defaultDuration;
    durations[k] = dur;
    totalCycleDuration += dur;
  }

  if (totalCycleDuration <= 0) {
    return { frameKey: frames[0] ?? '', frameIndex: 0, isFinished: true };
  }

  // For 'once' clips
  if (clip.loop === 'once') {
    if (elapsedMs >= totalCycleDuration) {
      const lastOrigIdx = seq[M - 1];
      return { frameKey: frames[lastOrigIdx] ?? '', frameIndex: lastOrigIdx, isFinished: true };
    }
    let acc = 0;
    for (let k = 0; k < M; k++) {
      acc += durations[k];
      if (elapsedMs < acc) {
        const origIdx = seq[k];
        return { frameKey: frames[origIdx] ?? '', frameIndex: origIdx, isFinished: false };
      }
    }
    const lastOrigIdx = seq[M - 1];
    return { frameKey: frames[lastOrigIdx] ?? '', frameIndex: lastOrigIdx, isFinished: true };
  }

  // Looping / Pingpong clips
  const shouldDesync = desyncPhase && (clip.desyncPhase ?? true);
  const phaseOffsetMs = shouldDesync
    ? ((entityId * 2654435761) >>> 0) % totalCycleDuration
    : 0;

  const t = (elapsedMs + phaseOffsetMs) % totalCycleDuration;
  let acc = 0;
  for (let k = 0; k < M; k++) {
    acc += durations[k];
    if (t < acc) {
      const origIdx = seq[k];
      return { frameKey: frames[origIdx] ?? '', frameIndex: origIdx, isFinished: false };
    }
  }

  return { frameKey: frames[0] ?? '', frameIndex: 0, isFinished: false };
}

/**
 * Resolves an AnimationClipDef from manifest dictionary given an animation set key and state key.
 */
export function resolveClipFromManifest(
  manifest: unknown,
  animSetKey: string,
  stateKey: AnimationStateKey,
): AnimationClipDef | null {
  if (!manifest || typeof manifest !== 'object') return null;
  const typedManifest = manifest as Partial<ThemedTilesetManifest>;
  const animations = typedManifest.animations;
  if (!animations) return null;

  let entry = animations[animSetKey];
  if (!entry) {
    const fallbackKey = resolveFallbackSpriteKey(animSetKey);
    if (fallbackKey && animations[fallbackKey]) {
      entry = animations[fallbackKey];
    }
  }
  if (!entry) return null;

  if ('frames' in entry && Array.isArray((entry as AnimationClipDef).frames)) {
    return stateKey === 'idle' ? (entry as AnimationClipDef) : null;
  }

  const set = entry as Record<string, AnimationClipDef | undefined>;
  return set[stateKey] ?? null;
}

/**
 * Client-only Sprite Animation State Machine and Sparse Frame Renderer.
 */
export class SpriteAnimator {
  private runtimeStates = new Map<EntityId, EntityAnimRuntimeState>();
  private customManifest: ThemedTilesetManifest | null = null;

  /**
   * Sets a custom manifest override (useful for testing or studio previews).
   */
  public setCustomManifest(manifest: ThemedTilesetManifest | null): void {
    this.customManifest = manifest;
  }

  /**
   * Retrieves the active animation manifest (checking custom override, active PixiJS theme, or default tileset.json).
   */
  public getActiveManifest(): unknown {
    if (this.customManifest) return this.customManifest;

    const hasAssets = typeof Assets !== 'undefined' && typeof Assets.get === 'function';
    const activeTheme = getActiveThemeId?.() ?? 'default';

    if (hasAssets && activeTheme !== 'default') {
      const themed = Assets.get(`tileset_${activeTheme}`);
      if (themed?.data?.animations) return themed.data;
    }

    if (hasAssets) {
      const base = Assets.get('tileset');
      if (base?.data?.animations) return base.data;
    }

    return baseTilesetJson;
  }

  /**
   * Resolves a clip for a given animation set key and state.
   */
  public getClip(animSetKey: string, state: AnimationStateKey): AnimationClipDef | null {
    const manifest = this.getActiveManifest();
    return resolveClipFromManifest(manifest, animSetKey, state);
  }

  /**
   * Registers or updates an entity's animation tracking configuration.
   */
  public registerEntity(
    entityId: EntityId,
    config: {
      key?: string;
      baseSpriteKey?: string;
      animationSet?: string;
      animationSetKey?: string;
      speedMultiplier?: number;
      paused?: boolean;
      desyncPhase?: boolean;
      initialState?: AnimationStateKey;
    },
  ): EntityAnimRuntimeState {
    const baseSpriteKey = config.key ?? config.baseSpriteKey ?? '';
    const animSetKey = config.animationSet ?? config.animationSetKey ?? baseSpriteKey;
    const existing = this.runtimeStates.get(entityId);

    if (existing) {
      if (existing.baseSpriteKey !== baseSpriteKey || existing.animationSetKey !== animSetKey) {
        existing.baseSpriteKey = baseSpriteKey;
        existing.animationSetKey = animSetKey;
        existing.elapsedMs = 0;
        existing.transientState = null;
        existing.lastRenderedFrameKey = '';
      }
      if (config.speedMultiplier !== undefined) existing.speedMultiplier = config.speedMultiplier;
      if (config.paused !== undefined) existing.paused = config.paused;
      if (config.desyncPhase !== undefined) existing.desyncPhase = config.desyncPhase;
      return existing;
    }

    const ambientState = config.initialState ?? 'idle';
    const clip = this.getClip(animSetKey, ambientState);
    const initialFrame = clip?.frames[0] ?? baseSpriteKey;

    const newState: EntityAnimRuntimeState = {
      entityId,
      baseSpriteKey,
      animationSetKey: animSetKey,
      ambientState,
      transientState: null,
      elapsedMs: 0,
      lastRenderedFrameKey: initialFrame === baseSpriteKey ? baseSpriteKey : '',
      speedMultiplier: config.speedMultiplier ?? 1,
      paused: config.paused ?? false,
      desyncPhase: config.desyncPhase ?? true,
      phaseOffsetMs: 0,
    };

    this.runtimeStates.set(entityId, newState);
    return newState;
  }

  /**
   * Sets paused state for an entity (locks to Frame 0 when true).
   */
  public setPaused(entityId: EntityId, paused: boolean): void {
    const record = this.runtimeStates.get(entityId);
    if (record) {
      record.paused = paused;
    }
  }

  /**
   * Sets desyncPhase flag for an entity.
   */
  public setDesyncPhase(entityId: EntityId, desyncPhase: boolean): void {
    const record = this.runtimeStates.get(entityId);
    if (record) {
      record.desyncPhase = desyncPhase;
    }
  }

  /**
   * Unregisters an entity when destroyed.
   */
  public unregisterEntity(entityId: EntityId): void {
    this.runtimeStates.delete(entityId);
  }

  /**
   * Sets an entity's ambient looping state ('idle', 'locked', 'searched', 'corrupted').
   */
  public setAmbientState(entityId: EntityId, state: AnimationStateKey): void {
    const record = this.runtimeStates.get(entityId);
    if (!record) return;

    if (record.ambientState !== state) {
      record.ambientState = state;
      // If no transient clip is playing, reset elapsed clock to begin new ambient clip cleanly
      if (!record.transientState) {
        record.elapsedMs = 0;
      }
    }
  }

  /**
   * Triggers a transient one-shot animation ('move', 'attack', 'hit', 'interact', 'death').
   */
  public triggerState(entityId: EntityId, state: AnimationStateKey): void {
    const record = this.runtimeStates.get(entityId);
    if (!record) return;

    // Death clip cannot be preempted
    if (record.transientState === 'death' && state !== 'death') {
      return;
    }

    // Only preempt if new state has higher or equal priority
    const currentPriority = record.transientState ? STATE_PRIORITIES[record.transientState] : -1;
    const newPriority = STATE_PRIORITIES[state];

    if (newPriority >= currentPriority) {
      record.transientState = state;
      record.elapsedMs = 0;
    }
  }

  /**
   * Ticks animation timers and applies sparse texture pointer updates.
   */
  public tick(
    deltaMs: number,
    fovSet?: Set<string>,
    getPositionFn?: (id: EntityId) => { x: number; y: number } | undefined,
    getSpriteFn?: (id: EntityId) => Sprite | undefined,
  ): void {
    const reducedMotion = isPrefersReducedMotion();

    for (const record of this.runtimeStates.values()) {
      if (record.paused) {
        // Spec §4.2: paused locks the sprite to Frame 0 of its current state
        const activeClip =
          (record.transientState ? this.getClip(record.animationSetKey, record.transientState) : null) ??
          this.getClip(record.animationSetKey, record.ambientState) ??
          this.getClip(record.animationSetKey, 'idle');
        const frame0 = activeClip?.frames[0] ?? record.baseSpriteKey;
        this.applySparseTexture(record, frame0, getSpriteFn);
        continue;
      }

      if (getSpriteFn) {
        const sprite = getSpriteFn(record.entityId);
        if (sprite && sprite.visible === false) {
          record.transientState = null;
          continue;
        }
      }

      // 1. Fog-of-War Freezing (U1 Invariant):
      // If entity is positioned on a tile outside active FOV, freeze on Frame 0 of ambient state.
      if (fovSet && getPositionFn) {
        const pos = getPositionFn(record.entityId);
        if (pos) {
          const tileKey = `${pos.x},${pos.y}`;
          if (!fovSet.has(tileKey)) {
            // Outside player FOV -> lock to Frame 0, clear transient state and skip elapsed clock
            record.transientState = null;
            const ambientClip = this.getClip(record.animationSetKey, record.ambientState);
            const frozenFrame = ambientClip?.frames[0] ?? record.baseSpriteKey;
            this.applySparseTexture(record, frozenFrame, getSpriteFn);
            continue;
          }
        }
      }

      // 2. Resolve Active Clip
      let activeClip: AnimationClipDef | null = null;
      let isTransient = false;

      if (record.transientState) {
        activeClip = this.getClip(record.animationSetKey, record.transientState);
        if (activeClip) {
          isTransient = true;
        } else {
          // If no clip defined for transient state, clear it immediately
          record.transientState = null;
        }
      }

      if (!activeClip) {
        activeClip = this.getClip(record.animationSetKey, record.ambientState);
        // Fallback to idle if ambient state is not explicitly defined
        if (!activeClip && record.ambientState !== 'idle') {
          activeClip = this.getClip(record.animationSetKey, 'idle');
        }
      }

      // 3. Fallback: if no animation clip exists, hold static base sprite
      if (!activeClip) {
        this.applySparseTexture(record, record.baseSpriteKey, getSpriteFn);
        continue;
      }

      // 4. Reduced Motion (U11 Invariant):
      // Ambient loops hold Frame 0, but one-shot clips (move/attack/hit/interact) still play
      if (reducedMotion && !isTransient) {
        const frame0 = activeClip.frames[0] ?? record.baseSpriteKey;
        this.applySparseTexture(record, frame0, getSpriteFn);
        continue;
      }

      // 5. Advance Timer and Step Frame
      record.elapsedMs += deltaMs * record.speedMultiplier;
      const useDesync = record.desyncPhase && (activeClip.desyncPhase ?? true);
      const stepResult = stepAnimationClip(
        activeClip,
        record.elapsedMs,
        record.entityId,
        useDesync,
      );

      // 6. Handle One-Shot Completion
      if (isTransient && stepResult.isFinished) {
        if (activeClip.nextState) {
          record.transientState = activeClip.nextState;
          record.elapsedMs = 0;
        } else {
          record.transientState = null;
          record.elapsedMs = 0;
        }
      }

      // 7. Sparse Texture Pointer Update
      this.applySparseTexture(record, stepResult.frameKey, getSpriteFn);
    }
  }

  private applySparseTexture(
    record: EntityAnimRuntimeState,
    targetFrameKey: string,
    getSpriteFn?: (id: EntityId) => Sprite | undefined,
  ): void {
    if (targetFrameKey !== record.lastRenderedFrameKey) {
      record.lastRenderedFrameKey = targetFrameKey;
      if (getSpriteFn) {
        const sprite = getSpriteFn(record.entityId);
        if (sprite) {
          sprite.texture = getTextureForSpriteKey(targetFrameKey);
        }
      }
    }
  }

  /**
   * Returns an entity's current runtime state.
   */
  public getEntityState(entityId: EntityId): EntityAnimRuntimeState | undefined {
    return this.runtimeStates.get(entityId);
  }

  /**
   * Clears all animation runtime states.
   */
  public clear(): void {
    this.runtimeStates.clear();
  }
}

export const spriteAnimator = new SpriteAnimator();
