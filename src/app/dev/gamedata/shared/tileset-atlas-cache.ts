export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TilesetAtlasData {
  frames: Record<string, { frame: FrameRect }>;
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

    const defaultManifest = themeId === 'default' ? '/assets/tileset.json' : `/assets/themes/${themeId}/tileset.json`;
    const defaultImage = themeId === 'default' ? '/assets/tileset.png' : `/assets/themes/${themeId}/tileset.png`;

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

  public getFrameKeys(themeId: string = 'default'): string[] {
    const manifest = this.manifests.get(themeId);
    if (!manifest) return [];
    return Object.keys(manifest.frames);
  }

  public getFrameRect(frameKey: string, themeId: string = 'default'): FrameRect | null {
    const manifest = this.manifests.get(themeId) || this.manifests.get('default');
    if (!manifest || !manifest.frames[frameKey]) return null;
    return manifest.frames[frameKey].frame;
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
