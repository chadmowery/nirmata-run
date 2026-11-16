'use client';
import { useEffect, useRef } from 'react';
import type { LightAnimationType, LightSourceData } from '@shared/components/light-source';
import { evaluateLightAnimation } from '@rendering/lighting/types';
import styles from '../editors.module.css';

export interface LightSourceSubEditorValues {
  enabled?: boolean;
  color?: string;
  intensity?: number;
  radius?: number;
  height?: number;
  falloff?: number;
  castsShadows?: boolean;
  offsetX?: number;
  offsetY?: number;
  animation?: {
    type?: LightAnimationType | string;
    speed?: number;
    amplitude?: number;
    secondaryColor?: string;
  };
}

export interface LightSourceSubEditorProps {
  values: LightSourceSubEditorValues;
  onFieldChange: (field: keyof LightSourceData, val: unknown) => void;
}

const ANIMATION_TYPES: LightAnimationType[] = [
  'STATIC',
  'PULSE',
  'FLICKER',
  'STROBE',
  'RADAR_SWEEP',
];

const QUICK_PALETTE = [
  '#00f0ff',
  '#ffb000',
  '#ff2a4b',
  '#38bdf8',
  '#10b981',
  '#a855f7',
  '#ffffff',
];

function sanitizeHexColor(raw: unknown, fallback: string = '#00f0ff'): string {
  if (typeof raw === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toLowerCase();
  }
  return fallback;
}

