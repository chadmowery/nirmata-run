'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { RoomPrefabTemplate, PropAnchorTag } from '@/game/generation/prefabs/types';
import { Grid } from '@/engine/grid/grid';
import { AutotileSolver } from '@/game/generation/autotile-solver';
import { useGamedataStore } from '../store';
import { tilesetAtlasCache } from '../shared/tileset-atlas-cache';
import {
  generateRoomPrefab,
  RoomArchetype,
  RoomGeneratorConfig,
} from '@/game/generation/prefabs/room-generator';
import { validatePrefabRules, PrefabValidationError } from '@/app/api/dev/gamedata/prefab-validator';
import styles from './editors.module.css';

interface Props {
  name: string;
  isNew?: boolean;
  cloneFrom?: string;
  onRefresh?: () => void;
}

export type CardinalOrientation = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';

export const ORIENTATION_CYCLE: Record<CardinalOrientation, CardinalOrientation> = {
  NORTH: 'EAST',
  EAST: 'SOUTH',
  SOUTH: 'WEST',
  WEST: 'NORTH',
};

export const ORIENTATION_ARROWS: Record<CardinalOrientation, string> = {
  NORTH: '↑',
  EAST: '→',
  SOUTH: '↓',
  WEST: '←',
};

export const ORIENTATION_DEGREES: Record<CardinalOrientation, number> = {
  NORTH: 0,
  EAST: 90,
  SOUTH: 180,
  WEST: 270,
};

type BrushType =
  | '#'
  | '.'
  | '+'
  | 'V'
  | '~'
  | 'PROP_DESK_CORNER'
  | 'PROP_LOCKER_WALL'
  | 'CONTAINER_RARE'
  | 'SURFACE_TABLE_TOP';

type EditorTool = 'pencil' | 'box' | 'flood' | 'portal';
type ViewMode = 'SPRITE' | 'GLYPH' | 'RAW';

export interface EditorPropSpawn {
  x: number;
  y: number;
  anchorType: PropAnchorTag;
  orientation: CardinalOrientation;
  guaranteedTemplate?: string;
}

