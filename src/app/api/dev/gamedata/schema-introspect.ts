import { z } from 'zod';
import { COMPONENTS_REGISTRY } from '@shared/components';

export interface FieldMeta {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object';
  optional: boolean;
  nullable: boolean;
  defaultVal?: unknown;
  enumValues?: string[];
  constraints?: {
    min?: number;
    max?: number;
    isInt?: boolean;
  };
}

interface ZodDefLike {
  type?: string;
  innerType?: z.ZodTypeAny;
  defaultValue?: unknown;
  getter?: () => z.ZodTypeAny;
  checks?: Array<{ kind?: string; value?: number }>;
  entries?: Record<string, string>;
  values?: unknown[];
  options?: z.ZodTypeAny[];
}

interface ZodSchemaLike {
  type?: string;
  _def?: ZodDefLike;
  minValue?: number;
  maxValue?: number;
  isInt?: boolean;
  options?: string[];
  shape?: Record<string, z.ZodTypeAny>;
}

export function getFieldMeta(schema: z.ZodTypeAny): FieldMeta[] {
  let target: ZodSchemaLike = schema as unknown as ZodSchemaLike;
  const targetType = target.type || target._def?.type;
  if (targetType === 'lazy' && typeof target._def?.getter === 'function') {
    target = target._def.getter() as unknown as ZodSchemaLike;
  }

  if (target instanceof z.ZodObject || target._def?.type === 'object') {
    const shape = target.shape;
    if (shape && typeof shape === 'object') {
      return Object.entries(shape).map(([key, fieldSchema]) => {
        return { key, ...resolveFieldType(fieldSchema) };
      });
    }
  }
  return [];
}

export function resolveFieldType(schema: z.ZodTypeAny): Omit<FieldMeta, 'key'> {
  let unwrapped: ZodSchemaLike = schema as unknown as ZodSchemaLike;
  let optional = false;
  let nullable = false;
  let defaultVal: unknown = undefined;

  let looping = true;
  while (looping) {
    const t = unwrapped.type || unwrapped._def?.type;
    if (t === 'optional') {
      optional = true;
      unwrapped = (unwrapped._def?.innerType || {}) as ZodSchemaLike;
    } else if (t === 'nullable') {
      nullable = true;
      unwrapped = (unwrapped._def?.innerType || {}) as ZodSchemaLike;
    } else if (t === 'default') {
      const def = unwrapped._def;
      defaultVal = typeof def?.defaultValue === 'function' ? def.defaultValue() : def?.defaultValue;
      unwrapped = (def?.innerType || {}) as ZodSchemaLike;
    } else if (t === 'lazy') {
      unwrapped = (unwrapped._def?.getter ? unwrapped._def.getter() : {}) as ZodSchemaLike;
    } else {
      looping = false;
    }
  }

  const t = unwrapped.type || unwrapped._def?.type;

  if (t === 'number') {
    const num = unwrapped as unknown as {
      minValue?: number;
      maxValue?: number;
      isInt?: boolean;
      _def?: { checks?: Array<{ kind?: string; value?: number }> };
    };
    const constraints: { min?: number; max?: number; isInt?: boolean } = {};
    if (num.minValue !== undefined && num.minValue !== -Infinity) constraints.min = num.minValue;
    if (num.maxValue !== undefined && num.maxValue !== Infinity) constraints.max = num.maxValue;
    if (num.isInt) constraints.isInt = true;

    // Fallback checks for Zod 3 style
    if (num._def?.checks) {
      for (const c of num._def.checks) {
        if (c.kind === 'min') constraints.min = c.value;
        else if (c.kind === 'max') constraints.max = c.value;
        else if (c.kind === 'int') constraints.isInt = true;
      }
    }

    return {
      type: 'number',
      optional,
      nullable,
      defaultVal,
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
    };
  }

  if (t === 'boolean') {
    return { type: 'boolean', optional, nullable, defaultVal };
  }

  if (t === 'enum') {
    const enumType = unwrapped as unknown as {
      options?: string[];
      _def?: { entries?: Record<string, string>; values?: string[] };
    };
    const enumValues =
      enumType.options ??
      (enumType._def?.entries ? Object.values(enumType._def.entries) : enumType._def?.values) ??
      [];
    return { type: 'enum', optional, nullable, defaultVal, enumValues };
  }

  if (t === 'array') {
    return { type: 'array', optional, nullable, defaultVal };
  }

  if (t === 'object' || t === 'record') {
    return { type: 'object', optional, nullable, defaultVal };
  }

  if (t === 'union') {
    const unionType = unwrapped as unknown as {
      options?: z.ZodTypeAny[];
      _def?: { options?: z.ZodTypeAny[] };
    };
    const options = unionType.options ?? unionType._def?.options ?? [];
    const allLiterals =
      options.length > 0 &&
      options.every((opt) => (opt.type || opt._def?.type) === 'literal');

    if (allLiterals) {
      const enumValues = options.map((opt) => {
        const lit = opt as unknown as { values?: Set<unknown>; _def?: { values?: unknown[] } };
        const val = lit.values ? Array.from(lit.values)[0] : lit._def?.values?.[0];
        return String(val);
      });
      return { type: 'enum', optional, nullable, defaultVal, enumValues };
    }

    const nonNullBranch = options.find((opt) => {
      const optT = opt.type || opt._def?.type;
      return optT !== 'null' && optT !== 'undefined';
    });
    if (nonNullBranch) {
      const inner = resolveFieldType(nonNullBranch);
      return {
        ...inner,
        optional: optional || inner.optional,
        nullable: nullable || inner.nullable,
        defaultVal: defaultVal !== undefined ? defaultVal : inner.defaultVal,
      };
    }
    return { type: 'object', optional, nullable, defaultVal };
  }

  return { type: 'string', optional, nullable, defaultVal };
}

export function getComponentSchemaMap(): Map<string, FieldMeta[]> {
  const map = new Map<string, FieldMeta[]>();
  for (const comp of COMPONENTS_REGISTRY) {
    map.set(comp.key, getFieldMeta(comp.schema));
  }
  return map;
}
