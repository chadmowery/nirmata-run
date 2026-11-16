import { Assets, ImageSource, Texture } from 'pixi.js';

let assetsRegistered = false;
let activeThemeId: string = 'default';
const registeredCompanions = new Set<string>();

export const THEME_MANIFEST_MAP: Record<string, string> = {
  default: 'assets/tileset.json',
  traxus: 'assets/tileset_traxus_foundry.json',
  traxus_foundry: 'assets/tileset_traxus_foundry.json',
  sekiguchi: 'assets/tileset_sekiguchi_biolabs.json',
  sekiguchi_biolabs: 'assets/tileset_sekiguchi_biolabs.json',
  dark_subnet: 'assets/tileset_dark_subnet.json',
  cyberacme: 'assets/tileset.json',
  nucaloric: 'assets/tileset.json',
  system: 'assets/tileset.json',
  research_lab: 'assets/tileset_research_lab.json',
};

/**
 * Returns the currently active faction theme identifier.
 */
export function getActiveThemeId(): string {
  return activeThemeId;
}

/**
 * Resolves the asset bundle key for the currently active tileset.
 */
export function getActiveAtlasKey(): string {
  const manifestSrc = THEME_MANIFEST_MAP[activeThemeId];
  const isDedicated = Boolean(manifestSrc && manifestSrc !== 'assets/tileset.json');
  return isDedicated ? `tileset_${activeThemeId}` : 'tileset';
}

function resolveCompanionAlias(themeId?: string): string {
  const target = themeId || activeThemeId;
  const manifestSrc = THEME_MANIFEST_MAP[target];
  const isDedicated = Boolean(manifestSrc && manifestSrc !== 'assets/tileset.json');
  return isDedicated ? `tileset_${target}` : 'tileset';
}

/**
 * Returns the loaded companion Normal+Specular (_n.png) atlas Texture for the
 * active or specified theme, falling back to base `tileset_n`.
 */
export function getNormalAtlasTexture(themeId?: string): Texture | null {
  if (typeof Assets === 'undefined' || typeof Assets?.get !== 'function') return null;
  const key = resolveCompanionAlias(themeId);
  const themed = Assets.get<Texture>(`${key}_n`);
  if (themed && themed.source) return themed;
  const base = Assets.get<Texture>('tileset_n');
  return base && base.source ? base : null;
}

/**
 * Returns the loaded companion Material+Height (_m.png) atlas Texture for the
 * active or specified theme, falling back to base `tileset_m`.
 */
export function getMaterialAtlasTexture(themeId?: string): Texture | null {
  if (typeof Assets === 'undefined' || typeof Assets?.get !== 'function') return null;
  const key = resolveCompanionAlias(themeId);
  const themed = Assets.get<Texture>(`${key}_m`);
  if (themed && themed.source) return themed;
  const base = Assets.get<Texture>('tileset_m');
  return base && base.source ? base : null;
}

const companionTextures = new Map<string, Texture>();

async function loadUnpremultipliedCompanionTexture(companionSrc: string): Promise<Texture | null> {
  if (
    typeof fetch !== 'function' ||
    typeof createImageBitmap !== 'function' ||
    typeof ImageSource !== 'function' ||
    typeof Texture !== 'function' ||
    typeof Assets.cache?.set !== 'function'
  ) {
    return null;
  }

  const response = await fetch(companionSrc);
  if (!response.ok) {
    throw new Error(`Failed to fetch companion atlas ${companionSrc}: ${response.status}`);
  }
  const blob = await response.blob();
  // PixiJS 8's loadTextures parser only sets premultiplyAlpha: 'none' when alphaMode === 'premultiplied-alpha',
  // causing browsers to premultiply normal RGB vectors by specular alpha and corrupt tangent normals.
  const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none' });
  const source = new ImageSource({
    resource: bitmap,
    alphaMode: 'no-premultiply-alpha',
    scaleMode: 'nearest',
  });
  return new Texture({ source });
}

