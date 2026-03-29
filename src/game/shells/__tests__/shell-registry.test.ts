import { describe, it, expect } from 'vitest';
import { ShellRegistry } from '../shell-registry';
import { ShellTemplate } from '../types';

describe('ShellRegistry', () => {
  const mockTemplate: ShellTemplate = {
    id: 'test-shell',
    name: 'Test Shell',
    baseStats: { speed: 100, stability: 5, armor: 1, maxHealth: 20 },
    basePorts: { maxFirmware: 2, maxAugment: 1, maxSoftware: 2 },
    upgrades: [],
  };

  it('should register and retrieve templates', () => {
    const registry = new ShellRegistry();
    registry.register(mockTemplate);
    expect(registry.getTemplates()).toContain(mockTemplate);
  });

  it('should create and retrieve records from templates', () => {
    const registry = new ShellRegistry();
    registry.register(mockTemplate);
    const record = registry.createRecord('instance-1', 'test-shell');

    expect(record.id).toBe('instance-1');
    expect(record.archetypeId).toBe('test-shell');
    expect(record.currentStats.speed).toBe(100);
    expect(record.level).toBe(1);
    expect(registry.get('instance-1')).toBe(record);
  });

  it('should update records', () => {
    const registry = new ShellRegistry();
    registry.register(mockTemplate);
    registry.createRecord('instance-1', 'test-shell');
    registry.update('instance-1', { level: 2, currentStats: { ...mockTemplate.baseStats, speed: 110 } });

    const record = registry.get('instance-1')!;
    expect(record.level).toBe(2);
    expect(record.currentStats.speed).toBe(110);
  });

  it('should throw when creating record from non-existent template', () => {
    const registry = new ShellRegistry();
    expect(() => registry.createRecord('id', 'missing')).toThrow();
  });

  it('should throw when updating non-existent record', () => {
    const registry = new ShellRegistry();
    expect(() => registry.update('missing', { level: 2 })).toThrow();
  });
});
