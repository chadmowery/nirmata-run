'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { tilesetAtlasCache, ResolvedAnimationClip } from './tileset-atlas-cache';
import { AnimationStateKey } from '@shared/tileset-types';
import styles from '../editors/editors.module.css';

interface Props {
  value: string;
  onChange: (spriteKey: string) => void;
  disabled?: boolean;
}

type DropdownFilter = 'ALL' | 'ANIMATED' | 'STATIC';

export function SpritePicker({ value, onChange, disabled }: Props) {
  const [frameKeys, setFrameKeys] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<DropdownFilter>('ALL');
  const [isOpen, setIsOpen] = useState(false);

  // Animation preview state
  const [currentState, setCurrentState] = useState<AnimationStateKey>('idle');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [manualFrameIndex, setManualFrameIndex] = useState<number | null>(null);
  const [playbackFrameIndex, setPlaybackFrameIndex] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const filmstripCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const animFrameIdRef = useRef<number | null>(null);
  const elapsedOffsetRef = useRef<number>(0);

  // Load atlas on mount
  useEffect(() => {
    const cached = tilesetAtlasCache.getFrameKeys('default');
    if (cached.length > 0) {
      setFrameKeys(cached.sort());
    }
    tilesetAtlasCache.loadAtlas('default').then((success) => {
      if (success) {
        setFrameKeys(tilesetAtlasCache.getFrameKeys('default').sort());
      }
    });
  }, []);

  // Available animation states for current sprite
  const animStates = useMemo(() => {
    if (!value) return [];
    return tilesetAtlasCache.getAnimationStates(value, 'default');
  }, [value, frameKeys]);

  const isAnimated = animStates.length > 0;

  // Active clip
  const activeClip: ResolvedAnimationClip | null = useMemo(() => {
    if (!isAnimated || !value) return null;
    return tilesetAtlasCache.getAnimationClip(value, currentState, 'default') ??
      tilesetAtlasCache.getAnimationClip(value, 'idle', 'default');
  }, [value, currentState, isAnimated, frameKeys]);

  // Reset state when sprite key value changes
  useEffect(() => {
    const states = tilesetAtlasCache.getAnimationStates(value, 'default');
    if (states.length > 0 && !states.includes(currentState)) {
      setCurrentState(states[0] ?? 'idle');
    }
    setManualFrameIndex(null);
    setIsPlaying(true);
    elapsedOffsetRef.current = 0;
  }, [value]);

  // Draw main 64x64 canvas
  const drawFrame = useCallback(
    (frameKey: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const drawn = tilesetAtlasCache.drawAtlasFrame(ctx, frameKey, 0, 0, 64);
      if (!drawn) {
        ctx.fillStyle = '#1c2638';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#79889e';
        ctx.font = '10px monospace';
        ctx.fillText('NO SPRITE', 4, 34);
      }
    },
    [],
  );

  // Animation loop
  useEffect(() => {
    if (!isAnimated || !activeClip) {
      if (value) drawFrame(value);
      return;
    }

    if (!isPlaying) {
      if (manualFrameIndex !== null) {
        const targetKey = activeClip.frames[manualFrameIndex] ?? value;
        drawFrame(targetKey);
      } else {
        const resolved = tilesetAtlasCache.resolveAnimatedFrameAtTime(
          value,
          currentState,
          elapsedOffsetRef.current,
          'default',
        );
        drawFrame(resolved.frameKey);
        setPlaybackFrameIndex(resolved.frameIndex);
      }
      return;
    }

    let lastTime = performance.now();
    let lastFrameIdx = -1;

    const loop = (time: number) => {
      const delta = (time - lastTime) * speedMultiplier;
      lastTime = time;

      elapsedOffsetRef.current += delta;

      const resolved = tilesetAtlasCache.resolveAnimatedFrameAtTime(
        value,
        currentState,
        elapsedOffsetRef.current,
        'default',
      );

      drawFrame(resolved.frameKey);

      if (resolved.frameIndex !== lastFrameIdx) {
        lastFrameIdx = resolved.frameIndex;
        setPlaybackFrameIndex(resolved.frameIndex);
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [value, currentState, isAnimated, activeClip, isPlaying, speedMultiplier, manualFrameIndex, drawFrame]);

  // Draw filmstrip thumbnails
  useEffect(() => {
    if (!activeClip) return;
    activeClip.frames.forEach((fKey, idx) => {
      const c = filmstripCanvasRefs.current.get(idx);
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, 32, 32);
      tilesetAtlasCache.drawAtlasFrame(ctx, fKey, 0, 0, 32);
    });
  }, [activeClip, value]);

  // Dropdown filtering
  const filtered = useMemo(() => {
    let result = frameKeys;

    if (filterMode === 'ANIMATED') {
      result = result.filter((k) => tilesetAtlasCache.isKeyAnimated(k, 'default'));
    } else if (filterMode === 'STATIC') {
      result = result.filter((k) => !tilesetAtlasCache.isKeyAnimated(k, 'default'));
    }

    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter((k) => k.toLowerCase().includes(lower));
    }

    return result;
  }, [frameKeys, filterMode, search]);

  const activeFrameIndex = manualFrameIndex !== null ? manualFrameIndex : playbackFrameIndex;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Top Bar: Live Canvas + Key Input + Pick Button */}
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
            border: isAnimated
              ? '1px solid var(--c-accent-secondary, #00f0ff)'
              : '1px solid var(--c-border, #1c2638)',
            borderRadius: '2px',
            flexShrink: 0,
            boxShadow: isAnimated ? '0 0 6px rgba(0, 240, 255, 0.2)' : undefined,
          }}
          title={`Sprite preview: ${value || 'none'} ${isAnimated ? '(Animated)' : '(Static)'}`}
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
              style={{
                padding: '4px 10px',
                fontWeight: 700,
                color: isAnimated ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
              }}
            >
              {isOpen ? '▲' : isAnimated ? `▼ PICK [ANIM • ${activeClip?.frames.length ?? animStates.length}f]` : '▼ PICK'}
            </button>
          </div>

          {/* Dropdown Menu with Filter Bar & Animation Badges */}
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
                maxHeight: '260px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.6)',
              }}
            >
              <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                {(['ALL', 'ANIMATED', 'STATIC'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={styles.toolButton}
                    onClick={() => setFilterMode(mode)}
                    style={{
                      flex: 1,
                      fontSize: '10px',
                      padding: '2px 4px',
                      background: filterMode === mode ? 'rgba(0, 240, 255, 0.2)' : undefined,
                      borderColor: filterMode === mode ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
                      color: filterMode === mode ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
                      fontWeight: 700,
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <input
                className={styles.fieldInput}
                placeholder="Search sprite frames..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ marginBottom: '6px' }}
                autoFocus
              />

              <div style={{ overflowY: 'auto', flex: 1, maxHeight: '180px' }}>
                {filtered.map((key) => {
                  const keyAnim = tilesetAtlasCache.isKeyAnimated(key, 'default');
                  const states = keyAnim ? tilesetAtlasCache.getAnimationStates(key, 'default') : [];
                  const clip = keyAnim ? tilesetAtlasCache.getAnimationClip(key, 'idle', 'default') : null;
                  const fCount = clip?.frames.length ?? states.length;

                  return (
                    <div
                      key={key}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono, monospace)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
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
                      <span>{key}</span>
                      {keyAnim && (
                        <span
                          style={{
                            fontSize: '9px',
                            padding: '1px 4px',
                            borderRadius: '2px',
                            background: 'rgba(0, 240, 255, 0.15)',
                            color: 'var(--c-accent-secondary, #00f0ff)',
                            border: '1px solid rgba(0, 240, 255, 0.4)',
                            fontWeight: 700,
                          }}
                        >
                          ANIM • {fCount}f
                        </span>
                      )}
                    </div>
                  );
                })}
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

      {/* Interactive Animation Workstation Bar (Only visible when sprite has animations) */}
      {isAnimated && (
        <div
          style={{
            padding: '8px 10px',
            background: 'var(--c-surface-elevated, #111722)',
            border: '1px solid var(--c-border, #1c2638)',
            borderRadius: '2px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Controls row: State pills + Play/Pause + Speed */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
            {/* State Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)', fontWeight: 700 }}>STATE:</span>
              {animStates.map((st) => (
                <button
                  key={st}
                  type="button"
                  className={styles.toolButton}
                  onClick={() => {
                    setCurrentState(st);
                    setManualFrameIndex(null);
                    setIsPlaying(true);
                    elapsedOffsetRef.current = 0;
                  }}
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    textTransform: 'uppercase',
                    fontWeight: currentState === st ? 700 : 500,
                    background: currentState === st ? 'rgba(0, 240, 255, 0.2)' : undefined,
                    borderColor: currentState === st ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
                    color: currentState === st ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
                  }}
                >
                  {st} {currentState === st && '●'}
                </button>
              ))}
            </div>

            {/* Transport & Speed */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className={styles.toolButton}
                onClick={() => {
                  setIsPlaying(!isPlaying);
                  setManualFrameIndex(null);
                }}
                style={{ fontSize: '10px', padding: '2px 8px', fontWeight: 700 }}
              >
                {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
              </button>

              <div style={{ display: 'flex', gap: '2px' }}>
                {[0.5, 1, 2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    className={styles.toolButton}
                    onClick={() => setSpeedMultiplier(spd)}
                    style={{
                      fontSize: '9px',
                      padding: '2px 4px',
                      fontWeight: speedMultiplier === spd ? 700 : 400,
                      color: speedMultiplier === spd ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
                      borderColor: speedMultiplier === spd ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
                    }}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Filmstrip Scrubber & Metadata */}
          {activeClip && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', overflowX: 'auto' }}>
                {activeClip.frames.map((frameKey, idx) => {
                  const isActive = activeFrameIndex === idx;
                  const durMs = activeClip.frameDurationsMs?.[idx] ?? Math.round(1000 / activeClip.fps);

                  return (
                    <div
                      key={`${frameKey}-${idx}`}
                      onClick={() => {
                        setIsPlaying(false);
                        setManualFrameIndex(idx);
                        drawFrame(frameKey);
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        cursor: 'pointer',
                        padding: '2px',
                        borderRadius: '2px',
                        background: isActive ? 'rgba(0, 240, 255, 0.15)' : 'var(--c-surface, #0a0e15)',
                        border: isActive
                          ? '1px solid var(--c-accent-secondary, #00f0ff)'
                          : '1px solid var(--c-border, #1c2638)',
                      }}
                      title={`Frame #${idx}: ${frameKey} (${durMs}ms). Click to scrub.`}
                    >
                      <canvas
                        ref={(el) => {
                          if (el) filmstripCanvasRefs.current.set(idx, el);
                          else filmstripCanvasRefs.current.delete(idx);
                        }}
                        width={32}
                        height={32}
                        style={{ width: '28px', height: '28px', imageRendering: 'pixelated' }}
                      />
                      <span
                        style={{
                          fontSize: '8px',
                          fontFamily: 'var(--font-mono, monospace)',
                          color: isActive ? 'var(--c-accent-secondary, #00f0ff)' : 'var(--c-text-dim, #79889e)',
                          fontWeight: isActive ? 700 : 400,
                        }}
                      >
                        #{idx} {isActive && '●'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '9px', color: 'var(--c-text-dim, #79889e)' }}>
                <span style={{ fontWeight: 700, color: 'var(--c-accent-secondary, #00f0ff)', textTransform: 'uppercase' }}>
                  {activeClip.loop} • {activeClip.frameDurationsMs ? `Custom [${activeClip.frameDurationsMs.join(', ')}ms]` : `${activeClip.fps} FPS (${Math.round(1000 / activeClip.fps)}ms/f)`}
                </span>
                <span>Click any frame cell to scrub</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
