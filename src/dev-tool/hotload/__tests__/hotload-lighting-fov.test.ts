import { describe, it, expect, beforeEach } from 'vitest';
import lightingJson from '@/game/config/lighting.json';
import fovJson from '@/game/config/fov.json';
import {
  LightingConfigSchema,
  DEFAULT_LIGHTING_CONFIG,
  setActiveLightingConfig,
} from '@shared/lighting-config';
import {
  FovConfigSchema,
  DEFAULT_FOV_CONFIG,
  setActiveFovConfig,
} from '@shared/fov-config';
import {
  resolveFactionAmbientProfile,
  resolveSectorConditionProfile,
} from '@/rendering/lighting/types';
import { GBufferPass } from '@/rendering/lighting/gbuffer-pass';

describe('Lighting & FOV/FOW Config Hotloading (HOTLOAD-04)', () => {
  beforeEach(() => {
    setActiveLightingConfig(structuredClone(DEFAULT_LIGHTING_CONFIG));
    setActiveFovConfig(structuredClone(DEFAULT_FOV_CONFIG));
  });

  it('validates canonical lighting.json and fov.json against Zod schemas', () => {
    const lParsed = LightingConfigSchema.safeParse(lightingJson);
    expect(lParsed.success).toBe(true);

    const fParsed = FovConfigSchema.safeParse(fovJson);
    expect(fParsed.success).toBe(true);
  });

  it('resolveFactionAmbientProfile and resolveSectorConditionProfile read dynamically from active LightingConfig', () => {
    const nextLighting = structuredClone(DEFAULT_LIGHTING_CONFIG);
    nextLighting.factionThemes.cyberacme = {
      colorHex: '#ff00aa',
      intensity: 0.77,
      bloomMultiplier: 2.5,
    };
    nextLighting.sectorConditions.THERMAL_SURGE = {
      ...nextLighting.sectorConditions.THERMAL_SURGE,
      ambientScale: 1.8,
      floorPulseHz: 2.4,
      floorPulseHex: '#00ff88',
    };
    setActiveLightingConfig(nextLighting);

    const faction = resolveFactionAmbientProfile('cyberacme');
    expect(faction.colorHex).toBe('#ff00aa');
    expect(faction.intensity).toBe(0.77);
    expect(faction.bloomMultiplier).toBe(2.5);

    const cond = resolveSectorConditionProfile('THERMAL_SURGE');
    expect(cond?.ambientScale).toBe(1.8);
    expect(cond?.floorPulseHz).toBe(2.4);
  });

  it('GBufferPass.updateFovMask encodes exploredMaskValue from active FovConfig', () => {
    const gbuf = new GBufferPass(4, 4);
    const fovCfg = structuredClone(DEFAULT_FOV_CONFIG);
    fovCfg.fow.exploredMaskValue = 0.5; // 128
    setActiveFovConfig(fovCfg);

    const fovSet = new Set(['1,1']);
    const exploredSet = new Set(['1,1', '2,2']);
    gbuf.updateFovMask(4, 4, fovSet, exploredSet);

    // Internal buffer check via private access for verification
    const rawBuf = (gbuf as unknown as { fovMaskData: Uint8Array }).fovMaskData;
    const activeIdx = (1 * 4 + 1) * 4;
    const exploredIdx = (2 * 4 + 2) * 4;
    const voidIdx = 0;

    expect(rawBuf[activeIdx]).toBe(255);
    expect(rawBuf[exploredIdx]).toBe(128);
    expect(rawBuf[voidIdx]).toBe(0);
    gbuf.destroy();
  });
});
