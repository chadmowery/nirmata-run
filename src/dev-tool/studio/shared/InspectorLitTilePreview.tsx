'use client';
import { useEffect, useRef, useState } from 'react';
import type { LightAnimationType, LightSourceData } from '@shared/components/light-source';
import type { LightSourceSubEditorValues } from '../editors/subeditors/LightSourceSubEditor';
import { tilesetAtlasCache } from './tileset-atlas-cache';
import { decodePngUnpremultiplied, type RawRgbaImage } from './png-decode';
import {
  PREVIEW_DISPLAY_SIZE,
  PREVIEW_LOGICAL_SIZE,
  PREVIEW_TILE_PX,
  renderLitPreviewFrame,
} from './lit-preview-math';

interface Props {
  spriteKey: string;
  lightSource?: LightSourceSubEditorValues | null;
}

type DiagnosticViewMode = 'lit' | 'normal' | 'material';

const LOGICAL_SIZE = PREVIEW_LOGICAL_SIZE;
const DISPLAY_SIZE = PREVIEW_DISPLAY_SIZE;
const TILE_PX = PREVIEW_TILE_PX;

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

function readCanvasPixelsFallback(img: HTMLImageElement): RawRgbaImage | null {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, img.width, img.height);
  return { width: imgData.width, height: imgData.height, data: imgData.data };
}

async function loadRawAtlasUnpremultiplied(src: string): Promise<RawRgbaImage | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return await decodePngUnpremultiplied(buf);
  } catch {
    // Fallback only if DecompressionStream/fetch fails (e.g. non-standard PNG)
    const img = await loadImageAsync(src);
    return img ? readCanvasPixelsFallback(img) : null;
  }
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
    diffImg: RawRgbaImage;
    normImg: RawRgbaImage | null;
    matImg: RawRgbaImage | null;
  } | null>(null);

  // Load diffuse, _n.png, and _m.png atlases once without 2D-canvas alpha premultiplication
  useEffect(() => {
    let active = true;
    (async () => {
      const ok = await tilesetAtlasCache.loadAtlas('default');
      if (!ok || !active) return;

      const [diffData, normData, matData] = await Promise.all([
        loadRawAtlasUnpremultiplied('/assets/tileset.png'),
        loadRawAtlasUnpremultiplied('/assets/tileset_n.png'),
        loadRawAtlasUnpremultiplied('/assets/tileset_m.png'),
      ]);
      if (!active || !diffData) return;

      atlasRawRef.current = {
        diffImg: diffData,
        normImg: normData,
        matImg: matData,
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

    // Initialize neutral normal & material buffers (R=emissive, G=shadowOp, B=roughness, A=heightZ)
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
      matBuf[i + 1] = 0;
      matBuf[i + 2] = 220;
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
      const baseLx = autoOrbit
        ? LOGICAL_SIZE * 0.5 + Math.cos(timeSec * 1.15) * 26
        : lightPosLogical.x;
      const baseLy = autoOrbit
        ? LOGICAL_SIZE * 0.5 + Math.sin(timeSec * 1.15) * 22
        : lightPosLogical.y;

      const { lx, ly } = renderLitPreviewFrame(bufs, imgData.data, {
        viewMode,
        baseLx,
        baseLy,
        effectiveLight,
        timeSec,
      });

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
