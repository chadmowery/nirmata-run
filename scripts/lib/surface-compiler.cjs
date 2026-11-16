/**
 * Multi-Plane Surface Compiler for Deferred 2.5D Lighting (LIGHT-02)
 *
 * Compiles companion 512x512 `_n.png` (Tangent Normal + Specular) and `_m.png`
 * (Emissive + ShadowOpacity + Roughness + Height Z) atlases from each diffuse
 * tileset image and JSON manifest.
 *
 * IMPORTANT: Uses a pure zlib un-premultiplied RGBA PNG writer because Cairo /
 * node-canvas premultiplies RGB by Alpha when writing PNGs, which would destroy
 * normal/material channels wherever Specular (A=0) or Height Z (A=0) is zero.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------------------------------------------------------------------------
// Lossless Non-Premultiplied RGBA PNG Encoder (zlib + CRC32)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodeRgbaPng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type 0 (None)
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, rowStart + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = zlib.deflateSync(raw, { level: 6 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function writeRgbaPng(filePath, width, height, rgba) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, encodeRgbaPng(width, height, rgba));
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Decodes an 8-bit RGBA PNG buffer into raw un-premultiplied RGBA bytes without Cairo premultiplication.
 */
function decodeRgbaPngBuffer(buf, sourceLabel = 'buffer') {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== signature[i]) {
      throw new Error(`Invalid PNG signature in ${sourceLabel}`);
    }
  }

  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idats = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idats.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`Unsupported PNG format in ${sourceLabel}: depth=${bitDepth}, colorType=${colorType}`);
  }

  const raw = zlib.inflateSync(Buffer.concat(idats));
  const bpp = 4;
  const stride = width * bpp;
  const rgba = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    const rowIn = y * (stride + 1);
    const filterType = raw[rowIn];
    const rowOut = y * stride;
    for (let x = 0; x < stride; x++) {
      const val = raw[rowIn + 1 + x];
      const a = x >= bpp ? rgba[rowOut + x - bpp] : 0;
      const b = y > 0 ? rgba[rowOut - stride + x] : 0;
      const c = x >= bpp && y > 0 ? rgba[rowOut - stride + x - bpp] : 0;
      let recon = val;
      if (filterType === 1) recon = (val + a) & 0xff;
      else if (filterType === 2) recon = (val + b) & 0xff;
      else if (filterType === 3) recon = (val + ((a + b) >> 1)) & 0xff;
      else if (filterType === 4) recon = (val + paethPredictor(a, b, c)) & 0xff;
      else if (filterType !== 0) {
        throw new Error(`Unsupported PNG filter ${filterType} in ${sourceLabel}`);
      }
      rgba[rowOut + x] = recon;
    }
  }

  return { width, height, rgba };
}

/**
 * Decodes an 8-bit RGBA PNG file into raw un-premultiplied RGBA bytes without Cairo premultiplication.
 */
function decodeRgbaPng(filePath) {
  return decodeRgbaPngBuffer(fs.readFileSync(filePath), filePath);
}

/**
 * Copies a raw un-premultiplied RGBA tile buffer into a larger atlas RGBA buffer at (destX, destY).
 */
function blitRgbaTile(dstRgba, dstWidth, srcRgba, srcWidth, srcHeight, destX, destY) {
  for (let ly = 0; ly < srcHeight; ly++) {
    const srcOffset = ly * srcWidth * 4;
    const dstOffset = ((destY + ly) * dstWidth + destX) * 4;
    dstRgba.set(srcRgba.subarray(srcOffset, srcOffset + srcWidth * 4), dstOffset);
  }
}

// ---------------------------------------------------------------------------
// Color Helpers
// ---------------------------------------------------------------------------
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function luminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// ---------------------------------------------------------------------------
// Multi-Plane Surface Buffers (Diffuse, Normal+Spec, Material+Height)
// ---------------------------------------------------------------------------
class SurfaceAtlasBuffers {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    const len = width * height * 4;
    this.normal = new Uint8ClampedArray(len);
    this.material = new Uint8ClampedArray(len);

