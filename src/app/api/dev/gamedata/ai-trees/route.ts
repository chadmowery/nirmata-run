import { NextResponse } from 'next/server';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { AIBehaviorRegistry } from '@/game/ai/tree-registry';

export async function GET() {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  const items = AIBehaviorRegistry.listTreeIds();
  const subtrees = AIBehaviorRegistry.listSubtreeRefs();

  return NextResponse.json({
    items,
    subtrees,
  });
}
