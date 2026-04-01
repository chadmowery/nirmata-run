import { loadImage, createCanvas } from 'canvas';
import fs from 'fs';

async function main() {
  const tilesetPath = 'public/assets/tileset.png';
  const newSprites = [
    { key: 'floor', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/floor_sprite_new_1774998381459.png', x: 0, y: 0 },
  ];
  const clearSlots = [
    { x: 32, y: 32 }, // enemy_triangle
    { x: 64, y: 32 }, // enemy_square
    { x: 32, y: 64 }, // item_star
  ];

  console.log(`Loading tileset from ${tilesetPath}`);
  const tileset = await loadImage(tilesetPath);

  const canvas = createCanvas(tileset.width, tileset.height);
  const ctx = canvas.getContext('2d');

  // Draw original tileset
  ctx.drawImage(tileset, 0, 0);

  // Clear deprecated slots
  for (const slot of clearSlots) {
    console.log(`Clearing slot at (${slot.x}, ${slot.y})`);
    ctx.clearRect(slot.x, slot.y, 32, 32);
  }

  // Draw new item sprites (partial update)
  for (const sprite of newSprites) {
    console.log(`Loading ${sprite.key} from ${sprite.path}`);
    const img = await loadImage(sprite.path);
    ctx.drawImage(img, sprite.x, sprite.y, 32, 32);
  }

  // Save back
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(tilesetPath, buffer);
  console.log('Successfully updated tileset.png with new floor sprite and cleared 3 deprecated slots');
}

main().catch(error => {
  console.error('Error in update-core-partial script:');
  console.error(error);
  process.exit(1);
});