export function LightSourceSubEditor({ values, onFieldChange }: LightSourceSubEditorProps) {
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const enabled = values.enabled ?? true;
  const color = typeof values.color === 'string' ? values.color : '#00f0ff';
  const swatchColor = sanitizeHexColor(color, '#00f0ff');
  const intensity = typeof values.intensity === 'number' ? values.intensity : 1.2;
  const radius = typeof values.radius === 'number' ? values.radius : 128;
  const height = typeof values.height === 'number' ? values.height : 18;
  const falloff = typeof values.falloff === 'number' ? values.falloff : 1.8;
  const castsShadows = values.castsShadows ?? true;
  const offsetX = typeof values.offsetX === 'number' ? values.offsetX : 0;
  const offsetY = typeof values.offsetY === 'number' ? values.offsetY : 0;

  const anim = values.animation ?? {
    type: 'STATIC' as LightAnimationType,
    speed: 2.0,
    amplitude: 0.2,
  };
  const animType = (ANIMATION_TYPES.includes(anim.type as LightAnimationType)
    ? anim.type
    : 'STATIC') as LightAnimationType;
  const animSpeed = typeof anim.speed === 'number' ? anim.speed : 2.0;
  const animAmplitude = typeof anim.amplitude === 'number' ? anim.amplitude : 0.2;
  const secondaryColor = anim.secondaryColor;

  const updateAnimation = (patch: Partial<NonNullable<LightSourceData['animation']>>) => {
    onFieldChange('animation', {
      type: animType,
      speed: animSpeed,
      amplitude: animAmplitude,
      ...(secondaryColor ? { secondaryColor } : {}),
      ...patch,
    });
  };

  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#040609';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(28, 38, 56, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    const lightSample: LightSourceData = {
      enabled,
      color,
      intensity,
      radius,
      height,
      falloff,
      castsShadows,
      offsetX,
      offsetY,
      animation: {
        type: animType,
        speed: animSpeed,
        amplitude: animAmplitude,
        ...(secondaryColor ? { secondaryColor } : {}),
      },
    };

    ctx.strokeStyle = swatchColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const durationSec = 2.0;
    for (let x = 0; x < w; x++) {
      const tSec = (x / Math.max(1, w - 1)) * durationSec;
      const ev = evaluateLightAnimation(lightSample, tSec, 0);
      const norm = Math.max(0, Math.min(1.5, ev.intensityMultiplier)) / 1.5;
      const y = h - 3 - norm * (h - 6);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [enabled, color, swatchColor, intensity, radius, height, falloff, castsShadows, offsetX, offsetY, animType, animSpeed, animAmplitude, secondaryColor]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
      {/* Enabled Toggle */}
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Enabled</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onFieldChange('enabled', e.target.checked)}
          />
          <span>Emit Light In World</span>
        </label>
      </div>

      {/* Color & Quick Palette */}
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Color</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, flexWrap: 'wrap' }}>
          <input
            type="color"
            aria-label="Light Color Swatch"
            value={swatchColor}
            onChange={(e) => onFieldChange('color', e.target.value)}
            style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer' }}
          />
          <input
            type="text"
            className={styles.fieldInput}
            style={{ width: '88px', fontFamily: 'var(--font-mono, monospace)' }}
            value={color}
            onChange={(e) => onFieldChange('color', e.target.value)}
            placeholder="#00f0ff"
          />
          <div style={{ display: 'flex', gap: '4px' }}>
            {QUICK_PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                title={`Preset ${hex}`}
                onClick={() => onFieldChange('color', hex)}
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '2px',
                  background: hex,
                  border: color.toLowerCase() === hex ? '1.5px solid #fff' : '1px solid #1c2638',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Intensity */}
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Intensity</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <input
            type="range"
            min={0.1}
            max={4.0}
            step={0.05}
            value={intensity}
            onChange={(e) => onFieldChange('intensity', Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '64px' }}
            min={0}
            max={10}
            step={0.05}
            value={intensity}
            onChange={(e) => onFieldChange('intensity', Number(e.target.value))}
          />
        </div>
      </div>

      {/* Radius (px + tiles readout) */}
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Radius</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <input
            type="range"
            min={8}
            max={512}
            step={4}
            value={radius}
            onChange={(e) => onFieldChange('radius', Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '64px' }}
            min={8}
            max={512}
            step={4}
            value={radius}
            onChange={(e) => onFieldChange('radius', Number(e.target.value))}
          />
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--c-accent-secondary, #00f0ff)',
              minWidth: '58px',
              textAlign: 'right',
            }}
          >
            {(radius / 32).toFixed(1)} tiles
          </span>
        </div>
      </div>

      {/* Height Z & Falloff */}
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Height Z / Falloff</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>Z(px):</span>
          <input
            type="range"
            min={1}
            max={64}
            step={1}
            value={height}
            onChange={(e) => onFieldChange('height', Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '54px' }}
            min={1}
            max={64}
            value={height}
            onChange={(e) => onFieldChange('height', Number(e.target.value))}
          />
          <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>Falloff:</span>
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '54px' }}
            min={0.5}
            max={4}
            step={0.1}
            value={falloff}
            onChange={(e) => onFieldChange('falloff', Number(e.target.value))}
          />
        </div>
      </div>

      {/* Sub-tile Offset X / Offset Y */}
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Offset X / Y (px)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>X:</span>
          <input
            type="range"
            min={-32}
            max={32}
            step={1}
            value={offsetX}
            onChange={(e) => onFieldChange('offsetX', Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            aria-label="Light Offset X"
            className={styles.fieldInput}
            style={{ width: '54px' }}
            min={-32}
            max={32}
            step={1}
            value={offsetX}
            onChange={(e) => onFieldChange('offsetX', Number(e.target.value))}
          />
          <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>Y:</span>
          <input
            type="range"
            min={-32}
            max={32}
            step={1}
            value={offsetY}
            onChange={(e) => onFieldChange('offsetY', Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            aria-label="Light Offset Y"
            className={styles.fieldInput}
            style={{ width: '54px' }}
            min={-32}
            max={32}
            step={1}
            value={offsetY}
            onChange={(e) => onFieldChange('offsetY', Number(e.target.value))}
          />
        </div>
      </div>

      {/* Cast Shadows Toggle */}
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Casts Shadows</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={castsShadows}
            onChange={(e) => onFieldChange('castsShadows', e.target.checked)}
          />
          <span>2.5D Raymarched Shadow Casting</span>
        </label>
      </div>

      {/* Animation Curve Controls & Mini Waveform */}
      <div
        style={{
          padding: '8px',
          background: 'rgba(4, 6, 9, 0.45)',
          border: '1px solid var(--c-border, #1c2638)',
          borderRadius: '2px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--c-text-dim, #79889e)', textTransform: 'uppercase' }}>
            Animation Curve
          </span>
          <canvas
            ref={waveCanvasRef}
            width={180}
            height={26}
            style={{ border: '1px solid #1c2638', borderRadius: '2px' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '6px', alignItems: 'center' }}>
          <select
            className={styles.fieldSelect}
            value={animType}
            onChange={(e) => updateAnimation({ type: e.target.value as LightAnimationType })}
          >
            {ANIMATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
            <span>Spd</span>
            <input
              type="number"
              className={styles.fieldInput}
              step={0.1}
              min={0.05}
              max={20}
              value={animSpeed}
              onChange={(e) => updateAnimation({ speed: Number(e.target.value) })}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
            <span>Amp</span>
            <input
              type="number"
              className={styles.fieldInput}
              step={0.05}
              min={0}
              max={1}
              value={animAmplitude}
              onChange={(e) => updateAnimation({ amplitude: Number(e.target.value) })}
            />
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)', minWidth: '96px' }}>
            Secondary Color
          </span>
          <input
            type="color"
            value={sanitizeHexColor(secondaryColor, swatchColor)}
            onChange={(e) => updateAnimation({ secondaryColor: e.target.value })}
            style={{ width: '24px', height: '20px', border: 'none', background: 'transparent', cursor: 'pointer' }}
          />
          <input
            type="text"
            className={styles.fieldInput}
            style={{ width: '88px', fontFamily: 'var(--font-mono, monospace)' }}
            value={secondaryColor ?? ''}
            placeholder="optional #hex"
            onChange={(e) =>
              updateAnimation({
                secondaryColor: e.target.value.trim() ? e.target.value.trim() : undefined,
              })
            }
          />
          {secondaryColor && (
            <button
              type="button"
              className={styles.toolButton}
              style={{ fontSize: '10px' }}
              onClick={() => {
                onFieldChange('animation', {
                  type: animType,
                  speed: animSpeed,
                  amplitude: animAmplitude,
                });
              }}
            >
              CLEAR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
