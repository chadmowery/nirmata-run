import { loadImage, createCanvas } from 'canvas';
import fs from 'fs';

async function main() {
  const tilesetPath = 'public/assets/tileset.png';
  const sprites = [
    { key: 'logic_leaker', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/logic_leaker_sprite_1774995984265.png', x: 96, y: 0 },
    { key: 'fragmenter', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/fragmenter_sprite_1774996016935.png', x: 96, y: 32 },
    { key: 'null_pointer', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/null_pointer_sprite_1774996033531.png', x: 0, y: 96 },
    { key: 'buffer_overflow', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/buffer_overflow_sprite_1774996052729.png', x: 32, y: 96 },
    { key: 'seed_eater', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/seed_eater_sprite_1774996071053.png', x: 64, y: 96 },
    { key: 'system_admin', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/system_admin_sprite_1774996088256.png', x: 96, y: 96 },
  ];

  console.log(`Loading tileset from ${tilesetPath}`);
  const tileset = await loadImage(tilesetPath);

  const canvas = createCanvas(tileset.width, tileset.height);
  const ctx = canvas.getContext('2d');

  // Draw original tileset
  ctx.drawImage(tileset, 0, 0);

  // Draw new enemy sprites
  for (const sprite of sprites) {
    console.log(`Loading ${sprite.key} from ${sprite.path}`);
    const img = await loadImage(sprite.path);
    ctx.drawImage(img, sprite.x, sprite.y, 32, 32);
  }

  // Save back
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(tilesetPath, buffer);
  console.log('Successfully updated public/assets/tileset.png with 6 new enemy sprites');
}

main().catch(error => {
  console.error('Error in add-enemy-sprites script:');
  console.error(error);
  process.exit(1);
});
