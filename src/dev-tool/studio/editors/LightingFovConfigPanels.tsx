'use client';

import type { LightingConfig } from '@shared/lighting-config';
import type { FovConfig } from '@shared/fov-config';
import { StudioFieldHint, StudioSliderField } from '../shared/StudioSliderField';
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
        <div className={styles.fieldGrid}>
          <div className={styles.fieldCell} style={{ justifyContent: 'center' }}>
            <div className={styles.fieldCellHeader}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  className={styles.fieldCheckbox}
                  checked={data.bloom?.enabled ?? true}
                  onChange={(e) => updateBloom({ enabled: e.target.checked })}
                />
                Bloom Enabled
              </label>
              <StudioFieldHint
                label="Bloom Enabled"
                tooltipTag="BLOOM"
                tooltip="Master toggle for the Dual-Kawase HDR post-processing bloom pass over emissive tiles and bright point lights."
              />
            </div>
          </div>

          <StudioSliderField
            label="Base Intensity"
            valueDisplay={(data.bloom?.baseIntensity ?? 0.72).toFixed(2)}
            tooltipTag="BLOOM"
            tooltip="Master HDR bloom glow intensity multiplier applied to bright emissive surfaces and point lights across all sectors."
            min={0}
            max={3}
            step={0.02}
            value={data.bloom?.baseIntensity ?? 0.72}
            onChange={(val) => updateBloom({ baseIntensity: val })}
          />

          <StudioSliderField
            label="Luminance Threshold"
            valueDisplay={(data.bloom?.threshold ?? 0.88).toFixed(2)}
            tooltipTag="BLOOM"
            tooltip="Minimum pixel brightness required before Dual-Kawase bloom triggers. Lower values make dimmer surfaces glow; higher values isolate intense neon highlights."
            min={0}
            max={2}
            step={0.02}
            value={data.bloom?.threshold ?? 0.88}
            onChange={(val) => updateBloom({ threshold: val })}
          />
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
                gridTemplateColumns: 'minmax(110px, 140px) minmax(90px, 110px) minmax(150px, 1fr) minmax(150px, 1fr)',
                gap: '12px',
                alignItems: 'center',
                padding: '8px 10px',
                background: 'rgba(11, 17, 30, 0.65)',
                border: '1px solid #1c2638',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#00f0ff', overflowWrap: 'anywhere' }}>
                {themeKey}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <input
                  type="color"
                  aria-label={`${themeKey} ambient color`}
                  value={prof.colorHex}
                  onChange={(e) => updateFaction(themeKey, { colorHex: e.target.value })}
                />
                <span style={{ fontSize: '10px', fontFamily: 'monospace' }}>{prof.colorHex}</span>
              </div>

              <StudioSliderField
                label="Intensity"
                valueDisplay={prof.intensity.toFixed(2)}
                tooltipTag="LIGHT"
                tooltip={`Baseline ambient fill-light strength for ${themeKey} in active FOV, scaling shadow floor and unlit surface visibility.`}
                min={0}
                max={1}
                step={0.01}
                value={prof.intensity}
                onChange={(val) => updateFaction(themeKey, { intensity: val })}
              />

              <StudioSliderField
                label="Bloom Mult"
                valueDisplay={prof.bloomMultiplier.toFixed(2)}
                tooltipTag="BLOOM"
                tooltip={`Per-faction multiplier on Global HDR Bloom intensity when rendering ${themeKey} floors.`}
                min={0}
                max={3}
                step={0.05}
                value={prof.bloomMultiplier}
                onChange={(val) => updateFaction(themeKey, { bloomMultiplier: val })}
              />
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
                padding: '10px',
                background: 'rgba(11, 17, 30, 0.65)',
                border: '1px solid #1c2638',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#f4f4f0' }}>{condKey}</span>
              <div className={styles.fieldGridCompact}>
                <StudioSliderField
                  label="Ambient Scale"
                  valueDisplay={cond.ambientScale.toFixed(2)}
                  tooltipTag="COND"
                  tooltip={`Multiplier on the active faction ambient intensity while ${condKey} is active (e.g. 0.35 dims DARK_SUBNET).`}
                  min={0}
                  max={3}
                  step={0.05}
                  value={cond.ambientScale}
                  onChange={(val) => updateCondition(condKey, { ambientScale: val })}
                />

                <StudioSliderField
                  label="Bloom Mult"
                  valueDisplay={cond.bloomMultiplier.toFixed(2)}
                  tooltipTag="COND"
                  tooltip={`Additional HDR bloom multiplier applied while ${condKey} is active.`}
                  min={0}
                  max={3}
                  step={0.05}
                  value={cond.bloomMultiplier}
                  onChange={(val) => updateCondition(condKey, { bloomMultiplier: val })}
                />

                <StudioSliderField
                  label="Floor Pulse Hz"
                  valueDisplay={cond.floorPulseHz.toFixed(1)}
                  tooltipTag="COND"
                  tooltip={`Oscillation frequency (cycles/sec) for animated floor vein glow waves under ${condKey}; 0 disables pulsing.`}
                  min={0}
                  max={5}
                  step={0.1}
                  value={cond.floorPulseHz}
                  onChange={(val) => updateCondition(condKey, { floorPulseHz: val })}
                />

                <StudioSliderField
                  label="Jitter"
                  valueDisplay={(cond.jitter ?? 0).toFixed(2)}
                  tooltipTag="COND"
                  tooltip={`Temporal shadow/lighting flicker amplitude under ${condKey} (used for unstable grid conditions like OVERCLOCKED_GRID).`}
                  min={0}
                  max={2}
                  step={0.05}
                  value={cond.jitter ?? 0}
                  onChange={(val) => updateCondition(condKey, { jitter: val })}
                />

                <div className={styles.fieldCell}>
                  <div className={styles.fieldCellHeader}>
                    <span className={styles.fieldCellLabel}>Tint ({cond.tintHex})</span>
                    <StudioFieldHint
                      label="Tint"
                      tooltipTag="COND"
                      tooltip={`Global color tint applied to lit surfaces under ${condKey}.`}
                    />
                  </div>
                  <input
                    type="color"
                    aria-label={`${condKey} tint color`}
                    value={cond.tintHex}
                    onChange={(e) => updateCondition(condKey, { tintHex: e.target.value })}
                  />
                </div>

                <div className={styles.fieldCell}>
                  <div className={styles.fieldCellHeader}>
                    <span className={styles.fieldCellLabel}>Shadow Tint ({cond.shadowTintHex})</span>
                    <StudioFieldHint
                      label="Shadow Tint"
                      tooltipTag="COND"
                      tooltip={`Bounce color applied into raymarched shadow pockets under ${condKey}.`}
                    />
                  </div>
                  <input
                    type="color"
                    aria-label={`${condKey} shadow tint color`}
                    value={cond.shadowTintHex}
                    onChange={(e) => updateCondition(condKey, { shadowTintHex: e.target.value })}
                  />
                </div>

                <div className={styles.fieldCell}>
                  <div className={styles.fieldCellHeader}>
                    <span className={styles.fieldCellLabel}>Floor Pulse Color ({cond.floorPulseHex})</span>
                    <StudioFieldHint
                      label="Floor Pulse Color"
                      tooltipTag="COND"
                      tooltip={`Emissive wave color used when Floor Pulse Hz > 0 under ${condKey}.`}
                    />
                  </div>
                  <input
                    type="color"
                    aria-label={`${condKey} floor pulse color`}
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
            flexWrap: 'wrap',
            gap: '8px',
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
        <div className={styles.fieldGrid}>
          <StudioSliderField
            label="Base Sight Radius"
            valueDisplay={`${data.fov.baseRadius} tiles`}
            tooltipTag="FOV"
            tooltip="Default player line-of-sight radius in tiles before sector condition penalties or firmware/augment sight modifiers."
            min={2}
            max={24}
            step={1}
            value={data.fov.baseRadius}
            onChange={(val) => updateFov({ baseRadius: val })}
          />

          <StudioSliderField
            label="Min Sight Radius"
            valueDisplay={`${data.fov.minRadius} tiles`}
            tooltipTag="FOV"
            tooltip="Hard minimum clamp on player sight radius in tiles after penalties such as DARK_SUBNET."
            min={1}
            max={12}
            step={1}
            value={data.fov.minRadius}
            onChange={(val) => updateFov({ minRadius: val })}
          />

          <StudioSliderField
            label="DARK_SUBNET Penalty"
            valueDisplay={`${data.fov.darkSubnetRadiusPenalty} tiles`}
            tooltipTag="FOV"
            tooltip="Number of tiles subtracted from Base Sight Radius while exploring a floor with the DARK_SUBNET sector condition."
            min={0}
            max={10}
            step={1}
            value={data.fov.darkSubnetRadiusPenalty}
            onChange={(val) => updateFov({ darkSubnetRadiusPenalty: val })}
          />

          <div className={styles.fieldCell}>
            <div className={styles.fieldCellHeader}>
              <label htmlFor="fov-filter-mode" className={styles.fieldCellLabel}>
                Mask Filter Mode
              </label>
              <StudioFieldHint
                label="Mask Filter Mode"
                tooltipTag="FOV"
                tooltip="GPU texture filtering on the FOV mask: LINEAR creates smooth bilinear vision falloff across tile edges; NEAREST snaps crisply to tile boundaries."
              />
            </div>
            <select
              id="fov-filter-mode"
              className={styles.fieldSelect}
              value={data.fov.filterMode}
              onChange={(e) => updateFov({ filterMode: e.target.value as 'linear' | 'nearest' })}
            >
              <option value="linear">LINEAR (Smooth Bilinear Gradient)</option>
              <option value="nearest">NEAREST (Crisp Tile Boundary)</option>
            </select>
          </div>

          <StudioSliderField
            label="Light Gate Min"
            valueDisplay={data.fov.activeLightGateMin.toFixed(2)}
            tooltipTag="FOV"
            tooltip="Lower smoothstep threshold on the FOV mask where dynamic point lights and diffuse/specular lighting begin illuminating active sight."
            min={0}
            max={0.95}
            step={0.01}
            value={data.fov.activeLightGateMin}
            onChange={(val) => updateFov({ activeLightGateMin: val })}
          />

          <StudioSliderField
            label="Light Gate Max"
            valueDisplay={data.fov.activeLightGateMax.toFixed(2)}
            tooltipTag="FOV"
            tooltip="Upper smoothstep threshold on the FOV mask where dynamic point lights reach 100% illumination."
            min={0.05}
            max={1}
            step={0.01}
            value={data.fov.activeLightGateMax}
            onChange={(val) => updateFov({ activeLightGateMax: val })}
          />

          <StudioSliderField
            label="Active Blend Min"
            valueDisplay={data.fov.activeBlendMin.toFixed(2)}
            tooltipTag="FOV"
            tooltip="Lower smoothstep threshold where explored Fog-of-War memory silhouette starts blending into fully lit Active FOV."
            min={0}
            max={0.95}
            step={0.01}
            value={data.fov.activeBlendMin}
            onChange={(val) => updateFov({ activeBlendMin: val })}
          />

          <StudioSliderField
            label="Active Blend Max"
            valueDisplay={data.fov.activeBlendMax.toFixed(2)}
            tooltipTag="FOV"
            tooltip="Upper smoothstep threshold where pixels complete the transition into full Active FOV color."
            min={0.05}
            max={1}
            step={0.01}
            value={data.fov.activeBlendMax}
            onChange={(val) => updateFov({ activeBlendMax: val })}
          />
        </div>
      </div>

      {/* Panel 2: Fog of War & Unexplored Void */}
      <div className={styles.fieldGroup}>
        <h3 className={styles.fieldGroupTitle}>Panel 2 — Fog of War (Memory Shroud) & Void</h3>
        <div className={styles.fieldGrid}>
          <StudioSliderField
            label="Explored Mask Value"
            valueDisplay={data.fow.exploredMaskValue.toFixed(2)}
            tooltipTag="FOW"
            tooltip="Normalized mask value (0.05–0.90) written to the FOV mask texture for previously explored tiles outside current line of sight."
            min={0.05}
            max={0.9}
            step={0.01}
            value={data.fow.exploredMaskValue}
            onChange={(val) => updateFow({ exploredMaskValue: val })}
          />

          <StudioSliderField
            label="Desaturation"
            valueDisplay={`${Math.round(data.fow.desaturation * 100)}%`}
            tooltipTag="FOW"
            tooltip="Color desaturation applied to explored Fog-of-War tiles (0% keeps original color; 100% reduces tiles to monochrome memory silhouettes)."
            min={0}
            max={1}
            step={0.01}
            value={data.fow.desaturation}
            onChange={(val) => updateFow({ desaturation: val })}
          />

          <StudioSliderField
            label="Brightness Multiplier"
            valueDisplay={data.fow.brightnessMultiplier.toFixed(2)}
            tooltipTag="FOW"
            tooltip="Master brightness multiplier applied to explored Fog-of-War memory tiles before min/max clamping."
            min={0}
            max={4}
            step={0.05}
            value={data.fow.brightnessMultiplier}
            onChange={(val) => updateFow({ brightnessMultiplier: val })}
          />

          <StudioSliderField
            label="Min Memory Scale"
            valueDisplay={data.fow.minMemoryScale.toFixed(2)}
            tooltipTag="FOW"
            tooltip="Minimum brightness floor for explored Fog-of-War tiles so memory geometry remains readable even in dark sectors."
            min={0}
            max={2}
            step={0.05}
            value={data.fow.minMemoryScale}
            onChange={(val) => updateFow({ minMemoryScale: val })}
          />

          <StudioSliderField
            label="Max Memory Scale"
            valueDisplay={data.fow.maxMemoryScale.toFixed(2)}
            tooltipTag="FOW"
            tooltip="Maximum brightness ceiling for explored Fog-of-War tiles so out-of-sight memory never outshines active vision."
            min={0.05}
            max={3}
            step={0.05}
            value={data.fow.maxMemoryScale}
            onChange={(val) => updateFow({ maxMemoryScale: val })}
          />

          <StudioSliderField
            label="Emissive Retention"
            valueDisplay={`${Math.round(data.fow.emissiveRetention * 100)}%`}
            tooltipTag="FOW"
            tooltip="Fraction of self-illuminated emissive pixels (neon strips, terminals, screens) preserved inside explored Fog-of-War memory."
            min={0}
            max={1}
            step={0.01}
            value={data.fow.emissiveRetention}
            onChange={(val) => updateFow({ emissiveRetention: val })}
          />

          <StudioSliderField
            label="Void Reveal Min"
            valueDisplay={data.fow.voidRevealMin.toFixed(2)}
            tooltipTag="FOW"
            tooltip="Outer FOV mask threshold where pure unexplored void starts fading into explored Fog-of-War memory."
            min={0}
            max={0.5}
            step={0.01}
            value={data.fow.voidRevealMin}
            onChange={(val) => updateFow({ voidRevealMin: val })}
          />

          <StudioSliderField
            label="Void Reveal Max"
            valueDisplay={data.fow.voidRevealMax.toFixed(2)}
            tooltipTag="FOW"
            tooltip="Inner FOV mask threshold where the unexplored void transition reaches full explored memory opacity."
            min={0.01}
            max={0.8}
            step={0.01}
            value={data.fow.voidRevealMax}
            onChange={(val) => updateFow({ voidRevealMax: val })}
          />

          <div className={styles.fieldCell}>
            <div className={styles.fieldCellHeader}>
              <span className={styles.fieldCellLabel}>Memory Shroud Tint ({data.fow.tintHex})</span>
              <StudioFieldHint
                label="Memory Shroud Tint"
                tooltipTag="FOW"
                tooltip="RGB tint color multiplied into desaturated explored Fog-of-War tiles."
              />
            </div>
            <input
              type="color"
              aria-label="Memory Shroud Tint"
              value={data.fow.tintHex}
              onChange={(e) => updateFow({ tintHex: e.target.value })}
            />
          </div>

          <div className={styles.fieldCell}>
            <div className={styles.fieldCellHeader}>
              <span className={styles.fieldCellLabel}>Unexplored Void Color ({data.fow.voidColorHex})</span>
              <StudioFieldHint
                label="Unexplored Void Color"
                tooltipTag="FOW"
                tooltip="Solid shroud color rendered over completely unexplored map regions."
              />
            </div>
            <input
              type="color"
              aria-label="Unexplored Void Color"
              value={data.fow.voidColorHex}
              onChange={(e) => updateFow({ voidColorHex: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Panel 3: Entity & Prop Visibility in FOW */}
      <div className={styles.fieldGroup}>
        <h3 className={styles.fieldGroupTitle}>Panel 3 — Entity & Prop Visibility in FOW</h3>
        <div className={styles.fieldGrid}>
          <StudioSliderField
            label="Remembered Prop Alpha"
            valueDisplay={data.entities.rememberedPropAlpha.toFixed(2)}
            tooltipTag="ENTITY"
            tooltip="Base sprite opacity for remembered props and ground items visible inside explored Fog-of-War."
            min={0.05}
            max={1}
            step={0.05}
            value={data.entities.rememberedPropAlpha}
            onChange={(val) => updateEntities({ rememberedPropAlpha: val })}
          />

          <StudioSliderField
            label="Searched Prop Multiplier"
            valueDisplay={data.entities.searchedPropAlphaMultiplier.toFixed(2)}
            tooltipTag="ENTITY"
            tooltip="Additional opacity multiplier applied to already-searched containers and props (stacks with Remembered Prop Alpha)."
            min={0.1}
            max={1}
            step={0.05}
            value={data.entities.searchedPropAlphaMultiplier}
            onChange={(val) => updateEntities({ searchedPropAlphaMultiplier: val })}
          />

          <StudioSliderField
            label="Unlit Fallback FOW Alpha"
            valueDisplay={data.entities.unlitFallbackFowAlpha.toFixed(2)}
            tooltipTag="ENTITY"
            tooltip="Fallback tile and prop opacity in explored Fog-of-War when the deferred lighting shader is disabled."
            min={0.05}
            max={1}
            step={0.05}
            value={data.entities.unlitFallbackFowAlpha}
            onChange={(val) => updateEntities({ unlitFallbackFowAlpha: val })}
          />
        </div>
      </div>
    </>
  );
}