    // Initialize default up normals (0, 0, 1) with specular 0, matte roughness 220
    for (let i = 0; i < len; i += 4) {
      this.normal[i] = 128;
      this.normal[i + 1] = 128;
      this.normal[i + 2] = 255;
      this.normal[i + 3] = 0;

      this.material[i] = 0;
      this.material[i + 1] = 0;
      this.material[i + 2] = 220;
      this.material[i + 3] = 0;
    }
  }

  _idx(x, y) {
    return (y * this.width + x) * 4;
  }

  setNormal(x, y, nx, ny, nz, specByte) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const len = Math.hypot(nx, ny, nz) || 1;
    const ux = nx / len;
    const uy = ny / len;
    const uz = nz / len;
    const idx = this._idx(x, y);
    this.normal[idx] = clamp(Math.round((ux * 0.5 + 0.5) * 255), 0, 255);
    this.normal[idx + 1] = clamp(Math.round((uy * 0.5 + 0.5) * 255), 0, 255);
    this.normal[idx + 2] = clamp(Math.round((uz * 0.5 + 0.5) * 255), 0, 255);
    this.normal[idx + 3] = clamp(Math.round(specByte), 0, 255);
  }

  setMaterial(x, y, emissiveByte, shadowOpacityByte, roughnessByte, heightPx) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = this._idx(x, y);
    this.material[idx] = clamp(Math.round(emissiveByte), 0, 255);
    this.material[idx + 1] = clamp(Math.round(shadowOpacityByte), 0, 255);
    this.material[idx + 2] = clamp(Math.round(roughnessByte), 0, 255);
    this.material[idx + 3] = clamp(Math.round((heightPx / 32) * 255), 0, 255);
  }

  drawBevelBox(ox, oy, bx, by, bw, bh, opts = {}) {
    const {
      heightPx = 18,
      bevelPx = 2,
      spec = 64,
      roughness = 145,
      shadowOpacity = 255,
      frontSkirtRows = 3,
      diffusePixels = null,
      atlasWidth = this.width,
    } = opts;

    for (let ly = by; ly < by + bh; ly++) {
      for (let lx = bx; lx < bx + bw; lx++) {
        if (lx < 0 || lx >= 32 || ly < 0 || ly >= 32) continue;
        const ax = ox + lx;
        const ay = oy + ly;
        if (diffusePixels) {
          const di = (ay * atlasWidth + ax) * 4;
          if (diffusePixels[di + 3] < 20) continue;
        }

        const dxLeft = lx - bx;
        const dxRight = bx + bw - 1 - lx;
        const dyTop = ly - by;
        const dyBottom = by + bh - 1 - ly;

        let nx = 0;
        let ny = 0;
        let nz = 1;
        let h = heightPx;

        if (dyBottom < frontSkirtRows) {
          // South-facing front vertical skirt catches corridor lights cleanly
          ny = 0.88;
          nz = 0.47;
          h = Math.max(4, heightPx * ((dyBottom + 1) / (frontSkirtRows + 1)));
        } else {
          if (dxLeft < bevelPx) nx -= (bevelPx - dxLeft) * 0.55;
          if (dxRight < bevelPx) nx += (bevelPx - dxRight) * 0.55;
          if (dyTop < bevelPx) ny -= (bevelPx - dyTop) * 0.55;
        }

        this.setNormal(ax, ay, nx, ny, nz, spec);
        this.setMaterial(ax, ay, 0, shadowOpacity, roughness, h);
      }
    }
  }

  drawCylinder(ox, oy, cx, topY, rx, bodyH, opts = {}) {
    const {
      heightPx = 20,
      spec = 225,
      roughness = 45,
      shadowOpacity = 128,
      diffusePixels = null,
      atlasWidth = this.width,
    } = opts;

    for (let ly = topY; ly < topY + bodyH; ly++) {
      for (let lx = Math.floor(cx - rx); lx <= Math.ceil(cx + rx); lx++) {
        if (lx < 0 || lx >= 32 || ly < 0 || ly >= 32) continue;
        const dx = clamp((lx - cx) / Math.max(1, rx), -0.96, 0.96);
        const ax = ox + lx;
        const ay = oy + ly;
        if (diffusePixels) {
          const di = (ay * atlasWidth + ax) * 4;
          if (diffusePixels[di + 3] < 20) continue;
        }

        const nx = dx;
        let ny = 0;
        if (ly - topY <= 2) ny = -0.35;
        else if (topY + bodyH - 1 - ly <= 2) ny = 0.45;
        const nz = Math.sqrt(Math.max(0.08, 1 - nx * nx * 0.75 - ny * ny * 0.5));
        const profileH = heightPx * (0.65 + 0.35 * nz);

        this.setNormal(ax, ay, nx, ny, nz, spec);
        this.setMaterial(ax, ay, 0, shadowOpacity, roughness, profileH);
      }
    }
  }

  drawDome(ox, oy, cx, cy, radius, opts = {}) {
    const {
      heightPx = 20,
      spec = 175,
      roughness = 75,
      shadowOpacity = 180,
      diffusePixels = null,
      atlasWidth = this.width,
    } = opts;

    const rMax = Math.max(1, radius);
    for (let ly = Math.floor(cy - rMax); ly <= Math.ceil(cy + rMax); ly++) {
      for (let lx = Math.floor(cx - rMax); lx <= Math.ceil(cx + rMax); lx++) {
        if (lx < 0 || lx >= 32 || ly < 0 || ly >= 32) continue;
        const dx = (lx - cx) / rMax;
        const dy = (ly - cy) / rMax;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > 1.0) continue;

        const ax = ox + lx;
        const ay = oy + ly;
        if (diffusePixels) {
          const di = (ay * atlasWidth + ax) * 4;
          if (diffusePixels[di + 3] < 20) continue;
        }

        const nz = Math.sqrt(Math.max(0.08, 1 - dist2));
        this.setNormal(ax, ay, dx, dy, nz, spec);
        this.setMaterial(ax, ay, 0, shadowOpacity, roughness, heightPx * (0.4 + 0.6 * nz));
      }
    }
  }

  paintEmissivePixel(ox, oy, lx, ly, emissive = 255, spec = 180, heightPx = null) {
    const ax = ox + lx;
    const ay = oy + ly;
    if (ax < 0 || ax >= this.width || ay < 0 || ay >= this.height) return;
    const idx = this._idx(ax, ay);
    this.normal[idx + 3] = clamp(Math.round(spec), 0, 255);
    this.material[idx] = clamp(Math.round(emissive), 0, 255);
    this.material[idx + 2] = 38; // low roughness for glowing optical diodes
    if (heightPx !== null) {
      this.material[idx + 3] = clamp(Math.round((heightPx / 32) * 255), 0, 255);
    }
  }
}

