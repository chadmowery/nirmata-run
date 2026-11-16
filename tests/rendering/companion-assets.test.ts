import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { cacheStore, mockUnload, mockAdd, mockLoad } = vi.hoisted(() => ({
  cacheStore: new Map<string, unknown>(),
  mockUnload: vi.fn().mockResolvedValue(undefined),
  mockAdd: vi.fn(),
  mockLoad: vi.fn().mockResolvedValue({ textures: {} }),
}));

vi.mock('pixi.js', () => {
  const ImageSource = vi.fn().mockImplementation(function (opts: Record<string, unknown>) {
    return {
      ...opts,
      destroy: vi.fn(),
    };
  });

  const Texture = Object.assign(
    vi.fn().mockImplementation(function (opts: { source: Record<string, unknown> }) {
      return {
        source: opts.source,
        destroy: vi.fn(),
      };
    }),
    { EMPTY: { source: {} } },
  );

  return {
    ImageSource,
    Texture,
    Assets: {
      add: mockAdd,
      load: mockLoad,
      unload: mockUnload,
      get: vi.fn((key: string) => cacheStore.get(key)),
      cache: {
        has: vi.fn((key: string) => cacheStore.has(key)),
        get: vi.fn((key: string) => cacheStore.get(key)),
        set: vi.fn((key: string, val: unknown) => {
          cacheStore.set(key, val);
        }),
        remove: vi.fn((key: string) => {
          cacheStore.delete(key);
        }),
      },
    },
  };
});

import {
  loadAssets,
  loadThemedAssets,
  getNormalAtlasTexture,
  getMaterialAtlasTexture,
  _resetAssetsForTesting,
} from '../../src/rendering/assets';

describe('Companion Normal/Material Atlas Loading (Unpremultiplied)', () => {
  const originalFetch = globalThis.fetch;
  const originalCreateImageBitmap = globalThis.createImageBitmap;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();
    _resetAssetsForTesting();

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      blob: async () => new Blob([url], { type: 'image/png' }),
    })) as unknown as typeof fetch;

    globalThis.createImageBitmap = vi.fn().mockImplementation(async () => ({
      width: 512,
      height: 512,
      close: vi.fn(),
    })) as unknown as typeof createImageBitmap;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.createImageBitmap = originalCreateImageBitmap;
  });

  it('decodes _n and _m companion maps with premultiplyAlpha none and alphaMode no-premultiply-alpha', async () => {
    await loadAssets();

    expect(globalThis.fetch).toHaveBeenCalledWith('assets/tileset_n.png');
    expect(globalThis.fetch).toHaveBeenCalledWith('assets/tileset_m.png');
    expect(globalThis.createImageBitmap).toHaveBeenCalledWith(expect.any(Blob), {
      premultiplyAlpha: 'none',
    });

    const normalTex = getNormalAtlasTexture();
    const materialTex = getMaterialAtlasTexture();
    expect(normalTex).toBeTruthy();
    expect(materialTex).toBeTruthy();
    expect(normalTex?.source.alphaMode).toBe('no-premultiply-alpha');
    expect(normalTex?.source.scaleMode).toBe('nearest');
    expect(materialTex?.source.alphaMode).toBe('no-premultiply-alpha');
    expect(materialTex?.source.scaleMode).toBe('nearest');

    // Should bypass Assets.load for _n/_m when unpremultiplied bitmap decode is used
    expect(mockLoad).not.toHaveBeenCalledWith('tileset_n');
    expect(mockLoad).not.toHaveBeenCalledWith('tileset_m');
  });

  it('unloads and destroys previous themed companion textures when switching sectors', async () => {
    await loadThemedAssets('traxus_foundry');
    const traxusN = getNormalAtlasTexture('traxus_foundry') as unknown as { destroy: ReturnType<typeof vi.fn> };
    const traxusM = getMaterialAtlasTexture('traxus_foundry') as unknown as { destroy: ReturnType<typeof vi.fn> };
    expect(traxusN).toBeTruthy();
    expect(traxusM).toBeTruthy();

    await loadThemedAssets('sekiguchi_biolabs');
    expect(traxusN.destroy).toHaveBeenCalledWith(true);
    expect(traxusM.destroy).toHaveBeenCalledWith(true);
    expect(cacheStore.has('tileset_traxus_foundry_n')).toBe(false);
    expect(cacheStore.has('tileset_traxus_foundry_m')).toBe(false);

    const sekiN = getNormalAtlasTexture('sekiguchi_biolabs');
    expect(sekiN?.source.alphaMode).toBe('no-premultiply-alpha');

    // New theme must finish loading before previous theme is unloaded
    const loadSekiOrder = mockLoad.mock.invocationCallOrder[
      mockLoad.mock.calls.findIndex((c) => c[0] === 'tileset_sekiguchi_biolabs')
    ];
    const unloadTraxusOrder = mockUnload.mock.invocationCallOrder[
      mockUnload.mock.calls.findIndex((c) => c[0] === 'tileset_traxus_foundry')
    ];
    expect(loadSekiOrder).toBeLessThan(unloadTraxusOrder);
  });
});
