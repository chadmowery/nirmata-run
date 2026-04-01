import { loadImage, createCanvas } from 'canvas';
import fs from 'fs';

async function main() {
  const tilesetPath = 'public/assets/tileset.png';
  const newSprites = [
    { key: 'floor', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/floor_sprite_new_1774998381459.png', x: 0, y: 0 },
    { key: 'wall', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/wall_sprite_new_final_1775013348053.png', x: 32, y: 0 },
    { key: 'door', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/door_sprite_new_final2_1775013446193.png', x: 64, y: 0 },
    { key: 'player', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/player_sprite_new_final3_1775013470074.png', x: 0, y: 32 },
    { key: 'item_potion', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/potion_sprite_new_final4_1775013487706.png', x: 0, y: 64 },
  ];

  console.log(`Loading tileset from ${tilesetPath}`);
  const tileset = await loadImage(tilesetPath);

  const canvas = createCanvas(tileset.width, tileset.height);
  const ctx = canvas.getContext('2d');

  // Draw original tileset
  ctx.drawImage(tileset, 0, 0);

  // Draw new core sprites
  for (const sprite of newSprites) {
    console.log(`Loading ${sprite.key} from ${sprite.path}`);
    const img = await loadImage(sprite.path);
    // Explicitly clear slot first in case of transparency differences
    ctx.clearRect(sprite.x, sprite.y, 32, 32);
    ctx.drawImage(img, sprite.x, sprite.y, 32, 32);
  }

  // Save back
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(tilesetPath, buffer);
  console.log('Successfully updated tileset.png with all 5 core sprites');
}

main().catch(error => {
  console.error('Error in update-core-complete script:');
  console.error(error);
  process.exit(1);
});
