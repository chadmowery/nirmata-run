import type { LightSourceData } from '@shared/components/light-source';
import { evaluateLightAnimation, parseHexColorNormalized } from '@rendering/lighting/types';

export const PREVIEW_LOGICAL_SIZE = 96; // 3 x 3 tiles @ 32px
export const PREVIEW_DISPLAY_SIZE = 192; // 2x crisp pixel preview
export const PREVIEW_TILE_PX = 32;

export interface PreviewGBuffer {
  diffuse: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  material: Uint8ClampedArray;
}

export interface PreviewSampledMaterial {
  emissive: number;
  shadowOpacity: number;
  roughness: number;
  heightZ: number;
}

export interface PreviewSampledNormal {
  nx: number;
  ny: number;
  nz: number;
  specular: number;
}

export function decodePreviewNormal(normal: Uint8ClampedArray, offset: number): PreviewSampledNormal {
  const nxRaw = (normal[offset] / 255) * 2 - 1;
  const nyRaw = (normal[offset + 1] / 255) * 2 - 1;
  const nzRaw = Math.max(0.05, (normal[offset + 2] / 255) * 2 - 1);
  const len = Math.hypot(nxRaw, nyRaw, nzRaw) || 1;
  return {
    nx: nxRaw / len,
    ny: nyRaw / len,
    nz: nzRaw / len,
    specular: normal[offset + 3] / 255,
  };
}

export function decodePreviewMaterial(
  material: Uint8ClampedArray,
  offset: number,
): PreviewSampledMaterial {
  const emissive = material[offset] / 255;
  const shadowOpacity = material[offset + 1] / 255;
  const roughness = Math.max(0.08, Math.min(1, material[offset + 2] / 255));
  const heightZ = (material[offset + 3] / 255) * 32;
  return { emissive, shadowOpacity, roughness, heightZ };
}

/**
 * Renders one 96x96 lit BRDF composite frame (or diagnostic view) into `out`.
 * Returns the final light cursor `(lx, ly)` in logical pixels.
 */
export function renderLitPreviewFrame(
  bufs: PreviewGBuffer,
  out: Uint8ClampedArray,
  options: {
    viewMode: 'lit' | 'normal' | 'material';
    baseLx: number;
    baseLy: number;
    effectiveLight: LightSourceData;
    timeSec: number;
  },
): { lx: number; ly: number } {
  const { viewMode, baseLx, baseLy, effectiveLight, timeSec } = options;
  const lx = baseLx + (effectiveLight.offsetX ?? 0);
  const ly = baseLy + (effectiveLight.offsetY ?? 0);

  const animEval = evaluateLightAnimation(effectiveLight, timeSec, 0);
  const lIntensity = effectiveLight.enabled
    ? effectiveLight.intensity * animEval.intensityMultiplier
    : 0;
  const [lr, lg, lb] = parseHexColorNormalized(effectiveLight.color);
  const cr = animEval.colorRgb[0] ?? lr;
  const cg = animEval.colorRgb[1] ?? lg;
  const cb = animEval.colorRgb[2] ?? lb;
  const radiusPx = Math.max(24, effectiveLight.radius * 0.55);
  const lz = Math.max(6, effectiveLight.height);
  const falloff = Math.max(0.5, effectiveLight.falloff);

  const { diffuse, normal, material } = bufs;

  for (let py = 0; py < PREVIEW_LOGICAL_SIZE; py++) {
    for (let px = 0; px < PREVIEW_LOGICAL_SIZE; px++) {
      const i = (py * PREVIEW_LOGICAL_SIZE + px) * 4;

      if (viewMode === 'normal') {
        out[i] = normal[i];
        out[i + 1] = normal[i + 1];
        out[i + 2] = normal[i + 2];
        out[i + 3] = 255;
        continue;
      }

      if (viewMode === 'material') {
        out[i] = material[i];
        out[i + 1] = material[i + 1];
        out[i + 2] = material[i + 2];
        out[i + 3] = 255;
        continue;
      }

      const ar = diffuse[i] / 255;
      const ag = diffuse[i + 1] / 255;
      const ab = diffuse[i + 2] / 255;

      const { nx, ny, nz, specular: spec } = decodePreviewNormal(normal, i);
      const { emissive, roughness, heightZ: pz } = decodePreviewMaterial(material, i);

      const dx = lx - px;
      const dy = ly - py;
      const dz = lz - pz;
      const dist2d = Math.hypot(dx, dy);

      let litR = ar * 0.14;
      let litG = ag * 0.17;
      let litB = ab * 0.22;

      if (dist2d < radiusPx && lIntensity > 0.001) {
        const dist3d = Math.max(1, Math.hypot(dist2d, dz));
        const ndotl = Math.max(0, (nx * dx + ny * dy + nz * dz) / dist3d);
        const normD = Math.min(1, dist2d / radiusPx);
        const window = Math.pow(Math.max(0, 1 - normD * normD), 2);
        const atten = (window / (normD * normD * Math.max(0.2, falloff) * 4.0 + 1.0)) * lIntensity;

        // 8-step 2.5D shadow raymarch
        let shadow = 1.0;
        if (effectiveLight.castsShadows && dist2d > 3) {
          for (let s = 1; s <= 7; s++) {
            const t = s / 8;
            const sx = Math.round(px + dx * t);
            const sy = Math.round(py + dy * t);
            if (sx < 0 || sx >= PREVIEW_LOGICAL_SIZE || sy < 0 || sy >= PREVIEW_LOGICAL_SIZE) {
              break;
            }
            const si = (sy * PREVIEW_LOGICAL_SIZE + sx) * 4;
            const occOp = material[si + 1] / 255;
            const occZ = (material[si + 3] / 255) * 32;
            const rayZ = pz + dz * t;
            if (occOp > 0.05 && occZ > rayZ + 0.65 && occZ > pz + 0.85) {
              shadow -= occOp * 0.62;
              if (shadow <= 0.08) {
                shadow = 0.08;
                break;
              }
            }
          }
        }

        // Blinn-Phong specular glint with roughness-driven shininess
        const shininess = 48.0 + (6.0 - 48.0) * roughness;
        const hx = dx / dist3d;
        const hy = dy / dist3d;
        const hz = dz / dist3d + 1.0;
        const hLen = Math.max(0.001, Math.hypot(hx, hy, hz));
        const ndoth = Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen);
        const specPower = Math.pow(ndoth, shininess) * spec * 0.85;

        const factor = atten * shadow;
        litR += (ar * ndotl + specPower) * cr * factor;
        litG += (ag * ndotl + specPower) * cg * factor;
        litB += (ab * ndotl + specPower) * cb * factor;
      }

      // Self-luminous emissive boost
      litR += ar * emissive * 1.4;
      litG += ag * emissive * 1.4;
      litB += ab * emissive * 1.4;

      // Filmic tone curve
      out[i] = Math.min(255, Math.round((litR / (1 + litR * 0.35)) * 255));
      out[i + 1] = Math.min(255, Math.round((litG / (1 + litG * 0.35)) * 255));
      out[i + 2] = Math.min(255, Math.round((litB / (1 + litB * 0.35)) * 255));
      out[i + 3] = 255;
    }
  }

  return { lx, ly };
}
