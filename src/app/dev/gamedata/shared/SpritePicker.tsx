'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { tilesetAtlasCache } from './tileset-atlas-cache';
import styles from '../editors/editors.module.css';

interface Props {
  value: string;
  onChange: (spriteKey: string) => void;
  disabled?: boolean;
}

export function SpritePicker({ value, onChange, disabled }: Props) {
  const [frameKeys, setFrameKeys] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    tilesetAtlasCache.loadAtlas('default').then((success) => {
      if (success) {
        setFrameKeys(tilesetAtlasCache.getFrameKeys('default').sort());
      }
    });
  }, []);

  // Redraw preview canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const drawn = tilesetAtlasCache.drawAtlasFrame(ctx, value, 0, 0, 64);
      if (!drawn) {
        // Fallback placeholder
        ctx.fillStyle = '#1c2638';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#79889e';
        ctx.font = '10px monospace';
        ctx.fillText('NO SPRITE', 4, 34);
      }
    }
  }, [value, frameKeys]);

  const filtered = useMemo(() => {
    if (!search.trim()) return frameKeys;
    const lower = search.toLowerCase();
    return frameKeys.filter((k) => k.toLowerCase().includes(lower));
  }, [frameKeys, search]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <canvas
        ref={canvasRef}
        width={64}
        height={64}
        style={{
          width: '48px',
          height: '48px',
          imageRendering: 'pixelated',
          background: 'var(--c-surface, #0a0e15)',
          border: '1px solid var(--c-border, #1c2638)',
          borderRadius: '2px',
          flexShrink: 0,
        }}
        title={`Sprite preview: ${value || 'none'}`}
      />

      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            className={styles.fieldInput}
            value={value || ''}
            placeholder="Select or enter sprite key"
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
            style={{ padding: '4px 8px' }}
          >
            {isOpen ? '▲' : '▼ PICK'}
          </button>
        </div>

        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 100,
              background: 'var(--c-surface, #0a0e15)',
              border: '1px solid var(--c-border-bright, #36445d)',
              borderRadius: '2px',
              padding: '8px',
              marginTop: '4px',
              maxHeight: '220px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.6)',
            }}
          >
            <input
              className={styles.fieldInput}
              placeholder="Search sprite frames..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginBottom: '6px' }}
              autoFocus
            />
            <div style={{ overflowY: 'auto', flex: 1, maxHeight: '160px' }}>
              {filtered.map((key) => (
                <div
                  key={key}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono, monospace)',
                    cursor: 'pointer',
                    color: key === value ? 'var(--c-accent-secondary, #00f0ff)' : 'var(--c-text, #ffffff)',
                    background: key === value ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 240, 255, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      key === value ? 'rgba(0, 240, 255, 0.1)' : 'transparent';
                  }}
                  onClick={() => {
                    onChange(key);
                    setIsOpen(false);
                  }}
                >
                  {key}
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: '8px', fontSize: '11px', opacity: 0.5, textAlign: 'center' }}>
                  No matching frames found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
