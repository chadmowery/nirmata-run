import fs, { type FSWatcher } from 'fs';
import path from 'path';
import { hotloadBus } from './hotload-bus';

const ASSETS_DIR = path.join(process.cwd(), 'public/assets');
const DEBOUNCE_MS = 150;

export function inferThemeIdFromAssetFilename(filename: string): string {
  const base = filename
    .replace(/\.(png|json)$/i, '')
    .replace(/_(n|m)$/i, '');

  if (base === 'tileset') return 'default';
  if (base.startsWith('tileset_')) {
    return base.slice('tileset_'.length);
  }
  return 'default';
}

class AssetWatcherService {
  private watcher: FSWatcher | null = null;
  private pendingByTheme = new Map<string, { files: Set<string>; timer: ReturnType<typeof setTimeout> }>();
  private ignoredUntil = new Map<string, number>();

  public markSelfWrite(filename: string, ttlMs = 800): void {
    this.ignoredUntil.set(filename, Date.now() + ttlMs);
  }

  public start(): void {
    if (process.env.NODE_ENV === 'production' || this.watcher) return;
    if (!fs.existsSync(ASSETS_DIR)) return;

    try {
      this.watcher = fs.watch(ASSETS_DIR, { persistent: false }, (_eventType, rawFilename) => {
        if (!rawFilename) return;
        const filename = String(rawFilename);
        if (!filename.endsWith('.png') && !filename.endsWith('.json')) return;
        if (!filename.startsWith('tileset')) return;

        const ignoreDeadline = this.ignoredUntil.get(filename);
        if (ignoreDeadline && Date.now() < ignoreDeadline) {
          return;
        }

        const themeId = inferThemeIdFromAssetFilename(filename);
        let bucket = this.pendingByTheme.get(themeId);
        if (!bucket) {
          bucket = {
            files: new Set<string>(),
            timer: setTimeout(() => {
              this.flushTheme(themeId);
            }, DEBOUNCE_MS),
          };
          this.pendingByTheme.set(themeId, bucket);
        } else {
          clearTimeout(bucket.timer);
          bucket.timer = setTimeout(() => {
            this.flushTheme(themeId);
          }, DEBOUNCE_MS);
        }
        bucket.files.add(filename);
      });
    } catch {
      // Graceful no-op in restricted test environments
      this.watcher = null;
    }
  }

  private flushTheme(themeId: string): void {
    const bucket = this.pendingByTheme.get(themeId);
    if (!bucket) return;
    this.pendingByTheme.delete(themeId);

    const filesChanged = Array.from(bucket.files).sort();
    if (filesChanged.length === 0) return;

    hotloadBus.publishCommit('assets:atlas', themeId, {
      themeId,
      filesChanged,
      version: Date.now(),
    });
  }

  public stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    for (const bucket of this.pendingByTheme.values()) {
      clearTimeout(bucket.timer);
    }
    this.pendingByTheme.clear();
  }
}

const globalForWatcher = globalThis as unknown as { __nirmataAssetWatcher?: AssetWatcherService };

export const assetWatcher: AssetWatcherService =
  globalForWatcher.__nirmataAssetWatcher ?? new AssetWatcherService();

if (process.env.NODE_ENV !== 'production') {
  globalForWatcher.__nirmataAssetWatcher = assetWatcher;
}

export function ensureAssetWatcherStarted(): void {
  if (process.env.NODE_ENV === 'production') return;
  assetWatcher.start();
}
