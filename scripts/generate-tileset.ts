import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const TILE_SIZE = 32;

/**
 * Generates a geometric placeholder tileset PNG and JSON manifest.
 */
async function generateTileset() {
  const assetsDir = path.resolve('public/assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const frames: Record<string, any> = {
    floor: { x: 0, y: 0, color: '#333333' },
    wall: { x: 32, y: 0, color: '#AAAAAA', border: '#777777' },
    door: { x: 64, y: 0, color: '#8B4513', highlight: '#A0522D' },
    player: { x: 0, y: 32, color: '#4488FF', shape: 'circle' },
    enemy_triangle: { x: 32, y: 32, color: '#FF4444', shape: 'triangle' },
    enemy_square: { x: 64, y: 32, color: '#FF8800', border: '#CC7700' },
    item_potion: { x: 0, y: 64, color: '#44FF44', shape: 'cross' },
    item_star: { x: 32, y: 64, color: '#FFDD00', shape: 'star' },
  };

  const canvasWidth = 128;
  const canvasHeight = 128;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  const manifestFrames: Record<string, any> = {};

  for (const [name, config] of Object.entries(frames)) {
    const { x, y, color } = config;

    ctx.fillStyle = color;

    if (config.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(x + 16, y + 16, 14, 0, Math.PI * 2);
      ctx.fill();
    } else if (config.shape === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(x + 16, y + 4);
      ctx.lineTo(x + 4, y + 28);
      ctx.lineTo(x + 28, y + 28);
      ctx.closePath();
      ctx.fill();
    } else if (config.shape === 'cross') {
      ctx.fillRect(x + 12, y + 4, 8, 24);
      ctx.fillRect(x + 4, y + 12, 24, 8);
    } else if (config.shape === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        ctx.lineTo(
          x + 16 + 14 * Math.cos(((18 + i * 72) / 180) * Math.PI),
          y + 16 - 14 * Math.sin(((18 + i * 72) / 180) * Math.PI)
        );
        ctx.lineTo(
          x + 16 + 7 * Math.cos(((54 + i * 72) / 180) * Math.PI),
          y + 16 - 7 * Math.sin(((54 + i * 72) / 180) * Math.PI)
        );
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      if (config.border) {
        ctx.strokeStyle = config.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      }
      if (config.highlight) {
        ctx.fillStyle = config.highlight;
        ctx.fillRect(x + 14, y + 2, 4, 28);
      }
    }

    manifestFrames[name] = {
      frame: { x, y, w: TILE_SIZE, h: TILE_SIZE },
      sourceSize: { w: TILE_SIZE, h: TILE_SIZE },
      spriteSourceSize: { x: 0, y: 0, w: TILE_SIZE, h: TILE_SIZE },
    };
  }

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(assetsDir, 'tileset.png'), buffer);

  const manifest = {
    frames: manifestFrames,
    meta: {
      image: 'tileset.png',
      format: 'RGBA8888',
      size: { w: canvasWidth, h: canvasHeight },
      scale: 1,
    },
  };

  fs.writeFileSync(
    path.join(assetsDir, 'tileset.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('Tileset generated successfully at public/assets/');
}

generateTileset().catch(console.error);
