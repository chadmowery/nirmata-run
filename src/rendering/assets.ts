import { Assets } from 'pixi.js';

let assetsRegistered = false;

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
}
