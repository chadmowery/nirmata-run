'use client';
import { useState, useRef, useMemo, useEffect } from 'react';
import { tilesetAtlasCache } from './tileset-atlas-cache';
import { AnimationStateKey } from '@shared/tileset-types';
import styles from './telemetry.module.css';

interface Props {
  selectedItem: { section: string; name: string } | null;
  effectiveData: unknown;
  validationStatus?: {
    zodValid: boolean;
    ecsResult?: {
      valid: boolean;
      errors: { id: string; message: string }[];
      warnings: { id: string; message: string }[];
    };
    prefabResult?: {
      valid: boolean;
      errors: { id: string; message: string }[];
      warnings: { id: string; message: string }[];
    };
  };
}

function InspectorSpritePreview({ spriteKey }: { spriteKey: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [atlasLoaded, setAtlasLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    tilesetAtlasCache.loadAtlas('default').then((success) => {
      if (active && success) {
        setAtlasLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const isAnim = useMemo(() => tilesetAtlasCache.isKeyAnimated(spriteKey), [spriteKey, atlasLoaded]);
  const states = useMemo(() => tilesetAtlasCache.getAnimationStates(spriteKey), [spriteKey, atlasLoaded]);
  const [activeState, setActiveState] = useState<AnimationStateKey>('idle');

  useEffect(() => {
    if (states.length > 0 && !states.includes(activeState)) {
      setActiveState(states[0] ?? 'idle');
    }
  }, [states, activeState]);

  useEffect(() => {
    let animId: number;
    let active = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!isAnim || states.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const drawn = tilesetAtlasCache.drawAtlasFrame(ctx, spriteKey, 0, 0, 48);
      if (!drawn) {
        ctx.fillStyle = '#1c2638';
        ctx.fillRect(0, 0, 48, 48);
      }
      return;
    }

    const start = performance.now();

    const loop = (now: number) => {
      if (!active) return;
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const resolved = tilesetAtlasCache.resolveAnimatedFrameAtTime(
        spriteKey,
        activeState,
        elapsed,
        'default',
        true,
      );
      const drawn = tilesetAtlasCache.drawAtlasFrame(ctx, resolved.frameKey, 0, 0, 48);
      if (!drawn) {
        ctx.fillStyle = '#1c2638';
        ctx.fillRect(0, 0, 48, 48);
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      active = false;
      cancelAnimationFrame(animId);
    };
  }, [spriteKey, activeState, isAnim, states.length, atlasLoaded]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        background: 'var(--c-surface-elevated, #111722)',
        borderBottom: '1px solid var(--c-border, #1c2638)',
      }}
    >
      <canvas
        ref={canvasRef}
        width={48}
        height={48}
        style={{
          width: '40px',
          height: '40px',
          imageRendering: 'pixelated',
          background: '#040609',
          border: isAnim
            ? '1px solid var(--c-accent-secondary, #00f0ff)'
            : '1px solid var(--c-border, #1c2638)',
          borderRadius: '2px',
          flexShrink: 0,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--c-text-ivory, #f4f4f0)',
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {spriteKey}
          </span>
          <span
            style={{
              fontSize: '9px',
              color: isAnim ? 'var(--c-accent-secondary, #00f0ff)' : 'var(--c-text-dim, #79889e)',
              background: isAnim ? 'rgba(0, 240, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              padding: '1px 4px',
              borderRadius: '2px',
            }}
          >
            {isAnim ? 'ANIMATED' : 'STATIC'}
          </span>
        </div>
        {states.length > 1 && (
          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
            {states.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setActiveState(st)}
                style={{
                  fontSize: '8px',
                  fontFamily: 'var(--font-mono, monospace)',
                  padding: '1px 4px',
                  borderRadius: '2px',
                  border: '1px solid',
                  cursor: 'pointer',
                  background: activeState === st ? 'var(--c-accent-secondary, #00f0ff)' : 'transparent',
                  color: activeState === st ? '#040609' : 'var(--c-text-dim, #79889e)',
                  borderColor: activeState === st ? 'var(--c-accent-secondary, #00f0ff)' : 'var(--c-border, #1c2638)',
                  fontWeight: activeState === st ? 700 : 400,
                  textTransform: 'uppercase',
                }}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ResolvedPreviewPanel({
  selectedItem,
  effectiveData,
  validationStatus,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const formattedJson = effectiveData ? JSON.stringify(effectiveData, null, 2) : '{}';

  const effObj = effectiveData && typeof effectiveData === 'object' ? (effectiveData as Record<string, unknown>) : null;
  const effComps = effObj?.effectiveComponents as Record<string, unknown> | undefined;
  const ownComps = effObj?.components as Record<string, unknown> | undefined;
  const overrides = effObj?.overrides as Record<string, unknown> | undefined;

  const spriteKey =
    ((effComps?.sprite as { key?: string })?.key) ||
    ((ownComps?.sprite as { key?: string })?.key) ||
    ((overrides?.sprite as { key?: string })?.key) ||
    (typeof effObj?.sprite === 'string' ? effObj.sprite : null);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (collapsed) {
    return (
      <div
        style={{
          width: '32px',
          height: '100%',
          background: 'var(--c-surface, #0a0e15)',
          borderLeft: '1px solid var(--c-border, #1c2638)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '12px',
          gap: '8px',
        }}
        onClick={() => setCollapsed(false)}
        title="Open Inspector Panel"
      >
        <span
          style={{
            writingMode: 'vertical-rl',
            fontFamily: 'var(--font-display, sans-serif)',
            fontSize: '11px',
            color: 'var(--c-accent-secondary, #00f0ff)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          TELEMETRY // INSPECTOR
        </span>
      </div>
    );
  }

  const ecs = validationStatus?.ecsResult;
  const prf = validationStatus?.prefabResult;

  return (
    <aside className={styles.telemetryPanel}>
      <div className={styles.panelHeader}>
        <span>TELEMETRY & INSPECTOR</span>
        <button
          className={styles.copyButton}
          onClick={() => setCollapsed(true)}
          title="Collapse Panel"
        >
          ▶
        </button>
      </div>

      {/* Live Visual Sprite & Animation Preview Badge */}
      {spriteKey && (
        <InspectorSpritePreview spriteKey={spriteKey} />
      )}

      {/* Validation Status Card */}
      <div className={styles.sectionCard}>
        <div className={styles.cardTitle}>
          <span>VALIDATION STATUS</span>
          {validationStatus ? (
            validationStatus.zodValid && (ecs?.valid ?? true) && (prf?.valid ?? true) ? (
              <span className={styles.badgeSuccess}>✓ PASS</span>
            ) : (
              <span className={styles.badgeDanger}>✕ ISSUES</span>
            )
          ) : (
            <span style={{ opacity: 0.5 }}>READY</span>
          )}
        </div>

        {ecs && (
          <div style={{ marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ opacity: 0.8 }}>ECS Consistency Rules:</span>
              <span className={ecs.valid ? styles.badgeSuccess : styles.badgeDanger}>
                {ecs.valid ? 'PASS' : `${ecs.errors.length} ERRORS`}
              </span>
            </div>
            {ecs.errors.map((e) => (
              <div key={e.id} style={{ color: 'var(--c-danger, #ff2a4b)', fontSize: '10px', marginTop: '2px' }}>
                • {e.message}
              </div>
            ))}
            {ecs.warnings.map((w) => (
              <div key={w.id} style={{ color: 'var(--c-warning, #ff6600)', fontSize: '10px', marginTop: '2px' }}>
                • {w.message}
              </div>
            ))}
          </div>
        )}

        {prf && (
          <div style={{ marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ opacity: 0.8 }}>Structural Invariants:</span>
              <span className={prf.valid ? styles.badgeSuccess : styles.badgeDanger}>
                {prf.valid ? 'PASS' : `${prf.errors.length} ERRORS`}
              </span>
            </div>
            {prf.errors.map((e) => (
              <div key={e.id} style={{ color: 'var(--c-danger, #ff2a4b)', fontSize: '10px', marginTop: '2px' }}>
                • [{e.id}] {e.message}
              </div>
            ))}
            {prf.warnings.map((w) => (
              <div key={w.id} style={{ color: 'var(--c-warning, #ff6600)', fontSize: '10px', marginTop: '2px' }}>
                • [{w.id}] {w.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Effective JSON Header */}
      <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--c-surface-header, #0c121c)' }}>
        <span style={{ fontSize: '10px', letterSpacing: '0.08em', color: 'var(--c-text-dim, #79889e)', textTransform: 'uppercase' }}>
          EFFECTIVE JSON ({selectedItem?.name || 'none'})
        </span>
        <button className={styles.copyButton} onClick={handleCopy}>
          {copied ? 'COPIED!' : 'COPY JSON'}
        </button>
      </div>

      {/* Formatted JSON Inspector */}
      <pre className={styles.jsonViewer}>
        <code>{formattedJson}</code>
      </pre>
    </aside>
  );
}
