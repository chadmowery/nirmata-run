import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

describe('Themed Tilesets Integration', () => {
  const rootDir = process.cwd();
  const baseJsonPath = path.join(rootDir, 'public/assets/tileset.json');
  const baseRaw = fs.readFileSync(baseJsonPath, 'utf-8');
  const baseJson = JSON.parse(baseRaw);

  const themes = [
    {
      id: 'traxus_foundry',
      png: 'public/assets/tileset_traxus_foundry.png',
      json: 'public/assets/tileset_traxus_foundry.json',
      preview: 'docs/visual-design/previews/tileset_traxus_foundry_sheet.png',
    },
    {
      id: 'sekiguchi_biolabs',
      png: 'public/assets/tileset_sekiguchi_biolabs.png',
      json: 'public/assets/tileset_sekiguchi_biolabs.json',
      preview: 'docs/visual-design/previews/tileset_sekiguchi_biolabs_sheet.png',
    },
    {
      id: 'dark_subnet',
      png: 'public/assets/tileset_dark_subnet.png',
      json: 'public/assets/tileset_dark_subnet.json',
      preview: 'docs/visual-design/previews/tileset_dark_subnet_sheet.png',
    },
  ];

  it('all 3 themed JSON manifests match tileset.json structure and frame keys', () => {
    const baseFrameKeys = Object.keys(baseJson.frames).sort();

    for (const theme of themes) {
      const jsonPath = path.join(rootDir, theme.json);
      expect(fs.existsSync(jsonPath), `Missing manifest ${theme.json}`).toBe(true);

      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const json = JSON.parse(raw);

      expect(json.meta.size.w).toBe(512);
      expect(json.meta.size.h).toBe(512);
      expect(json.meta.format).toBe('RGBA8888');

      const themeFrameKeys = Object.keys(json.frames).sort();
      expect(themeFrameKeys).toEqual(baseFrameKeys);

      for (const key of baseFrameKeys) {
        const baseFrame = baseJson.frames[key].frame;
        const themeFrame = json.frames[key].frame;
        expect(themeFrame.x).toBe(baseFrame.x);
        expect(themeFrame.y).toBe(baseFrame.y);
        expect(themeFrame.w).toBe(baseFrame.w);
        expect(themeFrame.h).toBe(baseFrame.h);
      }
    }
  });

  it('all 3 themed tileset PNGs exist, have 512x512 dimensions, and opaque terrain tiles', async () => {
    for (const theme of themes) {
      const pngPath = path.join(rootDir, theme.png);
      expect(fs.existsSync(pngPath), `Missing PNG ${theme.png}`).toBe(true);

      const img = await loadImage(pngPath);
      expect(img.width).toBe(512);
      expect(img.height).toBe(512);

      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Verify core terrain tiles (floor at 0,0, wall at 32,0, door at 64,0) are fully opaque
      const terrainCoords = [
        { name: 'floor', x: 0, y: 0 },
        { name: 'wall', x: 32, y: 0 },
        { name: 'door', x: 64, y: 0 },
      ];

      for (const { name, x, y } of terrainCoords) {
        const imgData = ctx.getImageData(x, y, 32, 32).data;
        let fullyOpaqueCount = 0;
        for (let i = 3; i < imgData.length; i += 4) {
          if (imgData[i] === 255) fullyOpaqueCount++;
        }
        expect(
          fullyOpaqueCount,
          `Theme ${theme.id} tile ${name} at (${x}, ${y}) must be 100% opaque`,
        ).toBe(1024);
      }

      // Verify sample actors, props, and items have non-empty sprite art
      const sampleSprites = [
        { key: 'player_bastion', x: 0, y: 224, minPixels: 300 },
        { key: 'prop_workstation_active', x: 128, y: 0, minPixels: 300 },
        { key: 'prop_cooling_vent_ready', x: 160, y: 32, minPixels: 300 },
        { key: 'enemy_system_admin', x: 96, y: 96, minPixels: 200 },
        { key: 'item_access_key', x: 128, y: 96, minPixels: 150 },
      ];

      for (const { key, x, y, minPixels } of sampleSprites) {
        const imgData = ctx.getImageData(x, y, 32, 32).data;
        let nonZeroAlpha = 0;
        for (let i = 3; i < imgData.length; i += 4) {
          if (imgData[i] > 0) nonZeroAlpha++;
        }
        expect(
          nonZeroAlpha,
          `Theme ${theme.id} sprite ${key} at (${x}, ${y}) has too few pixels`,
        ).toBeGreaterThanOrEqual(minPixels);
      }
    }
  });

  it('all 3 master review preview sheets exist and have non-empty image content', async () => {
    for (const theme of themes) {
      const previewPath = path.join(rootDir, theme.preview);
      expect(fs.existsSync(previewPath), `Missing preview sheet ${theme.preview}`).toBe(true);

      const img = await loadImage(previewPath);
      expect(img.width).toBe(780);
      expect(img.height).toBe(410);

      const stat = fs.statSync(previewPath);
      expect(stat.size).toBeGreaterThan(30000); // Should be >30KB PNG
    }
  });
});
