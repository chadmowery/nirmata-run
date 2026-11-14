import { NextResponse, type NextRequest } from 'next/server';
import { ManualReportRequestSchema } from '@shared/reports/schemas';
import { getLabelsForKind } from '@shared/reports/labels';
import { getReportsStatus, getReportsServerConfig } from '@server/reports/config';
import { reportsRateLimiter } from '@server/reports/rate-limiter';
import { generateRefId, composeTitle, composeIssueBody } from '@server/reports/composer';
import { getReportOutbox } from '@server/reports/outbox';
import { readJsonBodyWithLimit } from '@server/reports/body-limit';
import {
  deliverManualReport,
  getIdempotentManualOutcome,
  runWithManualIdempotency,
} from '@server/reports/delivery';
import { FloorState, Actor } from '@shared/components';
import { sessionManager } from '@server/session/session-manager';

export async function POST(req: NextRequest) {
  // 1. Status check (never consume rate limit while feature is off)
  const status = getReportsStatus();
  if (status.mode === 'off' || !status.available) {
    return NextResponse.json({ error: 'Issue reporting is currently unavailable' }, { status: 503 });
  }

  // 2. Bounded body read (128 KB cap) and Zod validation before consuming rate limit
  const bodyResult = await readJsonBodyWithLimit(req);
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  const parsed = ManualReportRequestSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // 2b. Return cached outcome if this idempotency key already completed or is in flight
  const existingOutcome = await getIdempotentManualOutcome(data.idempotencyKey);
  if (existingOutcome) {
    return NextResponse.json(existingOutcome.payload, { status: existingOutcome.statusCode });
  }

  // 3. Sliding window rate limit (manual: 20/hr)
  const rate = reportsRateLimiter.consume('manual');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Reporting is temporarily busy, try again later' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  const outcome = await runWithManualIdempotency(data.idempotencyKey, async () => {
    const cfg = getReportsServerConfig();
    const ref = generateRefId((candidate) => getReportOutbox().hasRef(candidate));

    // 4. Optionally capture sealed live diagnostics from active session (Assumption A2)
    let liveSnapshot: Record<string, unknown> | undefined;
    if (data.includeDiagnostics && data.sessionId) {
      try {
        const session = sessionManager.getSession(data.sessionId);
        if (session) {
          const floorState = session.playerId ? session.world.getComponent(session.playerId, FloorState) : undefined;
          liveSnapshot = {
            runSeed: floorState?.runSeed,
            currentFloor: floorState?.currentFloor,
            turn: session.turnManager?.getTurnNumber(),
            phase: session.turnManager?.getPhase(),
            activeEntityCount: session.world?.query(Actor).length,
          };
        }
      } catch {
        // Non-fatal
      }
    }

    // 5. Compose and delegate delivery
    const title = composeTitle({ kind: data.kind, title: data.title });
    const labels = getLabelsForKind(data.kind);
    const body = composeIssueBody({
      ref,
      kind: data.kind,
      title: data.title,
      description: data.description,
      diagnostics: data.includeDiagnostics ? data.diagnostics : undefined,
      build: data.diagnostics?.build || cfg.buildSha,
      sessionId: data.sessionId,
      stateSnapshot: liveSnapshot,
    });

    return deliverManualReport({
      cfg,
      status,
      ref,
      title,
      body,
      labels,
      dryRunMetadata: {
        kind: data.kind,
        sessionId: data.sessionId ? `${data.sessionId.slice(0, 8)}…` : undefined,
        includeDiagnostics: data.includeDiagnostics,
      },
    });
  });

  return NextResponse.json(outcome.payload, { status: outcome.statusCode });
}
