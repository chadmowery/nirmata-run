const fs = require('fs');
const path = require('path');
const { loadImage, createCanvas } = require('canvas');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const tilesetPaths = [
    path.join(rootDir, 'public/assets/tileset.png'),
    path.join(rootDir, 'public/assets/tiles/tileset.png'),
  ];
  const tilesetJsonPath = path.join(rootDir, 'public/assets/tileset.json');

  const directionalTiles = [
    // --- ROW 8 (y = 256): Wall Autotiles Cardinal Set ---
    { key: 'wall_single', aliases: ['wall_pillar'], file: 'wall_single.png', x: 0, y: 256 },
    { key: 'wall_straight_h', aliases: [], file: 'wall_straight_h.png', x: 32, y: 256 },
    { key: 'wall_straight_v', aliases: [], file: 'wall_straight_v.png', x: 64, y: 256 },
    { key: 'wall_cross', aliases: [], file: 'wall_cross.png', x: 96, y: 256 },
    { key: 'wall_cap_n', aliases: [], file: 'wall_cap_n.png', x: 128, y: 256 },
    { key: 'wall_cap_e', aliases: [], file: 'wall_cap_e.png', x: 160, y: 256 },
    { key: 'wall_cap_s', aliases: [], file: 'wall_cap_s.png', x: 192, y: 256 },
    { key: 'wall_cap_w', aliases: [], file: 'wall_cap_w.png', x: 224, y: 256 },
    { key: 'wall_corner_ne', aliases: ['wall_corner_outer_sw'], file: 'wall_corner_ne.png', x: 256, y: 256 },
    { key: 'wall_corner_se', aliases: ['wall_corner_outer_nw'], file: 'wall_corner_se.png', x: 288, y: 256 },
    { key: 'wall_corner_sw', aliases: ['wall_corner_outer_ne'], file: 'wall_corner_sw.png', x: 320, y: 256 },
    { key: 'wall_corner_nw', aliases: ['wall_corner_outer_se'], file: 'wall_corner_nw.png', x: 352, y: 256 },
    { key: 'wall_t_n', aliases: ['wall_tjunction_n'], file: 'wall_t_n.png', x: 384, y: 256 },
    { key: 'wall_t_e', aliases: ['wall_tjunction_e'], file: 'wall_t_e.png', x: 416, y: 256 },
    { key: 'wall_t_s', aliases: ['wall_tjunction_s'], file: 'wall_t_s.png', x: 448, y: 256 },
    { key: 'wall_t_w', aliases: ['wall_tjunction_w'], file: 'wall_t_w.png', x: 480, y: 256 },

    // --- ROW 9 (y = 288): Inner Corners, Doors & Cover ---
    { key: 'wall_corner_inner_ne', aliases: ['wall_corner_ne_inner'], file: 'wall_corner_inner_ne.png', x: 0, y: 288 },
    { key: 'wall_corner_inner_se', aliases: ['wall_corner_se_inner'], file: 'wall_corner_inner_se.png', x: 32, y: 288 },
    { key: 'wall_corner_inner_sw', aliases: ['wall_corner_sw_inner'], file: 'wall_corner_inner_sw.png', x: 64, y: 288 },
    { key: 'wall_corner_inner_nw', aliases: ['wall_corner_nw_inner'], file: 'wall_corner_inner_nw.png', x: 96, y: 288 },
    { key: 'door_h_closed', aliases: ['door_closed_horizontal'], file: 'door_h_closed.png', x: 128, y: 288 },
    { key: 'door_v_closed', aliases: ['door_closed_vertical'], file: 'door_v_closed.png', x: 160, y: 288 },
    { key: 'door_h_open', aliases: ['door_open_horizontal'], file: 'door_h_open.png', x: 192, y: 288 },
    { key: 'door_v_open', aliases: ['door_open_vertical'], file: 'door_v_open.png', x: 224, y: 288 },
    { key: 'prop_crate_cover_h', aliases: [], file: 'prop_crate_cover_h.png', x: 256, y: 288 },
    { key: 'prop_crate_cover_v', aliases: [], file: 'prop_crate_cover_v.png', x: 288, y: 288 },

    // --- ROW 10 (y = 320): Workstations & Lockers ---
    { key: 'prop_workstation_n', aliases: [], file: 'prop_workstation_n.png', x: 0, y: 320 },
    { key: 'prop_workstation_e', aliases: [], file: 'prop_workstation_e.png', x: 32, y: 320 },
    { key: 'prop_workstation_s', aliases: [], file: 'prop_workstation_s.png', x: 64, y: 320 },
    { key: 'prop_workstation_w', aliases: [], file: 'prop_workstation_w.png', x: 96, y: 320 },
    { key: 'prop_locker_n', aliases: [], file: 'prop_locker_n.png', x: 128, y: 320 },
    { key: 'prop_locker_e', aliases: [], file: 'prop_locker_e.png', x: 160, y: 320 },
    { key: 'prop_locker_s', aliases: [], file: 'prop_locker_s.png', x: 192, y: 320 },
    { key: 'prop_locker_w', aliases: [], file: 'prop_locker_w.png', x: 224, y: 320 },

    // --- ROW 11 (y = 352): Biocabinets & Vault Doors ---
    { key: 'prop_biocabinet_n', aliases: [], file: 'prop_biocabinet_n.png', x: 0, y: 352 },
    { key: 'prop_biocabinet_e', aliases: [], file: 'prop_biocabinet_e.png', x: 32, y: 352 },
    { key: 'prop_biocabinet_s', aliases: [], file: 'prop_biocabinet_s.png', x: 64, y: 352 },
    { key: 'prop_biocabinet_w', aliases: [], file: 'prop_biocabinet_w.png', x: 96, y: 352 },
    { key: 'prop_vault_door_n', aliases: ['prop_vault_door_locked_n'], file: 'prop_vault_door_n.png', x: 128, y: 352 },
    { key: 'prop_vault_door_e', aliases: ['prop_vault_door_locked_e'], file: 'prop_vault_door_e.png', x: 160, y: 352 },
    { key: 'prop_vault_door_s', aliases: ['prop_vault_door_locked_s'], file: 'prop_vault_door_s.png', x: 192, y: 352 },
    { key: 'prop_vault_door_w', aliases: ['prop_vault_door_locked_w'], file: 'prop_vault_door_w.png', x: 224, y: 352 },
  ];

  console.log(`Loading master tileset from ${tilesetPaths[0]}`);
  const masterTileset = await loadImage(tilesetPaths[0]);

  // Expand to 512x512
  const ATLAS_SIZE = 512;
  const canvas = createCanvas(ATLAS_SIZE, ATLAS_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Draw original tileset in top-left quadrant (0, 0)
  ctx.drawImage(masterTileset, 0, 0);

  // Composite directional tiles into expanded rows
  for (const item of directionalTiles) {
    const tilePath = path.join(rootDir, 'public/assets/tiles', item.file);
    if (!fs.existsSync(tilePath)) {
      throw new Error(`Directional tile file not found: ${tilePath}`);
    }
    console.log(`Compositing ${item.key} from ${tilePath} at (${item.x}, ${item.y})`);
    const img = await loadImage(tilePath);
    ctx.clearRect(item.x, item.y, 32, 32);
    ctx.drawImage(img, item.x, item.y, 32, 32);
  }

  // Save updated 512x512 tileset images
  const buffer = canvas.toBuffer('image/png');
  for (const p of tilesetPaths) {
    fs.writeFileSync(p, buffer);
    console.log(`Saved updated 512x512 tileset to ${p} (${buffer.length} bytes)`);
  }

  // Update tileset.json
  const jsonRaw = fs.readFileSync(tilesetJsonPath, 'utf-8');
  const tilesetJson = JSON.parse(jsonRaw);

  tilesetJson.meta.size = { w: ATLAS_SIZE, h: ATLAS_SIZE };

  for (const item of directionalTiles) {
    const frameData = {
      frame: { x: item.x, y: item.y, w: 32, h: 32 },
      sourceSize: { w: 32, h: 32 },
      spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
    };
    tilesetJson.frames[item.key] = frameData;
    if (item.aliases && item.aliases.length > 0) {
      for (const alias of item.aliases) {
        tilesetJson.frames[alias] = frameData;
      }
    }
  }

  fs.writeFileSync(tilesetJsonPath, JSON.stringify(tilesetJson, null, 2) + '\n');
  console.log(`Updated ${tilesetJsonPath} with ${directionalTiles.length} directional frames and aliases.`);
}

main().catch((err) => {
  console.error('Error adding directional tiles:', err);
  process.exit(1);
});
