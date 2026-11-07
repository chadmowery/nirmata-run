import { describe, it, expect } from 'vitest';
import { generateRoomPrefab, RoomArchetype } from '../room-generator';
import { validatePrefabRules } from '@/app/api/dev/gamedata/prefab-validator';

describe('Room Generator Engine', () => {
  const ARCHETYPES: RoomArchetype[] = [
    'SERVER_CORE',
    'FREIGHT_BAY',
    'DECON_AIRLOCK',
    'ZERO_DAY_VAULT',
    'SUBNET_HUB',
    'CORRUPTED_SECTOR',
  ];

  it('generates deterministic output for the same seed and config', () => {
    const config = {
      seed: 'TEST-SEED-42',
      archetype: 'SERVER_CORE' as const,
      faction: 'cyberacme' as const,
      width: 12,
      height: 12,
      symmetry: 'bilateral' as const,
      complexity: 0.5,
      propDensity: 0.5,
      hazardDensity: 0.1,
      portalCount: 2,
      minFloor: 1,
      maxFloor: 15,
    };

    const run1 = generateRoomPrefab(config);
    const run2 = generateRoomPrefab(config);

    expect(run1.layout).toEqual(run2.layout);
    expect(run1.portals).toEqual(run2.portals);
    expect(run1.propSpawns).toEqual(run2.propSpawns);
  });

  for (const archetype of ARCHETYPES) {
    it(`generates valid ${archetype} prefab passing all structural rules (VAL-PRF-01..05)`, () => {
      const prefab = generateRoomPrefab({
        seed: `SEED-${archetype}`,
        archetype,
        faction: archetype === 'DECON_AIRLOCK' ? 'sekiguchi' : 'traxus',
        width: 12,
        height: 12,
        symmetry: archetype === 'CORRUPTED_SECTOR' ? 'none' : 'bilateral',
        complexity: 0.5,
        propDensity: 0.6,
        hazardDensity: archetype === 'CORRUPTED_SECTOR' ? 0.3 : 0,
        portalCount: archetype === 'ZERO_DAY_VAULT' ? 1 : 2,
        minFloor: 1,
        maxFloor: 15,
      });

      const audit = validatePrefabRules(prefab);
      expect(audit.valid).toBe(true);
      expect(audit.errors).toEqual([]);
    });
  }

  it('sweeps 60 seeds across all archetypes and verifies 100% pass rate', () => {
    for (let s = 1; s <= 10; s++) {
      for (const archetype of ARCHETYPES) {
        const prefab = generateRoomPrefab({
          seed: `SWEEP-${archetype}-${s}`,
          archetype,
          faction: 'cyberacme',
          width: 10 + (s % 7), // 10 to 16
          height: 10 + ((s * 2) % 7), // 10 to 16
          symmetry: s % 2 === 0 ? 'bilateral' : 'vertical',
          complexity: (s % 10) / 10,
          propDensity: (s % 8) / 10,
          hazardDensity: archetype === 'CORRUPTED_SECTOR' ? 0.2 : 0,
          portalCount: archetype === 'ZERO_DAY_VAULT' ? 1 : (s % 3) + 1,
          minFloor: 1,
          maxFloor: 15,
        });

        const audit = validatePrefabRules(prefab);
        if (!audit.valid) {
          console.error(`Failed on ${archetype} seed SWEEP-${archetype}-${s}:`, audit.errors);
        }
        expect(audit.valid).toBe(true);
        expect(audit.errors).toHaveLength(0);
      }
    }
  });

  it('enforces vault invariant on ZERO_DAY_VAULT', () => {
    const vault = generateRoomPrefab({
      seed: 'VAULT-TEST-99',
      archetype: 'ZERO_DAY_VAULT',
      faction: 'traxus',
      width: 14,
      height: 14,
      symmetry: 'none',
      complexity: 0.5,
      propDensity: 0.5,
      hazardDensity: 0,
      portalCount: 1,
      minFloor: 5,
      maxFloor: 15,
    });

    expect(vault.isVaultRoom).toBe(true);
    expect(vault.faradayShielded).toBe(true);
    expect(vault.layout.some((r) => r.includes('V'))).toBe(true);
    expect(vault.propSpawns.some((p) => p.anchorType === 'CONTAINER_RARE')).toBe(true);
  });

  it('generates valid compact 10x8 rooms (like zero-day-vault) across all archetypes', () => {
    for (const archetype of ARCHETYPES) {
      const prefab = generateRoomPrefab({
        seed: `COMPACT-10x8-${archetype}`,
        archetype,
        faction: 'cyberacme',
        width: 10,
        height: 8,
        symmetry: archetype === 'CORRUPTED_SECTOR' ? 'none' : 'bilateral',
        complexity: 0.5,
        propDensity: 0.5,
        hazardDensity: archetype === 'CORRUPTED_SECTOR' ? 0.2 : 0,
        portalCount: archetype === 'ZERO_DAY_VAULT' ? 1 : 2,
        minFloor: 1,
        maxFloor: 15,
      });

      expect(prefab.width).toBe(10);
      expect(prefab.height).toBe(8);
      expect(prefab.layout).toHaveLength(8);
      for (const row of prefab.layout) {
        expect(row).toHaveLength(10);
      }

      const audit = validatePrefabRules(prefab);
      if (!audit.valid) {
        console.error(`10x8 failed for ${archetype}:`, audit.errors);
      }
      expect(audit.valid).toBe(true);
      expect(audit.errors).toHaveLength(0);
    }
  });

  it('generates valid minimum dimension 8x8 rooms across all archetypes', () => {
    for (const archetype of ARCHETYPES) {
      const prefab = generateRoomPrefab({
        seed: `MIN-8x8-${archetype}`,
        archetype,
        faction: 'traxus',
        width: 8,
        height: 8,
        symmetry: archetype === 'CORRUPTED_SECTOR' ? 'none' : 'horizontal',
        complexity: 0.4,
        propDensity: 0.4,
        hazardDensity: 0,
        portalCount: archetype === 'ZERO_DAY_VAULT' ? 1 : 2,
        minFloor: 1,
        maxFloor: 15,
      });

      expect(prefab.width).toBe(8);
      expect(prefab.height).toBe(8);
      const audit = validatePrefabRules(prefab);
      if (!audit.valid) {
        console.error(`8x8 failed for ${archetype}:`, audit.errors);
      }
      expect(audit.valid).toBe(true);
      expect(audit.errors).toHaveLength(0);
    }
  });

  it('generates valid large dimension 24x24 rooms across all archetypes', () => {
    for (const archetype of ARCHETYPES) {
      const prefab = generateRoomPrefab({
        seed: `LARGE-24x24-${archetype}`,
        archetype,
        faction: 'sekiguchi',
        width: 24,
        height: 24,
        symmetry: 'bilateral',
        complexity: 0.7,
        propDensity: 0.7,
        hazardDensity: archetype === 'CORRUPTED_SECTOR' ? 0.3 : 0.1,
        portalCount: archetype === 'ZERO_DAY_VAULT' ? 1 : 4,
        minFloor: 1,
        maxFloor: 15,
      });

      expect(prefab.width).toBe(24);
      expect(prefab.height).toBe(24);
      const audit = validatePrefabRules(prefab);
      if (!audit.valid) {
        console.error(`24x24 failed for ${archetype}:`, audit.errors);
      }
      expect(audit.valid).toBe(true);
      expect(audit.errors).toHaveLength(0);
    }
  });
});
