'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { RoomPrefabTemplate, PropAnchorTag } from '@/game/generation/prefabs/types';
import { Grid } from '@/engine/grid/grid';
import { AutotileSolver } from '@/game/generation/autotile-solver';
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

export interface EditorPropSpawn {
  x: number;
  y: number;
  anchorType: PropAnchorTag;
  orientation: CardinalOrientation;
  guaranteedTemplate?: string;
}

export function PrefabEditor({ name, isNew, cloneFrom, onRefresh }: Props) {
  const [prefabData, setPrefabData] = useState<RoomPrefabTemplate | null>(null);
  const [propSpawnsWithOrient, setPropSpawnsWithOrient] = useState<EditorPropSpawn[]>([]);
  const [selectedBrush, setSelectedBrush] = useState<BrushType>('#');
  const [brushOrientation, setBrushOrientation] = useState<CardinalOrientation>('NORTH');
  const [autotilePreview, setAutotilePreview] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

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
              orientation: 'NORTH',
            })),
          );
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
              orientation: 'NORTH',
            })),
          );
        })
        .catch(() => setErrors(['Failed to load prefab']));
    } else {
      // Default empty 12x12 room
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
  }, [name, isNew, cloneFrom]);

  // Rotate brush orientation helper
  const cycleOrientation = useCallback(() => {
    setBrushOrientation((prev) => ORIENTATION_CYCLE[prev]);
  }, []);

  // 'R' / 'r' hotkey handler for tile/brush rotation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        cycleOrientation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cycleOrientation]);

  // Real-time autotile glyph calculation
  const autotiledGrid = useMemo(() => {
    if (!autotilePreview || !prefabData) return null;
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
    return resolved;
  }, [autotilePreview, prefabData]);

  // Handle cell click (painting brush)
  const handleCellClick = (x: number, y: number) => {
    if (!prefabData) return;

    if (
      selectedBrush === '#' ||
      selectedBrush === '.' ||
      selectedBrush === '+' ||
      selectedBrush === 'V' ||
      selectedBrush === '~'
    ) {
      const newLayout = [...prefabData.layout];
      const rowChars = (newLayout[y] || '').split('');
      while (rowChars.length < prefabData.width) rowChars.push('.');
      rowChars[x] = selectedBrush;
      newLayout[y] = rowChars.join('');

      // If replacing a tile with wall, remove any prop spawn there
      const filteredSpawns =
        selectedBrush === '#'
          ? propSpawnsWithOrient.filter((p) => p.x !== x || p.y !== y)
          : propSpawnsWithOrient;

      setPrefabData({ ...prefabData, layout: newLayout });
      setPropSpawnsWithOrient(filteredSpawns);
    } else {
      // Placing prop anchor
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
  };

  // Handle cell right click (removing prop)
  const handleCellContextMenu = (e: React.MouseEvent, x: number, y: number) => {
    e.preventDefault();
    setPropSpawnsWithOrient((prev) => prev.filter((p) => p.x !== x || p.y !== y));
  };

  // Save handler
  const handleSave = async () => {
    if (!prefabData) return;
    setSaveStatus('saving');
    setErrors([]);

    const payload: RoomPrefabTemplate = {
      ...prefabData,
      propSpawns: propSpawnsWithOrient.map((p) => ({
        x: p.x,
        y: p.y,
        anchorType: p.anchorType,
        guaranteedTemplate: p.guaranteedTemplate,
      })),
    };

    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/dev/gamedata/prefabs' : `/api/dev/gamedata/prefabs/${name}`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save prefab');
      }

      setSaveStatus('success');
      onRefresh?.();
    } catch (err) {
      setSaveStatus('error');
      setErrors([err instanceof Error ? err.message : 'Save error']);
    }
  };

  if (!prefabData) {
    return <div className={styles.editor}>Loading prefab...</div>;
  }

  const propSpawnsMap = new Map<string, EditorPropSpawn>();
  for (const p of propSpawnsWithOrient) {
    propSpawnsMap.set(`${p.x},${p.y}`, p);
  }

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>
          {isNew ? 'New Prefab Template' : `PREFAB EDITOR: ${name}.json`}
        </h2>
        <div className={styles.buttonRow}>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Prefab'}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className={styles.fieldGroup}>
          {errors.map((e, i) => (
            <div key={i} className={styles.errorMessage}>
              {e}
            </div>
          ))}
        </div>
      )}
      {saveStatus === 'success' && (
        <div className={styles.successMessage}>Prefab saved successfully!</div>
      )}

      {/* Prefab Metadata Fields */}
      <div className={styles.fieldGroup}>
        <div className={styles.fieldGroupHeader}>
          <span className={styles.fieldGroupTitle}>Room Configuration</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>ID:</span>
          <input
            className={styles.fieldInput}
            value={prefabData.id}
            onChange={(e) => setPrefabData({ ...prefabData, id: e.target.value })}
            placeholder="e.g. freight-bay"
            disabled={!isNew}
          />
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Name:</span>
          <input
            className={styles.fieldInput}
            value={prefabData.name}
            onChange={(e) => setPrefabData({ ...prefabData, name: e.target.value })}
            placeholder="e.g. Freight Loading Bay"
          />
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Faction:</span>
          <select
            className={styles.fieldSelect}
            value={prefabData.faction}
            onChange={(e) =>
              setPrefabData({
                ...prefabData,
                faction: e.target.value as RoomPrefabTemplate['faction'],
              })
            }
          >
            <option value="traxus">Traxus</option>
            <option value="cyberacme">CyberAcme</option>
            <option value="sekiguchi">Sekiguchi</option>
            <option value="nucaloric">NuCaloric</option>
          </select>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Faraday Shielded:</span>
          <input
            type="checkbox"
            className={styles.fieldCheckbox}
            checked={Boolean(prefabData.faradayShielded)}
            onChange={(e) =>
              setPrefabData({ ...prefabData, faradayShielded: e.target.checked })
            }
          />
        </div>
      </div>

      {/* Brush Toolkit & Toolbar (DIRECTIONAL-TILEMAPS.md §7.1) */}
      <div className={styles.prefabToolbar}>
        <span style={{ fontSize: '11px', color: '#00f0ff', marginRight: '8px' }}>
          BRUSH TOOLKIT:
        </span>
        <button
          className={`${styles.brushButton} ${selectedBrush === '#' ? styles.brushButtonActive : ''}`}
          onClick={() => setSelectedBrush('#')}
        >
          [# WALL]
        </button>
        <button
          className={`${styles.brushButton} ${selectedBrush === '.' ? styles.brushButtonActive : ''}`}
          onClick={() => setSelectedBrush('.')}
        >
          [. FLOOR]
        </button>
        <button
          className={`${styles.brushButton} ${selectedBrush === '+' ? styles.brushButtonActive : ''}`}
          onClick={() => setSelectedBrush('+')}
        >
          [+ DOOR]
        </button>
        <button
          className={`${styles.brushButton} ${selectedBrush === 'V' ? styles.brushButtonActive : ''}`}
          onClick={() => setSelectedBrush('V')}
        >
          [V VAULT]
        </button>
        <button
          className={`${styles.brushButton} ${selectedBrush === '~' ? styles.brushButtonActive : ''}`}
          onClick={() => setSelectedBrush('~')}
        >
          [~ HAZARD]
        </button>
        <button
          className={`${styles.brushButton} ${selectedBrush === 'PROP_DESK_CORNER' ? styles.brushButtonActive : ''}`}
          onClick={() => setSelectedBrush('PROP_DESK_CORNER')}
        >
          [PROP DESK]
        </button>
        <button
          className={`${styles.brushButton} ${selectedBrush === 'PROP_LOCKER_WALL' ? styles.brushButtonActive : ''}`}
          onClick={() => setSelectedBrush('PROP_LOCKER_WALL')}
        >
          [PROP LOCKER]
        </button>
        <button
          className={`${styles.brushButton} ${selectedBrush === 'CONTAINER_RARE' ? styles.brushButtonActive : ''}`}
          onClick={() => setSelectedBrush('CONTAINER_RARE')}
        >
          [CONTAINER RARE]
        </button>

        {/* Orientation selector and R hotkey indicator */}
        <button
          className={styles.brushButton}
          onClick={cycleOrientation}
          title="Press 'R' key while hovering over canvas to rotate"
          style={{ borderColor: '#ff9500', color: '#ff9500', marginLeft: 'auto' }}
        >
          [ROTATION: {ORIENTATION_DEGREES[brushOrientation]}° {ORIENTATION_ARROWS[brushOrientation]} ↻ (R)]
        </button>

        {/* Autotile Preview Toggle */}
        <button
          className={`${styles.brushButton} ${autotilePreview ? styles.brushButtonActive : ''}`}
          onClick={() => setAutotilePreview((prev) => !prev)}
          style={{ borderColor: autotilePreview ? '#00f0ff' : '#666' }}
        >
          [AUTOTILE PREVIEW {autotilePreview ? '✓' : '✗'}]
        </button>
      </div>

      {/* Grid Canvas */}
      <div className={styles.prefabCanvasWrapper}>
        <div
          className={styles.prefabGrid}
          style={{
            gridTemplateColumns: `repeat(${prefabData.width}, 32px)`,
          }}
        >
          {Array.from({ length: prefabData.height }).map((_, y) => {
            const row = prefabData.layout[y] || '';
            return Array.from({ length: prefabData.width }).map((_, x) => {
              const char = row[x] || '.';
              const key = `${x},${y}`;
              const prop = propSpawnsMap.get(key);

              // Resolve visual character and CSS classes
              let cellClass = styles.cellFloor;
              if (char === '#') cellClass = styles.cellWall;
              else if (char === '+') cellClass = styles.cellDoor;
              else if (char === 'V') cellClass = styles.cellVault;
              else if (char === '~') cellClass = styles.cellHazard;

              let displayChar = char;
              if (autotilePreview && autotiledGrid) {
                const auto = autotiledGrid[y]?.[x];
                if (auto) {
                  displayChar = auto.glyph;
                }
              }

              // Determine prop abbreviation
              let propBadge = '';
              if (prop) {
                const arrow = ORIENTATION_ARROWS[prop.orientation];
                switch (prop.anchorType) {
                  case 'PROP_DESK_CORNER':
                    propBadge = `T${arrow}`;
                    break;
                  case 'PROP_LOCKER_WALL':
                    propBadge = `L${arrow}`;
                    break;
                  case 'CONTAINER_RARE':
                    propBadge = `C${arrow}`;
                    break;
                  case 'SURFACE_TABLE_TOP':
                    propBadge = `S${arrow}`;
                    break;
                }
              }

              return (
                <div
                  key={key}
                  className={`${styles.prefabCell} ${cellClass}`}
                  onClick={() => handleCellClick(x, y)}
                  onContextMenu={(e) => handleCellContextMenu(e, x, y)}
                  title={`(${x}, ${y}) - ${char}${prop ? ` [${prop.anchorType} ${prop.orientation}]` : ''}`}
                >
                  {displayChar}
                  {prop && (
                    <div className={styles.propOverlay}>
                      <span style={{ color: '#00f0ff' }}>[{propBadge}]</span>
                    </div>
                  )}
                </div>
              );
            });
          })}
        </div>
      </div>
      <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px' }}>
        * Left-click to paint with selected brush. Right-click on a cell to remove placed prop anchors. Press [R] to cycle orientation.
      </div>
    </div>
  );
}