// ---------------------------------------------------------------------------
// Frame Category & Emissive Classifier
// ---------------------------------------------------------------------------
function resolveBaseKey(key) {
  return key
    .replace(/_(idle_1|atk_1|anim_[12]|spin_[12]|pulse_[12]|blink_1|glint_1)$/, '')
    .replace(/_(n|e|s|w)$/, '');
}

function getCategory(frameKey) {
  if (frameKey === 'floor') return 'floor';
  if (frameKey === 'wall' || frameKey.startsWith('wall_')) return 'wall';
  if (frameKey.includes('door_h_open') || frameKey.includes('door_v_open') || frameKey.includes('door_open_')) {
    return 'door_open';
  }
  if (frameKey === 'door' || frameKey.startsWith('door_')) return 'door_closed';
  if (frameKey.includes('vault_door')) return 'vault_door';
  if (frameKey.includes('cryo_vat')) return 'cryo_vat';
  if (frameKey.includes('biocabinet')) return 'biocabinet';
  if (frameKey.includes('capacitor_bank')) return 'capacitor_bank';
  if (frameKey.includes('cooling_vent')) return 'cooling_vent';
  if (frameKey.includes('stabilizer')) return 'stabilizer';
  if (frameKey.includes('workstation')) return 'workstation';
  if (frameKey.includes('subnet_console')) return 'subnet_console';
  if (frameKey.includes('crate_cover')) return 'crate_cover';
  if (frameKey.includes('dead_drop')) return 'dead_drop';
  if (frameKey.includes('safe') || frameKey.includes('locker')) {
    return 'tall_box_prop';
  }
  if (frameKey.startsWith('anchor')) return 'anchor';
  if (frameKey.startsWith('staircase')) return 'staircase';
  if (frameKey.startsWith('player')) return 'player';
  if (frameKey.startsWith('enemy_')) return 'enemy';
  if (frameKey.startsWith('item_')) return 'item';
  return 'generic';
}

function isNeonEmissiveColor(r, g, b, a, category, themeId) {
  if (a < 100) return 0;
  const [hue, sat, lum] = rgbToHsl(r, g, b);

  // Neutral blacks / greys / bone-white panels are NEVER emissive on their own
  if (sat < 0.42 || lum < 0.28) return 0;

  // Floor tiles only illuminate bright glowing conduits/veins (avoid flagging dark slate tint)
  if (category === 'floor') {
    if (themeId === 'traxus_foundry') {
      // Molten amber/orange conduit traces
      return lum >= 0.4 && sat >= 0.7 && (hue <= 0.14 || hue >= 0.94) ? 235 : 0;
    }
    if (themeId === 'sekiguchi_biolabs') {
      // Bioluminescent mint/emerald channels
      return lum >= 0.38 && sat >= 0.65 && hue >= 0.35 && hue <= 0.55 ? 235 : 0;
    }
    if (themeId === 'dark_subnet') {
      // Quantum cyan & magenta grid nodes
      return lum >= 0.38 && sat >= 0.7 ? 245 : 0;
    }
    // Default CyberAcme micro-traces
    return lum >= 0.48 && sat >= 0.72 && hue >= 0.45 && hue <= 0.6 ? 200 : 0;
  }

  // Standard high-chroma glowing diodes, monitors, crystals, plasma, hazard LEDs
  if (sat >= 0.68 && lum >= 0.42) return 255;
  if (sat >= 0.55 && lum >= 0.55) return 215;
  return 0;
}

function getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx, ly) {
  const cx = clamp(lx, 0, 31);
  const cy = clamp(ly, 0, 31);
  const i = ((oy + cy) * atlasWidth + (ox + cx)) * 4;
  const a = diffusePixels[i + 3];
  if (a < 20) return 0;
  return luminance(diffusePixels[i], diffusePixels[i + 1], diffusePixels[i + 2]);
}

