import { Application } from 'pixi.js';

const globalForRenderer = globalThis as unknown as { __nirmataPixiApp?: Application | null };
let app: Application | null =
  process.env.NODE_ENV === 'development' ? (globalForRenderer.__nirmataPixiApp ?? null) : null;

/**
 * Initializes the PixiJS renderer singleton.
 * Uses a guard to prevent multiple initializations (e.g. React StrictMode or Dev HMR).
 */
export async function initRenderer(canvas: HTMLCanvasElement): Promise<Application> {
  if (app) {
    if (app.canvas && app.canvas !== canvas && canvas.parentNode) {
      app.canvas.className = canvas.className;
      canvas.parentNode.replaceChild(app.canvas, canvas);
    }
    return app;
  }

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

  if (process.env.NODE_ENV === 'development') {
    globalForRenderer.__nirmataPixiApp = app;
  }

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
  if (process.env.NODE_ENV === 'development') {
    globalForRenderer.__nirmataPixiApp = null;
  }
}

/**
 * Gets the current PixiJS Application instance.
 */
export function getApp(): Application | null {
  return app;
}
