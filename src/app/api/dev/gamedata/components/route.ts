import { NextResponse } from 'next/server';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { getComponentSchemaMap } from '../schema-introspect';
import { RUNTIME_INTENT_OR_TAG_KEYS } from '../ecs-rules';

export async function GET() {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  const schemaMap = getComponentSchemaMap();
  const items = Array.from(schemaMap.entries())
    .map(([key, fields]) => ({
      key,
      fields,
      isRuntimeOnly: RUNTIME_INTENT_OR_TAG_KEYS.has(key),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return NextResponse.json({ items });
}
