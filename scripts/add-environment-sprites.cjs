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

  const environmentTiles = [
    { key: 'prop_workstation_active', aliases: ['prop_workstation'], file: 'prop_workstation_active.png', x: 128, y: 0 },
    { key: 'prop_locker_closed', aliases: ['prop_locker'], file: 'prop_locker_closed.png', x: 160, y: 0 },
    { key: 'prop_biocabinet', aliases: ['prop_biocabinet_full'], file: 'prop_biocabinet.png', x: 192, y: 0 },
    { key: 'prop_safe_locked', aliases: ['prop_safe', 'prop_safe_open'], file: 'prop_safe_locked.png', x: 224, y: 0 },

    { key: 'prop_vault_door', aliases: ['prop_vault_door_locked'], file: 'prop_vault_door.png', x: 128, y: 32 },
    { key: 'prop_cooling_vent_ready', aliases: ['prop_cooling_vent'], file: 'prop_cooling_vent_ready.png', x: 160, y: 32 },
    { key: 'prop_dead_drop', aliases: ['prop_dead_drop_ready'], file: 'prop_dead_drop.png', x: 192, y: 32 },
    { key: 'prop_stabilizer', aliases: ['prop_stabilizer_active'], file: 'prop_stabilizer.png', x: 224, y: 32 },

    { key: 'prop_subnet_console', aliases: [], file: 'prop_subnet_console.png', x: 128, y: 64 },
    { key: 'prop_crate_cover', aliases: [], file: 'prop_crate_cover.png', x: 160, y: 64 },
    { key: 'prop_cryo_vat', aliases: [], file: 'prop_cryo_vat.png', x: 192, y: 64 },
    { key: 'prop_capacitor_bank', aliases: [], file: 'prop_capacitor_bank.png', x: 224, y: 64 },

    { key: 'item_access_key', aliases: [], file: 'item_access_key.png', x: 128, y: 96 },
    { key: 'item_scavenger_siphon', aliases: [], file: 'item_scavenger_siphon.png', x: 160, y: 96 },
    { key: 'item_kinetic_breacher', aliases: [], file: 'item_kinetic_breacher.png', x: 192, y: 96 },
    { key: 'item_thermal_bypass', aliases: [], file: 'item_thermal_bypass.png', x: 224, y: 96 },
  ];

  console.log(`Loading master tileset from ${tilesetPaths[0]}`);
  const masterTileset = await loadImage(tilesetPaths[0]);

  const canvas = createCanvas(masterTileset.width, masterTileset.height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Draw original tileset
  ctx.drawImage(masterTileset, 0, 0);

  // Composite environment sprites into tileset
  for (const item of environmentTiles) {
    const tilePath = path.join(rootDir, 'public/assets/tiles', item.file);
    if (!fs.existsSync(tilePath)) {
      throw new Error(`Tile file not found: ${tilePath}`);
    }
    console.log(`Compositing ${item.key} from ${tilePath} at (${item.x}, ${item.y})`);
    const img = await loadImage(tilePath);
    ctx.clearRect(item.x, item.y, 32, 32);
    ctx.drawImage(img, item.x, item.y, 32, 32);
  }

  // Save updated tileset images
  const buffer = canvas.toBuffer('image/png');
  for (const p of tilesetPaths) {
    fs.writeFileSync(p, buffer);
    console.log(`Saved updated tileset to ${p} (${buffer.length} bytes)`);
  }

  // Update tileset.json
  const jsonRaw = fs.readFileSync(tilesetJsonPath, 'utf-8');
  const tilesetJson = JSON.parse(jsonRaw);

  for (const item of environmentTiles) {
    const frameData = {
      frame: { x: item.x, y: item.y, w: 32, h: 32 },
      sourceSize: { w: 32, h: 32 },
      spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
    };
    tilesetJson.frames[item.key] = frameData;
    if (item.aliases) {
      for (const alias of item.aliases) {
        tilesetJson.frames[alias] = frameData;
      }
    }
  }

  fs.writeFileSync(tilesetJsonPath, JSON.stringify(tilesetJson, null, 2) + '\n');
  console.log(`Updated ${tilesetJsonPath} with all environment frames and aliases.`);
}

main().catch((err) => {
  console.error('Error adding environment sprites:', err);
  process.exit(1);
});
