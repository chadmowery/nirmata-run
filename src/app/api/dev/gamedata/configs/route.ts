import { NextResponse } from 'next/server';
import { checkNonProductionOnly } from '@/server/security/env-gate';

export const CONFIG_NAMES = ['economy', 'depth-config', 'loot-distribution', 'ambiance'];

export async function GET() {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  return NextResponse.json({ items: CONFIG_NAMES });
}
