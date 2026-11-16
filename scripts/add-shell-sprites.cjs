const fs = require('fs');
const path = require('path');
const { loadImage, createCanvas } = require('canvas');
const { decodeRgbaPng, decodeRgbaPngBuffer, blitRgbaTile, encodeRgbaPng } = require('./lib/surface-compiler.cjs');

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

  const directionalShellTiles = [
    { key: 'bastion-v1-north', file: 'shells/bastion-v1-north.png', x: 0, y: 480, orientation: 'NORTH', fallbackFrame: 'player_bastion' },
    { key: 'bastion-v1-east', file: 'shells/bastion-v1-east.png', x: 32, y: 480, orientation: 'EAST', fallbackFrame: 'player_bastion' },
    { key: 'bastion-v1-south', file: 'shells/bastion-v1-south.png', x: 64, y: 480, orientation: 'SOUTH', fallbackFrame: 'player_bastion' },
    { key: 'bastion-v1-west', file: 'shells/bastion-v1-west.png', x: 96, y: 480, orientation: 'WEST', fallbackFrame: 'player_bastion' },
  ];

  console.log(`Loading master tileset from ${tilesetPaths[0]}`);
  const masterTileset = await loadImage(tilesetPaths[0]);

  const canvas = createCanvas(masterTileset.width, masterTileset.height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Draw original tileset
  ctx.drawImage(masterTileset, 0, 0);

  // Composite base shell sprites into tileset
  for (const shell of shellTiles) {
    const tilePath = path.join(rootDir, 'public/assets/tiles', shell.file);
    console.log(`Compositing ${shell.key} from ${tilePath} at (${shell.x}, ${shell.y})`);
    const img = await loadImage(tilePath);
    ctx.clearRect(shell.x, shell.y, 32, 32);
    ctx.drawImage(img, shell.x, shell.y, 32, 32);
  }

  // Convert canvas buffer to raw RGBA via PNG roundtrip so directional tiles can be blitted un-premultiplied
  const intermediateBuf = canvas.toBuffer('image/png');
  const tmpDecoded = decodeRgbaPngBuffer(intermediateBuf, 'master-tileset');

  // Composite directional shell sprites verbatim (preserving semi-transparent RGBs)
  for (const dirTile of directionalShellTiles) {
    const tilePath = path.join(rootDir, 'public/assets/tiles', dirTile.file);
    if (!fs.existsSync(tilePath)) {
      throw new Error(`Directional shell tile file not found: ${tilePath}`);
    }
    console.log(`Compositing ${dirTile.key} from ${tilePath} at (${dirTile.x}, ${dirTile.y})`);
    const decodedTile = decodeRgbaPng(tilePath);
    blitRgbaTile(tmpDecoded.rgba, tmpDecoded.width, decodedTile.rgba, decodedTile.width, decodedTile.height, dirTile.x, dirTile.y);
  }

  // Save updated tileset images
  const buffer = encodeRgbaPng(tmpDecoded.width, tmpDecoded.height, tmpDecoded.rgba);
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

  for (const dirTile of directionalShellTiles) {
    tilesetJson.frames[dirTile.key] = {
      frame: { x: dirTile.x, y: dirTile.y, w: 32, h: 32 },
      sourceSize: { w: 32, h: 32 },
      spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
      orientation: dirTile.orientation,
      fallbackFrame: dirTile.fallbackFrame,
    };
  }

  fs.writeFileSync(tilesetJsonPath, JSON.stringify(tilesetJson, null, 2) + '\n');
  console.log(`Updated ${tilesetJsonPath} with shell frames, directional bastion frames, and aliases.`);
}

main().catch((err) => {
  console.error('Error adding shell sprites:', err);
  process.exit(1);
});
