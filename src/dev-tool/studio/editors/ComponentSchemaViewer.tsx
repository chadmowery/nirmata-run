'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import type { FieldMeta } from '@/app/api/dev/gamedata/schema-introspect';
import { RUNTIME_INTENT_OR_TAG_KEYS } from '@/app/api/dev/gamedata/ecs-rules';
import { AnimationStateKey } from '@shared/tileset-types';
import { tilesetAtlasCache } from '../shared/tileset-atlas-cache';
import styles from './editors.module.css';

interface Props {
  name?: string;
}

interface ComponentSchemaItem {
  key: string;
  fields: FieldMeta[];
}

interface TilesetValidation {
  valid: boolean;
  themeId: string;
  errors: string[];
  warnings: string[];
  totalFrames: number;
  missingDirectionalFrames: string[];
  presentDirectionalFrames: string[];
  totalAnimations?: number;
  animatedKeys?: string[];
}

const THEMES = ['default', 'traxus', 'cyberacme', 'sekiguchi', 'nucaloric'] as const;

function FrameCanvasPreview({ frameKey, themeId }: { frameKey: string; themeId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const drawn = tilesetAtlasCache.drawAtlasFrame(ctx, frameKey, 0, 0, 32, 0, themeId);
    if (!drawn) {
      ctx.fillStyle = '#1c2638';
      ctx.fillRect(0, 0, 32, 32);
    }
  }, [frameKey, themeId]);

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={32}
      style={{
        width: '32px',
        height: '32px',
        imageRendering: 'pixelated',
        background: '#040609',
        border: '1px solid var(--c-border, #1c2638)',
        borderRadius: '2px',
      }}
      title={frameKey}
    />
  );
}

