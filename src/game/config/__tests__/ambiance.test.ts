import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAmbianceConfig,
  setAmbianceConfig,
  resolveAmbianceForFloor,
  AmbianceConfig,
} from '../ambiance';

const DEFAULT_MOCK_CONFIG: AmbianceConfig = {
  scenes: {
    mainMenu: { cueId: 'amb_main_menu', description: 'Main Menu drone' },
    hub: { cueId: 'amb_hub_deck', description: 'Hub ambient' },
  },
  depthBands: [
    {
      id: 'band_1',
      label: 'CORRUPTED_DATA',
      floorRange: { min: 1, max: 5 },
      cueId: 'amb_band_1_corrupted',
      baseVolume: 0.6,
      description: 'Band 1',
    },
    {
      id: 'band_2',
      label: 'STATIC_HORRORS',
      floorRange: { min: 6, max: 10 },
      cueId: 'amb_band_2_static',
      baseVolume: 0.65,
      description: 'Band 2',
    },
    {
      id: 'band_3',
      label: 'LOGIC_BREAKERS',
      floorRange: { min: 11, max: 15 },
      cueId: 'amb_band_3_logic',
      baseVolume: 0.7,
      description: 'Band 3',
    },
  ],
  sectorConditions: [
    {
      condition: 'NOMINAL',
      cutoffMultiplier: 1.0,
      resonanceQ: 1.0,
    },
    {
      condition: 'DARK_SUBNET',
      cutoffMultiplier: 0.6,
      resonanceQ: 2.5,
    },
    {
      condition: 'SPECIAL_STORM',
      cueId: 'amb_custom_storm_track',
      cutoffMultiplier: 0.8,
      resonanceQ: 3.0,
    },
  ],
  ducking: {
    stabilityAnchorCutoffHz: 380,
    pauseMenuCutoffHz: 380,
    duckingRampDurationSec: 0.25,
    crossfadeDurationSec: 0.8,
  },
};

describe('Ambiance Configuration System', () => {
  beforeEach(() => {
    setAmbianceConfig({ ...DEFAULT_MOCK_CONFIG });
  });

  it('provides the current ambiance configuration', () => {
    const config = getAmbianceConfig();
    expect(config.scenes.mainMenu.cueId).toBe('amb_main_menu');
    expect(config.scenes.hub.cueId).toBe('amb_hub_deck');
    expect(config.depthBands.length).toBe(3);
  });

  it('updates configuration via setAmbianceConfig', () => {
    const updated = {
      ...DEFAULT_MOCK_CONFIG,
      scenes: {
        ...DEFAULT_MOCK_CONFIG.scenes,
        mainMenu: { cueId: 'amb_custom_menu' },
      },
    };
    setAmbianceConfig(updated);
    expect(getAmbianceConfig().scenes.mainMenu.cueId).toBe('amb_custom_menu');
  });

  it('resolves floor 1 to depth band 1', () => {
    const resolved = resolveAmbianceForFloor(1);
    expect(resolved.cueId).toBe('amb_band_1_corrupted');
    expect(resolved.depthBand).toBe('CORRUPTED_DATA');
    expect(resolved.baseVolume).toBe(0.6);
    expect(resolved.cutoffMultiplier).toBe(1.0);
    expect(resolved.resonanceQ).toBe(1.0);
  });

  it('resolves floor 7 to depth band 2', () => {
    const resolved = resolveAmbianceForFloor(7);
    expect(resolved.cueId).toBe('amb_band_2_static');
    expect(resolved.depthBand).toBe('STATIC_HORRORS');
    expect(resolved.baseVolume).toBe(0.65);
  });

  it('resolves floor 14 to depth band 3', () => {
    const resolved = resolveAmbianceForFloor(14);
    expect(resolved.cueId).toBe('amb_band_3_logic');
    expect(resolved.depthBand).toBe('LOGIC_BREAKERS');
    expect(resolved.baseVolume).toBe(0.7);
  });

  it('applies sector condition filter multipliers when active', () => {
    const resolved = resolveAmbianceForFloor(3, 'DARK_SUBNET');
    expect(resolved.cueId).toBe('amb_band_1_corrupted');
    expect(resolved.cutoffMultiplier).toBe(0.6);
    expect(resolved.resonanceQ).toBe(2.5);
  });

  it('applies sector condition track override cueId if configured', () => {
    const resolved = resolveAmbianceForFloor(8, 'SPECIAL_STORM');
    expect(resolved.cueId).toBe('amb_custom_storm_track');
    expect(resolved.depthBand).toBe('STATIC_HORRORS');
    expect(resolved.cutoffMultiplier).toBe(0.8);
    expect(resolved.resonanceQ).toBe(3.0);
  });

  it('handles floors out of configured ranges gracefully', () => {
    const low = resolveAmbianceForFloor(0);
    expect(low.cueId).toBe('amb_band_1_corrupted');

    const high = resolveAmbianceForFloor(99);
    expect(high.cueId).toBe('amb_band_3_logic');
  });
});
