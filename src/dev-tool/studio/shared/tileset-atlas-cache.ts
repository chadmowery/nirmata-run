import {
  AnimationLoopMode,
  AnimationStateKey,
  AnimationClipDef,
  EntityAnimationSet,
} from '@shared/tileset-types';
import { stepAnimationClip } from '../../../rendering/sprite-animator';

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ResolvedAnimationClip {
  state: AnimationStateKey;
  frames: string[];
  fps: number;
  loop: AnimationLoopMode;
  frameDurationsMs?: number[];
  totalDurationMs: number;
}

export interface TilesetAtlasData {
  frames: Record<string, { frame: FrameRect }>;
  animations?: Record<string, EntityAnimationSet | AnimationClipDef>;
  meta?: { size: { w: number; h: number } };
}

export class TilesetAtlasCache {
  private static instance: TilesetAtlasCache;

  private manifests: Map<string, TilesetAtlasData> = new Map();
  private images: Map<string, HTMLImageElement> = new Map();
  private loadPromises: Map<string, Promise<boolean>> = new Map();

  public static getInstance(): TilesetAtlasCache {
    if (!TilesetAtlasCache.instance) {
      TilesetAtlasCache.instance = new TilesetAtlasCache();
    }
    return TilesetAtlasCache.instance;
  }

