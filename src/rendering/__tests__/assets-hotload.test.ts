import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const events: string[] = [];

const cacheMap = new Map<string, unknown>();

vi.mock('pixi.js', () => {
  class MockImageSource {
    constructor(public opts: unknown) {}
  }
  class MockTexture {
    static EMPTY = { source: null };
    source: unknown;
    destroy = vi.fn(() => {
      events.push('prevTex.destroy');
    });
    constructor(opts?: { source?: unknown }) {
      this.source = opts?.source ?? {};
    }
  }
  class MockSpritesheet {
    textures: Record<string, unknown> = { floor: new MockTexture() };
    data: unknown;
    constructor(
      public baseTexture: unknown,
      data: unknown,
    ) {
      this.data = data;
    }
    async parse() {
      events.push('newSheet.parse');
    }
  }
  return {
    Assets: {
      get: vi.fn((k: string) => cacheMap.get(k)),
      cache: {
        set: vi.fn((k: string, v: unknown) => {
          events.push(`cache.set:${k}`);
          cacheMap.set(k, v);
        }),
        has: vi.fn((k: string) => cacheMap.has(k)),
        remove: vi.fn((k: string) => cacheMap.delete(k)),
      },
      add: vi.fn(),
      load: vi.fn(),
      unload: vi.fn(),
    },
    ImageSource: MockImageSource,
    Texture: MockTexture,
    Spritesheet: MockSpritesheet,
  };
});

vi.mock('../sprite-map', () => ({
  clearCompanionFrameCache: vi.fn(() => {
    events.push('clearCompanionFrameCache');
  }),
  refreshEntitySpriteTextures: vi.fn(() => {
    events.push('refreshEntitySpriteTextures');
  }),
  getTextureForSpriteKey: vi.fn(),
  resolveFallbackSpriteKey: vi.fn(),
}));

import { hotReloadThemeAssets, registerAssetReloadListener, _resetAssetsForTesting } from '../assets';

describe('hotReloadThemeAssets lifecycle ordering (CRIT-02)', () => {
  const origFetch = globalThis.fetch;
  const origCreateImageBitmap = globalThis.createImageBitmap;

  beforeEach(() => {
    events.length = 0;
    cacheMap.clear();
    _resetAssetsForTesting();
    globalThis.createImageBitmap = vi.fn(async () => ({}) as ImageBitmap);
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    globalThis.createImageBitmap = origCreateImageBitmap;
    vi.restoreAllMocks();
  });

  it('defers prevAsset.destroy(true) until after companion fetches, cache swap, sprite refresh, and listeners', async () => {
    const prevAsset = {
      destroy: vi.fn(() => {
        events.push('prevAsset.destroy');
      }),
    };
    cacheMap.set('tileset', prevAsset);

    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const s = String(url);
      events.push(`fetch:${s.split('?')[0]}`);
      if (s.includes('.json')) {
        return {
          ok: true,
          json: async () => ({ frames: {}, animations: { idle_loop: { frames: ['a'], fps: 4 } } }),
        } as unknown as Response;
      }
      return {
        ok: true,
        blob: async () => new Blob(),
      } as unknown as Response;
    });

    const unsub = registerAssetReloadListener((themeId) => {
      events.push(`listener:${themeId}`);
    });

    const ok = await hotReloadThemeAssets('default', 12345);
    unsub();

    expect(ok).toBe(true);
    expect(prevAsset.destroy).toHaveBeenCalledWith(true);

    const fetchNIdx = events.indexOf('fetch:/assets/tileset_n.png');
    const fetchMIdx = events.indexOf('fetch:/assets/tileset_m.png');
    const cacheSwapIdx = events.indexOf('cache.set:tileset');
    const refreshIdx = events.indexOf('refreshEntitySpriteTextures');
    const listenerIdx = events.indexOf('listener:default');
    const destroyIdx = events.indexOf('prevAsset.destroy');

    expect(fetchNIdx).toBeGreaterThan(-1);
    expect(fetchMIdx).toBeGreaterThan(-1);
    expect(cacheSwapIdx).toBeGreaterThan(fetchMIdx);
    expect(refreshIdx).toBeGreaterThan(cacheSwapIdx);
    expect(listenerIdx).toBeGreaterThan(refreshIdx);
    expect(destroyIdx).toBeGreaterThan(listenerIdx);
  });

  it('does not destroy prevAsset if manifest or png fetch fails', async () => {
    const prevAsset = { destroy: vi.fn() };
    cacheMap.set('tileset', prevAsset);

    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const s = String(url);
      if (s.includes('.json')) {
        return { ok: true, json: async () => ({ frames: {} }) } as unknown as Response;
      }
      return { ok: false, status: 500 } as unknown as Response;
    });

    const ok = await hotReloadThemeAssets('default', 999);
    expect(ok).toBe(false);
    expect(prevAsset.destroy).not.toHaveBeenCalled();
  });
});
