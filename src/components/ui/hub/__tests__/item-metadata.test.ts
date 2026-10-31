import { describe, it, expect } from 'vitest';
import { resolveItemMetadata } from '../item-metadata';

describe('resolveItemMetadata', () => {
  it('resolves known firmware metadata with accurate ability specs', () => {
    const meta = resolveItemMetadata({
      templateId: 'neural-spike',
      compiledAt: 1700000000000,
    });

    expect(meta.name).toBe('Neural_Spike.exe');
    expect(meta.type).toBe('firmware');
    expect(meta.typeLabel).toContain('FIRMWARE');
    expect(meta.statusBadge).toBe('COMPILED // READY');
    expect(meta.statusVariant).toBe('secured');
    expect(meta.description).toContain('Direct wireless logic spike');

    const labels = meta.specs.map((s) => s.label);
    expect(labels).toContain('THERMAL GENERATION');
    expect(labels).toContain('EFFECTIVE RANGE');
    expect(labels).toContain('BASE DISRUPTION');

    const heatSpec = meta.specs.find((s) => s.label === 'THERMAL GENERATION');
    expect(heatSpec?.value).toBe('+40 HEAT');

    const compiledSpec = meta.specs.find((s) => s.label === 'COMPILATION DATE');
    expect(compiledSpec).toBeDefined();
  });

  it('resolves known augment metadata with trigger and payload specs', () => {
    const meta = resolveItemMetadata({
      templateId: 'displacement-venting',
      cost: 50,
      costCurrency: 'FLX',
    });

    expect(meta.name).toBe('Displacement_Venting.arc');
    expect(meta.type).toBe('augment');
    expect(meta.statusBadge).toBe('RAW DATA CORE');
    expect(meta.statusVariant).toBe('amber');
    expect(meta.description).toContain('Emergency heat dissipation');

    const triggerSpec = meta.specs.find((s) => s.label === 'TRIGGER CONDITION');
    expect(triggerSpec?.value).toBe('ON ACTIVATION');

    const purgeSpec = meta.specs.find((s) => s.label === 'THERMAL PURGE');
    expect(purgeSpec?.value).toBe('-15 HEAT');

    const costSpec = meta.specs.find((s) => s.label === 'COMPILATION COST');
    expect(costSpec?.value).toBe('50 FLX');
  });

  it('resolves software metadata for shop requisitions', () => {
    const meta = resolveItemMetadata({
      templateId: 'bleed-v1',
      cost: 60,
      costCurrency: 'CR',
      status: 'SHOP REQUISITION',
      statusVariant: 'cyan',
    });

    expect(meta.name).toBe('Bleed.exe v1');
    expect(meta.type).toBe('software');
    expect(meta.statusBadge).toBe('SHOP REQUISITION');
    expect(meta.statusVariant).toBe('cyan');

    const slotSpec = meta.specs.find((s) => s.label === 'SOCKET TARGET');
    expect(slotSpec?.value).toBe('WEAPON SLOT');

    const costSpec = meta.specs.find((s) => s.label === 'REQUISITION COST');
    expect(costSpec?.value).toBe('60 CR');
  });

  it('resolves vault item metadata with coordinates and floor level', () => {
    const meta = resolveItemMetadata({
      templateId: 'armor-v2',
      type: 'equipment',
      rarity: 'uncommon',
      entityId: 98124,
      floor: 3,
      coord: 'C-04',
    });

    expect(meta.name).toBe('Refined Plating');
    expect(meta.type).toBe('equipment');
    expect(meta.statusBadge).toBe('BAY C-04 // SECURED');
    expect(meta.statusVariant).toBe('secured');

    const coordSpec = meta.specs.find((s) => s.label === 'CARGO BAY LOCATION');
    expect(coordSpec?.value).toBe('C-04');

    const floorSpec = meta.specs.find((s) => s.label === 'HARVEST SUB-LEVEL');
    expect(floorSpec?.value).toBe('FLOOR 3');

    const serialSpec = meta.specs.find((s) => s.label === 'SERIAL NUMBER');
    expect(serialSpec?.value).toContain('TK-VLT-');
  });

  it('gracefully handles unknown and procedural templates', () => {
    const meta = resolveItemMetadata({
      templateId: 'quantum-transceiver',
      type: 'firmware',
      rarity: 'epic',
    });

    expect(meta.name).toBe('Quantum Transceiver');
    expect(meta.type).toBe('firmware');
    expect(meta.rarityTier).toBe('epic');
    expect(meta.description).toContain('Taikoku Vector database');
    expect(meta.specs.length).toBeGreaterThan(0);
  });
});
