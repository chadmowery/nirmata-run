import { z } from 'zod';
import { COMPONENTS_REGISTRY } from '@shared/components';

export interface FieldMeta {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object';
  optional: boolean;
  defaultVal?: unknown;
  enumValues?: string[];
}

export function getFieldMeta(schema: z.ZodTypeAny): FieldMeta[] {
  if (schema instanceof z.ZodObject) {
    const shape = (schema as any).shape;
    return Object.entries(shape).map(([key, fieldSchema]) => {
      return { key, ...resolveFieldType(fieldSchema as z.ZodTypeAny) };
    });
  }
  return [];
}

function resolveFieldType(schema: z.ZodTypeAny): Omit<FieldMeta, 'key'> {
  let unwrapped = schema;
  let optional = false;
  let defaultVal: unknown = undefined;

  if (unwrapped instanceof z.ZodOptional) {
    optional = true;
    unwrapped = (unwrapped as any).unwrap();
  }
  if (unwrapped instanceof z.ZodDefault) {
    defaultVal = (unwrapped as any)._def.defaultValue;
    unwrapped = (unwrapped as any)._def.innerType;
  }
  if (unwrapped instanceof z.ZodOptional) {
    optional = true;
    unwrapped = (unwrapped as any).unwrap();
  }

  if (unwrapped instanceof z.ZodNumber) return { type: 'number', optional, defaultVal };
  if (unwrapped instanceof z.ZodBoolean) return { type: 'boolean', optional, defaultVal };
  if (unwrapped instanceof z.ZodEnum) {
    return { type: 'enum', optional, defaultVal, enumValues: (unwrapped as any)._def.values };
  }
  if (unwrapped instanceof z.ZodArray) return { type: 'array', optional, defaultVal };
  if (unwrapped instanceof z.ZodObject) return { type: 'object', optional, defaultVal };
  return { type: 'string', optional, defaultVal };
}

export function getComponentSchemaMap(): Map<string, FieldMeta[]> {
  const map = new Map<string, FieldMeta[]>();
  for (const comp of COMPONENTS_REGISTRY) {
    map.set(comp.key, getFieldMeta(comp.schema));
  }
  return map;
}
