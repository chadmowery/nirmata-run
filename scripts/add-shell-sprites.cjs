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

  const shellTiles = [
    { key: 'player_bastion', alias: 'bastion-v1', file: 'player_bastion.png', x: 0, y: 224 },
    { key: 'player_ghost', alias: 'ghost-v1', file: 'player_ghost.png', x: 32, y: 224 },
    { key: 'player_vanguard', alias: 'vanguard-v1', file: 'player_vanguard.png', x: 64, y: 224 },
  ];

  console.log(`Loading master tileset from ${tilesetPaths[0]}`);
  const masterTileset = await loadImage(tilesetPaths[0]);

  const canvas = createCanvas(masterTileset.width, masterTileset.height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Draw original tileset
  ctx.drawImage(masterTileset, 0, 0);

  // Composite shell sprites into tileset
  for (const shell of shellTiles) {
    const tilePath = path.join(rootDir, 'public/assets/tiles', shell.file);
    console.log(`Compositing ${shell.key} from ${tilePath} at (${shell.x}, ${shell.y})`);
    const img = await loadImage(tilePath);
    ctx.clearRect(shell.x, shell.y, 32, 32);
    ctx.drawImage(img, shell.x, shell.y, 32, 32);
  }

  // Save updated tileset images
  const buffer = canvas.toBuffer('image/png');
  for (const p of tilesetPaths) {
    fs.writeFileSync(p, buffer);
    console.log(`Saved updated tileset to ${p}`);
  }

  // Update tileset.json
  const jsonRaw = fs.readFileSync(tilesetJsonPath, 'utf-8');
  const tilesetJson = JSON.parse(jsonRaw);

  for (const shell of shellTiles) {
    const frameData = {
      frame: { x: shell.x, y: shell.y, w: 32, h: 32 },
      sourceSize: { w: 32, h: 32 },
      spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
    };
    tilesetJson.frames[shell.key] = frameData;
    if (shell.alias) {
      tilesetJson.frames[shell.alias] = frameData;
    }
  }

  fs.writeFileSync(tilesetJsonPath, JSON.stringify(tilesetJson, null, 2) + '\n');
  console.log(`Updated ${tilesetJsonPath} with shell frames and aliases.`);
}

main().catch((err) => {
  console.error('Error adding shell sprites:', err);
  process.exit(1);
});
