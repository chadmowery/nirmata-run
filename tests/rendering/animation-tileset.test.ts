import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadImage } from 'canvas';
import { validateThemeFile } from '../../src/app/api/dev/gamedata/tileset-validator';

describe('Animation Tileset & Build Pipeline Verification ([ANIM-02])', () => {
  const rootDir = process.cwd();
  const tilesetPngPath = path.join(rootDir, 'public/assets/tileset.png');
  const tilesetJsonPath = path.join(rootDir, 'public/assets/tileset.json');

  it('master tileset.png remains exactly 512x512 (1 MB VRAM allocation)', async () => {
    expect(fs.existsSync(tilesetPngPath)).toBe(true);
    const img = await loadImage(tilesetPngPath);
    expect(img.width).toBe(512);
    expect(img.height).toBe(512);
  });

  it('validateThemeFile("default") passes with valid: true and 0 errors', async () => {
    const result = await validateThemeFile('default');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.totalAnimations).toBeGreaterThanOrEqual(30);
  });

  it('all 3 corporate faction themed tilesets pass validation with matching animation manifests', async () => {
    const themes = ['traxus_foundry', 'sekiguchi_biolabs', 'dark_subnet'];
    for (const themeId of themes) {
      const themePngPath = path.join(rootDir, `public/assets/tileset_${themeId}.png`);
      const img = await loadImage(themePngPath);
      expect(img.width).toBe(512);
      expect(img.height).toBe(512);

      const result = await validateThemeFile(themeId);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.totalAnimations).toBeGreaterThanOrEqual(30);
    }
  });

  it('all animation clips reference valid 32x32 frames located within atlas boundaries', () => {
    const raw = fs.readFileSync(tilesetJsonPath, 'utf-8');
    const json = JSON.parse(raw);
    const animations = json.animations;
    expect(animations).toBeDefined();

    for (const [animKey, entry] of Object.entries(animations)) {
      const clips: any[] = [];
      if ('frames' in (entry as any)) {
        clips.push((entry as any));
      } else {
        for (const clip of Object.values(entry as any)) {
          clips.push(clip);
        }
      }

      for (const clip of clips) {
        expect(clip.frames.length).toBeGreaterThan(0);
        for (const frameKey of clip.frames) {
          const frameDef = json.frames[frameKey];
          expect(frameDef, `Clip in '${animKey}' references missing frame '${frameKey}'`).toBeDefined();
          expect(frameDef.frame.w).toBe(32);
          expect(frameDef.frame.h).toBe(32);
          expect(frameDef.frame.x).toBeGreaterThanOrEqual(0);
          expect(frameDef.frame.x + 32).toBeLessThanOrEqual(512);
          expect(frameDef.frame.y).toBeGreaterThanOrEqual(0);
          expect(frameDef.frame.y + 32).toBeLessThanOrEqual(512);
        }
      }
    }
  });
});
