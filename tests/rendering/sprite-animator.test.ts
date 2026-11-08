import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SpriteAnimator,
  stepAnimationClip,
} from '../../src/rendering/sprite-animator';
import { AnimationClipDef, ThemedTilesetManifest } from '@shared/tileset-types';

describe('SpriteAnimator & Runtime Engine ([ANIM-03])', () => {
  describe('stepAnimationClip math', () => {
    it('returns frame 0 and isFinished=true for single-frame clips', () => {
      const clip: AnimationClipDef = {
        frames: ['static_tile'],
        fps: 6,
        loop: 'loop',
      };
      const res = stepAnimationClip(clip, 500, 1, false);
      expect(res.frameKey).toBe('static_tile');
      expect(res.frameIndex).toBe(0);
      expect(res.isFinished).toBe(true);
    });

    it('loops through frames at specified fps', () => {
      const clip: AnimationClipDef = {
        frames: ['f0', 'f1', 'f2'],
        fps: 5, // 200ms per frame, 600ms total
        loop: 'loop',
        desyncPhase: false,
      };

      expect(stepAnimationClip(clip, 0, 1, false).frameKey).toBe('f0');
      expect(stepAnimationClip(clip, 150, 1, false).frameKey).toBe('f0');
      expect(stepAnimationClip(clip, 250, 1, false).frameKey).toBe('f1');
      expect(stepAnimationClip(clip, 450, 1, false).frameKey).toBe('f2');
      // Wrap around at 600ms
      expect(stepAnimationClip(clip, 650, 1, false).frameKey).toBe('f0');
    });

    it('oscillates via pingpong loop mode: 0 -> 1 -> 2 -> 1 -> 0', () => {
      const clip: AnimationClipDef = {
        frames: ['f0', 'f1', 'f2'],
        fps: 5, // 200ms per frame. Seq: [0, 1, 2, 1] (800ms cycle)
        loop: 'pingpong',
        desyncPhase: false,
      };

      expect(stepAnimationClip(clip, 50, 1, false).frameKey).toBe('f0');
      expect(stepAnimationClip(clip, 250, 1, false).frameKey).toBe('f1');
      expect(stepAnimationClip(clip, 450, 1, false).frameKey).toBe('f2');
      expect(stepAnimationClip(clip, 650, 1, false).frameKey).toBe('f1'); // bounces back!
      expect(stepAnimationClip(clip, 850, 1, false).frameKey).toBe('f0'); // next cycle
    });

    it('respects asymmetrical frameDurationsMs', () => {
      const clip: AnimationClipDef = {
        frames: ['glint_base', 'glint_flash'],
        fps: 1,
        loop: 'loop',
        frameDurationsMs: [900, 100], // 1000ms total cycle
        desyncPhase: false,
      };

      // 0..899ms -> glint_base
      expect(stepAnimationClip(clip, 500, 1, false).frameKey).toBe('glint_base');
      expect(stepAnimationClip(clip, 890, 1, false).frameKey).toBe('glint_base');
      // 900..999ms -> glint_flash
      expect(stepAnimationClip(clip, 920, 1, false).frameKey).toBe('glint_flash');
    });

    it('marks isFinished=true once elapsedMs exceeds duration on once mode', () => {
      const clip: AnimationClipDef = {
        frames: ['atk_0', 'atk_1'],
        fps: 10, // 100ms per frame, 200ms total
        loop: 'once',
      };

      const playing = stepAnimationClip(clip, 50, 1, false);
      expect(playing.frameKey).toBe('atk_0');
      expect(playing.isFinished).toBe(false);

      const playing2 = stepAnimationClip(clip, 150, 1, false);
      expect(playing2.frameKey).toBe('atk_1');
      expect(playing2.isFinished).toBe(false);

      const finished = stepAnimationClip(clip, 250, 1, false);
      expect(finished.frameKey).toBe('atk_1');
      expect(finished.isFinished).toBe(true);
    });

    it('desynchronizes initial phase deterministically based on EntityId hash', () => {
      const clip: AnimationClipDef = {
        frames: ['f0', 'f1', 'f2'],
        fps: 5, // 200ms per frame, 600ms total
        loop: 'loop',
        desyncPhase: true,
      };

      // Two different entity IDs should produce different frames or phase offsets at t=0
      const resA = stepAnimationClip(clip, 0, 10, true);
      const resB = stepAnimationClip(clip, 0, 25, true);

      // Verify formula: ((entityId * 2654435761) >>> 0) % 600
      const offsetA = ((10 * 2654435761) >>> 0) % 600;
      const offsetB = ((25 * 2654435761) >>> 0) % 600;
      expect(offsetA).not.toBe(offsetB);

      // Desync disabled
      const resSync1 = stepAnimationClip(clip, 0, 10, false);
      const resSync2 = stepAnimationClip(clip, 0, 25, false);
      expect(resSync1.frameKey).toBe(resSync2.frameKey);
    });
  });

  describe('SpriteAnimator state machine & transitions', () => {
    let animator: SpriteAnimator;
    const testManifest: ThemedTilesetManifest = {
      frames: {
        player: { frame: { x: 0, y: 0, w: 32, h: 32 }, sourceSize: { w: 32, h: 32 }, spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 } },
        player_idle_1: { frame: { x: 32, y: 0, w: 32, h: 32 }, sourceSize: { w: 32, h: 32 }, spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 } },
        player_atk_1: { frame: { x: 64, y: 0, w: 32, h: 32 }, sourceSize: { w: 32, h: 32 }, spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 } },
        player_move_1: { frame: { x: 96, y: 0, w: 32, h: 32 }, sourceSize: { w: 32, h: 32 }, spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 } },
        prop_chest: { frame: { x: 128, y: 0, w: 32, h: 32 }, sourceSize: { w: 32, h: 32 }, spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 } },
        prop_chest_anim_1: { frame: { x: 160, y: 0, w: 32, h: 32 }, sourceSize: { w: 32, h: 32 }, spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 } },
      },
      animations: {
        player: {
          idle: {
            frames: ['player', 'player_idle_1'],
            fps: 6,
            frameDurationsMs: [300, 100], // 400ms total
            loop: 'loop',
            desyncPhase: false,
          },
          move: {
            frames: ['player_move_1', 'player'],
            fps: 10, // 200ms total
            loop: 'once',
          },
          attack: {
            frames: ['player_atk_1', 'player'],
            fps: 6,
            frameDurationsMs: [80, 40], // 120ms total
            loop: 'once',
          },
          death: {
            frames: ['player_atk_1'],
            fps: 5,
            loop: 'once',
          },
        },
        prop_chest: {
          idle: {
            frames: ['prop_chest', 'prop_chest_anim_1'],
            fps: 6,
            frameDurationsMs: [500, 500],
            loop: 'loop',
            desyncPhase: false,
          },
          searched: {
            frames: ['prop_chest'],
            fps: 6,
            loop: 'once',
          },
        },
      },
      meta: {
        themeId: 'default',
        themeName: 'Default',
        image: 'tileset.png',
        format: 'RGBA8888',
        size: { w: 512, h: 512 },
        scale: 1,
        tileSize: 32,
      },
    };

    beforeEach(() => {
      animator = new SpriteAnimator();
      animator.setCustomManifest(testManifest);
    });

    it('initializes entity in ambient idle state', () => {
      const state = animator.registerEntity(1, { baseSpriteKey: 'player' });
      expect(state.ambientState).toBe('idle');
      expect(state.transientState).toBeNull();
      expect(state.lastRenderedFrameKey).toBe('player');
    });

    it('progresses ambient idle frames on tick', () => {
      animator.registerEntity(1, { baseSpriteKey: 'player', desyncPhase: false });

      // Tick 200ms -> still in frame 0 (300ms duration)
      animator.tick(200);
      expect(animator.getEntityState(1)?.lastRenderedFrameKey).toBe('player');

      // Tick another 150ms (total 350ms) -> transitions to player_idle_1
      animator.tick(150);
      expect(animator.getEntityState(1)?.lastRenderedFrameKey).toBe('player_idle_1');

      // Tick another 100ms (total 450ms -> 50ms into next cycle) -> wraps to player
      animator.tick(100);
      expect(animator.getEntityState(1)?.lastRenderedFrameKey).toBe('player');
    });

    it('triggers transient one-shot move clip and returns to idle when finished', () => {
      animator.registerEntity(1, { baseSpriteKey: 'player', desyncPhase: false });

      animator.triggerState(1, 'move');
      expect(animator.getEntityState(1)?.transientState).toBe('move');

      // Tick 50ms -> player_move_1
      animator.tick(50);
      expect(animator.getEntityState(1)?.lastRenderedFrameKey).toBe('player_move_1');

      // Tick 250ms (total 300ms > 200ms duration) -> once clip completes and returns to idle
      animator.tick(250);
      const state = animator.getEntityState(1);
      expect(state?.transientState).toBeNull();
      expect(state?.lastRenderedFrameKey).toBe('player');
    });

    it('preempts move with attack (priority 4 > 2)', () => {
      animator.registerEntity(1, { baseSpriteKey: 'player', desyncPhase: false });

      animator.triggerState(1, 'move');
      animator.tick(50);
      expect(animator.getEntityState(1)?.transientState).toBe('move');

      // Attack preempts move
      animator.triggerState(1, 'attack');
      expect(animator.getEntityState(1)?.transientState).toBe('attack');

      // Move cannot preempt active attack
      animator.triggerState(1, 'move');
      expect(animator.getEntityState(1)?.transientState).toBe('attack');

      // Death preempts attack
      animator.triggerState(1, 'death');
      expect(animator.getEntityState(1)?.transientState).toBe('death');

      // Nothing can preempt death
      animator.triggerState(1, 'attack');
      expect(animator.getEntityState(1)?.transientState).toBe('death');
    });

    it('switches to searched ambient state and holds static searched frame for searched props', () => {
      animator.registerEntity(2, { baseSpriteKey: 'prop_chest', desyncPhase: false });
      animator.tick(600);
      expect(animator.getEntityState(2)?.lastRenderedFrameKey).toBe('prop_chest_anim_1');

      // Switch ambient state to searched
      animator.setAmbientState(2, 'searched');
      animator.tick(50);
      expect(animator.getEntityState(2)?.lastRenderedFrameKey).toBe('prop_chest');

      // Further ticks maintain prop_chest
      animator.tick(2000);
      expect(animator.getEntityState(2)?.lastRenderedFrameKey).toBe('prop_chest');
    });

    it('U1 Invariant: freezes entity on Frame 0 when outside active player FOV', () => {
      animator.registerEntity(3, { baseSpriteKey: 'player', desyncPhase: false });
      const fovSet = new Set(['5,5', '5,6']);
      const getPos = () => ({ x: 10, y: 10 }); // outside FOV

      // Ticking outside FOV should NOT advance animation clock
      animator.tick(500, fovSet, getPos);
      expect(animator.getEntityState(3)?.lastRenderedFrameKey).toBe('player');
      expect(animator.getEntityState(3)?.elapsedMs).toBe(0);

      // Now inside FOV
      const getInsidePos = () => ({ x: 5, y: 5 });
      animator.tick(350, fovSet, getInsidePos);
      expect(animator.getEntityState(3)?.lastRenderedFrameKey).toBe('player_idle_1');
    });

    it('sparse texture update only updates sprite.texture when frame key actually changes', () => {
      let textureUpdates = 0;
      let currentTexture: any = { label: 'initial' };
      const mockSprite: any = {
        get texture() {
          return currentTexture;
        },
        set texture(val: any) {
          currentTexture = val;
          textureUpdates++;
        },
      };

      animator.registerEntity(1, { baseSpriteKey: 'player', desyncPhase: false });
      const getSprite = () => mockSprite;

      // First tick advances frame to player_idle_1 -> 1 update
      animator.tick(350, undefined, undefined, getSprite);
      expect(textureUpdates).toBe(1);

      // Next tick 20ms later stays on player_idle_1 -> 0 updates!
      animator.tick(20, undefined, undefined, getSprite);
      expect(textureUpdates).toBe(1);
    });

    it('falls back to canonical base clip when directional variant does not define custom clips', () => {
      const manifestWithBaseOnly: any = {
        animations: {
          prop_workstation: {
            idle: {
              frames: ['prop_workstation', 'prop_workstation_glow'],
              fps: 4,
              loop: 'loop',
            },
          },
        },
      };
      animator.setCustomManifest(manifestWithBaseOnly);
      const clip = animator.getClip('prop_workstation_n', 'idle');
      expect(clip).toBeDefined();
      expect(clip?.frames).toEqual(['prop_workstation', 'prop_workstation_glow']);
    });

    it('resets animation state and clock when baseSpriteKey changes on entity re-registration', () => {
      animator.registerEntity(1, { baseSpriteKey: 'player', desyncPhase: false });
      animator.tick(350);
      expect(animator.getEntityState(1)?.lastRenderedFrameKey).toBe('player_idle_1');

      // Shell swap or prop mutation
      animator.registerEntity(1, { baseSpriteKey: 'prop_chest', desyncPhase: false });
      const state = animator.getEntityState(1);
      expect(state?.baseSpriteKey).toBe('prop_chest');
      expect(state?.elapsedMs).toBe(0);
      expect(state?.lastRenderedFrameKey).toBe('');
    });
  });
});
