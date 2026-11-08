import { Assets } from 'pixi.js';

let assetsRegistered = false;
let activeThemeId: string = 'default';

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
 * Resets asset tracking state (for testing).
 */
export function _resetAssetsForTesting(): void {
  assetsRegistered = false;
  activeThemeId = 'default';
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

  // Unload previous dedicated non-default theme atlas if transitioning between sectors
  if (previousWasDedicated && previousThemeId !== targetThemeId && previousManifestSrc !== manifestSrc) {
    try {
      if (typeof Assets.unload === 'function') {
        await Assets.unload(`tileset_${previousThemeId}`);
      }
    } catch {
      // Ignore unload errors
    }
  }

  if (!isDedicatedTheme) {
    activeThemeId = targetThemeId;
    return;
  }

  const alias = `tileset_${targetThemeId}`;

  try {
    Assets.add({
      alias,
      src: manifestSrc!,
    });
    await Assets.load(alias);
    activeThemeId = targetThemeId;
  } catch {
    activeThemeId = 'default';
  }
}
