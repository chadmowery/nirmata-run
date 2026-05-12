import { NextResponse } from 'next/server';
import { getComponentSchemaMap } from '../schema-introspect';

export async function GET() {
  const schemaMap = getComponentSchemaMap();
  const items = Array.from(schemaMap.entries())
    .map(([key, fields]) => ({
      key,
      fields,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return NextResponse.json({ items });
}
