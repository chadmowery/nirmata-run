import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import { createGame } from '@/game/setup';
import { SpriteComponent } from '@shared/components/sprite';

describe('Shell Tileset and In-Game Launch Integration', () => {
  const rootDir = process.cwd();
  const tilesetJsonPath = path.join(rootDir, 'public/assets/tileset.json');
  const tilesetPngPath = path.join(rootDir, 'public/assets/tileset.png');

  it('tileset.json contains all required shell frames and aliases', () => {
    const raw = fs.readFileSync(tilesetJsonPath, 'utf-8');
    const json = JSON.parse(raw);

    const expectedFrames = [
      'player_bastion',
      'player_ghost',
      'player_vanguard',
      'bastion-v1',
      'ghost-v1',
      'vanguard-v1',
    ];

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

  it('tileset.png has non-empty pixel data at shell frame coordinates', async () => {
    const img = await loadImage(tilesetPngPath);
    expect(img.width).toBe(256);
    expect(img.height).toBe(256);

    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const raw = fs.readFileSync(tilesetJsonPath, 'utf-8');
    const json = JSON.parse(raw);

    for (const shellKey of ['player_bastion', 'player_ghost', 'player_vanguard']) {
      const { x, y, w, h } = json.frames[shellKey].frame;
      const imageData = ctx.getImageData(x, y, w, h).data;

      let nonZeroAlphaCount = 0;
      for (let i = 3; i < imageData.length; i += 4) {
        if (imageData[i] > 0) {
          nonZeroAlphaCount++;
        }
      }
      expect(
        nonZeroAlphaCount,
        `Expected tile ${shellKey} at (${x}, ${y}) to contain non-transparent pixels`,
      ).toBeGreaterThan(50);
    }
  });

  it('createGame spawns player entity with specified shell sprite', () => {
    const shells = [
      { shellId: 'bastion-v1', expectedKey: 'player_bastion' },
      { shellId: 'ghost-v1', expectedKey: 'player_ghost' },
      { shellId: 'vanguard-v1', expectedKey: 'player_vanguard' },
    ];

    for (const { shellId, expectedKey } of shells) {
      const game = createGame({
        gridWidth: 20,
        gridHeight: 20,
        shellId,
        seed: `seed-${shellId}`,
      });

      expect(game.playerId).toBeDefined();
      const sprite = game.world.getComponent(game.playerId!, SpriteComponent);
      expect(sprite).toBeDefined();
      expect(sprite?.key).toBe(expectedKey);
    }
  });
});
