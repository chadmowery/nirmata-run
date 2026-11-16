import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { LightSource, LightSourceSchema, LightAnimationTypeSchema } from '@shared/components/light-source';
import { FloorState } from '@shared/components/floor-state';
import { resolveThemeAssetPaths } from '@shared/tileset-types';

const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets');

function decodePngRgba(filePath: string): { width: number; height: number; pixels: Uint8Array } {
  const buf = fs.readFileSync(filePath);
  expect(buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);

  let offset = 8;
  let width = 0;
  let height = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buf.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * 4;
  const pixels = new Uint8Array(width * height * 4);

  const paeth = (a: number, b: number, c: number): number => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  };

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart];
    const outRow = y * stride;

    for (let x = 0; x < stride; x++) {
      const byte = raw[rowStart + 1 + x];
      const left = x >= 4 ? pixels[outRow + x - 4] : 0;
      const up = y > 0 ? pixels[outRow - stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? pixels[outRow - stride + x - 4] : 0;

      let recon = byte;
      if (filter === 1) recon = (byte + left) & 0xff;
      else if (filter === 2) recon = (byte + up) & 0xff;
      else if (filter === 3) recon = (byte + ((left + up) >> 1)) & 0xff;
      else if (filter === 4) recon = (byte + paeth(left, up, upLeft)) & 0xff;

      pixels[outRow + x] = recon;
    }
  }

  return { width, height, pixels };
}

