import { Application } from 'pixi.js';

let app: Application | null = null;

/**
 * Initializes the PixiJS renderer singleton.
 * Uses a guard to prevent multiple initializations (e.g. React StrictMode).
 */
export async function initRenderer(canvas: HTMLCanvasElement): Promise<Application> {
  if (app) return app;

  app = new Application();
  await app.init({
    canvas,
    width: 960,
    height: 640,
    backgroundColor: 0x000000,
    antialias: false,
    resolution: 1,
    preference: 'webgl',
  });

  return app;
}

/**
 * Destroys the PixiJS renderer and clears the singleton.
 */
export function destroyRenderer(): void {
  if (app) {
    app.destroy(true, {
      children: true,
      texture: false,
      textureSource: false,
    });
    app = null;
  }
}

/**
 * Gets the current PixiJS Application instance.
 */
export function getApp(): Application | null {
  return app;
}
