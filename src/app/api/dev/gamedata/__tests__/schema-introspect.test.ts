import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { getComponentSchemaMap, getFieldMeta, resolveFieldType } from '../schema-introspect';

enum TestNativeEnum {
  Alpha = 'ALPHA',
  Beta = 'BETA',
}

describe('Schema introspection', () => {
  it('should return a map with components', () => {
    const map = getComponentSchemaMap();
    expect(map.size).toBeGreaterThan(0);
    expect(map.has('health')).toBe(true);
    expect(map.has('aiState')).toBe(true);
  });

  it('should unwrap z.nativeEnum into enum type with string values', () => {
    const schema = z.nativeEnum(TestNativeEnum);
    const meta = resolveFieldType(schema);
    expect(meta.type).toBe('enum');
    expect(meta.enumValues).toEqual(['ALPHA', 'BETA']);
  });

  it('should unwrap z.nullable and preserve inner type', () => {
    const schema = z.number().int().min(1).max(10).nullable().default(null);
    const meta = resolveFieldType(schema);
    expect(meta.type).toBe('number');
    expect(meta.nullable).toBe(true);
    expect(meta.constraints?.isInt).toBe(true);
    expect(meta.constraints?.min).toBe(1);
    expect(meta.constraints?.max).toBe(10);
    expect(meta.defaultVal).toBe(null);
  });

  it('should classify z.record as object', () => {
    const schema = z.record(z.string(), z.number());
    const meta = resolveFieldType(schema);
    expect(meta.type).toBe('object');
  });

  it('should unwrap z.lazy schema', () => {
    interface Node {
      value: string;
      children?: Node[];
    }
    const nodeSchema: z.ZodType<Node> = z.lazy(() =>
      z.object({
        value: z.string(),
        children: z.array(nodeSchema).optional(),
      }),
    );
    const fields = getFieldMeta(nodeSchema);
    expect(fields.length).toBe(2);
    expect(fields.find((f) => f.key === 'value')?.type).toBe('string');
    expect(fields.find((f) => f.key === 'children')?.type).toBe('array');
  });

  it('should handle union of literals as enum', () => {
    const schema = z.union([z.literal('first'), z.literal('second')]);
    const meta = resolveFieldType(schema);
    expect(meta.type).toBe('enum');
    expect(meta.enumValues).toEqual(['first', 'second']);
  });
});
