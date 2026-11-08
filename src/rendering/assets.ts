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
};

/**
 * Returns the currently active faction theme identifier.
 */
export function getActiveThemeId(): string {
  return activeThemeId;
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
 */
export async function loadThemedAssets(themeId: string = 'default'): Promise<void> {
  await loadAssets();

  if (!themeId || themeId === 'default') {
    if (activeThemeId !== 'default') {
      try {
        await Assets.unload(`tileset_${activeThemeId}`);
      } catch {
        // Ignore unload errors
      }
    }
    activeThemeId = 'default';
    return;
  }

  // Unload previous non-default theme atlas if transitioning between sectors
  if (activeThemeId !== 'default' && activeThemeId !== themeId) {
    try {
      await Assets.unload(`tileset_${activeThemeId}`);
    } catch {
      // Ignore unload errors
    }
  }

  const manifestSrc = THEME_MANIFEST_MAP[themeId] ?? 'assets/tileset.json';
  const alias = `tileset_${themeId}`;

  try {
    Assets.add({
      alias,
      src: manifestSrc,
    });
    await Assets.load(alias);
    activeThemeId = themeId;
  } catch {
    activeThemeId = 'default';
  }
}
