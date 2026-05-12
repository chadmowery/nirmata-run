import { describe, it, expect } from 'vitest';
import { ShellRegistry } from '../server/shell-registry';
import vanguard from '../shared/templates/vanguard-v1.json';
import ghost from '../shared/templates/ghost-v1.json';
import bastion from '../shared/templates/bastion-v1.json';

describe('Shell Template Loading', () => {
  it('should correctly load and register all starter templates', () => {
    const registry = new ShellRegistry();
    
    registry.register(vanguard);
    registry.register(ghost);
    registry.register(bastion);

    const templates = registry.getTemplates();
    expect(templates).toHaveLength(3);
    
    expect(registry.getTemplates().find(t => t.id === 'vanguard-v1')).toBeDefined();
    expect(registry.getTemplates().find(t => t.id === 'ghost-v1')).toBeDefined();
    expect(registry.getTemplates().find(t => t.id === 'bastion-v1')).toBeDefined();
  });

  it('should instantiate vanguard correctly', () => {
    const registry = new ShellRegistry();
    registry.register(vanguard);
    const record = registry.createRecord('vanguard-player', 'vanguard-v1');
    
    expect(record.currentStats.speed).toBe(120);
    expect(record.portConfig.maxFirmware).toBe(2);
  });

  it('should instantiate bastion correctly', () => {
    const registry = new ShellRegistry();
    registry.register(bastion);
    const record = registry.createRecord('bastion-player', 'bastion-v1');
    
    expect(record.currentStats.speed).toBe(80);
    expect(record.portConfig.maxFirmware).toBe(1);
  });
});
