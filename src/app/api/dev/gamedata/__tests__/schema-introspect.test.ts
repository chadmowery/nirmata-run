import { describe, it, expect } from 'vitest';
import { getComponentSchemaMap } from '../schema-introspect';

describe('Schema introspection', () => {
  it('should return a map with components', () => {
    const map = getComponentSchemaMap();
    expect(map.size).toBeGreaterThan(0);
    expect(map.has('health')).toBe(true);
  });
});
