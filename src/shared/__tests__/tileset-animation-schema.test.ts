import { describe, it, expect } from 'vitest';
import {
  AnimationClipDefSchema,
  EntityAnimationSetSchema,
  AnimationManifestEntrySchema,
  ThemedTilesetManifestSchema,
} from '../tileset-types';
import { SpriteComponent } from '../components/sprite';
import { validateTilesetManifest } from '../../app/api/dev/gamedata/tileset-validator';

describe('Tileset Animation Schemas (@shared)', () => {
  describe('AnimationClipDefSchema', () => {
    it('parses valid clip with defaults (fps=6, loop=loop, desyncPhase=true)', () => {
      const parsed = AnimationClipDefSchema.parse({
        frames: ['hero_0', 'hero_1'],
      });
      expect(parsed.frames).toEqual(['hero_0', 'hero_1']);
      expect(parsed.fps).toBe(6);
      expect(parsed.loop).toBe('loop');
      expect(parsed.desyncPhase).toBe(true);
    });

    it('parses custom pingpong clip with frameDurationsMs and nextState', () => {
      const parsed = AnimationClipDefSchema.parse({
        frames: ['chest_closed', 'chest_opening', 'chest_open'],
        fps: 10,
        loop: 'pingpong',
        frameDurationsMs: [100, 200, 300],
        nextState: 'idle',
        desyncPhase: false,
      });
      expect(parsed.loop).toBe('pingpong');
      expect(parsed.frameDurationsMs).toEqual([100, 200, 300]);
      expect(parsed.nextState).toBe('idle');
      expect(parsed.desyncPhase).toBe(false);
    });

    it('rejects invalid clip definitions', () => {
      // Empty frames array
      expect(() => AnimationClipDefSchema.parse({ frames: [] })).toThrow();
      // Negative FPS
      expect(() =>
        AnimationClipDefSchema.parse({ frames: ['f0'], fps: -5 }),
      ).toThrow();
      // Invalid loop mode
      expect(() =>
        AnimationClipDefSchema.parse({ frames: ['f0'], loop: 'zigzag' }),
      ).toThrow();
    });
  });

  describe('EntityAnimationSetSchema & AnimationManifestEntrySchema', () => {
    it('parses multi-state entity animation sets', () => {
      const set = {
        idle: { frames: ['player_idle_0', 'player_idle_1'], fps: 4 },
        move: { frames: ['player_move_0', 'player_move_1'], fps: 12, loop: 'loop' as const },
        attack: { frames: ['player_atk_0'], fps: 10, loop: 'once' as const },
      };
      const parsed = EntityAnimationSetSchema.parse(set);
      expect(parsed.idle?.frames).toEqual(['player_idle_0', 'player_idle_1']);
      expect(parsed.attack?.loop).toBe('once');
    });

    it('parses union manifest entry as single clip or multi-state set', () => {
      const singleClipEntry = { frames: ['anchor_0', 'anchor_1'], loop: 'pingpong' as const };
      const parsedClip = AnimationManifestEntrySchema.parse(singleClipEntry);
      expect('frames' in parsedClip).toBe(true);

      const multiStateEntry = {
        idle: { frames: ['idle_0'] },
        searched: { frames: ['searched_0'] },
      };
      const parsedSet = AnimationManifestEntrySchema.parse(multiStateEntry);
      expect('idle' in parsedSet).toBe(true);
    });
  });

  describe('SpriteComponent backward compatibility & extension', () => {
    it('accepts legacy SpriteComponent payload with key only', () => {
      const legacy = { key: 'enemy_null_pointer' };
      const parsed = SpriteComponent.schema.parse(legacy);
      expect(parsed.key).toBe('enemy_null_pointer');
      expect(parsed.animationSet).toBeUndefined();
      expect(parsed.paused).toBe(false);
      expect(parsed.speedMultiplier).toBe(1);
    });

    it('accepts full animation-enabled SpriteComponent payload', () => {
      const full = {
        key: 'player_vanguard',
        animationSet: 'vanguard_custom',
        initialState: 'idle' as const,
        speedMultiplier: 1.5,
        paused: true,
        desyncPhase: false,
      };
      const parsed = SpriteComponent.schema.parse(full);
      expect(parsed.key).toBe('player_vanguard');
      expect(parsed.animationSet).toBe('vanguard_custom');
      expect(parsed.initialState).toBe('idle');
      expect(parsed.speedMultiplier).toBe(1.5);
      expect(parsed.paused).toBe(true);
      expect(parsed.desyncPhase).toBe(false);
    });
  });

  describe('ThemedTilesetManifestSchema backward compatibility', () => {
    const baseManifest = {
      frames: {
        base_frame: {
          frame: { x: 0, y: 0, w: 32, h: 32 },
          sourceSize: { w: 32, h: 32 },
          spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
        },
      },
      meta: {
        themeId: 'default' as const,
        themeName: 'Default',
        image: 'tileset.png',
        format: 'RGBA8888',
        size: { w: 512, h: 512 },
        scale: 1,
        tileSize: 32,
      },
    };

    it('parses valid manifest without animations block (backward compatible)', () => {
      const parsed = ThemedTilesetManifestSchema.parse(baseManifest);
      expect(parsed.animations).toBeUndefined();
    });

    it('parses manifest with valid animations dictionary', () => {
      const manifestWithAnimations = {
        ...baseManifest,
        animations: {
          base_prop: {
            frames: ['base_frame'],
            fps: 8,
          },
        },
      };
      const parsed = ThemedTilesetManifestSchema.parse(manifestWithAnimations);
      expect(parsed.animations?.['base_prop']).toBeDefined();
    });
  });

  describe('Tileset Validator Animation Rules (VAL-ANIM-01..03)', () => {
    const makeFrame = (x: number, y: number, w = 32, h = 32) => ({
      frame: { x, y, w, h },
      sourceSize: { w, h },
      spriteSourceSize: { x: 0, y: 0, w, h },
    });

    const createValidBaseManifest = () => ({
      frames: {
        prop_base: makeFrame(0, 0),
        prop_anim_1: makeFrame(32, 0),
        prop_anim_2: makeFrame(64, 0),
      } as Record<string, ReturnType<typeof makeFrame>>,
      animations: {
        prop_base: {
          idle: {
            frames: ['prop_base', 'prop_anim_1', 'prop_anim_2'],
            fps: 4,
            loop: 'pingpong' as const,
          } as import('../tileset-types').AnimationClipDef,
        },
      },
      meta: {
        themeId: 'default' as const,
        themeName: 'Default',
        image: 'tileset.png',
        format: 'RGBA8888',
        size: { w: 512, h: 512 },
        scale: 1,
        tileSize: 32,
      },
    });

    it('reports valid animation manifest stats', () => {
      const manifest = createValidBaseManifest();
      const result = validateTilesetManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.totalAnimations).toBe(1);
      expect(result.animatedKeys).toEqual(['prop_base']);
    });

    it('VAL-ANIM-01: flags error when clip references missing frame', () => {
      const manifest = createValidBaseManifest();
      manifest.animations.prop_base.idle.frames.push('missing_frame_key');

      const result = validateTilesetManifest(manifest);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes("references missing frame 'missing_frame_key'"),
        ),
      ).toBe(true);
    });

    it('VAL-ANIM-02: flags error when frame coordinates exceed atlas bounds', () => {
      const manifest = createValidBaseManifest();
      // x: 500 + w: 32 = 532 > 512
      manifest.frames['out_of_bounds_frame'] = makeFrame(500, 0);
      manifest.animations.prop_base.idle.frames = ['out_of_bounds_frame'];

      const result = validateTilesetManifest(manifest);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes('exceed atlas dimensions'),
        ),
      ).toBe(true);
    });

    it('VAL-ANIM-03: flags error when frameDurationsMs length does not match frames length', () => {
      const manifest = createValidBaseManifest();
      manifest.animations.prop_base.idle = {
        ...manifest.animations.prop_base.idle,
        frameDurationsMs: [100, 200], // length 2, but frames has 3
      };

      const result = validateTilesetManifest(manifest);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes('frameDurationsMs length 2 which does not match frames length 3'),
        ),
      ).toBe(true);
    });
  });
});
