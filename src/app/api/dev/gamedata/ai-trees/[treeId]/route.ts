import { NextResponse } from 'next/server';
import path from 'path';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { AIBehaviorRegistry } from '@/game/ai/tree-registry';
import { BehaviorTreeNodeSchema } from '@shared/components/ai-tree';
import { atomicWrite, errorResponse, resolveFilePath } from '../../utils';
import { hotloadBus } from '@/server/dev/hotload-bus';

const AI_DIR = path.join(process.cwd(), 'src/game/entities/templates/ai');

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

export async function PUT(req: Request, context: RouteContext) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  const { treeId } = await context.params;
  if (!treeId || treeId === 'subtrees') {
    return errorResponse('Invalid behavior tree id', 400);
  }

  const kebabName = treeId.replace(/_/g, '-');
  const filePath = resolveFilePath(AI_DIR, kebabName);
  if (!filePath) {
    return errorResponse('Invalid behavior tree id', 400);
  }

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request body', 400);
    }
    const bodyRecord = body as Record<string, unknown>;
    if (typeof bodyRecord.id === 'string' && bodyRecord.id !== treeId) {
      return errorResponse(
        `Tree id in body ('${bodyRecord.id}') does not match route param ('${treeId}')`,
        400,
      );
    }

    const rootCandidate = 'root' in bodyRecord ? bodyRecord.root : bodyRecord;
    const parseResult = BehaviorTreeNodeSchema.safeParse(rootCandidate);
    if (!parseResult.success) {
      return errorResponse(`Invalid behavior tree schema: ${parseResult.error.message}`, 400);
    }

    const payload = { id: treeId, root: parseResult.data };
    await atomicWrite(filePath, payload);
    AIBehaviorRegistry.registerTree(treeId, parseResult.data);
    const envelope = hotloadBus.publishCommit('aiTree', treeId, payload);

    return NextResponse.json({ success: true, id: treeId, envelope });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
