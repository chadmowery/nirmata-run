import { describe, it, expect } from 'vitest';
import { ShellRegistry } from '../shell-registry';
import striker from '../templates/striker-v1.json';
import bastion from '../templates/bastion-v1.json';
import signal from '../templates/signal-v1.json';

describe('Shell Template Loading', () => {
  it('should correctly load and register all starter templates', () => {
    const registry = new ShellRegistry();
    
    registry.register(striker);
    registry.register(bastion);
    registry.register(signal);

    const templates = registry.getTemplates();
    expect(templates).toHaveLength(3);
    
    expect(registry.getTemplates().find(t => t.id === 'striker-v1')).toBeDefined();
    expect(registry.getTemplates().find(t => t.id === 'bastion-v1')).toBeDefined();
    expect(registry.getTemplates().find(t => t.id === 'signal-v1')).toBeDefined();
  });

  it('should instantiate striker correctly', () => {
    const registry = new ShellRegistry();
    registry.register(striker);
    const record = registry.createRecord('striker-player', 'striker-v1');
    
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