function AnimatedSpriteCard({
  entityKey,
  themeId,
}: {
  entityKey: string;
  themeId: string;
}) {
  const states = useMemo(
    () => tilesetAtlasCache.getAnimationStates(entityKey, themeId),
    [entityKey, themeId],
  );
  const [activeState, setActiveState] = useState<AnimationStateKey>('idle');

  useEffect(() => {
    if (states.length > 0 && !states.includes(activeState)) {
      setActiveState(states[0]);
    }
  }, [states, activeState]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const clip = useMemo(
    () => tilesetAtlasCache.getAnimationClip(entityKey, activeState, themeId),
    [entityKey, activeState, themeId],
  );

  useEffect(() => {
    let animId: number;
    const start = performance.now();

    const loop = (now: number) => {
      const elapsed = now - start;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const resolved = tilesetAtlasCache.resolveAnimatedFrameAtTime(
            entityKey,
            activeState,
            elapsed,
            themeId,
          );
          const drawn = tilesetAtlasCache.drawAtlasFrame(
            ctx,
            resolved.frameKey,
            0,
            0,
            32,
            0,
            themeId,
          );
          if (!drawn) {
            ctx.fillStyle = '#1c2638';
            ctx.fillRect(0, 0, 32, 32);
          }
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [entityKey, activeState, themeId]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '10px',
        background: 'var(--c-surface, #0a0e15)',
        border: '1px solid var(--c-border, #1c2638)',
        borderRadius: '2px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono, monospace)',
            fontWeight: 700,
            color: 'var(--c-accent-secondary, #00f0ff)',
          }}
        >
          {entityKey}
        </span>
        <span
          style={{
            fontSize: '9px',
            color: 'var(--c-accent, #d8ff00)',
            background: 'rgba(216, 255, 0, 0.1)',
            padding: '1px 5px',
            borderRadius: '2px',
          }}
        >
          {clip ? `${clip.loop.toUpperCase()} • ${clip.fps} FPS` : 'STATIC'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <canvas
          ref={canvasRef}
          width={32}
          height={32}
          style={{
            width: '32px',
            height: '32px',
            imageRendering: 'pixelated',
            background: '#040609',
            border: '1px solid var(--c-border, #1c2638)',
            borderRadius: '2px',
            flexShrink: 0,
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
          {/* State pills */}
          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
            {states.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setActiveState(st)}
                style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono, monospace)',
                  padding: '1px 5px',
                  borderRadius: '2px',
                  border: '1px solid',
                  cursor: 'pointer',
                  background: activeState === st ? 'var(--c-accent-secondary, #00f0ff)' : 'transparent',
                  color: activeState === st ? '#040609' : 'var(--c-text-dim, #79889e)',
                  borderColor: activeState === st ? 'var(--c-accent-secondary, #00f0ff)' : 'var(--c-border, #1c2638)',
                  fontWeight: activeState === st ? 700 : 400,
                }}
              >
                {st.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Frame strip */}
          {clip && (
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--c-text-dim, #79889e)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={clip.frames.join(' → ')}
            >
              {clip.frames.length}f: [{clip.frames.join(', ')}]
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ComponentSchemaViewer({ name }: Props) {
  const [activeTab, setActiveTab] = useState<'schemas' | 'tileset'>('schemas');
  const [components, setComponents] = useState<ComponentSchemaItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'ALL' | 'AUTHORABLE' | 'RUNTIME'>('ALL');

  // Tileset inspector state
  const [selectedTheme, setSelectedTheme] = useState<string>('default');
  const [tilesetData, setTilesetData] = useState<TilesetValidation | null>(null);
  const [animSearch, setAnimSearch] = useState('');

  useEffect(() => {
    fetch('/api/dev/gamedata/components')
      .then((r) => r.json())
      .then((data) => setComponents(data.items || []));
  }, []);

  useEffect(() => {
    tilesetAtlasCache.loadAtlas(selectedTheme);
    fetch(`/api/dev/gamedata/tileset/validate?theme=${selectedTheme}`)
      .then((r) => r.json())
      .then((d) => setTilesetData(d))
      .catch(() => {});
  }, [selectedTheme]);

  const filteredComponents = useMemo(() => {
    let list = components;
    if (name) {
      list = list.filter((c) => c.key === name);
    }

    if (category === 'AUTHORABLE') {
      list = list.filter((c) => !RUNTIME_INTENT_OR_TAG_KEYS.has(c.key));
    } else if (category === 'RUNTIME') {
      list = list.filter((c) => RUNTIME_INTENT_OR_TAG_KEYS.has(c.key));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.key.toLowerCase().includes(q) ||
          c.fields.some((f) => f.key.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [components, name, category, search]);

  const authorableCount = useMemo(
    () => components.filter((c) => !RUNTIME_INTENT_OR_TAG_KEYS.has(c.key)).length,
    [components],
  );
  const runtimeCount = components.length - authorableCount;

  const animatedKeys = useMemo(() => {
    if (tilesetData?.animatedKeys && tilesetData.animatedKeys.length > 0) {
      return tilesetData.animatedKeys;
    }
    return tilesetAtlasCache.getAnimatedSpriteKeys(selectedTheme);
  }, [tilesetData, selectedTheme]);

  const filteredAnimKeys = useMemo(() => {
    if (!animSearch.trim()) return animatedKeys;
    const q = animSearch.toLowerCase();
    return animatedKeys.filter((k) => k.toLowerCase().includes(q));
  }, [animatedKeys, animSearch]);

  return (
    <div className={styles.editor}>
      {/* Top Header with Tab Switcher */}
      <div className={styles.editorHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 className={styles.editorTitle}>
            {activeTab === 'schemas'
              ? name
                ? `Component: ${name}`
                : 'ECS Component Schema Registry'
              : `Themed Tileset Inspector (${selectedTheme.toUpperCase()})`}
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => setActiveTab('schemas')}
            style={{
              background: activeTab === 'schemas' ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
              color: activeTab === 'schemas' ? '#040609' : undefined,
              fontWeight: 700,
            }}
          >
            ECS SCHEMAS ({components.length})
          </button>
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => setActiveTab('tileset')}
            style={{
              background: activeTab === 'tileset' ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
              color: activeTab === 'tileset' ? '#040609' : undefined,
              fontWeight: 700,
            }}
          >
            THEMED TILESET DICTIONARY
          </button>
        </div>
      </div>

      {activeTab === 'schemas' ? (
        <>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
            }}
          >
            <input
              className={styles.fieldInput}
              placeholder="Search components or fields..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '280px' }}
            />

            <div style={{ display: 'flex', gap: '4px' }}>
              {(['ALL', 'AUTHORABLE', 'RUNTIME'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={styles.toolButton}
                  onClick={() => setCategory(cat)}
                  style={{
                    background: category === cat ? 'rgba(0, 240, 255, 0.2)' : undefined,
                    borderColor: category === cat ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
                    fontSize: '11px',
                  }}
                >
                  {cat === 'ALL'
                    ? `ALL (${components.length})`
                    : cat === 'AUTHORABLE'
                      ? `AUTHORABLE (${authorableCount})`
                      : `RUNTIME (${runtimeCount})`}
                </button>
              ))}
            </div>
          </div>

          {/* Component Schemas List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredComponents.map((comp) => {
              const isRuntime = RUNTIME_INTENT_OR_TAG_KEYS.has(comp.key);
              return (
                <div key={comp.key} className={styles.fieldGroup}>
                  <div className={styles.fieldGroupHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={styles.fieldGroupTitle}>{comp.key}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono, monospace)',
                          padding: '1px 6px',
                          borderRadius: '2px',
                          background: isRuntime ? 'rgba(255, 102, 0, 0.15)' : 'rgba(0, 240, 255, 0.15)',
                          color: isRuntime ? 'var(--c-warning, #ff6600)' : 'var(--c-accent-secondary, #00f0ff)',
                          border: `1px solid ${isRuntime ? 'var(--c-warning, #ff6600)' : 'var(--c-accent-secondary, #00f0ff)'}`,
                        }}
                      >
                        {isRuntime ? 'RUNTIME INTENT / TAG' : 'AUTHORABLE'}
                      </span>
                    </div>
                  </div>

                  {comp.fields.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)', padding: '6px 0' }}>
                      Tag component (no data fields).
                    </div>
                  ) : (
                    comp.fields.map((field: FieldMeta) => (
                      <div key={field.key} className={styles.fieldRow}>
                        <span className={styles.fieldLabel}>{field.key}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: '11px',
                              color: 'var(--c-accent, #d8ff00)',
                            }}
                          >
                            {field.type}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              color: field.optional ? 'var(--c-text-dim, #79889e)' : 'var(--c-accent-secondary, #00f0ff)',
                            }}
                          >
                            {field.optional ? '(optional)' : '(required)'}
                          </span>
                          {field.nullable && (
                            <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>
                              [nullable]
                            </span>
                          )}
                          {field.constraints && (
                            <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>
                              {field.constraints.min !== undefined && `min: ${field.constraints.min} `}
                              {field.constraints.max !== undefined && `max: ${field.constraints.max} `}
                              {field.constraints.isInt && 'integer'}
                            </span>
                          )}
                          {field.enumValues && (
                            <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>
                              [{field.enumValues.join(' | ')}]
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Themed Tileset Dictionary Inspector */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Theme Selector Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>THEME:</span>
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                className={styles.toolButton}
                onClick={() => setSelectedTheme(t)}
                style={{
                  background: selectedTheme === t ? 'rgba(0, 240, 255, 0.2)' : undefined,
                  borderColor: selectedTheme === t ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {tilesetData && (
            <div
              style={{
                display: 'flex',
                gap: '16px',
                padding: '10px 14px',
                background: 'var(--c-surface-elevated, #111722)',
                border: '1px solid var(--c-border, #1c2638)',
                borderRadius: '2px',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '2px',
                  fontWeight: 700,
                  fontSize: '11px',
                  background: tilesetData.valid ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 42, 75, 0.15)',
                  color: tilesetData.valid ? 'var(--c-accent-secondary, #00f0ff)' : 'var(--c-danger, #ff2a4b)',
                  border: `1px solid ${tilesetData.valid ? 'var(--c-accent-secondary, #00f0ff)' : 'var(--c-danger, #ff2a4b)'}`,
                }}
              >
                {tilesetData.valid ? '✓ MANIFEST VALID' : '✕ ISSUES DETECTED'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>
                Total Frames: <strong style={{ color: '#fff' }}>{tilesetData.totalFrames}</strong>
              </span>
              <span style={{ fontSize: '11px', color: 'var(--c-accent-secondary, #00f0ff)' }}>
                Present Directional: <strong>{tilesetData.presentDirectionalFrames.length}</strong>
              </span>
              <span style={{ fontSize: '11px', color: 'var(--c-accent, #d8ff00)' }}>
                Animations: <strong>{tilesetData.totalAnimations ?? animatedKeys.length}</strong>
              </span>
              {tilesetData.missingDirectionalFrames.length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--c-warning, #ff6600)' }}>
                  Missing Directional: <strong>{tilesetData.missingDirectionalFrames.length}</strong>
                </span>
              )}
            </div>
          )}

          {/* Animated Sprites & State Matrix */}
          <div className={styles.fieldGroup}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '4px',
              }}
            >
              <h3 className={styles.fieldGroupTitle}>
                Animated Sprites & State Matrix ({filteredAnimKeys.length})
              </h3>
              <input
                className={styles.fieldInput}
                placeholder="Filter animations..."
                value={animSearch}
                onChange={(e) => setAnimSearch(e.target.value)}
                style={{ width: '220px', fontSize: '11px', padding: '3px 8px' }}
              />
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '8px',
                marginTop: '10px',
              }}
            >
              {filteredAnimKeys.map((key) => (
                <AnimatedSpriteCard key={key} entityKey={key} themeId={selectedTheme} />
              ))}
            </div>
          </div>

          {/* Directional Sprite Grid */}
          <div className={styles.fieldGroup}>
            <h3 className={styles.fieldGroupTitle}>Required Directional Frames (32×32)</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '8px',
                marginTop: '10px',
              }}
            >
              {tilesetData?.presentDirectionalFrames.map((frameKey) => (
                <div
                  key={frameKey}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px',
                    background: 'var(--c-surface, #0a0e15)',
                    border: '1px solid var(--c-border, #1c2638)',
                    borderRadius: '2px',
                  }}
                >
                  <FrameCanvasPreview frameKey={frameKey} themeId={selectedTheme} />
                  <span
                    style={{
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono, monospace)',
                      color: 'var(--c-text-dim, #79889e)',
                      textAlign: 'center',
                      wordBreak: 'break-all',
                    }}
                  >
                    {frameKey}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
