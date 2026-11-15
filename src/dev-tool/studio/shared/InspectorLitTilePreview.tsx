'use client';
import { useEffect, useRef, useState } from 'react';
import type { LightAnimationType, LightSourceData } from '@shared/components/light-source';
import { evaluateLightAnimation, parseHexColorNormalized } from '@rendering/lighting/types';
import type { LightSourceSubEditorValues } from '../editors/subeditors/LightSourceSubEditor';
import { tilesetAtlasCache } from './tileset-atlas-cache';

interface Props {
  spriteKey: string;
  lightSource?: LightSourceSubEditorValues | null;
}

type DiagnosticViewMode = 'lit' | 'normal' | 'material';

const LOGICAL_SIZE = 96; // 3 x 3 tiles @ 32px
const DISPLAY_SIZE = 192; // 2x crisp pixel preview
const TILE_PX = 32;

function loadImageAsync(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function readAtlasPixels(img: HTMLImageElement): ImageData | null {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

export function InspectorLitTilePreview({ spriteKey, lightSource }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<DiagnosticViewMode>('lit');
  const [autoOrbit, setAutoOrbit] = useState(true);
  const [lightPosLogical, setLightPosLogical] = useState<{ x: number; y: number }>({
    x: LOGICAL_SIZE * 0.5,
    y: LOGICAL_SIZE * 0.5,
  });
  const [dragging, setDragging] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);

  const buffersRef = useRef<{
    diffuse: Uint8ClampedArray;
    normal: Uint8ClampedArray;
    material: Uint8ClampedArray;
  } | null>(null);

  const atlasRawRef = useRef<{
    diffImg: ImageData;
    normImg: ImageData | null;
    matImg: ImageData | null;
  } | null>(null);

  // Load diffuse, _n.png, and _m.png atlases once
  useEffect(() => {
    let active = true;
    (async () => {
      const ok = await tilesetAtlasCache.loadAtlas('default');
      if (!ok || !active) return;

      const [diffImg, normImgEl, matImgEl] = await Promise.all([
        loadImageAsync('/assets/tileset.png'),
        loadImageAsync('/assets/tileset_n.png'),
        loadImageAsync('/assets/tileset_m.png'),
      ]);
      if (!active || !diffImg) return;

      const diffData = readAtlasPixels(diffImg);
      if (!diffData) return;

      atlasRawRef.current = {
        diffImg: diffData,
        normImg: normImgEl ? readAtlasPixels(normImgEl) : null,
        matImg: matImgEl ? readAtlasPixels(matImgEl) : null,
      };
      setMapsReady(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  // Compose 3x3 logical G-buffer (96x96) whenever spriteKey or atlas maps change
  useEffect(() => {
    const raw = atlasRawRef.current;
    if (!raw || !mapsReady) return;

    const totalBytes = LOGICAL_SIZE * LOGICAL_SIZE * 4;
    const diffBuf = new Uint8ClampedArray(totalBytes);
    const normBuf = new Uint8ClampedArray(totalBytes);
    const matBuf = new Uint8ClampedArray(totalBytes);

    // Initialize neutral normal & material buffers
    for (let i = 0; i < totalBytes; i += 4) {
      diffBuf[i] = 10;
      diffBuf[i + 1] = 14;
      diffBuf[i + 2] = 20;
      diffBuf[i + 3] = 255;

      normBuf[i] = 128;
      normBuf[i + 1] = 128;
      normBuf[i + 2] = 255;
      normBuf[i + 3] = 0;

      matBuf[i] = 0;
      matBuf[i + 1] = 180;
      matBuf[i + 2] = 10;
      matBuf[i + 3] = 0;
    }

    const blitFrame = (frameName: string, dstTileX: number, dstTileY: number) => {
      const rect = tilesetAtlasCache.getFrameRect(frameName, 'default');
      if (!rect) return;
      const sx0 = rect.x;
      const sy0 = rect.y;
      const w = Math.min(TILE_PX, rect.w);
      const h = Math.min(TILE_PX, rect.h);
      const dx0 = dstTileX * TILE_PX;
      const dy0 = dstTileY * TILE_PX;

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const si = ((sy0 + py) * raw.diffImg.width + (sx0 + px)) * 4;
          const a = raw.diffImg.data[si + 3];
          if (a < 10) continue;
          const di = ((dy0 + py) * LOGICAL_SIZE + (dx0 + px)) * 4;

          diffBuf[di] = raw.diffImg.data[si];
          diffBuf[di + 1] = raw.diffImg.data[si + 1];
          diffBuf[di + 2] = raw.diffImg.data[si + 2];
          diffBuf[di + 3] = 255;

          if (raw.normImg) {
            normBuf[di] = raw.normImg.data[si];
            normBuf[di + 1] = raw.normImg.data[si + 1];
            normBuf[di + 2] = raw.normImg.data[si + 2];
            normBuf[di + 3] = raw.normImg.data[si + 3];
          }
          if (raw.matImg) {
            matBuf[di] = raw.matImg.data[si];
            matBuf[di + 1] = raw.matImg.data[si + 1];
            matBuf[di + 2] = raw.matImg.data[si + 2];
            matBuf[di + 3] = raw.matImg.data[si + 3];
          }
        }
      }
    };

    // Build 3x3 room diorama: north/west wall borders + floors + center target sprite
    for (let ty = 0; ty < 3; ty++) {
      for (let tx = 0; tx < 3; tx++) {
        blitFrame('floor', tx, ty);
      }
    }
    blitFrame('wall', 0, 0);
    blitFrame('wall', 1, 0);
    blitFrame('wall', 0, 1);

    if (spriteKey && spriteKey !== 'floor') {
      blitFrame(spriteKey, 1, 1);
    }

    buffersRef.current = { diffuse: diffBuf, normal: normBuf, material: matBuf };
  }, [spriteKey, mapsReady]);

  // Animation & per-pixel 2.5D CPU BRDF + Shadow Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapsReady) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
      offscreenCanvasRef.current.width = LOGICAL_SIZE;
      offscreenCanvasRef.current.height = LOGICAL_SIZE;
    }
    const offCtx = offscreenCanvasRef.current.getContext('2d');
    if (!offCtx) return;

    const imgData = offCtx.createImageData(LOGICAL_SIZE, LOGICAL_SIZE);
    let rafId = 0;
    let mounted = true;
    const startMs = performance.now();

    const effectiveLight: LightSourceData = {
      enabled: lightSource?.enabled ?? true,
      color: lightSource?.color ?? '#00f0ff',
      intensity: lightSource?.intensity ?? 1.45,
      radius: Math.min(180, lightSource?.radius ?? 140),
      height: lightSource?.height ?? 22,
      falloff: lightSource?.falloff ?? 1.35,
      castsShadows: lightSource?.castsShadows ?? true,
      offsetX: lightSource?.offsetX ?? 0,
      offsetY: lightSource?.offsetY ?? 0,
      animation: {
        type: (lightSource?.animation?.type as LightAnimationType | undefined) ?? 'STATIC',
        speed: lightSource?.animation?.speed ?? 2.0,
        amplitude: lightSource?.animation?.amplitude ?? 0.2,
        ...(lightSource?.animation?.secondaryColor
          ? { secondaryColor: lightSource.animation.secondaryColor }
          : {}),
      },
    };

    const renderFrame = (nowMs: number) => {
      if (!mounted) return;
      const bufs = buffersRef.current;
      if (!bufs) {
        rafId = requestAnimationFrame(renderFrame);
        return;
      }

      const timeSec = (nowMs - startMs) * 0.001;
      const lx = autoOrbit
        ? LOGICAL_SIZE * 0.5 + Math.cos(timeSec * 1.15) * 26
        : lightPosLogical.x;
      const ly = autoOrbit
        ? LOGICAL_SIZE * 0.5 + Math.sin(timeSec * 1.15) * 22
        : lightPosLogical.y;

      const animEval = evaluateLightAnimation(effectiveLight, timeSec, 0);
      const lIntensity = effectiveLight.enabled ? effectiveLight.intensity * animEval.intensityMultiplier : 0;
      const [lr, lg, lb] = parseHexColorNormalized(effectiveLight.color);
      const cr = animEval.colorRgb[0] ?? lr;
      const cg = animEval.colorRgb[1] ?? lg;
      const cb = animEval.colorRgb[2] ?? lb;
      const radiusPx = Math.max(24, effectiveLight.radius * 0.55);
      const lz = Math.max(6, effectiveLight.height);
      const falloff = Math.max(0.5, effectiveLight.falloff);

      const { diffuse, normal, material } = bufs;
      const out = imgData.data;

      for (let py = 0; py < LOGICAL_SIZE; py++) {
        for (let px = 0; px < LOGICAL_SIZE; px++) {
          const i = (py * LOGICAL_SIZE + px) * 4;

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

          // Lit BRDF composite
          const ar = diffuse[i] / 255;
          const ag = diffuse[i + 1] / 255;
          const ab = diffuse[i + 2] / 255;

          const nx = (normal[i] / 255) * 2 - 1;
          const ny = -((normal[i + 1] / 255) * 2 - 1);
          const nz = Math.max(0.05, normal[i + 2] / 255);
          const spec = normal[i + 3] / 255;

          const emissive = material[i] / 255;
          const pz = (material[i + 2] / 255) * 48;

          const dx = lx - px;
          const dy = ly - py;
          const dz = lz - pz;
          const dist2d = Math.hypot(dx, dy);

          let litR = ar * 0.14;
          let litG = ag * 0.17;
          let litB = ab * 0.22;

          if (dist2d < radiusPx) {
            const dist3d = Math.max(1, Math.hypot(dist2d, dz));
            const ndotl = Math.max(0, (nx * dx + ny * dy + nz * dz) / dist3d);
            const normD = Math.min(1, dist2d / radiusPx);
            const atten = Math.pow(1 - normD * normD, falloff) * lIntensity;

            // 8-step 2.5D shadow raymarch
            let shadow = 1.0;
            if (effectiveLight.castsShadows && dist2d > 3) {
              for (let s = 1; s <= 7; s++) {
                const t = s / 8;
                const sx = Math.round(px + dx * t);
                const sy = Math.round(py + dy * t);
                if (sx < 0 || sx >= LOGICAL_SIZE || sy < 0 || sy >= LOGICAL_SIZE) break;
                const si = (sy * LOGICAL_SIZE + sx) * 4;
                const occZ = (material[si + 2] / 255) * 48;
                const occOp = material[si + 3] / 255;
                const rayZ = pz + dz * t;
                if (occOp > 0.15 && occZ > rayZ + 1.5) {
                  shadow *= 1 - occOp * 0.85;
                  if (shadow < 0.08) {
                    shadow = 0.08;
                    break;
                  }
                }
              }
            }

            // Blinn-Phong specular glint
            const hx = dx / dist3d;
            const hy = dy / dist3d;
            const hz = dz / dist3d + 1.0;
            const hLen = Math.max(0.001, Math.hypot(hx, hy, hz));
            const ndoth = Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen);
            const specPower = Math.pow(ndoth, 24) * spec * 0.75;

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

      offCtx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
      ctx.drawImage(offscreenCanvasRef.current!, 0, 0, DISPLAY_SIZE, DISPLAY_SIZE);

      // Draw crisp crosshair indicator at active light cursor
      if (viewMode === 'lit') {
        const cx = Math.round(lx * 2);
        const cy = Math.round(ly * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
    };
  }, [mapsReady, viewMode, autoOrbit, lightPosLogical, lightSource]);

  const updatePointerLight = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lx = Math.max(4, Math.min(LOGICAL_SIZE - 4, ((clientX - rect.left) / rect.width) * LOGICAL_SIZE));
    const ly = Math.max(4, Math.min(LOGICAL_SIZE - 4, ((clientY - rect.top) / rect.height) * LOGICAL_SIZE));
    setAutoOrbit(false);
    setLightPosLogical({ x: lx, y: ly });
  };

  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--c-surface-elevated, #111722)',
        borderBottom: '1px solid var(--c-border, #1c2638)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--c-accent, #d8ff00)',
            letterSpacing: '0.08em',
            fontWeight: 700,
          }}
        >
          3×3 NORMAL / SHADOW PREVIEW
        </span>
        <button
          type="button"
          onClick={() => setAutoOrbit((v) => !v)}
          style={{
            fontSize: '9px',
            fontFamily: 'var(--font-mono, monospace)',
            padding: '1px 5px',
            borderRadius: '2px',
            border: '1px solid var(--c-border, #1c2638)',
            background: autoOrbit ? 'rgba(0, 240, 255, 0.14)' : 'transparent',
            color: autoOrbit ? 'var(--c-accent-secondary, #00f0ff)' : 'var(--c-text-dim, #79889e)',
            cursor: 'pointer',
          }}
        >
          {autoOrbit ? 'ORBIT: AUTO' : 'ORBIT: DRAG'}
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={DISPLAY_SIZE}
        height={DISPLAY_SIZE}
        onPointerDown={(e) => {
          setDragging(true);
          updatePointerLight(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging) updatePointerLight(e.clientX, e.clientY);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
        style={{
          width: '192px',
          height: '192px',
          alignSelf: 'center',
          imageRendering: 'pixelated',
          border: '1px solid var(--c-border, #1c2638)',
          borderRadius: '2px',
          cursor: 'crosshair',
          background: '#040609',
        }}
        title="Click & drag to orbit point light across 3x3 normal + height tiles"
      />

      <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
        {(['lit', 'normal', 'material'] as DiagnosticViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            style={{
              fontSize: '9px',
              fontFamily: 'var(--font-mono, monospace)',
              padding: '2px 6px',
              borderRadius: '2px',
              border: '1px solid',
              cursor: 'pointer',
              background: viewMode === mode ? 'var(--c-accent-secondary, #00f0ff)' : 'transparent',
              color: viewMode === mode ? '#040609' : 'var(--c-text-dim, #79889e)',
              borderColor: viewMode === mode ? 'var(--c-accent-secondary, #00f0ff)' : 'var(--c-border, #1c2638)',
              fontWeight: viewMode === mode ? 700 : 400,
              textTransform: 'uppercase',
            }}
          >
            {mode === 'lit' ? 'LIT 2.5D' : mode === 'normal' ? 'NORM (_n)' : 'MAT (_m)'}
          </button>
        ))}
      </div>
    </div>
  );
}
