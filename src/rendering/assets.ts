import { Assets } from 'pixi.js';

/**
 * Loads game assets using PixiJS Assets API.
 */
export async function loadAssets(): Promise<void> {
  // Add tileset to assets manifest
  Assets.add({
    alias: 'tileset',
    src: 'assets/tileset.json',
  });

  // Load the tileset
  await Assets.load('tileset');
}
