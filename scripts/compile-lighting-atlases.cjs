/**
 * Compile 512x512 Companion Normal (_n.png) and Material (_m.png) Atlases +
 * 4-Panel Diagnostic Preview Sheets (LIGHT-02).
 *
 * Flags:
 *   --strip-legacy-shadows   Removes legacy semi-transparent dark grounding
 *                            ellipses baked into base entity/item slots in
 *                            public/assets/tileset.png before generating
 *                            derived animation frames and themed atlases.
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const {
  writeRgbaPng,
  decodeRgbaPng,
  blitRgbaTile,
  compileAtlasSurfaces,
  render4PanelPreviewStrip,
} = require('./lib/surface-compiler.cjs');

const ATLAS_DEFS = [
  { id: 'default', json: 'tileset.json', img: 'tileset.png' },
  { id: 'traxus_foundry', json: 'tileset_traxus_foundry.json', img: 'tileset_traxus_foundry.png' },
  { id: 'sekiguchi_biolabs', json: 'tileset_sekiguchi_biolabs.json', img: 'tileset_sekiguchi_biolabs.png' },
  { id: 'dark_subnet', json: 'tileset_dark_subnet.json', img: 'tileset_dark_subnet.png' },
];

const KEY_SPRITE_GROUPS = [
  {
    filename: 'props_lighting_preview.png',
    title: 'Props // 4-Panel Surface Inspection',
    keys: [
      'prop_workstation_active',
      'prop_cryo_vat',
      'prop_capacitor_bank',
      'prop_biocabinet',
      'prop_safe_locked',
      'prop_crate_cover',
      'prop_cooling_vent_ready',
      'prop_stabilizer',
      'prop_subnet_console',
      'prop_dead_drop',
      'prop_vault_door',
    ],
  },
  {
    filename: 'walls_doors_lighting_preview.png',
    title: 'Terrain // 4-Panel Surface Inspection',
    keys: [
      'floor',
      'wall',
      'wall_straight_h',
      'wall_straight_v',
      'wall_single',
      'wall_t_s',
      'door',
      'door_h_closed',
      'door_h_open',
      'door_v_closed',
      'door_v_open',
    ],
  },
  {
    filename: 'actors_items_lighting_preview.png',
    title: 'Actors & Loot // 4-Panel Surface Inspection',
    keys: [
      'player_vanguard',
      'player_bastion',
      'bastion-v1-north',
      'bastion-v1-east',
      'bastion-v1-south',
      'bastion-v1-west',
      'player_ghost',
      'enemy_null_pointer',
      'enemy_buffer_overflow',
      'enemy_fragmenter',
      'enemy_logic_leaker',
      'enemy_seed_eater',
      'enemy_system_admin',
      'anchor',
      'staircase',
      'item_flux',
      'item_potion',
    ],
  },
];

async function stripLegacyShadows(rootDir) {
  const tilesetPath = path.join(rootDir, 'public/assets/tileset.png');
  const altTilesetPath = path.join(rootDir, 'public/assets/tiles/tileset.png');
  const jsonPath = path.join(rootDir, 'public/assets/tileset.json');

  const img = await loadImage(tilesetPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);

  const tilesetJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  const clearedSlots = new Set();
  let pixelsRemoved = 0;

  for (const [key, frameDef] of Object.entries(tilesetJson.frames)) {
    if (
      key === 'floor' ||
      key === 'wall' ||
      key.startsWith('wall_') ||
      key === 'door' ||
      key.startsWith('door_') ||
      fs.existsSync(path.join(rootDir, 'public/assets/tiles/shells', `${key}.png`))
    ) {
      continue;
    }
    const { x: ox, y: oy, w, h } = frameDef.frame;
    const slotKey = `${ox},${oy}`;
    if (clearedSlots.has(slotKey)) continue;
    clearedSlots.add(slotKey);

    for (let ly = 0; ly < h; ly++) {
      for (let lx = 0; lx < w; lx++) {
        const i = ((oy + ly) * canvas.width + (ox + lx)) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        // Legacy grounding ellipses are very dark semi-transparent pixels (alpha < 235)
        if (a > 0 && a < 235 && r <= 24 && g <= 24 && b <= 38) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 0;
          pixelsRemoved++;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const outBuf = canvas.toBuffer('image/png');
  fs.writeFileSync(tilesetPath, outBuf);
  if (fs.existsSync(path.dirname(altTilesetPath))) {
    fs.writeFileSync(altTilesetPath, outBuf);
  }
  console.log(`Stripped ${pixelsRemoved} baked drop-shadow pixels from public/assets/tileset.png.`);
}

async function compileAllAtlases(rootDir) {
  const assetsDir = path.join(rootDir, 'public/assets');
  const previewDir = path.join(rootDir, 'docs/visual-design/previews');
  if (!fs.existsSync(previewDir)) {
    fs.mkdirSync(previewDir, { recursive: true });
  }

  for (const def of ATLAS_DEFS) {
    const jsonPath = path.join(assetsDir, def.json);
    const imgPath = path.join(assetsDir, def.img);
    if (!fs.existsSync(jsonPath) || !fs.existsSync(imgPath)) {
      console.warn(`Skipping ${def.id}: missing ${def.json} or ${def.img}`);
      continue;
    }

    const tilesetJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const img = await loadImage(imgPath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);

    const buffers = compileAtlasSurfaces(canvas, tilesetJson, def.id);
    const shellsDir = path.join(rootDir, 'public/assets/tiles/shells');
    for (const [key, frameDef] of Object.entries(tilesetJson.frames)) {
      const { x, y } = frameDef.frame;
      const customNormalPath = path.join(shellsDir, `${key}_n.png`);
      const customMatPath = path.join(shellsDir, `${key}_m.png`);
      if (fs.existsSync(customNormalPath)) {
        const nTile = decodeRgbaPng(customNormalPath);
        blitRgbaTile(buffers.normal, canvas.width, nTile.rgba, nTile.width, nTile.height, x, y);
      }
      if (fs.existsSync(customMatPath)) {
        const mTile = decodeRgbaPng(customMatPath);
        blitRgbaTile(buffers.material, canvas.width, mTile.rgba, mTile.width, mTile.height, x, y);
      }
    }
    const baseName = def.img.replace(/\.png$/, '');
    const normalPath = path.join(assetsDir, `${baseName}_n.png`);
    const materialPath = path.join(assetsDir, `${baseName}_m.png`);

    writeRgbaPng(normalPath, canvas.width, canvas.height, buffers.normal);
    writeRgbaPng(materialPath, canvas.width, canvas.height, buffers.material);

    console.log(
      `Compiled [${def.id}] ${canvas.width}x${canvas.height} -> ${path.basename(normalPath)}, ${path.basename(materialPath)}`
    );

    const diffuseData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    if (def.id === 'default') {
      for (const group of KEY_SPRITE_GROUPS) {
        const entries = group.keys
          .filter((k) => tilesetJson.frames[k])
          .map((k) => ({ key: k, frame: tilesetJson.frames[k].frame }));
        const strip = render4PanelPreviewStrip(
          createCanvas,
          diffuseData,
          buffers,
          canvas.width,
          entries,
          group.title
        );
        fs.writeFileSync(path.join(previewDir, group.filename), strip.toBuffer('image/png'));
      }
    } else {
      const themeKeys = [
        'floor',
        'wall',
        'door',
        'prop_cryo_vat',
        'prop_workstation_active',
        'anchor',
        'player_vanguard',
      ];
      const entries = themeKeys
        .filter((k) => tilesetJson.frames[k])
        .map((k) => ({ key: k, frame: tilesetJson.frames[k].frame }));
      const strip = render4PanelPreviewStrip(
        createCanvas,
        diffuseData,
        buffers,
        canvas.width,
        entries,
        `${def.id.toUpperCase()} // 4-Panel Inspection`
      );
      fs.writeFileSync(
        path.join(previewDir, `${def.id}_lighting_preview.png`),
        strip.toBuffer('image/png')
      );
    }
  }

  console.log(`Saved 4-panel inspection sheets to ${previewDir}`);
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const stripOnly = process.argv.includes('--strip-legacy-shadows');
  if (stripOnly) {
    await stripLegacyShadows(rootDir);
  }
  await compileAllAtlases(rootDir);
}

main().catch((err) => {
  console.error('Failed compiling lighting atlases:', err);
  process.exit(1);
});
