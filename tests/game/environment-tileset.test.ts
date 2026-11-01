import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

describe('Environment Tileset Integration', () => {
  const rootDir = process.cwd();
  const tilesetJsonPath = path.join(rootDir, 'public/assets/tileset.json');
  const tilesetPngPath = path.join(rootDir, 'public/assets/tileset.png');

  const expectedFrames = [
    'prop_workstation_active',
    'prop_workstation',
    'prop_locker_closed',
    'prop_locker',
    'prop_biocabinet',
    'prop_biocabinet_full',
    'prop_safe_locked',
    'prop_vault_door',
    'prop_vault_door_locked',
    'prop_cooling_vent_ready',
    'prop_cooling_vent',
    'prop_dead_drop',
    'prop_dead_drop_ready',
    'prop_stabilizer',
    'prop_stabilizer_active',
    'prop_subnet_console',
    'prop_crate_cover',
    'prop_cryo_vat',
    'prop_capacitor_bank',
    'item_access_key',
    'item_scavenger_siphon',
    'item_kinetic_breacher',
    'item_thermal_bypass',
  ];

  it('tileset.json contains all required environment prop and item frames and aliases', () => {
    const raw = fs.readFileSync(tilesetJsonPath, 'utf-8');
    const json = JSON.parse(raw);

    for (const frameKey of expectedFrames) {
      expect(json.frames[frameKey], `Missing frame ${frameKey}`).toBeDefined();
      const frame = json.frames[frameKey].frame;
      expect(frame.w).toBe(32);
      expect(frame.h).toBe(32);
      expect(frame.x % 32).toBe(0);
      expect(frame.y % 32).toBe(0);
      expect(frame.x + frame.w).toBeLessThanOrEqual(json.meta.size.w);
      expect(frame.y + frame.h).toBeLessThanOrEqual(json.meta.size.h);
    }
  });

  it('tileset.png has non-empty, non-corrupted pixel art at all environment frame coordinates', async () => {
    const img = await loadImage(tilesetPngPath);
    expect(img.width).toBe(256);
    expect(img.height).toBe(256);

    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const raw = fs.readFileSync(tilesetJsonPath, 'utf-8');
    const json = JSON.parse(raw);

    const distinctFrames = [
      'prop_workstation_active',
      'prop_locker_closed',
      'prop_biocabinet',
      'prop_safe_locked',
      'prop_vault_door',
      'prop_cooling_vent_ready',
      'prop_dead_drop',
      'prop_stabilizer',
      'prop_subnet_console',
      'prop_crate_cover',
      'prop_cryo_vat',
      'prop_capacitor_bank',
      'item_access_key',
      'item_scavenger_siphon',
      'item_kinetic_breacher',
      'item_thermal_bypass',
    ];

    for (const frameKey of distinctFrames) {
      const { x, y, w, h } = json.frames[frameKey].frame;
      const imageData = ctx.getImageData(x, y, w, h).data;

      let nonZeroAlphaCount = 0;
      for (let i = 3; i < imageData.length; i += 4) {
        if (imageData[i] > 0) {
          nonZeroAlphaCount++;
        }
      }

      // Each 32x32 sprite should have at least 150 non-transparent pixels
      expect(
        nonZeroAlphaCount,
        `Tile ${frameKey} at (${x}, ${y}) has too few pixels: ${nonZeroAlphaCount}`,
      ).toBeGreaterThan(150);
    }
  });
});
