import { loadImage, createCanvas } from 'canvas';
import fs from 'fs';

async function main() {
  const tilesetPath = 'public/assets/tileset.png';
  const staircasePath = '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/staircase_sprite_1774990880973.png';
  const anchorPath = '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/anchor_sprite_1774990900118.png';

  console.log(`Loading tileset from ${tilesetPath}`);
  const tileset = await loadImage(tilesetPath);
  console.log(`Loading staircase from ${staircasePath}`);
  const staircase = await loadImage(staircasePath);
  console.log(`Loading anchor from ${anchorPath}`);
  const anchor = await loadImage(anchorPath);

  const canvas = createCanvas(tileset.width, tileset.height);
  const ctx = canvas.getContext('2d');

  // Draw original tileset
  ctx.drawImage(tileset, 0, 0);

  // Draw new sprites at fixed slots
  // staircase at (64, 64)
  ctx.drawImage(staircase, 64, 64, 32, 32);
  // anchor at (96, 64)
  ctx.drawImage(anchor, 96, 64, 32, 32);

  // Save back
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(tilesetPath, buffer);
  console.log('Successfully updated public/assets/tileset.png');
}

main().catch(error => {
  console.error('Error in add-sprites script:');
  console.error(error);
  process.exit(1);
});