export function PrefabEditor({ name, isNew, cloneFrom, onRefresh }: Props) {
  const {
    setCloneSource,
    selectItem,
    clearSelection,
    setDirty,
    setActiveEffectiveData,
    setActiveValidationStatus,
  } = useGamedataStore();

  const [prefabData, setPrefabData] = useState<RoomPrefabTemplate | null>(null);
  const [propSpawnsWithOrient, setPropSpawnsWithOrient] = useState<EditorPropSpawn[]>([]);
  const [selectedBrush, setSelectedBrush] = useState<BrushType>('#');
  const [brushOrientation, setBrushOrientation] = useState<CardinalOrientation>('NORTH');
  const [activeTool, setActiveTool] = useState<EditorTool>('pencil');
  const [viewMode, setViewMode] = useState<ViewMode>('SPRITE');
  const [isAnimatingPreview, setIsAnimatingPreview] = useState(false);
  const animElapsedRef = useRef<number>(0);

  // Box drag state
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Undo / Redo history
  const [history, setHistory] = useState<
    Array<{ layout: string[]; propSpawns: EditorPropSpawn[]; portals: RoomPrefabTemplate['portals'] }>
  >([]);
  const [redoStack, setRedoStack] = useState<
    Array<{ layout: string[]; propSpawns: EditorPropSpawn[]; portals: RoomPrefabTemplate['portals'] }>
  >([]);

  // ProcGen Drawer state
  const [genArchetype, setGenArchetype] = useState<RoomArchetype>('SERVER_CORE');
  const [genSeed, setGenSeed] = useState('TK-8890');
  const [genFaction, setGenFaction] = useState<'traxus' | 'cyberacme' | 'sekiguchi' | 'nucaloric'>('cyberacme');
  const [genSymmetry, setGenSymmetry] = useState<'none' | 'horizontal' | 'vertical' | 'bilateral'>('bilateral');
  const [genComplexity, setGenComplexity] = useState(0.5);
  const [genPropDensity, setGenPropDensity] = useState(0.5);
  const [genHazardDensity, setGenHazardDensity] = useState(0.0);
  const [genPortalCount, setGenPortalCount] = useState(2);
  const [zoomScale, setZoomScale] = useState<number>(1.5);

  const [errors, setErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load atlas texture
  useEffect(() => {
    tilesetAtlasCache.loadAtlas('default');
  }, []);

  // Load prefab data
  useEffect(() => {
    if (isNew && cloneFrom) {
      fetch(`/api/dev/gamedata/prefabs/${cloneFrom}`)
        .then((r) => r.json())
        .then((data: RoomPrefabTemplate) => {
          setPrefabData({ ...data, id: '', name: '' });
          setPropSpawnsWithOrient(
            (data.propSpawns || []).map((p) => ({
              ...p,
              orientation: (p as EditorPropSpawn).orientation || 'NORTH',
            })),
          );
          setDirty(true);
        })
        .catch(() => setErrors(['Failed to load clone source']));
    } else if (!isNew && name) {
      fetch(`/api/dev/gamedata/prefabs/${name}`)
        .then((r) => r.json())
        .then((data: RoomPrefabTemplate) => {
          setPrefabData(data);
          setPropSpawnsWithOrient(
            (data.propSpawns || []).map((p) => ({
              ...p,
              orientation: (p as EditorPropSpawn).orientation || 'NORTH',
            })),
          );
          setDirty(false);
        })
        .catch(() => setErrors(['Failed to load prefab']));
    } else {
      const defaultLayout = [
        '############',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '############',
      ];
      setPrefabData({
        id: '',
        name: '',
        archetype: 'CUSTOM',
        faction: 'traxus',
        minFloor: 1,
        maxFloor: 10,
        width: 12,
        height: 12,
        layout: defaultLayout,
        portals: [{ x: 6, y: 0, direction: 'north' }],
        propSpawns: [],
      });
      setPropSpawnsWithOrient([]);
    }
  }, [name, isNew, cloneFrom, setDirty]);

  // Current effective prefab template
  const currentPrefab: RoomPrefabTemplate | null = useMemo(() => {
    if (!prefabData) return null;
    return {
      ...prefabData,
      propSpawns: propSpawnsWithOrient.map((p) => ({
        x: p.x,
        y: p.y,
        anchorType: p.anchorType,
        orientation: p.orientation,
        guaranteedTemplate: p.guaranteedTemplate,
      })),
    };
  }, [prefabData, propSpawnsWithOrient]);

  // Run live structural audit
  const auditResult = useMemo(() => {
    if (!currentPrefab) return { valid: true, errors: [], warnings: [] };
    return validatePrefabRules(currentPrefab);
  }, [currentPrefab]);

  // Sync telemetry store
  useEffect(() => {
    if (currentPrefab) {
      setActiveEffectiveData(currentPrefab);
      setActiveValidationStatus({
        zodValid: Boolean(currentPrefab.id && currentPrefab.name),
        prefabResult: auditResult,
      });
    }
  }, [currentPrefab, auditResult, setActiveEffectiveData, setActiveValidationStatus]);

  // Push history state
  const pushHistory = useCallback(() => {
    if (!prefabData) return;
    setHistory((prev) => [
      ...prev.slice(-49),
      {
        layout: [...prefabData.layout],
        propSpawns: [...propSpawnsWithOrient],
        portals: [...prefabData.portals],
      },
    ]);
    setRedoStack([]);
    setDirty(true);
  }, [prefabData, propSpawnsWithOrient, setDirty]);

  const handleUndo = useCallback(() => {
    if (history.length === 0 || !prefabData) return;
    const prev = history[history.length - 1];
    setRedoStack((r) => [
      ...r,
      {
        layout: [...prefabData.layout],
        propSpawns: [...propSpawnsWithOrient],
        portals: [...prefabData.portals],
      },
    ]);
    setHistory((h) => h.slice(0, -1));
    setPrefabData({ ...prefabData, layout: prev.layout, portals: prev.portals });
    setPropSpawnsWithOrient(prev.propSpawns);
    setDirty(true);
  }, [history, prefabData, propSpawnsWithOrient, setDirty]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !prefabData) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((h) => [
      ...h,
      {
        layout: [...prefabData.layout],
        propSpawns: [...propSpawnsWithOrient],
        portals: [...prefabData.portals],
      },
    ]);
    setRedoStack((r) => r.slice(0, -1));
    setPrefabData({ ...prefabData, layout: next.layout, portals: next.portals });
    setPropSpawnsWithOrient(next.propSpawns);
    setDirty(true);
  }, [redoStack, prefabData, propSpawnsWithOrient, setDirty]);

  // Rotate brush orientation helper
  const cycleOrientation = useCallback(() => {
    setBrushOrientation((prev) => ORIENTATION_CYCLE[prev]);
  }, []);

  // Hotkeys: P, B, G, O, R, Cmd+Z, Cmd+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        cycleOrientation();
      } else if (e.key === 'p' || e.key === 'P') {
        setActiveTool('pencil');
      } else if (e.key === 'b' || e.key === 'B') {
        setActiveTool('box');
      } else if (e.key === 'g' || e.key === 'G') {
        setActiveTool('flood');
      } else if (e.key === 'o' || e.key === 'O') {
        setActiveTool('portal');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cycleOrientation, handleUndo, handleRedo]);

  // Real-time autotiled grid solver
  const autotiledGrid = useMemo(() => {
    if (!prefabData) return null;
    const { width, height, layout } = prefabData;
    const grid = new Grid(width, height);

    for (let y = 0; y < height; y++) {
      const row = layout[y] || '';
      for (let x = 0; x < width; x++) {
        const char = row[x] || ' ';
        const isWall = char === '#';
        const isDoor = char === '+' || char === 'V';
        grid.setTile(x, y, {
          terrain: isWall ? 'wall' : isDoor ? 'door' : 'floor',
          walkable: !isWall,
        });
      }
    }

    const resolved: Array<Array<{ glyph: string; frameKey: string }>> = [];
    for (let y = 0; y < height; y++) {
      const rowGlyphs: Array<{ glyph: string; frameKey: string }> = [];
      for (let x = 0; x < width; x++) {
        const tile = grid.getTile(x, y);
        if (tile?.terrain === 'wall') {
          const auto = AutotileSolver.resolveWallTile(grid, x, y);
          let glyph = '#';
          switch (auto.frameKey) {
            case 'wall_cap_n':
              glyph = 'C↑';
              break;
            case 'wall_cap_e':
              glyph = 'C→';
              break;
            case 'wall_cap_s':
              glyph = 'C↓';
              break;
            case 'wall_cap_w':
              glyph = 'C←';
              break;
            case 'wall_straight_h':
              glyph = '═';
              break;
            case 'wall_straight_v':
              glyph = '║';
              break;
            case 'wall_corner_ne':
              glyph = '╚';
              break;
            case 'wall_corner_se':
              glyph = '╔';
              break;
            case 'wall_corner_sw':
              glyph = '╗';
              break;
            case 'wall_corner_nw':
              glyph = '╝';
              break;
            case 'wall_t_n':
              glyph = '╩';
              break;
            case 'wall_t_e':
              glyph = '╠';
              break;
            case 'wall_t_s':
              glyph = '╦';
              break;
            case 'wall_t_w':
              glyph = '╣';
              break;
            case 'wall_cross':
              glyph = '╬';
              break;
            case 'wall_single':
              glyph = '▣';
              break;
          }
          rowGlyphs.push({ glyph, frameKey: auto.frameKey });
        } else if (tile?.terrain === 'door') {
          const doorAuto = AutotileSolver.resolveDoorTile(grid, x, y);
          const isVert = doorAuto.frameKey.includes('_v_');
          rowGlyphs.push({ glyph: isVert ? '+║' : '+═', frameKey: doorAuto.frameKey });
        } else {
          rowGlyphs.push({ glyph: '.', frameKey: 'floor' });
        }
      }
      resolved.push(rowGlyphs);
    }
    return { grid, resolved };
  }, [prefabData]);

  // HTML5 Canvas Sprite Renderer
  const renderCanvas = useCallback(
    (elapsedMs: number = 0) => {
      if (viewMode !== 'SPRITE' || !canvasRef.current || !prefabData || !autotiledGrid) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height, layout, portals, faradayShielded } = prefabData;
      const tileSize = Math.round(32 * zoomScale);

      canvas.width = width * tileSize;
      canvas.height = height * tileSize;

      // Layer 0: Void backing
      ctx.fillStyle = '#040609';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Layer 1 & 2: Floor & Autotiled Walls / Hazards
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const char = layout[y]?.[x] ?? '#';
          const dx = x * tileSize;
          const dy = y * tileSize;

          // Draw floor substrate underneath everything
          tilesetAtlasCache.drawAtlasFrame(ctx, 'floor', dx, dy, tileSize);

          if (char === '#') {
            const frameKey = autotiledGrid.resolved[y]?.[x]?.frameKey || 'wall_straight_h';
            tilesetAtlasCache.drawAtlasFrame(ctx, frameKey, dx, dy, tileSize);
          } else if (char === '~') {
            // Dead-zone hazard hatch
            ctx.fillStyle = 'rgba(255, 0, 85, 0.35)';
            ctx.fillRect(dx, dy, tileSize, tileSize);
            ctx.strokeStyle = '#ff0055';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(dx, dy + tileSize);
            ctx.lineTo(dx + tileSize, dy);
            ctx.stroke();
          } else if (char === '+' || char === 'V') {
            if (char === 'V') {
              let vFrame = 'prop_vault_door_n';
              if (isAnimatingPreview) {
                const phaseOffset = (x * 31 + y * 17) * 40;
                vFrame = tilesetAtlasCache.resolveAnimatedFrameAtTime(
                  vFrame,
                  'idle',
                  elapsedMs + phaseOffset,
                ).frameKey;
              }
              tilesetAtlasCache.drawAtlasFrame(ctx, vFrame, dx, dy, tileSize);
            } else {
              const doorFrame = autotiledGrid.resolved[y]?.[x]?.frameKey || 'door_h_closed';
              tilesetAtlasCache.drawAtlasFrame(ctx, doorFrame, dx, dy, tileSize);
            }
          }
        }
      }

      // Layer 3: Perimeter Portals
      for (const p of portals) {
        const px = p.x * tileSize;
        const py = p.y * tileSize;

        ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.fillRect(px, py, tileSize, tileSize);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);

        // Cyan arrow badge
        ctx.fillStyle = '#00f0ff';
        ctx.font = `bold ${Math.max(12, Math.round(14 * zoomScale))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const arrow =
          p.direction === 'north'
            ? '▲'
            : p.direction === 'south'
              ? '▼'
              : p.direction === 'west'
                ? '◀'
                : '▶';
        ctx.fillText(arrow, px + tileSize / 2, py + tileSize / 2);
      }

      // Layer 4: Interactive Props & Orientation Indicators
      for (const prop of propSpawnsWithOrient) {
        const px = prop.x * tileSize;
        const py = prop.y * tileSize;
        const o = prop.orientation.toLowerCase()[0]; // 'n', 'e', 's', 'w'

        let frame = 'prop_workstation_n';
        if (prop.guaranteedTemplate) {
          if (prop.guaranteedTemplate === 'prop-workstation') frame = `prop_workstation_${o}`;
          else if (prop.guaranteedTemplate === 'prop-locker') frame = `prop_locker_${o}`;
          else if (prop.guaranteedTemplate === 'prop-biocabinet') frame = `prop_biocabinet_${o}`;
          else if (prop.guaranteedTemplate === 'prop-crate-cover')
            frame = o === 'n' || o === 's' ? 'prop_crate_cover_h' : 'prop_crate_cover_v';
          else if (prop.guaranteedTemplate === 'prop-safe') frame = 'prop_safe_locked';
          else if (prop.guaranteedTemplate === 'prop-subnet-console') frame = 'prop_subnet_console';
          else if (prop.guaranteedTemplate === 'prop-cryo-vat') frame = 'prop_cryo_vat';
          else if (prop.guaranteedTemplate === 'prop-capacitor-bank') frame = 'prop_capacitor_bank';
          else if (prop.guaranteedTemplate === 'prop-reality-stabilizer') frame = 'prop_stabilizer';
          else if (prop.guaranteedTemplate === 'prop-cooling-vent') frame = 'prop_cooling_vent';
          else if (prop.guaranteedTemplate === 'prop-dead-drop') frame = 'prop_dead_drop';
        } else {
          if (prop.anchorType === 'PROP_DESK_CORNER') frame = `prop_workstation_${o}`;
          else if (prop.anchorType === 'PROP_LOCKER_WALL') frame = `prop_locker_${o}`;
          else if (prop.anchorType === 'SURFACE_TABLE_TOP') frame = 'prop_crate_cover_h';
          else if (prop.anchorType === 'CONTAINER_RARE') frame = 'prop_safe_locked';
        }

        if (isAnimatingPreview) {
          const phaseOffset = (prop.x * 31 + prop.y * 17) * 40;
          const animElapsed = elapsedMs + phaseOffset;
          const resolved = tilesetAtlasCache.resolveAnimatedFrameAtTime(frame, 'idle', animElapsed);
          frame = resolved.frameKey;
        }

        const drawn = tilesetAtlasCache.drawAtlasFrame(ctx, frame, px, py, tileSize);
        if (!drawn) {
          // Fallback badge
          ctx.fillStyle = 'rgba(216, 255, 0, 0.2)';
          ctx.fillRect(px, py, tileSize, tileSize);
        }

        // Translucent directional indicator
        const badgeSize = Math.max(12, Math.round(14 * zoomScale));
        const offset = tileSize - badgeSize;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(px + offset, py + offset, badgeSize, badgeSize);
        ctx.fillStyle = '#d8ff00';
        ctx.font = `${Math.max(9, Math.round(10 * zoomScale))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          ORIENTATION_ARROWS[prop.orientation],
          px + offset + badgeSize / 2,
          py + offset + badgeSize / 2,
        );
      }

      // Layer 5: Faraday Cage Scanline Shroud
      if (faradayShielded) {
        ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
        ctx.fillRect(tileSize, tileSize, (width - 2) * tileSize, (height - 2) * tileSize);

        ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
        for (let y = tileSize; y < (height - 1) * tileSize; y += 4) {
          ctx.fillRect(tileSize, y, (width - 2) * tileSize, 2);
        }

        ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
        ctx.font = `bold ${Math.max(8, Math.round(9 * zoomScale))}px monospace`;
        ctx.textAlign = 'left';
        ctx.fillText('⚡ FARADAY SHIELDED', tileSize + 4, tileSize + Math.round(12 * zoomScale));
      }

      // Grid Overlay
      ctx.strokeStyle = '#1c2638';
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * tileSize, 0);
        ctx.lineTo(x * tileSize, height * tileSize);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * tileSize);
        ctx.lineTo(width * tileSize, y * tileSize);
        ctx.stroke();
      }

      // Drag box outline preview
      if (activeTool === 'box' && boxStart && hoverPos) {
        const minX = Math.min(boxStart.x, hoverPos.x);
        const maxX = Math.max(boxStart.x, hoverPos.x);
        const minY = Math.min(boxStart.y, hoverPos.y);
        const maxY = Math.max(boxStart.y, hoverPos.y);

        ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.fillRect(
          minX * tileSize,
          minY * tileSize,
          (maxX - minX + 1) * tileSize,
          (maxY - minY + 1) * tileSize,
        );
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          minX * tileSize,
          minY * tileSize,
          (maxX - minX + 1) * tileSize,
          (maxY - minY + 1) * tileSize,
        );
      }

      // Cursor reticle
      if (hoverPos) {
        ctx.strokeStyle = '#d8ff00';
        ctx.lineWidth = 1;
        ctx.strokeRect(hoverPos.x * tileSize, hoverPos.y * tileSize, tileSize, tileSize);
      }
    },
    [
      viewMode,
      prefabData,
      propSpawnsWithOrient,
      autotiledGrid,
      hoverPos,
      boxStart,
      activeTool,
      zoomScale,
      isAnimatingPreview,
    ],
  );

  // Initial / Static Canvas Render Effect
  useEffect(() => {
    if (!isAnimatingPreview) {
      renderCanvas(animElapsedRef.current);
    }
  }, [renderCanvas, isAnimatingPreview]);

  // Live rAF loop when isAnimatingPreview is active
  useEffect(() => {
    if (!isAnimatingPreview || viewMode !== 'SPRITE') return;
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      animElapsedRef.current += dt;
      renderCanvas(animElapsedRef.current);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isAnimatingPreview, viewMode, renderCanvas]);

  // Painting handlers
  const paintCell = useCallback(
    (x: number, y: number) => {
      if (!prefabData) return;
      if (x < 0 || x >= prefabData.width || y < 0 || y >= prefabData.height) return;

      if (activeTool === 'portal') {
        const isPerimeter =
          x === 0 || x === prefabData.width - 1 || y === 0 || y === prefabData.height - 1;
        const isCorner =
          (x === 0 && y === 0) ||
          (x === prefabData.width - 1 && y === 0) ||
          (x === 0 && y === prefabData.height - 1) ||
          (x === prefabData.width - 1 && y === prefabData.height - 1);

        if (!isPerimeter || isCorner) return;

        pushHistory();
        const existingIdx = prefabData.portals.findIndex((p) => p.x === x && p.y === y);
        let nextPortals = [...prefabData.portals];
        if (existingIdx >= 0) {
          nextPortals = nextPortals.filter((_, i) => i !== existingIdx);
        } else {
          let dir: 'north' | 'south' | 'east' | 'west' = 'north';
          if (y === 0) dir = 'north';
          else if (y === prefabData.height - 1) dir = 'south';
          else if (x === 0) dir = 'west';
          else dir = 'east';
          nextPortals.push({ x, y, direction: dir });
        }
        setPrefabData({ ...prefabData, portals: nextPortals });
        return;
      }

      if (
        selectedBrush === '#' ||
        selectedBrush === '.' ||
        selectedBrush === '+' ||
        selectedBrush === 'V' ||
        selectedBrush === '~'
      ) {
        pushHistory();
        const newLayout = [...prefabData.layout];
        const rowChars = (newLayout[y] || '').split('');
        while (rowChars.length < prefabData.width) rowChars.push('.');
        rowChars[x] = selectedBrush;
        newLayout[y] = rowChars.join('');

        const filteredSpawns =
          selectedBrush === '#'
            ? propSpawnsWithOrient.filter((p) => p.x !== x || p.y !== y)
            : propSpawnsWithOrient;

        setPrefabData({ ...prefabData, layout: newLayout });
        setPropSpawnsWithOrient(filteredSpawns);
      } else {
        // Placing prop anchor
        pushHistory();
        const existingIndex = propSpawnsWithOrient.findIndex((p) => p.x === x && p.y === y);
        const newSpawn: EditorPropSpawn = {
          x,
          y,
          anchorType: selectedBrush as PropAnchorTag,
          orientation: brushOrientation,
        };

        if (existingIndex >= 0) {
          const updated = [...propSpawnsWithOrient];
          updated[existingIndex] = newSpawn;
          setPropSpawnsWithOrient(updated);
        } else {
          setPropSpawnsWithOrient([...propSpawnsWithOrient, newSpawn]);
        }
      }
    },
    [prefabData, activeTool, selectedBrush, brushOrientation, propSpawnsWithOrient, pushHistory],
  );

  // Fill rectangular region
  const fillRect = useCallback(
    (x1: number, y1: number, x2: number, y2: number) => {
      if (!prefabData) return;
      const minX = Math.max(1, Math.min(x1, x2));
      const maxX = Math.min(prefabData.width - 2, Math.max(x1, x2));
      const minY = Math.max(1, Math.min(y1, y2));
      const maxY = Math.min(prefabData.height - 2, Math.max(y1, y2));

      pushHistory();
      const newLayout = [...prefabData.layout];
      for (let y = minY; y <= maxY; y++) {
        const rowChars = (newLayout[y] || '').split('');
        for (let x = minX; x <= maxX; x++) {
          rowChars[x] = selectedBrush === '#' ? '#' : '.';
        }
        newLayout[y] = rowChars.join('');
      }

      setPrefabData({ ...prefabData, layout: newLayout });
    },
    [prefabData, selectedBrush, pushHistory],
  );

  // Flood fill algorithm
  const floodFill = useCallback(
    (startX: number, startY: number) => {
      if (!prefabData) return;
      const targetChar = prefabData.layout[startY]?.[startX];
      const replacementChar = selectedBrush === '#' ? '#' : '.';
      if (targetChar === replacementChar) return;

      pushHistory();
      const newLayout = prefabData.layout.map((r) => r.split(''));
      const queue: [number, number][] = [[startX, startY]];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        const key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        visited.add(key);

        if (newLayout[cy]?.[cx] === targetChar) {
          newLayout[cy][cx] = replacementChar;
          for (const [dx, dy] of [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
          ]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 1 && nx < prefabData.width - 1 && ny >= 1 && ny < prefabData.height - 1) {
              queue.push([nx, ny]);
            }
          }
        }
      }

      setPrefabData({
        ...prefabData,
        layout: newLayout.map((r) => r.join('')),
      });
    },
    [prefabData, selectedBrush, pushHistory],
  );

  // Canvas mouse events
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const tileSize = Math.round(32 * zoomScale);
    const x = Math.floor((e.clientX - rect.left) / tileSize);
    const y = Math.floor((e.clientY - rect.top) / tileSize);

    setIsMouseDown(true);
    if (activeTool === 'box') {
      setBoxStart({ x, y });
    } else if (activeTool === 'flood') {
      floodFill(x, y);
    } else {
      paintCell(x, y);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const tileSize = Math.round(32 * zoomScale);
    const x = Math.floor((e.clientX - rect.left) / tileSize);
    const y = Math.floor((e.clientY - rect.top) / tileSize);
    setHoverPos({ x, y });

    if (isMouseDown && activeTool === 'pencil') {
      paintCell(x, y);
    }
  };

  const handleCanvasMouseUp = () => {
    if (activeTool === 'box' && boxStart && hoverPos) {
      fillRect(boxStart.x, boxStart.y, hoverPos.x, hoverPos.y);
    }
    setIsMouseDown(false);
    setBoxStart(null);
  };

  // Resize Handlers
  const handleResizeGrid = (newW: number, newH: number) => {
    if (!prefabData) return;
    pushHistory();
    const targetW = Math.max(8, Math.min(24, newW));
    const targetH = Math.max(8, Math.min(24, newH));

    const newLayout: string[] = [];
    for (let y = 0; y < targetH; y++) {
      if (y < prefabData.layout.length) {
        let row = prefabData.layout[y].slice(0, targetW);
        while (row.length < targetW) {
          row += y === 0 || y === targetH - 1 ? '#' : '.';
        }
        const chars = row.split('');
        if (y === 0 || y === targetH - 1) {
          for (let x = 0; x < targetW; x++) chars[x] = '#';
        } else {
          chars[0] = '#';
          chars[targetW - 1] = '#';
        }
        newLayout.push(chars.join(''));
      } else {
        newLayout.push('#'.repeat(targetW));
      }
    }

    const validPortals = prefabData.portals
      .filter((p) => p.x < targetW && p.y < targetH)
      .map((p) => {
        let x = p.x;
        let y = p.y;
        if (p.direction === 'east' && x >= targetW - 1) x = targetW - 1;
        if (p.direction === 'south' && y >= targetH - 1) y = targetH - 1;
        return { ...p, x, y };
      });

    const validProps = propSpawnsWithOrient.filter((p) => p.x < targetW && p.y < targetH);

    setPrefabData({
      ...prefabData,
      width: targetW,
      height: targetH,
      layout: newLayout,
      portals:
        validPortals.length > 0
          ? validPortals
          : [{ x: Math.floor(targetW / 2), y: 0, direction: 'north' }],
    });
    setPropSpawnsWithOrient(validProps);
    setDirty(true);
  };

  // Mutation operators
  const handleGenerateRoom = () => {
    if (!prefabData) return;
    pushHistory();
    const newSeed = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
    setGenSeed(newSeed);
    const safeWidth = Math.max(8, Math.min(24, Number(prefabData.width) || 12));
    const safeHeight = Math.max(8, Math.min(24, Number(prefabData.height) || 12));
    const config: RoomGeneratorConfig = {
      seed: newSeed,
      archetype: genArchetype,
      faction: genFaction,
      width: safeWidth,
      height: safeHeight,
      symmetry: genSymmetry,
      complexity: genComplexity,
      propDensity: genPropDensity,
      hazardDensity: genHazardDensity,
      portalCount: genPortalCount,
      minFloor: prefabData.minFloor,
      maxFloor: prefabData.maxFloor,
    };
    const generated = generateRoomPrefab(config);
    setPrefabData({
      ...generated,
      id: prefabData.id || generated.id,
      name: prefabData.name || generated.name,
    });
    setPropSpawnsWithOrient(
      generated.propSpawns.map((p) => ({
        ...p,
        orientation: p.orientation || 'NORTH',
      })),
    );
  };

  const handleRerollSeed = () => {
    const newSeed = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
    setGenSeed(newSeed);
  };

  const handleApplySymmetry = (type: 'horizontal' | 'vertical' | 'bilateral') => {
    if (!prefabData) return;
    pushHistory();
    const grid = prefabData.layout.map((r) => r.split(''));
    const { width, height } = prefabData;

    if (type === 'horizontal' || type === 'bilateral') {
      for (let y = 1; y < Math.floor(height / 2); y++) {
        const mirrorY = height - 1 - y;
        for (let x = 1; x < width - 1; x++) {
          grid[mirrorY][x] = grid[y][x];
        }
      }
    }

    if (type === 'vertical' || type === 'bilateral') {
      for (let x = 1; x < Math.floor(width / 2); x++) {
        const mirrorX = width - 1 - x;
        for (let y = 1; y < height - 1; y++) {
          grid[y][mirrorX] = grid[y][x];
        }
      }
    }

    setPrefabData({ ...prefabData, layout: grid.map((r) => r.join('')) });
  };

  const handleSave = useCallback(async () => {
    if (!prefabData || !currentPrefab) return;
    setSaveStatus('saving');
    setErrors([]);

    if (!currentPrefab.id.trim() || !currentPrefab.name.trim()) {
      setErrors(['Prefab ID and Name are required']);
      setSaveStatus('error');
      return;
    }

    const audit = validatePrefabRules(currentPrefab);
    if (!audit.valid) {
      setErrors(audit.errors.map((e) => e.message));
      setSaveStatus('error');
      return;
    }

    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/dev/gamedata/prefabs' : `/api/dev/gamedata/prefabs/${name}`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentPrefab),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save prefab');
      }

      setSaveStatus('success');
      setDirty(false);
      onRefresh?.();

      if (isNew) {
        selectItem('prefabs', currentPrefab.id);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Save failed']);
      setSaveStatus('error');
    }
  }, [prefabData, currentPrefab, isNew, name, setDirty, onRefresh, selectItem]);

  // Global save listener
  useEffect(() => {
    const onSaveKey = () => handleSave();
    window.addEventListener('gamedata-save', onSaveKey);
    return () => window.removeEventListener('gamedata-save', onSaveKey);
  }, [handleSave]);

  const handleClone = () => {
    if (!currentPrefab) return;
    setCloneSource(currentPrefab.id || name);
    selectItem('prefabs', '__new__');
  };

  const handleDelete = async () => {
    if (!name || isNew) return;
    const confirmed = window.confirm(`Are you sure you want to delete room prefab '${name}'?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/dev/gamedata/prefabs/${name}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete prefab');
      }
      setDirty(false);
      onRefresh?.();
      clearSelection();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to delete prefab']);
    }
  };

  if (!prefabData) return <div>Loading...</div>;

  return (
    <div className={styles.editor}>
      {/* Header placard */}
      <div className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>
          {isNew ? 'New Room Prefab' : `Prefab: ${prefabData.name || name}`}
        </h2>
        <div className={styles.buttonRow}>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'SAVING...' : 'SAVE'}
          </button>
          {!isNew && (
            <>
              <button className={styles.cloneButton} onClick={handleClone}>
                CLONE
              </button>
              <button className={styles.deleteButton} onClick={handleDelete}>
                DELETE
              </button>
            </>
          )}
        </div>
      </div>

      {errors.length > 0 && <div className={styles.errorMessage}>{errors.join(', ')}</div>}

      {/* Main Prefab Layout Workspace */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {/* Left Column: Properties & ProcGen Drawer */}
        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Metadata Card */}
          <div
            style={{
              background: 'var(--c-surface-elevated, #111722)',
              border: '1px solid var(--c-border, #1c2638)',
              padding: '10px',
              borderRadius: '2px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display, sans-serif)',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--c-accent-secondary, #00f0ff)',
                letterSpacing: '0.08em',
                marginBottom: '8px',
              }}
            >
              PREFAB METADATA
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>ID</label>
              <input
                className={styles.fieldInput}
                value={prefabData.id}
                onChange={(e) => {
                  setPrefabData({ ...prefabData, id: e.target.value });
                  setDirty(true);
                }}
                disabled={!isNew}
              />
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Name</label>
              <input
                className={styles.fieldInput}
                value={prefabData.name}
                onChange={(e) => {
                  setPrefabData({ ...prefabData, name: e.target.value });
                  setDirty(true);
                }}
              />
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Faction</label>
              <select
                className={styles.fieldSelect}
                value={prefabData.faction}
                onChange={(e) => {
                  setPrefabData({
                    ...prefabData,
                    faction: e.target.value as RoomPrefabTemplate['faction'],
                  });
                  setDirty(true);
                }}
              >
                <option value="traxus">Traxus</option>
                <option value="cyberacme">CyberAcme</option>
                <option value="sekiguchi">Sekiguchi</option>
                <option value="nucaloric">NuCaloric</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Width (8-24)</label>
                <input
                  type="number"
                  min={8}
                  max={24}
                  className={styles.fieldInput}
                  value={prefabData.width}
                  onChange={(e) => handleResizeGrid(Number(e.target.value) || 8, prefabData.height)}
                />
              </div>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Height (8-24)</label>
                <input
                  type="number"
                  min={8}
                  max={24}
                  className={styles.fieldInput}
                  value={prefabData.height}
                  onChange={(e) => handleResizeGrid(prefabData.width, Number(e.target.value) || 8)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Min Fl</label>
                <input
                  type="number"
                  className={styles.fieldInput}
                  value={prefabData.minFloor}
                  onChange={(e) => {
                    setPrefabData({ ...prefabData, minFloor: Number(e.target.value) });
                    setDirty(true);
                  }}
                />
              </div>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Max Fl</label>
                <input
                  type="number"
                  className={styles.fieldInput}
                  value={prefabData.maxFloor}
                  onChange={(e) => {
                    setPrefabData({ ...prefabData, maxFloor: Number(e.target.value) });
                    setDirty(true);
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                <input
                  type="checkbox"
                  checked={Boolean(prefabData.isVaultRoom)}
                  onChange={(e) => {
                    setPrefabData({ ...prefabData, isVaultRoom: e.target.checked });
                    setDirty(true);
                  }}
                />
                Vault Room
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                <input
                  type="checkbox"
                  checked={Boolean(prefabData.faradayShielded)}
                  onChange={(e) => {
                    setPrefabData({ ...prefabData, faradayShielded: e.target.checked });
                    setDirty(true);
                  }}
                />
                Faraday Shield
              </label>
            </div>
          </div>

          {/* ProcGen Drawer */}
          <div
            style={{
              background: 'var(--c-surface-elevated, #111722)',
              border: '1px solid var(--c-border, #1c2638)',
              padding: '10px',
              borderRadius: '2px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display, sans-serif)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--c-accent-secondary, #00f0ff)',
                  letterSpacing: '0.08em',
                }}
              >
                PROCGEN SYNTHESIS
              </span>
              <button
                type="button"
                className={styles.toolButton}
                onClick={handleRerollSeed}
                style={{ fontSize: '10px', padding: '2px 6px' }}
                title="Reroll Seed"
              >
                🎲 REROLL
              </button>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Seed</label>
              <input
                className={styles.fieldInput}
                value={genSeed}
                onChange={(e) => setGenSeed(e.target.value)}
              />
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Archetype</label>
              <select
                className={styles.fieldSelect}
                value={genArchetype}
                onChange={(e) => setGenArchetype(e.target.value as RoomArchetype)}
              >
                <option value="SERVER_CORE">SERVER_CORE</option>
                <option value="FREIGHT_BAY">FREIGHT_BAY</option>
                <option value="DECON_AIRLOCK">DECON_AIRLOCK</option>
                <option value="ZERO_DAY_VAULT">ZERO_DAY_VAULT</option>
                <option value="SUBNET_HUB">SUBNET_HUB</option>
                <option value="CORRUPTED_SECTOR">CORRUPTED_SECTOR</option>
              </select>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Faction</label>
              <select
                className={styles.fieldSelect}
                value={genFaction}
                onChange={(e) =>
                  setGenFaction(
                    e.target.value as 'traxus' | 'cyberacme' | 'sekiguchi' | 'nucaloric',
                  )
                }
              >
                <option value="traxus">Traxus</option>
                <option value="cyberacme">CyberAcme</option>
                <option value="sekiguchi">Sekiguchi</option>
                <option value="nucaloric">NuCaloric</option>
              </select>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Symmetry</label>
              <select
                className={styles.fieldSelect}
                value={genSymmetry}
                onChange={(e) =>
                  setGenSymmetry(
                    e.target.value as 'none' | 'horizontal' | 'vertical' | 'bilateral',
                  )
                }
              >
                <option value="none">None</option>
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
                <option value="bilateral">Bilateral</option>
              </select>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Portals</label>
              <input
                type="number"
                min={1}
                max={4}
                className={styles.fieldInput}
                value={genPortalCount}
                onChange={(e) => setGenPortalCount(Math.max(1, Math.min(4, Number(e.target.value))))}
              />
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Complexity: {genComplexity.toFixed(2)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={genComplexity}
                onChange={(e) => setGenComplexity(Number(e.target.value))}
                style={{ flex: 1 }}
              />
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Props: {genPropDensity.toFixed(2)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={genPropDensity}
                onChange={(e) => setGenPropDensity(Number(e.target.value))}
                style={{ flex: 1 }}
              />
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Hazards: {genHazardDensity.toFixed(2)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={genHazardDensity}
                onChange={(e) => setGenHazardDensity(Number(e.target.value))}
                style={{ flex: 1 }}
              />
            </div>

            <button
              type="button"
              className={styles.saveButton}
              onClick={handleGenerateRoom}
              style={{ width: '100%', marginTop: '6px' }}
            >
              ⚡ GENERATE ROOM
            </button>
          </div>

          {/* Quick Mutation Levers */}
          <div
            style={{
              background: 'var(--c-surface-elevated, #111722)',
              border: '1px solid var(--c-border, #1c2638)',
              padding: '10px',
              borderRadius: '2px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display, sans-serif)',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--c-accent-secondary, #00f0ff)',
                letterSpacing: '0.08em',
                marginBottom: '8px',
              }}
            >
              MUTATION LEVERS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                className={styles.toolButton}
                onClick={() => handleApplySymmetry('horizontal')}
                style={{ fontSize: '10px' }}
              >
                ↔ H-SYMMETRY
              </button>
              <button
                type="button"
                className={styles.toolButton}
                onClick={() => handleApplySymmetry('vertical')}
                style={{ fontSize: '10px' }}
              >
                ↕ V-SYMMETRY
              </button>
              <button
                type="button"
                className={styles.toolButton}
                onClick={handleUndo}
                disabled={history.length === 0}
                style={{ fontSize: '10px' }}
              >
                ↩ UNDO (Cmd+Z)
              </button>
              <button
                type="button"
                className={styles.toolButton}
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                style={{ fontSize: '10px' }}
              >
                ↪ REDO
              </button>
            </div>
          </div>

          {/* Structural Audit Card */}
          <div
            style={{
              background: 'var(--c-surface-elevated, #111722)',
              border: '1px solid var(--c-border, #1c2638)',
              padding: '10px',
              borderRadius: '2px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display, sans-serif)',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--c-accent-secondary, #00f0ff)',
                letterSpacing: '0.08em',
                marginBottom: '8px',
              }}
            >
              STRUCTURAL AUDIT
            </div>

            {(['VAL-PRF-01', 'VAL-PRF-02', 'VAL-PRF-03', 'VAL-PRF-04', 'VAL-PRF-05'] as const).map(
              (ruleId) => {
                const error = auditResult.errors.find((e: PrefabValidationError) => e.id === ruleId);
                const hasError = Boolean(error);
                return (
                  <div
                    key={ruleId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 6px',
                      background: hasError ? 'rgba(255, 42, 75, 0.1)' : 'rgba(0, 240, 255, 0.05)',
                      border: `1px solid ${hasError ? 'var(--c-danger, #ff2a4b)' : 'rgba(0, 240, 255, 0.2)'}`,
                      borderRadius: '2px',
                      marginBottom: '4px',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono, monospace)',
                    }}
                    title={error?.message || 'Rule passed'}
                  >
                    <span>{ruleId}</span>
                    <span style={{ color: hasError ? 'var(--c-danger, #ff2a4b)' : 'var(--c-accent-secondary, #00f0ff)' }}>
                      {hasError ? '✕ FAIL' : '✓ PASS'}
                    </span>
                  </div>
                );
              },
            )}

            {auditResult.warnings.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--c-warning, #ff6600)' }}>
                  WARNINGS:
                </span>
                {auditResult.warnings.map((w: PrefabValidationError, i: number) => (
                  <div key={i} style={{ fontSize: '10px', color: 'var(--c-warning, #ff6600)', marginTop: '2px' }}>
                    • {w.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center Column: Toolbar & Multi-Layer Canvas / Glyph Grid */}
        <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Top Bar: View Modes & Active Tool */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--c-surface-elevated, #111722)',
              border: '1px solid var(--c-border, #1c2638)',
              padding: '6px 12px',
              borderRadius: '2px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className={styles.toolButton}
                onClick={() => setViewMode('SPRITE')}
                style={{
                  background: viewMode === 'SPRITE' ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
                  color: viewMode === 'SPRITE' ? '#040609' : undefined,
                  fontWeight: 700,
                }}
              >
                SPRITE VIEW
              </button>
              <button
                type="button"
                className={styles.toolButton}
                onClick={() => setViewMode('GLYPH')}
                style={{
                  background: viewMode === 'GLYPH' ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
                  color: viewMode === 'GLYPH' ? '#040609' : undefined,
                  fontWeight: 700,
                }}
              >
                AUTOTILE GLYPHS
              </button>
              <button
                type="button"
                className={styles.toolButton}
                onClick={() => setViewMode('RAW')}
                style={{
                  background: viewMode === 'RAW' ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
                  color: viewMode === 'RAW' ? '#040609' : undefined,
                  fontWeight: 700,
                }}
              >
                RAW ASCII
              </button>

              {viewMode === 'SPRITE' && (
                <button
                  type="button"
                  className={styles.toolButton}
                  onClick={() => setIsAnimatingPreview((prev) => !prev)}
                  style={{
                    background: isAnimatingPreview ? 'var(--c-accent, #d8ff00)' : 'rgba(216, 255, 0, 0.15)',
                    color: isAnimatingPreview ? '#040609' : 'var(--c-accent, #d8ff00)',
                    borderColor: 'var(--c-accent, #d8ff00)',
                    fontWeight: 700,
                    marginLeft: '6px',
                  }}
                  title={isAnimatingPreview ? 'Pause animation preview' : 'Animate props and terminals in room preview'}
                >
                  {isAnimatingPreview ? '⏸ PAUSE ANIMATION' : '▶ ANIMATE PREVIEW'}
                </button>
              )}
            </div>

            {/* Zoom Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)', marginRight: '2px' }}>
                ZOOM:
              </span>
              {([1, 1.5, 2, 2.5] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  className={styles.toolButton}
                  onClick={() => setZoomScale(z)}
                  style={{
                    background: zoomScale === z ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
                    color: zoomScale === z ? '#040609' : undefined,
                    fontWeight: 700,
                    fontSize: '10px',
                    padding: '2px 6px',
                  }}
                >
                  {z}x
                </button>
              ))}
            </div>

            {/* Tools (P, B, G, O) */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['pencil', 'box', 'flood', 'portal'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={styles.toolButton}
                  onClick={() => setActiveTool(t)}
                  style={{
                    background: activeTool === t ? 'var(--c-accent, #d8ff00)' : undefined,
                    color: activeTool === t ? '#040609' : undefined,
                    fontWeight: 700,
                  }}
                  title={`Tool: ${t} (${t[0].toUpperCase()})`}
                >
                  {t.toUpperCase()} ({t[0].toUpperCase()})
                </button>
              ))}
            </div>
          </div>

          {/* Brushes Selector Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
              background: 'var(--c-surface-elevated, #111722)',
              border: '1px solid var(--c-border, #1c2638)',
              padding: '6px 12px',
              borderRadius: '2px',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)', marginRight: '6px' }}>
              TILES:
            </span>
            {(['#', '.', '+', 'V', '~'] as const).map((b) => (
              <button
                key={b}
                type="button"
                className={styles.toolButton}
                onClick={() => setSelectedBrush(b)}
                style={{
                  background: selectedBrush === b ? 'rgba(0, 240, 255, 0.2)' : undefined,
                  borderColor: selectedBrush === b ? 'var(--c-accent-secondary, #00f0ff)' : undefined,
                  fontWeight: 700,
                  minWidth: '32px',
                }}
              >
                {b === '#'
                  ? 'WALL (#)'
                  : b === '.'
                    ? 'FLOOR (.)'
                    : b === '+'
                      ? 'DOOR (+)'
                      : b === 'V'
                        ? 'VAULT (V)'
                        : 'DEAD-ZONE (~)'}
              </button>
            ))}

            <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)', margin: '0 6px' }}>
              PROPS:
            </span>
            {(
              [
                'PROP_DESK_CORNER',
                'PROP_LOCKER_WALL',
                'SURFACE_TABLE_TOP',
                'CONTAINER_RARE',
              ] as const
            ).map((p) => (
              <button
                key={p}
                type="button"
                className={styles.toolButton}
                onClick={() => setSelectedBrush(p)}
                style={{
                  background: selectedBrush === p ? 'rgba(216, 255, 0, 0.2)' : undefined,
                  borderColor: selectedBrush === p ? 'var(--c-accent, #d8ff00)' : undefined,
                  fontSize: '10px',
                }}
              >
                {p === 'PROP_DESK_CORNER'
                  ? 'WORKSTATION'
                  : p === 'PROP_LOCKER_WALL'
                    ? 'LOCKER'
                    : p === 'SURFACE_TABLE_TOP'
                      ? 'CRATE COVER'
                      : 'SAFE / RARE'}
              </button>
            ))}

            {/* Rotation indicator */}
            <button
              type="button"
              className={styles.toolButton}
              onClick={cycleOrientation}
              style={{
                marginLeft: 'auto',
                color: 'var(--c-accent, #d8ff00)',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 700,
              }}
              title="Press 'R' to rotate brush"
            >
              ROT: {brushOrientation} {ORIENTATION_ARROWS[brushOrientation]} (R)
            </button>
          </div>

          {/* Canvas or Glyph Grid Viewport */}
          <div
            style={{
              background: '#040609',
              border: '1px solid var(--c-border, #1c2638)',
              padding: '16px',
              borderRadius: '2px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'auto',
              minHeight: '560px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {viewMode === 'SPRITE' && (
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => {
                  setHoverPos(null);
                  setIsMouseDown(false);
                }}
                style={{
                  imageRendering: 'pixelated',
                  cursor: activeTool === 'portal' ? 'crosshair' : 'pointer',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
                }}
              />
            )}

            {viewMode === 'GLYPH' && autotiledGrid && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${prefabData.width}, ${Math.round(32 * zoomScale)}px)`,
                  gap: '1px',
                  background: '#1c2638',
                  padding: '1px',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: `${Math.max(12, Math.round(14 * zoomScale))}px`,
                  userSelect: 'none',
                }}
              >
                {autotiledGrid.resolved.map((row, y) =>
                  row.map((cell, x) => (
                    <div
                      key={`${x},${y}`}
                      onClick={() => paintCell(x, y)}
                      style={{
                        width: `${Math.round(32 * zoomScale)}px`,
                        height: `${Math.round(32 * zoomScale)}px`,
                        background: '#0a0e15',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color:
                          cell.glyph === '.'
                            ? '#36445d'
                            : cell.glyph.startsWith('+')
                              ? '#00f0ff'
                              : '#f4f4f0',
                      }}
                      title={`(${x}, ${y}): ${cell.frameKey}`}
                    >
                      {cell.glyph}
                    </div>
                  )),
                )}
              </div>
            )}

            {viewMode === 'RAW' && (
              <div
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: `${Math.round(14 * zoomScale)}px`,
                  lineHeight: `${Math.round(20 * zoomScale)}px`,
                  letterSpacing: `${Math.round(4 * zoomScale)}px`,
                  whiteSpace: 'pre',
                  color: 'var(--c-accent-secondary, #00f0ff)',
                }}
              >
                {prefabData.layout.join('\n')}
              </div>
            )}

            <div
              style={{
                marginTop: '12px',
                fontSize: '11px',
                color: 'var(--c-text-dim, #79889e)',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              POS: {hoverPos ? `${hoverPos.x}, ${hoverPos.y}` : '--, --'} | SIZE:{' '}
              {prefabData.width} × {prefabData.height} | ZOOM: {zoomScale}x ({Math.round(32 * zoomScale)}px) | TOOL:{' '}
              {activeTool.toUpperCase()} | PORTALS: {prefabData.portals.length} | PROPS:{' '}
              {propSpawnsWithOrient.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