function isOuterVoidWallPixel(diffusePixels, atlasWidth, ox, oy, lx, ly) {
  const i = ((oy + ly) * atlasWidth + (ox + lx)) * 4;
  const r = diffusePixels[i];
  const g = diffusePixels[i + 1];
  const b = diffusePixels[i + 2];
  const a = diffusePixels[i + 3];
  if (a < 20) return true;
  // Detect WALL_C.VOID (#050816) used as empty floor surround on narrow directional walls
  const isVoidColor = r <= 12 && g <= 16 && b <= 32 && lumNearZero(r, g, b);
  if (!isVoidColor) return false;

  // Keep internal 1px structural groove rows (like skirt groove y=26 or panel divider seams) solid
  let nonVoidNorth = false;
  let nonVoidSouth = false;
  let nonVoidWest = false;
  let nonVoidEast = false;
  for (let d = 1; d <= 3; d++) {
    if (ly - d >= 0 && !isDarkVoidColor(diffusePixels, atlasWidth, ox + lx, oy + ly - d)) nonVoidNorth = true;
    if (ly + d < 32 && !isDarkVoidColor(diffusePixels, atlasWidth, ox + lx, oy + ly + d)) nonVoidSouth = true;
    if (lx - d >= 0 && !isDarkVoidColor(diffusePixels, atlasWidth, ox + lx - d, oy + ly)) nonVoidWest = true;
    if (lx + d < 32 && !isDarkVoidColor(diffusePixels, atlasWidth, ox + lx + d, oy + ly)) nonVoidEast = true;
  }
  return !((nonVoidNorth && nonVoidSouth) || (nonVoidWest && nonVoidEast));
}

function lumNearZero(r, g, b) {
  return r + g + b <= 58;
}

function isDarkVoidColor(diffusePixels, atlasWidth, ax, ay) {
  const i = (ay * atlasWidth + ax) * 4;
  if (diffusePixels[i + 3] < 20) return true;
  return diffusePixels[i] <= 12 && diffusePixels[i + 1] <= 16 && diffusePixels[i + 2] <= 32;
}

