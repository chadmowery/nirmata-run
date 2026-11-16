import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { switchPlayerShellInSession } from '@/server/dev/hotload-reconciler';
import { hotloadBus } from '@/server/dev/hotload-bus';

const SwitchShellSchema = z.object({
  sessionId: z.string().min(1),
  shellId: z.string().min(1),
});

export async function POST(req: Request) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  try {
    const raw = await req.json();
    const parsed = SwitchShellSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid switch-shell request', details: parsed.error },
        { status: 400 },
      );
    }

    const { sessionId, shellId } = parsed.data;
    const patch = switchPlayerShellInSession(sessionId, shellId);
    if (!patch) {
      return NextResponse.json(
        { error: `Session '${sessionId}' or Shell '${shellId}' not found` },
        { status: 404 },
      );
    }

    hotloadBus.publishCommit('shell', shellId, { id: shellId }, { [sessionId]: patch });
    return NextResponse.json({ success: true, sessionId, shellId, patch });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to switch shell' },
      { status: 500 },
    );
  }
}
