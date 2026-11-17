'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { tilesetAtlasCache, ResolvedAnimationClip } from './tileset-atlas-cache';
import {
  AnimationClipDef,
  AnimationLoopMode,
  AnimationStateKey,
  AnimationStateKeySchema,
  EntityAnimationSet,
} from '@shared/tileset-types';
import { useGamedataStore } from '../store';
import { postHotloadCommit, postHotloadPreview } from '@dev-tool/hotload/studio-sync';
import { StudioFieldHint, StudioSliderField } from './StudioSliderField';
import styles from '../editors/editors.module.css';

const ALL_ANIM_STATES: AnimationStateKey[] = [...AnimationStateKeySchema.options];
const EDITABLE_THEMES = ['default', 'traxus_foundry', 'sekiguchi_biolabs', 'dark_subnet'] as const;

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

  // Clip authoring drawer state
  const liveSyncEnabled = useGamedataStore((s) => s.liveSyncEnabled);
  const [clipEditorOpen, setClipEditorOpen] = useState(false);
  const [clipThemeId, setClipThemeId] = useState<string>('default');
  const [propagateToThemes, setPropagateToThemes] = useState(true);
  const [clipStateKey, setClipStateKey] = useState<AnimationStateKey>('idle');
  const [draftFrames, setDraftFrames] = useState<string[]>([]);
  const [draftFps, setDraftFps] = useState<number>(6);
  const [draftLoop, setDraftLoop] = useState<AnimationLoopMode>('loop');
  const [draftNextState, setDraftNextState] = useState<string>('');
  const [draftDesyncPhase, setDraftDesyncPhase] = useState<boolean>(true);
  const [draftDurations, setDraftDurations] = useState<Array<number | undefined>>([]);
  const [addFrameSearch, setAddFrameSearch] = useState('');
  const [clipSaveStatus, setClipSaveStatus] = useState<string | null>(null);
  const [clipVersion, setClipVersion] = useState(0);

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
    void clipVersion;
    return tilesetAtlasCache.getAnimationStates(value, clipThemeId);
  }, [value, frameKeys, clipThemeId, clipVersion]);

  const isAnimated = animStates.length > 0;

  // Active clip
  const activeClip: ResolvedAnimationClip | null = useMemo(() => {
    if (!isAnimated || !value) return null;
    void clipVersion;
    return tilesetAtlasCache.getAnimationClip(value, currentState, clipThemeId) ??
      tilesetAtlasCache.getAnimationClip(value, 'idle', clipThemeId);
  }, [value, currentState, isAnimated, frameKeys, clipThemeId, clipVersion]);

  // Load theme atlas when clipThemeId changes
  useEffect(() => {
    tilesetAtlasCache.loadAtlas(clipThemeId).then((ok) => {
      if (ok) {
        setFrameKeys(tilesetAtlasCache.getFrameKeys(clipThemeId).sort());
        setClipVersion((v) => v + 1);
      }
    });
  }, [clipThemeId]);

  // Hydrate draft clip fields when opening drawer or changing state/value/theme
  useEffect(() => {
    if (!clipEditorOpen || !value) return;
    const clip = tilesetAtlasCache.getAnimationClip(value, clipStateKey, clipThemeId);
    if (clip) {
      setDraftFrames([...clip.frames]);
      setDraftFps(clip.fps);
      setDraftLoop(clip.loop);
      setDraftDurations(clip.frameDurationsMs ? [...clip.frameDurationsMs] : clip.frames.map(() => undefined));
      const rawAnims = tilesetAtlasCache.getRawAnimations(clipThemeId);
      const rawEntry = rawAnims[value];
      let nextSt = '';
      let desync = true;
      if (rawEntry && 'frames' in rawEntry && Array.isArray(rawEntry.frames)) {
        nextSt = rawEntry.nextState ?? '';
        desync = rawEntry.desyncPhase ?? true;
      } else if (rawEntry) {
        const stClip = (rawEntry as EntityAnimationSet)[clipStateKey];
        nextSt = stClip?.nextState ?? '';
        desync = stClip?.desyncPhase ?? true;
      }
      setDraftNextState(nextSt);
      setDraftDesyncPhase(desync);
    } else {
      setDraftFrames(value ? [value] : []);
      setDraftFps(6);
      setDraftLoop(clipStateKey === 'idle' || clipStateKey === 'locked' || clipStateKey === 'corrupted' ? 'loop' : 'once');
      setDraftDurations([undefined]);
      setDraftNextState('');
      setDraftDesyncPhase(true);
    }
  }, [clipEditorOpen, value, clipStateKey, clipThemeId]);

  const buildUpdatedAnimationsEntry = useCallback(
    (
      nextFrames: string[],
      nextFps: number,
      nextLoop: AnimationLoopMode,
      nextNextState: string,
      nextDesync: boolean,
      nextDurations: Array<number | undefined>,
    ): EntityAnimationSet | AnimationClipDef => {
      const hasCustomDurations =
        nextDurations.length === nextFrames.length &&
        nextDurations.some((d) => typeof d === 'number' && d > 0);
      const clipDef: AnimationClipDef = {
        frames: nextFrames,
        fps: Math.max(1, Math.min(30, nextFps)),
        loop: nextLoop,
        desyncPhase: nextDesync,
        ...(hasCustomDurations
          ? {
              frameDurationsMs: nextDurations.map((d) =>
                typeof d === 'number' && d > 0 ? Math.round(d) : Math.round(1000 / Math.max(1, nextFps)),
              ),
            }
          : {}),
        ...(nextNextState ? { nextState: nextNextState as AnimationStateKey } : {}),
      };

      const rawAnims = tilesetAtlasCache.getRawAnimations(clipThemeId);
      const existing = rawAnims[value];
      let baseSet: EntityAnimationSet = {};
      if (existing) {
        if ('frames' in existing && Array.isArray(existing.frames)) {
          baseSet = { idle: existing as AnimationClipDef };
        } else {
          baseSet = { ...(existing as EntityAnimationSet) };
        }
      }
      return {
        ...baseSet,
        [clipStateKey]: clipDef,
      };
    },
    [clipThemeId, clipStateKey, value],
  );

  const pushClipPreview = useCallback(
    (
      nextFrames: string[],
      nextFps: number,
      nextLoop: AnimationLoopMode,
      nextNextState: string,
      nextDesync: boolean,
      nextDurations: Array<number | undefined>,
    ) => {
      if (!value || nextFrames.length === 0) return;
      const entry = buildUpdatedAnimationsEntry(
        nextFrames,
        nextFps,
        nextLoop,
        nextNextState,
        nextDesync,
        nextDurations,
      );
      tilesetAtlasCache.setAnimationEntry(clipThemeId, value, entry);
      setClipVersion((v) => v + 1);

      if (liveSyncEnabled) {
        const allAnims = tilesetAtlasCache.getRawAnimations(clipThemeId);
        postHotloadPreview('tileset:animations', value, {
          themeId: clipThemeId,
          animSetKey: value,
          animations: { ...allAnims, [value]: entry },
        });
      }
    },
    [value, clipThemeId, liveSyncEnabled, buildUpdatedAnimationsEntry],
  );

  const handleSaveClip = async () => {
    if (!value || draftFrames.length === 0) return;
    setClipSaveStatus('SAVING...');
    const entry = buildUpdatedAnimationsEntry(
      draftFrames,
      draftFps,
      draftLoop,
      draftNextState,
      draftDesyncPhase,
      draftDurations,
    );
    try {
      const res = await fetch('/api/dev/gamedata/tileset/animations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          themeId: clipThemeId,
          animSetKey: value,
          entry,
          propagateToThemes: clipThemeId === 'default' ? propagateToThemes : false,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setClipSaveStatus(`ERR: ${json.error || 'Failed'}`);
        return;
      }
      tilesetAtlasCache.setAnimationEntry(clipThemeId, value, entry);
      setClipVersion((v) => v + 1);
      postHotloadCommit(
        'tileset:animations',
        value,
        {
          themeId: clipThemeId,
          animSetKey: value,
          animations: json.animations,
        },
        undefined,
        json.envelope?.id,
      );
      setClipSaveStatus(`SAVED (${(json.updatedThemes as string[])?.join(', ') || clipThemeId})`);
      window.setTimeout(() => setClipSaveStatus(null), 2500);
    } catch (err) {
      setClipSaveStatus(`ERR: ${err instanceof Error ? err.message : 'Save failed'}`);
    }
  };

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
            <button
              type="button"
              className={styles.toolButton}
              onClick={() => setClipEditorOpen(!clipEditorOpen)}
              disabled={disabled || !value}
              style={{
                padding: '4px 8px',
                fontWeight: 700,
                borderColor: clipEditorOpen ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
                color: clipEditorOpen ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
              }}
              title="Author or edit tileset animation clips for this sprite key"
            >
              ✎ EDIT CLIPS
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

      {/* Interactive Animation Clip Authoring Drawer */}
      {clipEditorOpen && value && (
        <div
          style={{
            padding: '10px',
            background: '#0b111e',
            border: '1px solid rgba(0, 240, 255, 0.45)',
            borderRadius: '2px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#00f0ff' }}>
              ANIMATION CLIP AUTHOR // {value}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <select
                aria-label="Clip Theme Manifest"
                className={styles.fieldInput}
                style={{ width: 'auto', padding: '2px 6px', fontSize: '11px' }}
                value={clipThemeId}
                onChange={(e) => setClipThemeId(e.target.value)}
              >
                {EDITABLE_THEMES.map((t) => (
                  <option key={t} value={t}>
                    theme: {t}
                  </option>
                ))}
              </select>
              {clipThemeId === 'default' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#a0aec0' }}>
                  <input
                    type="checkbox"
                    checked={propagateToThemes}
                    onChange={(e) => setPropagateToThemes(e.target.checked)}
                  />
                  Propagate to matching themes
                </label>
              )}
              <button
                type="button"
                className={styles.saveButton}
                style={{ padding: '2px 10px', fontSize: '11px' }}
                onClick={handleSaveClip}
                disabled={draftFrames.length === 0}
              >
                SAVE CLIP
              </button>
            </div>
          </div>

          {clipSaveStatus && (
            <div style={{ fontSize: '10px', color: clipSaveStatus.startsWith('ERR') ? '#ff4d6d' : '#00f0ff' }}>
              {clipSaveStatus}
            </div>
          )}

          {/* State Selector */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#79889e' }}>CLIP STATE:</span>
            {ALL_ANIM_STATES.map((st) => {
              const hasClip = animStates.includes(st);
              return (
                <button
                  key={st}
                  type="button"
                  className={styles.toolButton}
                  onClick={() => {
                    setClipStateKey(st);
                    if (hasClip) setCurrentState(st);
                  }}
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderColor: clipStateKey === st ? '#00f0ff' : hasClip ? 'rgba(0,240,255,0.35)' : undefined,
                    color: clipStateKey === st ? '#00f0ff' : hasClip ? '#e2e8f0' : '#64748b',
                    background: clipStateKey === st ? 'rgba(0, 240, 255, 0.15)' : undefined,
                  }}
                >
                  {st} {hasClip ? '•' : ''}
                </button>
              );
            })}
          </div>

          {/* Playback Controls */}
          <div className={styles.fieldGridCompact}>
            <StudioSliderField
              label="FPS"
              valueDisplay={`${draftFps}`}
              tooltipTag="ANIM"
              tooltip="Playback frame rate (1–30 frames/sec) for this animation clip when individual frame durations are left blank."
              min={1}
              max={30}
              step={1}
              value={draftFps}
              onChange={(val) => {
                setDraftFps(val);
                pushClipPreview(draftFrames, val, draftLoop, draftNextState, draftDesyncPhase, draftDurations);
              }}
            />
            <div className={styles.fieldCell}>
              <div className={styles.fieldCellHeader}>
                <label className={styles.fieldCellLabel}>Loop Mode</label>
                <StudioFieldHint
                  label="Loop Mode"
                  tooltipTag="ANIM"
                  tooltip="Controls clip playback: loop repeats continuously, pingpong reverses at ends, once stops or transitions to Next State."
                />
              </div>
              <select
                className={styles.fieldSelect}
                value={draftLoop}
                onChange={(e) => {
                  const val = e.target.value as AnimationLoopMode;
                  setDraftLoop(val);
                  pushClipPreview(draftFrames, draftFps, val, draftNextState, draftDesyncPhase, draftDurations);
                }}
              >
                <option value="loop">loop</option>
                <option value="pingpong">pingpong</option>
                <option value="once">once</option>
              </select>
            </div>
            <div className={styles.fieldCell}>
              <div className={styles.fieldCellHeader}>
                <label className={styles.fieldCellLabel}>Next State</label>
                <StudioFieldHint
                  label="Next State"
                  tooltipTag="ANIM"
                  tooltip="Clip state to transition into after a one-shot ('once') animation finishes playing."
                />
              </div>
              <select
                className={styles.fieldSelect}
                value={draftNextState}
                onChange={(e) => {
                  const val = e.target.value;
                  setDraftNextState(val);
                  pushClipPreview(draftFrames, draftFps, draftLoop, val, draftDesyncPhase, draftDurations);
                }}
              >
                <option value="">(ambient)</option>
                {ALL_ANIM_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.fieldCell} style={{ justifyContent: 'flex-end' }}>
              <div className={styles.fieldCellHeader}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                  <input
                    type="checkbox"
                    className={styles.fieldCheckbox}
                    checked={draftDesyncPhase}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setDraftDesyncPhase(checked);
                      pushClipPreview(draftFrames, draftFps, draftLoop, draftNextState, checked, draftDurations);
                    }}
                  />
                  desyncPhase
                </label>
                <StudioFieldHint
                  label="desyncPhase"
                  tooltipTag="ANIM"
                  tooltip="Offsets each entity's starting animation frame so identical props/enemies don't animate in lockstep."
                />
              </div>
            </div>
          </div>

          {/* Frame Sequence Builder */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: '#79889e' }}>
              FRAMES ({draftFrames.length})
            </span>
            {draftFrames.map((fKey, idx) => (
              <div
                key={`${fKey}-${idx}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}
              >
                <span style={{ width: '24px', color: '#79889e' }}>#{idx}</span>
                <span style={{ flex: 1, fontFamily: 'var(--font-mono, monospace)', color: '#f4f4f0' }}>
                  {fKey}
                </span>
                <input
                  type="number"
                  min={16}
                  placeholder="ms"
                  className={styles.fieldInput}
                  style={{ width: '72px', padding: '2px 4px', fontSize: '10px' }}
                  value={draftDurations[idx] ?? ''}
                  onChange={(e) => {
                    const nextD = [...draftDurations];
                    nextD[idx] = e.target.value ? Number(e.target.value) : undefined;
                    setDraftDurations(nextD);
                    pushClipPreview(draftFrames, draftFps, draftLoop, draftNextState, draftDesyncPhase, nextD);
                  }}
                  title="Optional custom frame duration (ms)"
                />
                <button
                  type="button"
                  className={styles.toolButton}
                  disabled={idx === 0}
                  onClick={() => {
                    const nextF = [...draftFrames];
                    const nextD = [...draftDurations];
                    [nextF[idx - 1], nextF[idx]] = [nextF[idx], nextF[idx - 1]];
                    [nextD[idx - 1], nextD[idx]] = [nextD[idx], nextD[idx - 1]];
                    setDraftFrames(nextF);
                    setDraftDurations(nextD);
                    pushClipPreview(nextF, draftFps, draftLoop, draftNextState, draftDesyncPhase, nextD);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.toolButton}
                  disabled={idx === draftFrames.length - 1}
                  onClick={() => {
                    const nextF = [...draftFrames];
                    const nextD = [...draftDurations];
                    [nextF[idx + 1], nextF[idx]] = [nextF[idx], nextF[idx + 1]];
                    [nextD[idx + 1], nextD[idx]] = [nextD[idx], nextD[idx + 1]];
                    setDraftFrames(nextF);
                    setDraftDurations(nextD);
                    pushClipPreview(nextF, draftFps, draftLoop, draftNextState, draftDesyncPhase, nextD);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={styles.toolButton}
                  disabled={draftFrames.length <= 1}
                  onClick={() => {
                    const nextF = draftFrames.filter((_, i) => i !== idx);
                    const nextD = draftDurations.filter((_, i) => i !== idx);
                    setDraftFrames(nextF);
                    setDraftDurations(nextD);
                    pushClipPreview(nextF, draftFps, draftLoop, draftNextState, draftDesyncPhase, nextD);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Add Frame */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <input
                className={styles.fieldInput}
                placeholder="Filter frame key to add..."
                value={addFrameSearch}
                onChange={(e) => setAddFrameSearch(e.target.value)}
                style={{ flex: 1, fontSize: '11px', padding: '2px 6px' }}
              />
              <select
                className={styles.fieldInput}
                style={{ flex: 1, fontSize: '11px', padding: '2px 6px' }}
                value=""
                onChange={(e) => {
                  const chosen = e.target.value;
                  if (!chosen) return;
                  const nextF = [...draftFrames, chosen];
                  const nextD = [...draftDurations, undefined];
                  setDraftFrames(nextF);
                  setDraftDurations(nextD);
                  pushClipPreview(nextF, draftFps, draftLoop, draftNextState, draftDesyncPhase, nextD);
                }}
              >
                <option value="">+ Add frame from atlas...</option>
                {frameKeys
                  .filter((k) => !addFrameSearch || k.toLowerCase().includes(addFrameSearch.toLowerCase()))
                  .slice(0, 80)
                  .map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      )}

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