  /**
   * Load a tileset atlas manifest and texture image.
   * Defaults to '/assets/tileset.json' and '/assets/tileset.png'.
   */
  public async loadAtlas(
    themeId: string = 'default',
    manifestUrl?: string,
    imageUrl?: string,
  ): Promise<boolean> {
    if (this.manifests.has(themeId) && this.images.has(themeId)) {
      return true;
    }

    const cacheKey = themeId;
    if (this.loadPromises.has(cacheKey)) {
      return this.loadPromises.get(cacheKey)!;
    }

    const defaultManifest = themeId === 'default' ? '/assets/tileset.json' : `/assets/tileset_${themeId}.json`;
    const defaultImage = themeId === 'default' ? '/assets/tileset.png' : `/assets/tileset_${themeId}.png`;

    const mUrl = manifestUrl || defaultManifest;
    const iUrl = imageUrl || defaultImage;

    const promise = (async () => {
      try {
        if (typeof window === 'undefined') return false;

        const res = await fetch(mUrl);
        if (!res.ok) return false;
        const manifestData: TilesetAtlasData = await res.json();
        this.manifests.set(themeId, manifestData);

        const img = new Image();
        img.src = iUrl;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load texture image: ${iUrl}`));
        });

        this.images.set(themeId, img);
        return true;
      } catch {
        return false;
      }
    })();

    this.loadPromises.set(cacheKey, promise);
    return promise;
  }

  public setAtlasData(themeId: string, manifest: TilesetAtlasData, image?: HTMLImageElement): void {
    this.manifests.set(themeId, manifest);
    if (image) {
      this.images.set(themeId, image);
    }
  }

  public getFrameKeys(themeId: string = 'default'): string[] {
    const manifest = this.manifests.get(themeId) || this.manifests.get('default');
    if (!manifest) return [];
    return Object.keys(manifest.frames);
  }

  public getFrameRect(frameKey: string, themeId: string = 'default'): FrameRect | null {
    const manifest = this.manifests.get(themeId) || this.manifests.get('default');
    if (!manifest || !manifest.frames[frameKey]) return null;
    return manifest.frames[frameKey].frame;
  }

  /**
   * Returns all animation state keys ('idle', 'move', 'attack', etc.) available for a sprite key.
   */
  public getAnimationStates(spriteKey: string, themeId: string = 'default'): AnimationStateKey[] {
    const manifest = this.manifests.get(themeId) || this.manifests.get('default');
    if (!manifest || !manifest.animations) return [];

    const entry = manifest.animations[spriteKey];
    if (!entry) return [];

    if ('frames' in entry && Array.isArray(entry.frames)) {
      return ['idle'];
    }

    return Object.keys(entry) as AnimationStateKey[];
  }

  /**
   * Checks if a sprite key has any registered animations in the manifest.
   */
  public isKeyAnimated(spriteKey: string, themeId: string = 'default'): boolean {
    return this.getAnimationStates(spriteKey, themeId).length > 0;
  }

  /**
   * Returns all sprite keys that have an animations entry in the manifest.
   */
  public getAnimatedSpriteKeys(themeId: string = 'default'): string[] {
    const manifest = this.manifests.get(themeId) || this.manifests.get('default');
    if (!manifest || !manifest.animations) return [];
    return Object.keys(manifest.animations);
  }

  /**
   * Resolves a normalized clip definition for `(spriteKey, state, themeId)`, or null if static.
   */
  public getAnimationClip(
    spriteKey: string,
    state: AnimationStateKey = 'idle',
    themeId: string = 'default',
  ): ResolvedAnimationClip | null {
    const manifest = this.manifests.get(themeId) || this.manifests.get('default');
    if (!manifest || !manifest.animations) return null;

    const entry = manifest.animations[spriteKey];
    if (!entry) return null;

    let clip: AnimationClipDef | null = null;
    if ('frames' in entry && Array.isArray((entry as AnimationClipDef).frames)) {
      if (state === 'idle') clip = entry as AnimationClipDef;
    } else {
      clip = (entry as EntityAnimationSet)[state] ?? null;
    }

    if (!clip || !Array.isArray(clip.frames) || clip.frames.length === 0) return null;

    const fps = clip.fps ?? 6;
    const loop = clip.loop ?? 'loop';
    const defaultDur = 1000 / (fps > 0 ? fps : 6);
    const N = clip.frames.length;
    const effectiveLen = loop === 'pingpong' && N > 2 ? 2 * N - 2 : N;

    let totalDurationMs = 0;
    for (let i = 0; i < effectiveLen; i++) {
      const origIdx = loop === 'pingpong' && N > 2
        ? (i < N ? i : 2 * N - 2 - i)
        : (i % N);
      totalDurationMs += clip.frameDurationsMs?.[origIdx] ?? defaultDur;
    }

    return {
      state,
      frames: clip.frames,
      fps,
      loop,
      frameDurationsMs: clip.frameDurationsMs,
      totalDurationMs,
    };
  }

  /**
   * Computes the active frame key and frame index at `elapsedMs` for a clip.
   * In DevTool preview contexts, loops even one-shot clips ('once') so designers can inspect and preview them continuously.
   */
  public resolveAnimatedFrameAtTime(
    spriteKey: string,
    state: AnimationStateKey = 'idle',
    elapsedMs: number,
    themeId: string = 'default',
    previewLoop: boolean = true,
  ): { frameKey: string; frameIndex: number; totalFrames: number } {
    const clip = this.getAnimationClip(spriteKey, state, themeId);
    if (!clip || clip.frames.length === 0) {
      return { frameKey: spriteKey, frameIndex: 0, totalFrames: 1 };
    }

    let effectiveElapsedMs = elapsedMs;
    let loopMode = clip.loop;

    if (previewLoop && clip.loop === 'once') {
      // In devtool preview, loop one-shot clips (such as move, attack, hit, interact)
      // For action clips (attack, hit, interact, death), add a 350ms resting hold on the final frame before repeating
      const restHoldMs = state === 'move' ? 0 : 350;
      const totalCycleWithHold = clip.totalDurationMs + restHoldMs;
      const t = totalCycleWithHold > 0 ? elapsedMs % totalCycleWithHold : 0;

      if (t < clip.totalDurationMs) {
        effectiveElapsedMs = t;
        loopMode = 'once';
      } else {
        // Holding on last frame
        const lastIdx = clip.frames.length - 1;
        return {
          frameKey: clip.frames[lastIdx],
          frameIndex: lastIdx,
          totalFrames: clip.frames.length,
        };
      }
    }

    const step = stepAnimationClip(
      {
        frames: clip.frames,
        fps: clip.fps,
        loop: loopMode,
        frameDurationsMs: clip.frameDurationsMs,
        desyncPhase: false,
      },
      effectiveElapsedMs,
      0,
      false,
    );

    return {
      frameKey: step.frameKey,
      frameIndex: step.frameIndex,
      totalFrames: clip.frames.length,
    };
  }

  /**
   * Draw an atlas frame onto a 2D canvas context.
   */
  public drawAtlasFrame(
    ctx: CanvasRenderingContext2D,
    frameKey: string,
    dx: number,
    dy: number,
    tileSize: number = 32,
    angleDegrees: number = 0,
    themeId: string = 'default',
  ): boolean {
    const rect = this.getFrameRect(frameKey, themeId);
    const img = this.images.get(themeId) || this.images.get('default');
    if (!rect || !img) return false;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (angleDegrees !== 0) {
      ctx.translate(dx + tileSize / 2, dy + tileSize / 2);
      ctx.rotate((angleDegrees * Math.PI) / 180);
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, -tileSize / 2, -tileSize / 2, tileSize, tileSize);
    } else {
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, dx, dy, tileSize, tileSize);
    }

    ctx.restore();
    return true;
  }
}

export const tilesetAtlasCache = TilesetAtlasCache.getInstance();