async function loadCompanionMaps(alias: string, manifestSrc: string): Promise<void> {
  if (!manifestSrc.endsWith('.json')) return;
  const baseSrc = manifestSrc.replace(/\.json$/, '');
  const suffixes: Array<'_n' | '_m'> = ['_n', '_m'];

  for (const suffix of suffixes) {
    const companionAlias = `${alias}${suffix}`;
    const companionSrc = `${baseSrc}${suffix}.png`;
    try {
      if (companionTextures.has(companionAlias)) {
        continue;
      }

      const directTex = await loadUnpremultipliedCompanionTexture(companionSrc);
      if (directTex) {
        Assets.cache.set(companionAlias, directTex);
        companionTextures.set(companionAlias, directTex);
        registeredCompanions.add(companionAlias);
        continue;
      }

      if (!registeredCompanions.has(companionAlias)) {
        Assets.add({
          alias: companionAlias,
          src: companionSrc,
          data: {
            alphaMode: 'no-premultiply-alpha',
            scaleMode: 'nearest',
          },
        });
        registeredCompanions.add(companionAlias);
      }
      const tex = await Assets.load<Texture>(companionAlias);
      if (tex?.source) {
        tex.source.alphaMode = 'no-premultiply-alpha';
        tex.source.scaleMode = 'nearest';
      }
    } catch {
      // Non-fatal in test mocks or when custom dev manifest omits companions
    }
  }
}

async function unloadCompanionMaps(alias: string): Promise<void> {
  for (const suffix of ['_n', '_m'] as const) {
    const companionAlias = `${alias}${suffix}`;
    registeredCompanions.delete(companionAlias);
    try {
      const directTex = companionTextures.get(companionAlias);
      if (directTex) {
        companionTextures.delete(companionAlias);
        if (typeof Assets.cache?.remove === 'function' && Assets.cache.has?.(companionAlias)) {
          Assets.cache.remove(companionAlias);
        }
        directTex.destroy?.(true);
      } else if (typeof Assets.unload === 'function') {
        await Assets.unload(companionAlias);
      }
    } catch {
      // Ignore unload errors
    }
  }
}

/**
 * Resets asset tracking state (for testing).
 */
export function _resetAssetsForTesting(): void {
  assetsRegistered = false;
  activeThemeId = 'default';
  registeredCompanions.clear();
  companionTextures.clear();
}

/**
 * Loads game assets using PixiJS Assets API.
 */
export async function loadAssets(): Promise<void> {
  // Add tileset to assets manifest if not already present
  if (!assetsRegistered) {
    Assets.add({
      alias: 'tileset',
      src: 'assets/tileset.json',
    });
    assetsRegistered = true;
  }

  // Load the tileset
  await Assets.load('tileset');
  await loadCompanionMaps('tileset', 'assets/tileset.json');
  activeThemeId = 'default';
}

/**
 * Loads a themed faction tileset manifest (DIRECTIONAL-TILEMAPS.md §8 Milestone 4).
 * Falls back to base tileset if the theme manifest fails or is not found.
 * Unloads previous dedicated non-default theme atlas to bound GPU VRAM (SPRITE-ANIMATIONS.md §3.4.2).
 */
export async function loadThemedAssets(themeId: string = 'default'): Promise<void> {
  const previousThemeId = activeThemeId;
  await loadAssets();

  const targetThemeId = themeId || 'default';
  const manifestSrc = THEME_MANIFEST_MAP[targetThemeId];
  const isDedicatedTheme = Boolean(manifestSrc && manifestSrc !== 'assets/tileset.json');

  const previousManifestSrc = THEME_MANIFEST_MAP[previousThemeId];
  const previousWasDedicated = Boolean(previousManifestSrc && previousManifestSrc !== 'assets/tileset.json');

  const unloadPreviousTheme = async () => {
    if (previousWasDedicated && previousThemeId !== targetThemeId && previousManifestSrc !== manifestSrc) {
      try {
        if (typeof Assets.unload === 'function') {
          await Assets.unload(`tileset_${previousThemeId}`);
        }
        await unloadCompanionMaps(`tileset_${previousThemeId}`);
      } catch {
        // Ignore unload errors
      }
    }
  };

  if (!isDedicatedTheme) {
    activeThemeId = targetThemeId;
    await unloadPreviousTheme();
    return;
  }

  const alias = `tileset_${targetThemeId}`;

  try {
    Assets.add({
      alias,
      src: manifestSrc!,
    });
    await Assets.load(alias);
    await loadCompanionMaps(alias, manifestSrc!);
    activeThemeId = targetThemeId;
    await unloadPreviousTheme();
  } catch {
    activeThemeId = 'default';
    await unloadPreviousTheme();
  }
}
