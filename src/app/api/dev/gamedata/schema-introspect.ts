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
    const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
    return Object.entries(shape).map(([key, fieldSchema]) => {
      return { key, ...resolveFieldType(fieldSchema as z.ZodTypeAny) };
    });
  }
  return [];
}

function resolveFieldType(schema: z.ZodTypeAny): Omit<FieldMeta, 'key'> {
  let unwrapped: z.ZodTypeAny = schema;
  let optional = false;
  let defaultVal: unknown = undefined;

  if (unwrapped instanceof z.ZodOptional) {
    optional = true;
    unwrapped = (unwrapped as z.ZodOptional<z.ZodTypeAny>).unwrap();
  }
  if (unwrapped instanceof z.ZodDefault) {
    const defaultDef = (unwrapped as z.ZodDefault<z.ZodTypeAny>)._def;
    defaultVal =
      typeof defaultDef.defaultValue === 'function'
        ? defaultDef.defaultValue()
        : defaultDef.defaultValue;
    unwrapped = defaultDef.innerType;
  }
  if (unwrapped instanceof z.ZodOptional) {
    optional = true;
    unwrapped = (unwrapped as z.ZodOptional<z.ZodTypeAny>).unwrap();
  }

  if (unwrapped instanceof z.ZodNumber) return { type: 'number', optional, defaultVal };
  if (unwrapped instanceof z.ZodBoolean) return { type: 'boolean', optional, defaultVal };
  if (unwrapped instanceof z.ZodEnum) {
    const enumType = unwrapped as unknown as { options?: string[]; _def?: { values?: string[] } };
    const enumValues = enumType.options ?? enumType._def?.values ?? [];
    return { type: 'enum', optional, defaultVal, enumValues };
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
