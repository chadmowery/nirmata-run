import { loadImage, createCanvas } from 'canvas';
import fs from 'fs';

async function main() {
  const tilesetPath = 'public/assets/tileset.png';
  const sprites = [
    { key: 'auto_loader', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/item_auto_loader_sprite_1774997389146.png', x: 0, y: 128 },
    { key: 'bleed', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/item_bleed_sprite_1774997407005.png', x: 32, y: 128 },
    { key: 'vampire', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/item_vampire_sprite_1774997423651.png', x: 64, y: 128 },
    { key: 'neural_spike', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/item_neural_spike_sprite_1774997443930.png', x: 96, y: 128 },
    { key: 'phase_shift', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/item_phase_shift_sprite_1774997462872.png', x: 0, y: 160 },
    { key: 'extended_sight', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/item_extended_sight_sprite_1774997482270.png', x: 32, y: 160 },
    { key: 'displacement_venting', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/item_displacement_venting_sprite_1774997501237.png', x: 64, y: 160 },
    { key: 'static_siphon', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/item_static_siphon_sprite_1774997520774.png', x: 96, y: 160 },
    { key: 'neural_feedback', path: '/Users/chadmowery/.gemini/antigravity/brain/d4613f93-49b0-4c0d-ad69-fab1a51ce0cf/item_neural_feedback_sprite_1774997538763.png', x: 0, y: 192 },
  ];

  console.log(`Loading tileset from ${tilesetPath}`);
  const tileset = await loadImage(tilesetPath);

  // Expand to 256x256
  const canvas = createCanvas(256, 256);
  const ctx = canvas.getContext('2d');

  // Draw original tileset
  ctx.drawImage(tileset, 0, 0);

  // Draw new item sprites
  for (const sprite of sprites) {
    console.log(`Loading ${sprite.key} from ${sprite.path}`);
    const img = await loadImage(sprite.path);
    ctx.drawImage(img, sprite.x, sprite.y, 32, 32);
  }

  // Save back
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(tilesetPath, buffer);
  console.log('Successfully expanded tileset.png to 256x256 and added 9 new item sprites');
}

main().catch(error => {
  console.error('Error in add-item-sprites script:');
  console.error(error);
  process.exit(1);
});
