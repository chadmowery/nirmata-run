import { NextResponse, type NextRequest } from 'next/server';
import { ManualReportRequestSchema, type ReportResult } from '@/shared/reports/schemas';
import { getLabelsForKind } from '@/shared/reports/labels';
import { getReportsStatus, getReportsServerConfig } from '@/server/reports/config';
import { reportsRateLimiter } from '@/server/reports/rate-limiter';
import { generateRefId, composeTitle, composeIssueBody } from '@/server/reports/composer';
import { writeDryRunReport } from '@/server/reports/dry-run';
import { GitHubClient, GitHubRateLimitError, GitHubNetworkError } from '@/server/reports/github-client';
import { getReportOutbox } from '@/server/reports/outbox';
import { readJsonBodyWithLimit } from '@/server/reports/body-limit';
import { FloorState, Actor } from '@/shared/components';
import { sessionManager } from '@/server/session/session-manager';
import { logger } from '@/engine/utils/logger';

export async function POST(req: NextRequest) {
  // 1. Status check (never consume rate limit while feature is off)
  const status = getReportsStatus();
  if (status.mode === 'off' || !status.available) {
    return NextResponse.json({ error: 'Issue reporting is currently unavailable' }, { status: 503 });
  }

  // 2. Bounded JSON read (<= 128 KB) & Zod validation
  const bodyRead = await readJsonBodyWithLimit(req);
  if (!bodyRead.ok) {
    return NextResponse.json({ error: bodyRead.error }, { status: bodyRead.status });
  }

  const parsed = ManualReportRequestSchema.safeParse(bodyRead.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // 3. Independent rate limit check (only after availability & schema validation succeed)
  const rate = reportsRateLimiter.consume('manual');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Reporting is temporarily busy, try again later' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  const ref = generateRefId();

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

  // 5. Compose title, labels, and issue body
  const title = composeTitle({ kind: data.kind, title: data.title });
  const labels = getLabelsForKind(data.kind);
  const body = composeIssueBody({
    ref,
    kind: data.kind,
    title: data.title,
    description: data.description,
    diagnostics: data.includeDiagnostics ? data.diagnostics : undefined,
    sessionId: data.sessionId,
    stateSnapshot: liveSnapshot,
  });

  // 6. Delivery
  if (status.mode === 'dry-run') {
    const res = writeDryRunReport({
      ref,
      type: 'issue',
      title,
      body,
      labels,
      metadata: {
        kind: data.kind,
        sessionId: data.sessionId ? `${data.sessionId.slice(0, 8)}…` : undefined,
      },
    });
    return NextResponse.json(res satisfies ReportResult);
  }

  // Live delivery
  const cfg = getReportsServerConfig();
  const client = new GitHubClient({
    token: cfg.githubToken,
    repo: cfg.githubRepo,
  });

  try {
    await client.ensureLabels(labels);
    await client.createIssue({ title, body, labels });
    return NextResponse.json({ status: 'created', ref } satisfies ReportResult);
  } catch (err) {
    logger.warn(`Direct GitHub delivery failed for ${ref}; queuing in outbox`, 'REPORTS', {
      err: String(err),
    });

    if (err instanceof GitHubRateLimitError || err instanceof GitHubNetworkError) {
      getReportOutbox().enqueue({
        ref,
        action: 'create-issue',
        title,
        body,
        labels,
      });
      return NextResponse.json({ status: 'queued', ref } satisfies ReportResult);
    }

    // For auth or unrecoverable client errors, also queue to avoid data loss
    getReportOutbox().enqueue({
      ref,
      action: 'create-issue',
      title,
      body,
      labels,
    });
    return NextResponse.json({ status: 'queued', ref } satisfies ReportResult);
  }
}
