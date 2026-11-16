import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodePngUnpremultiplied } from '@dev-tool/studio/shared/png-decode';
import {
  decodePreviewMaterial,
  decodePreviewNormal,
  PREVIEW_LOGICAL_SIZE,
  renderLitPreviewFrame,
} from '@dev-tool/studio/shared/lit-preview-math';
import type { LightSourceData } from '@shared/components/light-source';

describe('CRIT-01: InspectorLitTilePreview PNG decoding & 2.5D BRDF', () => {
  it('decodes _n.png and _m.png without alpha premultiplication', async () => {
    const nBuf = fs.readFileSync(path.resolve('public/assets/tileset_n.png'));
    const mBuf = fs.readFileSync(path.resolve('public/assets/tileset_m.png'));

    const nAb = nBuf.buffer.slice(nBuf.byteOffset, nBuf.byteOffset + nBuf.byteLength);
    const mAb = mBuf.buffer.slice(mBuf.byteOffset, mBuf.byteOffset + mBuf.byteLength);

    const nImg = await decodePngUnpremultiplied(nAb);
    const mImg = await decodePngUnpremultiplied(mAb);

    expect(nImg.width).toBe(512);
    expect(nImg.height).toBe(512);
    expect(mImg.width).toBe(512);
    expect(mImg.height).toBe(512);

    // Find a pixel with A === 0 in _n.png (matte surface, specular = 0) and verify RGB != 0
    let foundZeroAlphaNormal = false;
    for (let i = 0; i < nImg.data.length; i += 4) {
      if (nImg.data[i + 3] === 0 && nImg.data[i + 2] > 128) {
        foundZeroAlphaNormal = true;
        break;
      }
    }
    expect(foundZeroAlphaNormal).toBe(true);

    // Find a pixel with A === 0 in _m.png (height = 0) and verify B (roughness) != 0
    let foundZeroAlphaMat = false;
    for (let i = 0; i < mImg.data.length; i += 4) {
      if (mImg.data[i + 3] === 0 && mImg.data[i + 2] > 100) {
        foundZeroAlphaMat = true;
        break;
      }
    }
    expect(foundZeroAlphaMat).toBe(true);
  });

  it('decodes material channels as R=emissive, G=shadowOpacity, B=roughness, A=heightZ*32', () => {
    // High matte roughness (210) on flat floor (height 0), zero shadow opacity
    const mat = new Uint8ClampedArray([0, 0, 210, 0, 128, 255, 64, 255]);
    const floorMat = decodePreviewMaterial(mat, 0);
    expect(floorMat.emissive).toBe(0);
    expect(floorMat.shadowOpacity).toBe(0);
    expect(floorMat.roughness).toBeCloseTo(210 / 255, 3);
    expect(floorMat.heightZ).toBe(0);

    const wallMat = decodePreviewMaterial(mat, 4);
    expect(wallMat.emissive).toBeCloseTo(128 / 255, 3);
    expect(wallMat.shadowOpacity).toBe(1);
    expect(wallMat.roughness).toBeCloseTo(64 / 255, 3);
    expect(wallMat.heightZ).toBe(32);
  });

  it('decodes tangent normal ny without Y-inversion (south bevel G > 128 => ny > 0)', () => {
    const norm = new Uint8ClampedArray([128, 220, 190, 128]);
    const sampled = decodePreviewNormal(norm, 0);
    expect(sampled.ny).toBeGreaterThan(0);
    expect(sampled.nz).toBeGreaterThan(0);
    const len = Math.hypot(sampled.nx, sampled.ny, sampled.nz);
    expect(len).toBeCloseTo(1, 5);
  });

  it('illuminates matte floor, respects south-facing normals, casts 32px shadows, and applies offsetX/offsetY', () => {
    const total = PREVIEW_LOGICAL_SIZE * PREVIEW_LOGICAL_SIZE * 4;
    const diffuse = new Uint8ClampedArray(total);
    const normal = new Uint8ClampedArray(total);
    const material = new Uint8ClampedArray(total);

    for (let i = 0; i < total; i += 4) {
      diffuse[i] = 160;
      diffuse[i + 1] = 160;
      diffuse[i + 2] = 160;
      diffuse[i + 3] = 255;

      // Flat floor normal (0, 0, 1)
      normal[i] = 128;
      normal[i + 1] = 128;
      normal[i + 2] = 255;
      normal[i + 3] = 0;

      // Matte floor (roughness=210, height=0)
      material[i] = 0;
      material[i + 1] = 0;
      material[i + 2] = 210;
      material[i + 3] = 0;
    }

    // Place a south-facing bevel pixel at (48, 40)
    const southIdx = (40 * PREVIEW_LOGICAL_SIZE + 48) * 4;
    normal[southIdx] = 128;
    normal[southIdx + 1] = 240; // +Ny (south)
    normal[southIdx + 2] = 180;

    // Place a 32px wall occluder row at y=30
    for (let x = 20; x < 70; x++) {
      const wi = (30 * PREVIEW_LOGICAL_SIZE + x) * 4;
      material[wi + 1] = 255; // shadowOpacity = 1
      material[wi + 3] = 255; // height = 32px
    }

    const baseLight: LightSourceData = {
      enabled: true,
      color: '#ffffff',
      intensity: 1.5,
      radius: 160,
      height: 22,
      falloff: 1.2,
      castsShadows: true,
      offsetX: 6,
      offsetY: -4,
      animation: { type: 'STATIC', speed: 2, amplitude: 0 },
    };

    const outSouth = new Uint8ClampedArray(total);
    const cursor = renderLitPreviewFrame(
      { diffuse, normal, material },
      outSouth,
      { viewMode: 'lit', baseLx: 48, baseLy: 60, effectiveLight: baseLight, timeSec: 0 },
    );

    expect(cursor.lx).toBe(54);
    expect(cursor.ly).toBe(56);

    // Floor pixel near light should be significantly brighter than ambient
    const nearFloorIdx = (56 * PREVIEW_LOGICAL_SIZE + 54) * 4;
    expect(outSouth[nearFloorIdx]).toBeGreaterThan(150);

    // South-facing pixel at (48, 40) lit from South (y=56) should be brighter than when lit from North (y=24)
    const southLitFromSouth = outSouth[southIdx];
    const outNorth = new Uint8ClampedArray(total);
    renderLitPreviewFrame(
      { diffuse, normal, material },
      outNorth,
      { viewMode: 'lit', baseLx: 42, baseLy: 28, effectiveLight: baseLight, timeSec: 0 },
    );
    expect(southLitFromSouth).toBeGreaterThan(outNorth[southIdx]);

    // Pixel behind the 32px wall at (54, 20) when light is at (54, 56) should be shadowed
    const shadowedIdx = (20 * PREVIEW_LOGICAL_SIZE + 54) * 4;
    const unshadowedIdx = (56 * PREVIEW_LOGICAL_SIZE + 54) * 4;
    expect(outSouth[shadowedIdx]).toBeLessThan(outSouth[unshadowedIdx] * 0.5);
  });
});
