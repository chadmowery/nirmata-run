import { describe, it, expect } from 'vitest';
import { globalShellRegistry } from '../server/index';

describe('Shell Registry dynamic loading', () => {
  it('should load templates from the filesystem', () => {
    const templates = globalShellRegistry.getTemplates();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.find(t => t.id === 'bastion-v1')).toBeDefined();
  });
});
