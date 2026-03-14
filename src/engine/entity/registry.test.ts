import { describe, it, expect, beforeEach } from 'vitest';
import { EntityRegistry } from './registry';
import { RawTemplate } from './types';

describe('EntityRegistry', () => {
  let registry: EntityRegistry;

  beforeEach(() => {
    registry = new EntityRegistry();
  });

  it('registers and retrieves a template', () => {
    const template: RawTemplate = {
      name: 'player',
      components: { health: { current: 20, max: 20 } }
    };
    registry.register(template);
    expect(registry.get('player')).toBe(template);
    expect(registry.has('player')).toBe(true);
  });

  it('returns undefined for unregistered template', () => {
    expect(registry.get('ghost')).toBeUndefined();
    expect(registry.has('ghost')).toBe(false);
  });

  it('throws on duplicate registration', () => {
    const template: RawTemplate = { name: 'dup', components: {} };
    registry.register(template);
    expect(() => registry.register(template)).toThrow(/already registered/);
  });

  it('returns all registered templates', () => {
    const t1 = { name: 't1', components: {} };
    const t2 = { name: 't2', components: {} };
    registry.register(t1);
    registry.register(t2);
    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(t1);
    expect(all).toContain(t2);
  });
});
