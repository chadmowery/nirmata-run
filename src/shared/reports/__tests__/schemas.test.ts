import { describe, it, expect } from 'vitest';
import {
  ManualReportRequestSchema,
  CrashApproveRequestSchema,
  ClientDiagnosticsSchema,
  ReportKindSchema,
  getLabelsForKind,
  getTitlePrefixForKind,
} from '../index';

describe('Reports Schemas and Labels', () => {
  it('maps report kinds to correct labels and title prefixes', () => {
    expect(getLabelsForKind('BUG')).toEqual(['ai-ready', 'source:in-game', 'bug']);
    expect(getLabelsForKind('FEATURE')).toEqual(['ai-ready', 'source:in-game', 'enhancement']);
    expect(getLabelsForKind('FEEDBACK')).toEqual(['ai-ready', 'source:in-game', 'feedback']);
    expect(getLabelsForKind('OTHER')).toEqual(['ai-ready', 'source:in-game', 'feedback']);
    expect(getLabelsForKind('CRASH')).toEqual(['ai-ready', 'source:in-game', 'crash']);

    expect(getTitlePrefixForKind('BUG')).toBe('[Bug]');
    expect(getTitlePrefixForKind('FEATURE')).toBe('[Feature]');
    expect(getTitlePrefixForKind('CRASH')).toBe('[Crash]');
  });

  it('validates valid manual report requests', () => {
    const valid = {
      kind: 'BUG',
      title: 'Enemy failed to spawn in sector 3',
      description: 'While walking through the corridor, no enemies spawned despite high threat.',
      includeDiagnostics: true,
      sessionId: 'sess_12345',
    };
    expect(ManualReportRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects manual reports with titles that are too short or too long', () => {
    const tooShort = {
      kind: 'BUG',
      title: 'Bad',
      description: 'Valid description that has enough characters.',
      includeDiagnostics: false,
    };
    expect(ManualReportRequestSchema.safeParse(tooShort).success).toBe(false);

    const tooLong = {
      kind: 'BUG',
      title: 'x'.repeat(121),
      description: 'Valid description that has enough characters.',
      includeDiagnostics: false,
    };
    expect(ManualReportRequestSchema.safeParse(tooLong).success).toBe(false);
  });

  it('validates server crash approval requests', () => {
    const serverApproval = {
      source: 'SERVER_TURN',
      draftId: '550e8400-e29b-41d4-a716-446655440000',
      sessionId: 'session_test_abc',
      note: 'I was using the dash augment',
    };
    expect(CrashApproveRequestSchema.safeParse(serverApproval).success).toBe(true);
  });

  it('validates client crash approval requests with diagnostics', () => {
    const clientApproval = {
      source: 'CLIENT_ERROR',
      fingerprint: '1234567890abcdef',
      error: {
        name: 'TypeError',
        message: 'Cannot read properties of null',
        stack: 'at foo (page.js:1:1)',
      },
      diagnostics: {
        build: 'sha-12345',
        route: '/game',
        userAgent: 'Mozilla/5.0',
        viewport: { w: 1920, h: 1080 },
        gameStatus: 'IN_RUN',
        mode: 'SOLO',
        floor: 2,
        turn: 45,
        shellId: 'infiltrator',
        recentLogs: [{ t: 1000, level: 'INFO', msg: 'Started turn' }],
        recentActions: [{ t: 1000, type: 'MOVE' }],
        recentMessages: ['Player took 5 damage'],
      },
    };
    expect(CrashApproveRequestSchema.safeParse(clientApproval).success).toBe(true);
  });

  it('rejects out-of-range or non-finite timestamps in recentLogs (M-5)', () => {
    const baseDiag = {
      build: 'dev',
      route: '/game',
      userAgent: 'Test',
      viewport: { w: 800, h: 600 },
      gameStatus: 'IN_RUN',
      recentActions: [],
      recentMessages: [],
    };

    const tooLarge = ClientDiagnosticsSchema.safeParse({
      ...baseDiag,
      recentLogs: [{ t: 9e15, level: 'INFO', msg: 'boom' }],
    });
    expect(tooLarge.success).toBe(false);

    const negative = ClientDiagnosticsSchema.safeParse({
      ...baseDiag,
      recentLogs: [{ t: -1, level: 'INFO', msg: 'boom' }],
    });
    expect(negative.success).toBe(false);
  });
});
