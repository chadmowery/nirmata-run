import { NextResponse } from 'next/server';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { AIBehaviorRegistry } from '@/game/ai/tree-registry';

interface RouteContext {
  params: Promise<{ treeId: string }>;
}

export async function GET(_req: Request, context: RouteContext) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  const { treeId } = await context.params;
  const tree = AIBehaviorRegistry.getTree(treeId);

  if (!tree) {
    return NextResponse.json({ error: `Behavior tree '${treeId}' not found` }, { status: 404 });
  }

  return NextResponse.json({
    id: treeId,
    root: tree,
  });
}
