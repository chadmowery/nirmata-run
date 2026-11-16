/**
 * Lossless un-premultiplied PNG decoder for Gamedata Studio companion atlases (`_n.png`, `_m.png`).
 *
 * HTML5 2D `<canvas>` (`drawImage` + `getImageData`) premultiplies RGB by Alpha,
 * which destroys normal vectors and roughness/emissive channels wherever `A === 0`
 * (e.g. floor tiles with `heightZ = 0` or matte surfaces with `specular = 0`).
 * Decoding raw PNG `IDAT` chunks directly preserves all 4 RGBA channels bit-for-bit.
 */

export interface RawRgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

async function inflateZlib(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream is unavailable in this environment');
  }
  const copy = new Uint8Array(compressed.byteLength);
  copy.set(compressed);
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  writer.write(copy).catch(() => {});
  writer.close().catch(() => {});

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Decodes an 8-bit RGB/RGBA PNG buffer into raw un-premultiplied RGBA bytes.
 */
export async function decodePngUnpremultiplied(buffer: ArrayBuffer): Promise<RawRgbaImage> {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 8) {
    throw new Error('Invalid PNG: file too short');
  }
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error('Invalid PNG signature');
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatParts: Uint8Array[] = [];
  let idatTotal = 0;

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const type =
      String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) break;

    if (type === 'IHDR') {
      width = view.getUint32(dataStart, false);
      height = view.getUint32(dataStart + 4, false);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
      interlace = bytes[dataStart + 12];
    } else if (type === 'IDAT') {
      const part = bytes.subarray(dataStart, dataEnd);
      idatParts.push(part);
      idatTotal += part.length;
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4; // skip CRC
  }

  if (width <= 0 || height <= 0) {
    throw new Error('Invalid PNG dimensions');
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2) || interlace !== 0) {
    throw new Error(
      `Unsupported PNG format (bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace})`,
    );
  }

  const compressed = new Uint8Array(idatTotal);
  let pos = 0;
  for (const part of idatParts) {
    compressed.set(part, pos);
    pos += part.length;
  }

  const raw = await inflateZlib(compressed);
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const expectedMin = (stride + 1) * height;
  if (raw.length < expectedMin) {
    throw new Error(`Inflated PNG scanlines truncated: got ${raw.length}, expected ${expectedMin}`);
  }

  const unfiltered = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const rowIn = y * (stride + 1);
    const filterType = raw[rowIn];
    const rowOut = y * stride;
    const prevOut = (y - 1) * stride;

    for (let x = 0; x < stride; x++) {
      const val = raw[rowIn + 1 + x];
      const a = x >= bpp ? unfiltered[rowOut + x - bpp] : 0;
      const b = y > 0 ? unfiltered[prevOut + x] : 0;
      const c = y > 0 && x >= bpp ? unfiltered[prevOut + x - bpp] : 0;

      let recon = val;
      if (filterType === 1) {
        recon = (val + a) & 0xff;
      } else if (filterType === 2) {
        recon = (val + b) & 0xff;
      } else if (filterType === 3) {
        recon = (val + ((a + b) >> 1)) & 0xff;
      } else if (filterType === 4) {
        recon = (val + paethPredictor(a, b, c)) & 0xff;
      }
      unfiltered[rowOut + x] = recon;
    }
  }

  if (bpp === 4) {
    return { width, height, data: new Uint8ClampedArray(unfiltered) };
  }

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < unfiltered.length; i += 3, j += 4) {
    rgba[j] = unfiltered[i];
    rgba[j + 1] = unfiltered[i + 1];
    rgba[j + 2] = unfiltered[i + 2];
    rgba[j + 3] = 255;
  }
  return { width, height, data: rgba };
}
