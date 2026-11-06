import type { FieldMeta } from '@/app/api/dev/gamedata/schema-introspect';

export function buildDefaultComponentData(fields: FieldMeta[]): Record<string, unknown> {
  const initial: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.defaultVal !== undefined) {
      initial[field.key] = structuredClone(field.defaultVal);
    } else if (!field.optional) {
      if (field.type === 'number') initial[field.key] = 0;
      else if (field.type === 'boolean') initial[field.key] = false;
      else if (field.type === 'enum' && field.enumValues && field.enumValues.length > 0) {
        initial[field.key] = field.enumValues[0];
      } else if (field.type === 'array') initial[field.key] = [];
      else if (field.type === 'object') initial[field.key] = {};
      else initial[field.key] = '';
    }
  }
  return initial;
}