// ---------------------------------------------------------------------------
// Compile Individual 32x32 Frame into Normal + Material Planes
// ---------------------------------------------------------------------------
function compileFrameSurface(buffers, diffusePixels, atlasWidth, ox, oy, frameKey, themeId) {
  const cat = getCategory(frameKey);

  // 1. Structural / Geometric Material + Height Primitives per Category
  if (cat === 'floor') {
    const floorSpec =
      themeId === 'sekiguchi_biolabs'
        ? 150
        : themeId === 'dark_subnet'
          ? 130
          : themeId === 'traxus_foundry'
            ? 85
            : 26;
    const floorRough =
      themeId === 'sekiguchi_biolabs' ? 75 : themeId === 'dark_subnet' ? 95 : 210;

    for (let ly = 0; ly < 32; ly++) {
      for (let lx = 0; lx < 32; lx++) {
        const ax = ox + lx;
        const ay = oy + ly;
        const lL = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx - 1, ly);
        const lR = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx + 1, ly);
        const lU = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx, ly - 1);
        const lD = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx, ly + 1);
        const nx = (lL - lR) * 0.45;
        const ny = (lU - lD) * 0.45;
        buffers.setNormal(ax, ay, nx, ny, 1.0, floorSpec);
        buffers.setMaterial(ax, ay, 0, 0, floorRough, 0);
      }
    }
  } else if (cat === 'wall') {
    const isFullWall = frameKey === 'wall';
    // First determine wall occupancy mask (0 = outer void floor padding, 1 = solid bulkhead)
    const solid = new Uint8Array(32 * 32);
    for (let ly = 0; ly < 32; ly++) {
      for (let lx = 0; lx < 32; lx++) {
        if (isFullWall || !isOuterVoidWallPixel(diffusePixels, atlasWidth, ox, oy, lx, ly)) {
          solid[ly * 32 + lx] = 1;
        }
      }
    }

    const wallSpec =
      themeId === 'sekiguchi_biolabs' ? 160 : themeId === 'traxus_foundry' ? 95 : 115;
    const wallRough = themeId === 'sekiguchi_biolabs' ? 85 : 135;

    for (let ly = 0; ly < 32; ly++) {
      for (let lx = 0; lx < 32; lx++) {
        const ax = ox + lx;
        const ay = oy + ly;
        if (!solid[ly * 32 + lx]) {
          buffers.setNormal(ax, ay, 0, 0, 1.0, 22);
          buffers.setMaterial(ax, ay, 0, 0, 215, 0);
          continue;
        }

        // Check boundary distances for beveled wall roof & 4px+ South skirt
        const nEmpty = ly > 0 && !solid[(ly - 1) * 32 + lx];
        const sEmpty = ly === 31 || (ly < 31 && !solid[(ly + 1) * 32 + lx]);
        const sNearEmpty =
          (ly + 1 < 32 && !solid[(ly + 1) * 32 + lx]) ||
          (ly + 2 < 32 && !solid[(ly + 2) * 32 + lx]) ||
          (ly + 3 < 32 && !solid[(ly + 3) * 32 + lx]) ||
          (ly + 4 < 32 && !solid[(ly + 4) * 32 + lx]);
        const wEmpty = lx > 0 && !solid[ly * 32 + (lx - 1)];
        const eEmpty = lx < 31 && !solid[ly * 32 + (lx + 1)];

        let nx = 0;
        let ny = 0;
        let nz = 1.0;
        const heightPx = 32;

        // Only walls with an exposed southern bottom edge (or base full wall tile) have a South front skirt.
        const hasSouthSkirt = isFullWall || !solid[31 * 32 + 16];
        const isFrontSkirtRow =
          (hasSouthSkirt && ly >= 22 && ly <= 30 && solid[ly * 32 + lx]) ||
          (!hasSouthSkirt && !sEmpty && sNearEmpty && ly >= 25);

        if (isFullWall && ly >= 24) {
          ny = 0.9;
          nz = 0.44;
        } else if (isFrontSkirtRow) {
          ny = 0.9;
          nz = 0.44;
        } else {
          if (wEmpty) nx = -0.7;
          else if (eEmpty) nx = 0.7;
          if (nEmpty) ny = -0.7;
          else if (sEmpty) ny = 0.85;

          // Subtle Sobel surface relief for internal wall ribs & panel seams
          const lL = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx - 1, ly);
          const lR = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx + 1, ly);
          const lU = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx, ly - 1);
          const lD = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx, ly + 1);
          nx += (lL - lR) * 0.35;
          ny += (lU - lD) * 0.35;
          nz = nx === 0 && ny === 0 ? 1.0 : 0.72;
        }

        buffers.setNormal(ax, ay, nx, ny, nz, wallSpec);
        buffers.setMaterial(ax, ay, 0, 255, wallRough, heightPx);
      }
    }
  } else if (cat === 'door_open') {
    // Open doors only cast light-blocking shadows on the retracted jamb posts, NOT the open doorway!
    const isHorizontal = frameKey.includes('_h_') || frameKey.includes('horizontal');
    for (let ly = 0; ly < 32; ly++) {
      for (let lx = 0; lx < 32; lx++) {
        const ax = ox + lx;
        const ay = oy + ly;
        const inThreshold = isHorizontal ? lx >= 7 && lx <= 24 : ly >= 7 && ly <= 24;
        if (inThreshold || isDarkVoidColor(diffusePixels, atlasWidth, ax, ay)) {
          buffers.setNormal(ax, ay, 0, 0, 1.0, 40);
          buffers.setMaterial(ax, ay, 0, 0, 180, 0);
        } else {
          buffers.setNormal(ax, ay, isHorizontal ? (lx < 16 ? 0.5 : -0.5) : 0, 0.3, 0.8, 165);
          buffers.setMaterial(ax, ay, 0, 220, 85, 22);
        }
      }
    }
  } else if (cat === 'door_closed') {
    // Spec §7.2.2: Side jambs at Z = 32px (O = 255); central laser barrier beam sets Emissive = 255, Z = 16px, O = 0
    const isVertical = frameKey.includes('_v_') || frameKey.includes('vertical');
    for (let ly = 0; ly < 32; ly++) {
      for (let lx = 0; lx < 32; lx++) {
        const ax = ox + lx;
        const ay = oy + ly;
        const inJamb = isVertical ? ly <= 6 || ly >= 25 : lx <= 6 || lx >= 25;
        const inLaserBeam = isVertical
          ? lx >= 14 && lx <= 18 && !inJamb
          : ly >= 14 && ly <= 18 && !inJamb;

        if (inJamb) {
          const nx = isVertical ? 0 : lx <= 6 ? 0.45 : -0.45;
          const ny = isVertical ? (ly <= 6 ? 0.45 : -0.45) : 0.25;
          buffers.setNormal(ax, ay, nx, ny, 0.85, 165);
          buffers.setMaterial(ax, ay, 0, 255, 80, 32);
        } else if (inLaserBeam) {
          buffers.setNormal(ax, ay, 0, isVertical ? 0 : 0.2, 0.98, 210);
          buffers.setMaterial(ax, ay, 255, 0, 38, 16);
        } else if (isDarkVoidColor(diffusePixels, atlasWidth, ax, ay)) {
          buffers.setNormal(ax, ay, 0, 0, 1.0, 26);
          buffers.setMaterial(ax, ay, 0, 0, 210, 0);
        } else {
          buffers.setNormal(ax, ay, 0, 0.4, 0.9, 145);
          buffers.setMaterial(ax, ay, 0, 255, 85, 24);
        }
      }
    }
  } else if (cat === 'vault_door') {
    buffers.drawBevelBox(ox, oy, 2, 2, 28, 28, {
      heightPx: 32,
      bevelPx: 3,
      spec: 195,
      roughness: 80,
      shadowOpacity: 255,
      frontSkirtRows: 4,
      diffusePixels,
      atlasWidth,
    });
  } else if (cat === 'cryo_vat') {
    buffers.drawCylinder(ox, oy, 15.5, 4, 9, 25, {
      heightPx: 22,
      spec: 235,
      roughness: 38,
      shadowOpacity: 110, // Translucent glass transmits partial light
      diffusePixels,
      atlasWidth,
    });
  } else if (cat === 'biocabinet') {
    buffers.drawBevelBox(ox, oy, 4, 4, 24, 25, {
      heightPx: 20,
      bevelPx: 2,
      spec: 150,
      roughness: 95,
      shadowOpacity: 210,
      diffusePixels,
      atlasWidth,
    });
    buffers.drawCylinder(ox, oy, 15.5, 7, 7, 17, {
      heightPx: 20,
      spec: 225,
      roughness: 42,
      shadowOpacity: 140,
      diffusePixels,
      atlasWidth,
    });
  } else if (cat === 'capacitor_bank') {
    buffers.drawBevelBox(ox, oy, 5, 16, 22, 13, {
      heightPx: 14,
      bevelPx: 2,
      spec: 130,
      roughness: 110,
      shadowOpacity: 220,
      diffusePixels,
      atlasWidth,
    });
    buffers.drawCylinder(ox, oy, 10, 5, 4, 15, {
      heightPx: 22,
      spec: 200,
      roughness: 60,
      shadowOpacity: 200,
      diffusePixels,
      atlasWidth,
    });
    buffers.drawCylinder(ox, oy, 21, 5, 4, 15, {
      heightPx: 22,
      spec: 200,
      roughness: 60,
      shadowOpacity: 200,
      diffusePixels,
      atlasWidth,
    });
  } else if (cat === 'cooling_vent') {
    buffers.drawBevelBox(ox, oy, 3, 3, 26, 26, {
      heightPx: 6,
      bevelPx: 2,
      spec: 155,
      roughness: 95,
      shadowOpacity: 60,
      frontSkirtRows: 2,
      diffusePixels,
      atlasWidth,
    });
    buffers.drawDome(ox, oy, 15.5, 15.5, 10, {
      heightPx: 7,
      spec: 175,
      roughness: 80,
      shadowOpacity: 60,
      diffusePixels,
      atlasWidth,
    });
  } else if (cat === 'stabilizer' || cat === 'anchor') {
    buffers.drawBevelBox(ox, oy, 4, 4, 24, 24, {
      heightPx: 18,
      bevelPx: 2,
      spec: 165,
      roughness: 85,
      shadowOpacity: 170,
      frontSkirtRows: 2,
      diffusePixels,
      atlasWidth,
    });
    buffers.drawDome(ox, oy, 15.5, 14.5, 8, {
      heightPx: 22,
      spec: 205,
      roughness: 60,
      shadowOpacity: 165,
      diffusePixels,
      atlasWidth,
    });
  } else if (cat === 'staircase') {
    buffers.drawBevelBox(ox, oy, 3, 3, 26, 26, {
      heightPx: 5,
      bevelPx: 2,
      spec: 120,
      roughness: 125,
      shadowOpacity: 0,
      frontSkirtRows: 2,
      diffusePixels,
      atlasWidth,
    });
  } else if (cat === 'workstation' || cat === 'subnet_console') {
    buffers.drawBevelBox(ox, oy, 3, 5, 26, 24, {
      heightPx: cat === 'subnet_console' ? 18 : 16,
      bevelPx: 2,
      spec: 155,
      roughness: 95,
      shadowOpacity: 200,
      frontSkirtRows: 3,
      diffusePixels,
      atlasWidth,
    });
  } else if (cat === 'crate_cover') {
    buffers.drawBevelBox(ox, oy, 3, 6, 26, 22, {
      heightPx: 12,
      bevelPx: 3,
      spec: 64,
      roughness: 155,
      shadowOpacity: 230,
      frontSkirtRows: 3,
      diffusePixels,
      atlasWidth,
    });
  } else if (cat === 'dead_drop') {
    buffers.drawBevelBox(ox, oy, 4, 6, 24, 22, {
      heightPx: 14,
      bevelPx: 2,
      spec: 72,
      roughness: 145,
      shadowOpacity: 245,
      frontSkirtRows: 3,
      diffusePixels,
      atlasWidth,
    });
  } else if (cat === 'tall_box_prop') {
    buffers.drawBevelBox(ox, oy, 4, 4, 24, 25, {
      heightPx: 24,
      bevelPx: 2,
      spec: 84,
      roughness: 135,
      shadowOpacity: 255,
      frontSkirtRows: 3,
      diffusePixels,
      atlasWidth,
    });
  } else if (cat === 'player' || cat === 'enemy') {
    // Actors: Sobel heightfield + subtle spherical volume over opaque pixels
    const actorHeight = cat === 'player' ? 17 : 18;
    const actorSpec = cat === 'player' ? 145 : 130;
    for (let ly = 0; ly < 32; ly++) {
      for (let lx = 0; lx < 32; lx++) {
        const ax = ox + lx;
        const ay = oy + ly;
        const i = (ay * atlasWidth + ax) * 4;
        if (diffusePixels[i + 3] < 20) continue;

        const lL = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx - 1, ly);
        const lR = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx + 1, ly);
        const lU = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx, ly - 1);
        const lD = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx, ly + 1);
        const dx = (lx - 15.5) / 14;
        const dy = (ly - 15.5) / 14;
        const nx = dx * 0.45 + (lL - lR) * 0.9;
        const ny = dy * 0.35 + (lU - lD) * 0.9;
        const lum = luminance(diffusePixels[i], diffusePixels[i + 1], diffusePixels[i + 2]);
        const spec = lum > 0.65 ? Math.min(240, actorSpec + 55) : actorSpec;
        buffers.setNormal(ax, ay, nx, ny, 0.78, spec);
        buffers.setMaterial(ax, ay, 0, 175, 95, actorHeight * (0.7 + 0.3 * lum));
      }
    }
  } else if (cat === 'item') {
    // Ground items: shiny micro-relief, zero shadow occlusion
    for (let ly = 0; ly < 32; ly++) {
      for (let lx = 0; lx < 32; lx++) {
        const ax = ox + lx;
        const ay = oy + ly;
        const i = (ay * atlasWidth + ax) * 4;
        if (diffusePixels[i + 3] < 20) continue;

        const lL = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx - 1, ly);
        const lR = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx + 1, ly);
        const lU = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx, ly - 1);
        const lD = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx, ly + 1);
        buffers.setNormal(ax, ay, (lL - lR) * 0.85, (lU - lD) * 0.85, 0.85, 195);
        buffers.setMaterial(ax, ay, 0, 0, 62, 5);
      }
    }
  } else {
    // Generic Sobel fallback for any unrecognized frame
    for (let ly = 0; ly < 32; ly++) {
      for (let lx = 0; lx < 32; lx++) {
        const ax = ox + lx;
        const ay = oy + ly;
        const i = (ay * atlasWidth + ax) * 4;
        if (diffusePixels[i + 3] < 20) continue;

        const lL = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx - 1, ly);
        const lR = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx + 1, ly);
        const lU = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx, ly - 1);
        const lD = getTileLuminance(diffusePixels, atlasWidth, ox, oy, lx, ly + 1);
        buffers.setNormal(ax, ay, (lL - lR) * 0.8, (lU - lD) * 0.8, 0.85, 96);
        buffers.setMaterial(ax, ay, 0, 140, 130, 12);
      }
    }
  }

  // 2. Automated Emissive Detection Pass + Adjacent Hot-Core White Glints
  const emissiveFlags = new Uint8Array(32 * 32);
  for (let ly = 0; ly < 32; ly++) {
    for (let lx = 0; lx < 32; lx++) {
      const ax = ox + lx;
      const ay = oy + ly;
      const i = (ay * atlasWidth + ax) * 4;
      const em = isNeonEmissiveColor(
        diffusePixels[i],
        diffusePixels[i + 1],
        diffusePixels[i + 2],
        diffusePixels[i + 3],
        cat,
        themeId
      );
      if (em > 0) {
        emissiveFlags[ly * 32 + lx] = em;
        buffers.paintEmissivePixel(ox, oy, lx, ly, em, 180);
      }
    }
  }

  // Promote 1-2px pure-white hot optical centers adjacent to emissive pixels
  if (cat !== 'floor') {
    for (let ly = 0; ly < 32; ly++) {
      for (let lx = 0; lx < 32; lx++) {
        if (emissiveFlags[ly * 32 + lx] > 0) continue;
        const ax = ox + lx;
        const ay = oy + ly;
        const i = (ay * atlasWidth + ax) * 4;
        const r = diffusePixels[i];
        const g = diffusePixels[i + 1];
        const b = diffusePixels[i + 2];
        const a = diffusePixels[i + 3];
        if (a < 180 || r < 235 || g < 235 || b < 235) continue;

        let touchesEmissive = false;
        for (let dy = -1; dy <= 1 && !touchesEmissive; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = lx + dx;
            const ny = ly + dy;
            if (nx >= 0 && nx < 32 && ny >= 0 && ny < 32 && emissiveFlags[ny * 32 + nx] > 0) {
              touchesEmissive = true;
              break;
            }
          }
        }
        if (touchesEmissive) {
          buffers.paintEmissivePixel(ox, oy, lx, ly, 255, 220);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Full Atlas Compiler Entry Point
// ---------------------------------------------------------------------------
function compileAtlasSurfaces(diffuseCanvas, tilesetJson, themeId = 'default') {
  const width = diffuseCanvas.width;
  const height = diffuseCanvas.height;
  const ctx = diffuseCanvas.getContext('2d');
  const diffuseData = ctx.getImageData(0, 0, width, height).data;

  const buffers = new SurfaceAtlasBuffers(width, height);
  const compiledSlots = new Set();

  // Compile every unique 32x32 frame slot referenced by tileset.json
  for (const [frameKey, frameDef] of Object.entries(tilesetJson.frames)) {
    const { x, y } = frameDef.frame;
    const slotKey = `${x},${y}`;
    if (compiledSlots.has(slotKey)) continue;
    compiledSlots.add(slotKey);
    compileFrameSurface(buffers, diffuseData, width, x, y, frameKey, themeId);
  }

  return buffers;
}

// ---------------------------------------------------------------------------
// 4-Panel Diagnostic Preview Strip Renderer (Spec §7.2)
// Panels: 1) Unlit Albedo | 2) Tangent Normal (_n) | 3) Emissive+Height (_m) | 4) Simulated Lit
// ---------------------------------------------------------------------------
function render4PanelPreviewStrip(createCanvasFn, diffuseData, atlasBuffers, atlasW, entries, title) {
  const panelSize = 64; // 2x upscale of 32x32
  const padding = 10;
  const headerH = 42;
  const labelW = 155;
  const rowH = panelSize + 10;
  const sheetW = labelW + 4 * (panelSize + padding) + padding;
  const sheetH = headerH + entries.length * rowH + padding;

  const canvas = createCanvasFn(sheetW, sheetH);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, sheetW, sheetH);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(title, 10, 17);

  const colHeaders = ['ALBEDO', 'NORMAL (_n)', 'MAT/HEIGHT', 'SIM LIT'];
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#94a3b8';
  for (let c = 0; c < 4; c++) {
    ctx.fillText(colHeaders[c], labelW + c * (panelSize + padding), 34);
  }

  // Warm key point light coming from top-left (-0.5, -0.6, 0.75) for simulated composite
  const lx = -0.48;
  const ly = -0.58;
  const lz = 0.66;
  const lLen = Math.hypot(lx, ly, lz);
  const Lx = lx / lLen;
  const Ly = ly / lLen;
  const Lz = lz / lLen;

  entries.forEach((entry, idx) => {
    const ry = headerH + idx * rowH;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px monospace';
    ctx.fillText(entry.key.slice(0, 20), 8, ry + 36);

    const { x: ox, y: oy } = entry.frame;

    for (let panel = 0; panel < 4; panel++) {
      const px0 = labelW + panel * (panelSize + padding);
      ctx.fillStyle = '#03060c';
      ctx.fillRect(px0, ry, panelSize, panelSize);

      for (let py = 0; py < 32; py++) {
        for (let px = 0; px < 32; px++) {
          const i = ((oy + py) * atlasW + (ox + px)) * 4;
          const dr = diffuseData[i];
          const dg = diffuseData[i + 1];
          const db = diffuseData[i + 2];
          const da = diffuseData[i + 3] / 255;

          const nr = atlasBuffers.normal[i];
          const ng = atlasBuffers.normal[i + 1];
          const nb = atlasBuffers.normal[i + 2];
          const na = atlasBuffers.normal[i + 3];

          const mr = atlasBuffers.material[i];
          const ma = atlasBuffers.material[i + 3];

          let r = 0;
          let g = 0;
          let b = 0;

          if (panel === 0) {
            r = dr * da;
            g = dg * da;
            b = db * da;
          } else if (panel === 1) {
            if (da > 0.05) {
              r = nr;
              g = ng;
              b = nb;
            } else {
              r = 16;
              g = 18;
              b = 32;
            }
          } else if (panel === 2) {
            // Red = Emissive, Green = ShadowOpacity * 0.4, Blue = Height Z
            r = mr;
            g = Math.round(atlasBuffers.material[i + 1] * 0.35);
            b = ma;
          } else {
            // Simulated PBR-lite N.L + Specular + Emissive
            const ux = (nr / 255) * 2 - 1;
            const uy = (ng / 255) * 2 - 1;
            const uz = (nb / 255) * 2 - 1;
            const ndl = Math.max(0, ux * Lx + uy * Ly + uz * Lz);
            const hLen = Math.hypot(Lx, Ly, Lz + 1);
            const ndh = Math.max(0, (ux * Lx + uy * Ly + uz * (Lz + 1)) / hLen);
            const spec = Math.pow(ndh, 24) * (na / 255) * 140;
            const amb = 0.22;
            const em = (mr / 255) * 1.15;
            const litScale = amb + ndl * 0.95;
            r = clamp(Math.round((dr * litScale + spec + dr * em) * da), 0, 255);
            g = clamp(Math.round((dg * litScale + spec + dg * em) * da), 0, 255);
            b = clamp(Math.round((db * litScale + spec + db * em) * da), 0, 255);
          }

          ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
          ctx.fillRect(px0 + px * 2, ry + py * 2, 2, 2);
        }
      }
    }
  });

  return canvas;
}

module.exports = {
  encodeRgbaPng,
  decodeRgbaPng,
  decodeRgbaPngBuffer,
  blitRgbaTile,
  writeRgbaPng,
  SurfaceAtlasBuffers,
  compileAtlasSurfaces,
  render4PanelPreviewStrip,
};