describe('LightSource Schema, Companion Atlases (_n/_m), and Un-Premultiplied Integrity [LIGHT-01/02/07]', () => {
  it('validates LightSourceSchema defaults and all 5 animation types', () => {
    const parsed = LightSourceSchema.parse({});
    expect(parsed.enabled).toBe(true);
    expect(parsed.color).toBe('#00f0ff');
    expect(parsed.intensity).toBe(1.2);
    expect(parsed.radius).toBe(128);
    expect(parsed.height).toBe(18);
    expect(parsed.falloff).toBe(1.8);
    expect(parsed.castsShadows).toBe(true);
    expect(parsed.animation.type).toBe('STATIC');

    for (const animType of ['STATIC', 'PULSE', 'FLICKER', 'STROBE', 'RADAR_SWEEP']) {
      expect(LightAnimationTypeSchema.parse(animType)).toBe(animType);
    }

    expect(() => LightSourceSchema.parse({ color: 'cyan' })).toThrow();
    expect(() => LightSourceSchema.parse({ radius: 4 })).toThrow();
    expect(LightSource.key).toBe('lightSource');
  });

  it('supports optional factionTheme on FloorState component schema', () => {
    const floor = FloorState.schema.parse({
      currentFloor: 2,
      maxFloor: 15,
      runSeed: 'seed-test-01',
      factionTheme: 'traxus',
      sectorCondition: 'DARK_SUBNET',
    });
    expect(floor.factionTheme).toBe('traxus');
    expect(floor.sectorCondition).toBe('DARK_SUBNET');
    expect(FloorState.key).toBe('floorState');
  });

  it('ships 512x512 _n.png and _m.png companion atlases for all 4 diffuse tilesets with non-premultiplied RGBA data', () => {
    const baseNames = [
      'tileset',
      'tileset_traxus_foundry',
      'tileset_sekiguchi_biolabs',
      'tileset_dark_subnet',
    ];

    for (const name of baseNames) {
      const normPath = path.join(ASSETS_DIR, `${name}_n.png`);
      const matPath = path.join(ASSETS_DIR, `${name}_m.png`);
      expect(fs.existsSync(normPath)).toBe(true);
      expect(fs.existsSync(matPath)).toBe(true);

      const normImg = decodePngRgba(normPath);
      const matImg = decodePngRgba(matPath);
      expect(normImg.width).toBe(512);
      expect(normImg.height).toBe(512);
      expect(matImg.width).toBe(512);
      expect(matImg.height).toBe(512);

      // Verify un-premultiplied RGB survives where Alpha === 0 (Specular=0 in _n, ShadowOpacity=0 on floor in _m)
      let foundNonZeroRgbWithZeroAlphaInNormal = false;
      for (let i = 0; i < normImg.pixels.length; i += 4) {
        if (normImg.pixels[i + 3] === 0 && (normImg.pixels[i] > 0 || normImg.pixels[i + 2] > 0)) {
          foundNonZeroRgbWithZeroAlphaInNormal = true;
          break;
        }
      }
      expect(foundNonZeroRgbWithZeroAlphaInNormal).toBe(true);

      let foundNonZeroRgbWithZeroAlphaInMat = false;
      for (let i = 0; i < matImg.pixels.length; i += 4) {
        if (
          matImg.pixels[i + 3] === 0 &&
          (matImg.pixels[i] > 0 || matImg.pixels[i + 1] > 0 || matImg.pixels[i + 2] > 0)
        ) {
          foundNonZeroRgbWithZeroAlphaInMat = true;
          break;
        }
      }
      expect(foundNonZeroRgbWithZeroAlphaInMat).toBe(true);
    }
  });

  it('removes baked semi-transparent grounding ellipses from prop tiles in base tileset.png', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ASSETS_DIR, 'tileset.json'), 'utf-8'));
    const diffuse = decodePngRgba(path.join(ASSETS_DIR, 'tileset.png'));

    const cryoRect = manifest.frames['prop_cryo_vat']?.frame;
    expect(cryoRect).toBeDefined();

    // Check bottom row corners of prop_cryo_vat — previously darkened with translucent shadow ovals (alpha 10..200)
    let semiTransparentDarkShadowPixels = 0;
    for (let y = cryoRect.y + cryoRect.h - 4; y < cryoRect.y + cryoRect.h; y++) {
      for (let x = cryoRect.x; x < cryoRect.x + cryoRect.w; x++) {
        const idx = (y * diffuse.width + x) * 4;
        const r = diffuse.pixels[idx];
        const g = diffuse.pixels[idx + 1];
        const b = diffuse.pixels[idx + 2];
        const a = diffuse.pixels[idx + 3];
        if (a > 10 && a < 210 && r < 25 && g < 25 && b < 25) {
          semiTransparentDarkShadowPixels++;
        }
      }
    }
    expect(semiTransparentDarkShadowPixels).toBe(0);
  });

  it('resolves companion normal and material atlas paths cleanly per theme', () => {
    const paths = resolveThemeAssetPaths('traxus');
    expect(paths.png).toBe('assets/tileset_traxus_foundry.png');
    expect(paths.png.replace('.png', '_n.png')).toBe('assets/tileset_traxus_foundry_n.png');
    expect(paths.png.replace('.png', '_m.png')).toBe('assets/tileset_traxus_foundry_m.png');
  });

  it('encodes Spec §3.3 & §7.2 heights for walls (32px), laser door beams (Z=16px, O=0, E=255), dead drops (14px), and lockers/safes (24px) (MED-05)', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ASSETS_DIR, 'tileset.json'), 'utf-8'));
    const matImg = decodePngRgba(path.join(ASSETS_DIR, 'tileset_m.png'));
    const readPixel = (x: number, y: number) => {
      const idx = (y * matImg.width + x) * 4;
      return {
        emissive: matImg.pixels[idx],
        shadowOpacity: matImg.pixels[idx + 1],
        roughness: matImg.pixels[idx + 2],
        heightByte: matImg.pixels[idx + 3],
      };
    };

    // Structural wall (including south front skirt row ly=28) encodes 32px (255) & O=255
    const wallRect = manifest.frames['wall'].frame;
    const wallRoof = readPixel(wallRect.x + 16, wallRect.y + 4);
    const wallSkirt = readPixel(wallRect.x + 16, wallRect.y + 28);
    expect(wallRoof.heightByte).toBe(255);
    expect(wallRoof.shadowOpacity).toBe(255);
    expect(wallSkirt.heightByte).toBe(255);
    expect(wallSkirt.shadowOpacity).toBe(255);

    // Closed laser door: side jamb at Z=32px (255), O=255; central laser beam at E=255, O=0, Z=16px (128)
    const doorRect = manifest.frames['door'].frame;
    const doorJamb = readPixel(doorRect.x + 2, doorRect.y + 16);
    const doorLaser = readPixel(doorRect.x + 16, doorRect.y + 16);
    expect(doorJamb.heightByte).toBe(255);
    expect(doorJamb.shadowOpacity).toBe(255);
    expect(doorLaser.emissive).toBe(255);
    expect(doorLaser.shadowOpacity).toBe(0);
    expect(doorLaser.heightByte).toBe(Math.round((16 / 32) * 255));

    // Dead drop (low-cover 14px) vs locker & safe_locked (tall prop 24px)
    const maxFrameHeightByte = (key: string) => {
      const rect = manifest.frames[key].frame;
      let maxH = 0;
      for (let py = 0; py < rect.h; py++) {
        for (let px = 0; px < rect.w; px++) {
          const p = readPixel(rect.x + px, rect.y + py);
          if (p.heightByte > maxH) maxH = p.heightByte;
        }
      }
      return maxH;
    };
    expect(maxFrameHeightByte('prop_dead_drop')).toBe(Math.round((14 / 32) * 255));
    expect(maxFrameHeightByte('prop_locker')).toBe(Math.round((24 / 32) * 255));
    expect(maxFrameHeightByte('prop_safe_locked')).toBe(Math.round((24 / 32) * 255));
  });
});
