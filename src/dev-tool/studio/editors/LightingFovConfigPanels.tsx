'use client';

import type { LightingConfig } from '@shared/lighting-config';
import type { FovConfig } from '@shared/fov-config';
import styles from './editors.module.css';

interface LightingPanelProps {
  data: LightingConfig;
  onChange: (next: LightingConfig) => void;
}

export function LightingConfigPanel({ data, onChange }: LightingPanelProps) {
  const updateBloom = (patch: Partial<LightingConfig['bloom']>) => {
    onChange({ ...data, bloom: { ...data.bloom, ...patch } });
  };

  const updateFaction = (
    key: string,
    patch: Partial<LightingConfig['factionThemes'][string]>,
  ) => {
    onChange({
      ...data,
      factionThemes: {
        ...data.factionThemes,
        [key]: { ...data.factionThemes[key], ...patch },
      },
    });
  };

  const updateCondition = (
    key: string,
    patch: Partial<LightingConfig['sectorConditions'][string]>,
  ) => {
    onChange({
      ...data,
      sectorConditions: {
        ...data.sectorConditions,
        [key]: { ...data.sectorConditions[key], ...patch },
      },
    });
  };

  return (
    <>
      {/* Global HDR Bloom */}
      <div className={styles.fieldGroup}>
        <h3 className={styles.fieldGroupTitle}>Global Dual-Kawase HDR Bloom</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
          }}
        >
          <div className={styles.fieldRow}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={data.bloom?.enabled ?? true}
                onChange={(e) => updateBloom({ enabled: e.target.checked })}
              />
              Bloom Enabled
            </label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Base Intensity ({(data.bloom?.baseIntensity ?? 0.72).toFixed(2)})
            </label>
            <input
              type="range"
              min={0}
              max={3}
              step={0.02}
              value={data.bloom?.baseIntensity ?? 0.72}
              onChange={(e) => updateBloom({ baseIntensity: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Luminance Threshold ({(data.bloom?.threshold ?? 0.88).toFixed(2)})
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.02}
              value={data.bloom?.threshold ?? 0.88}
              onChange={(e) => updateBloom({ threshold: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* Faction Ambient Profiles */}
      <div className={styles.fieldGroup}>
        <h3 className={styles.fieldGroupTitle}>Faction Ambient Profiles</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(data.factionThemes || {}).map(([themeKey, prof]) => (
            <div
              key={themeKey}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 110px 1fr 1fr',
                gap: '10px',
                alignItems: 'center',
                padding: '6px 8px',
                background: 'rgba(11, 17, 30, 0.65)',
                border: '1px solid #1c2638',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#00f0ff' }}>{themeKey}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="color"
                  value={prof.colorHex}
                  onChange={(e) => updateFaction(themeKey, { colorHex: e.target.value })}
                />
                <span style={{ fontSize: '10px', fontFamily: 'monospace' }}>{prof.colorHex}</span>
              </div>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Intensity ({prof.intensity.toFixed(2)})</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={prof.intensity}
                  onChange={(e) => updateFaction(themeKey, { intensity: Number(e.target.value) })}
                />
              </div>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>
                  Bloom Mult ({prof.bloomMultiplier.toFixed(2)})
                </label>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.05}
                  value={prof.bloomMultiplier}
                  onChange={(e) =>
                    updateFaction(themeKey, { bloomMultiplier: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sector Condition Visual Profiles */}
      <div className={styles.fieldGroup}>
        <h3 className={styles.fieldGroupTitle}>Sector Condition Visual Profiles</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Object.entries(data.sectorConditions || {}).map(([condKey, cond]) => (
            <div
              key={condKey}
              style={{
                padding: '8px',
                background: 'rgba(11, 17, 30, 0.65)',
                border: '1px solid #1c2638',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#f4f4f0' }}>{condKey}</span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '8px',
                }}
              >
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    Ambient Scale ({cond.ambientScale.toFixed(2)})
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.05}
                    value={cond.ambientScale}
                    onChange={(e) =>
                      updateCondition(condKey, { ambientScale: Number(e.target.value) })
                    }
                  />
                </div>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    Bloom Mult ({cond.bloomMultiplier.toFixed(2)})
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.05}
                    value={cond.bloomMultiplier}
                    onChange={(e) =>
                      updateCondition(condKey, { bloomMultiplier: Number(e.target.value) })
                    }
                  />
                </div>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    Floor Pulse Hz ({cond.floorPulseHz.toFixed(1)})
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.1}
                    value={cond.floorPulseHz}
                    onChange={(e) =>
                      updateCondition(condKey, { floorPulseHz: Number(e.target.value) })
                    }
                  />
                </div>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>
                    Jitter ({(cond.jitter ?? 0).toFixed(2)})
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={cond.jitter ?? 0}
                    onChange={(e) => updateCondition(condKey, { jitter: Number(e.target.value) })}
                  />
                </div>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>Tint</label>
                  <input
                    type="color"
                    value={cond.tintHex}
                    onChange={(e) => updateCondition(condKey, { tintHex: e.target.value })}
                  />
                </div>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>Shadow Tint</label>
                  <input
                    type="color"
                    value={cond.shadowTintHex}
                    onChange={(e) => updateCondition(condKey, { shadowTintHex: e.target.value })}
                  />
                </div>
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>Floor Pulse Color</label>
                  <input
                    type="color"
                    value={cond.floorPulseHex}
                    onChange={(e) => updateCondition(condKey, { floorPulseHex: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

interface FovPanelProps {
  data: FovConfig;
  onChange: (next: FovConfig) => void;
}

export function FovConfigPanel({ data, onChange }: FovPanelProps) {
  const updateFov = (patch: Partial<FovConfig['fov']>) => {
    onChange({ ...data, fov: { ...data.fov, ...patch } });
  };
  const updateFow = (patch: Partial<FovConfig['fow']>) => {
    onChange({ ...data, fow: { ...data.fow, ...patch } });
  };
  const updateEntities = (patch: Partial<FovConfig['entities']>) => {
    onChange({ ...data, entities: { ...data.entities, ...patch } });
  };

  const voidPct = Math.round((data.fow?.voidRevealMax ?? 0.18) * 100);
  const activeStartPct = Math.round((data.fov?.activeBlendMin ?? 0.25) * 100);
  const activeFullPct = Math.round((data.fov?.activeBlendMax ?? 0.72) * 100);

  return (
    <>
      {/* 3-Zone Shroud Gradient Visualizer */}
      <div className={styles.fieldGroup}>
        <h3 className={styles.fieldGroupTitle}>3-Zone Shroud Gradient Visualizer</h3>
        <div
          style={{
            height: '28px',
            borderRadius: '2px',
            border: '1px solid #30415c',
            background: `linear-gradient(90deg, ${data.fow?.voidColorHex ?? '#000000'} 0%, ${data.fow?.tintHex ?? '#172136'} ${Math.max(5, voidPct)}%, ${data.fow?.tintHex ?? '#172136'} ${Math.max(voidPct + 5, activeStartPct)}%, #38bdf8 ${Math.max(activeStartPct + 5, activeFullPct)}%, #ffffff 100%)`,
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: '#94a3b8',
            marginTop: '4px',
          }}
        >
          <span>UNEXPLORED VOID (0.00 → {data.fow?.voidRevealMax?.toFixed(2)})</span>
          <span>EXPLORED FOW MEMORY (mask={data.fow?.exploredMaskValue?.toFixed(2)})</span>
          <span>ACTIVE FOV ({data.fov?.activeBlendMin?.toFixed(2)} → {data.fov?.activeBlendMax?.toFixed(2)})</span>
        </div>
      </div>

      {/* Panel 1: Active Field of View */}
      <div className={styles.fieldGroup}>
        <h3 className={styles.fieldGroupTitle}>Panel 1 — Active FOV Geometry & Edge Falloff</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
          }}
        >
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Base Sight Radius ({data.fov.baseRadius} tiles)</label>
            <input
              type="range"
              min={2}
              max={24}
              step={1}
              value={data.fov.baseRadius}
              onChange={(e) => updateFov({ baseRadius: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Min Sight Radius ({data.fov.minRadius} tiles)</label>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={data.fov.minRadius}
              onChange={(e) => updateFov({ minRadius: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              DARK_SUBNET Penalty ({data.fov.darkSubnetRadiusPenalty} tiles)
            </label>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={data.fov.darkSubnetRadiusPenalty}
              onChange={(e) => updateFov({ darkSubnetRadiusPenalty: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Mask Filter Mode</label>
            <select
              className={styles.fieldInput}
              value={data.fov.filterMode}
              onChange={(e) => updateFov({ filterMode: e.target.value as 'linear' | 'nearest' })}
            >
              <option value="linear">LINEAR (Smooth Bilinear Gradient)</option>
              <option value="nearest">NEAREST (Crisp Tile Boundary)</option>
            </select>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Light Gate Min ({data.fov.activeLightGateMin.toFixed(2)})
            </label>
            <input
              type="range"
              min={0}
              max={0.95}
              step={0.01}
              value={data.fov.activeLightGateMin}
              onChange={(e) => updateFov({ activeLightGateMin: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Light Gate Max ({data.fov.activeLightGateMax.toFixed(2)})
            </label>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.01}
              value={data.fov.activeLightGateMax}
              onChange={(e) => updateFov({ activeLightGateMax: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Active Blend Min ({data.fov.activeBlendMin.toFixed(2)})
            </label>
            <input
              type="range"
              min={0}
              max={0.95}
              step={0.01}
              value={data.fov.activeBlendMin}
              onChange={(e) => updateFov({ activeBlendMin: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Active Blend Max ({data.fov.activeBlendMax.toFixed(2)})
            </label>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.01}
              value={data.fov.activeBlendMax}
              onChange={(e) => updateFov({ activeBlendMax: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* Panel 2: Fog of War & Unexplored Void */}
      <div className={styles.fieldGroup}>
        <h3 className={styles.fieldGroupTitle}>Panel 2 — Fog of War (Memory Shroud) & Void</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
          }}
        >
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Explored Mask Value ({data.fow.exploredMaskValue.toFixed(2)})
            </label>
            <input
              type="range"
              min={0.05}
              max={0.9}
              step={0.01}
              value={data.fow.exploredMaskValue}
              onChange={(e) => updateFow({ exploredMaskValue: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Desaturation ({Math.round(data.fow.desaturation * 100)}%)
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={data.fow.desaturation}
              onChange={(e) => updateFow({ desaturation: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Brightness Multiplier ({data.fow.brightnessMultiplier.toFixed(2)})
            </label>
            <input
              type="range"
              min={0}
              max={4}
              step={0.05}
              value={data.fow.brightnessMultiplier}
              onChange={(e) => updateFow({ brightnessMultiplier: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Min Memory Scale ({data.fow.minMemoryScale.toFixed(2)})
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={data.fow.minMemoryScale}
              onChange={(e) => updateFow({ minMemoryScale: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Max Memory Scale ({data.fow.maxMemoryScale.toFixed(2)})
            </label>
            <input
              type="range"
              min={0.05}
              max={3}
              step={0.05}
              value={data.fow.maxMemoryScale}
              onChange={(e) => updateFow({ maxMemoryScale: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Emissive Retention ({Math.round(data.fow.emissiveRetention * 100)}%)
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={data.fow.emissiveRetention}
              onChange={(e) => updateFow({ emissiveRetention: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Void Reveal Min ({data.fow.voidRevealMin.toFixed(2)})
            </label>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={data.fow.voidRevealMin}
              onChange={(e) => updateFow({ voidRevealMin: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Void Reveal Max ({data.fow.voidRevealMax.toFixed(2)})
            </label>
            <input
              type="range"
              min={0.01}
              max={0.8}
              step={0.01}
              value={data.fow.voidRevealMax}
              onChange={(e) => updateFow({ voidRevealMax: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Memory Shroud Tint ({data.fow.tintHex})</label>
            <input
              type="color"
              value={data.fow.tintHex}
              onChange={(e) => updateFow({ tintHex: e.target.value })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Unexplored Void Color ({data.fow.voidColorHex})</label>
            <input
              type="color"
              value={data.fow.voidColorHex}
              onChange={(e) => updateFow({ voidColorHex: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Panel 3: Entity & Prop Visibility in FOW */}
      <div className={styles.fieldGroup}>
        <h3 className={styles.fieldGroupTitle}>Panel 3 — Entity & Prop Visibility in FOW</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
          }}
        >
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Remembered Prop Alpha ({data.entities.rememberedPropAlpha.toFixed(2)})
            </label>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={data.entities.rememberedPropAlpha}
              onChange={(e) => updateEntities({ rememberedPropAlpha: Number(e.target.value) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Searched Prop Multiplier ({data.entities.searchedPropAlphaMultiplier.toFixed(2)})
            </label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={data.entities.searchedPropAlphaMultiplier}
              onChange={(e) =>
                updateEntities({ searchedPropAlphaMultiplier: Number(e.target.value) })
              }
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>
              Unlit Fallback FOW Alpha ({data.entities.unlitFallbackFowAlpha.toFixed(2)})
            </label>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={data.entities.unlitFallbackFowAlpha}
              onChange={(e) => updateEntities({ unlitFallbackFowAlpha: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>
    </>
  );
}
