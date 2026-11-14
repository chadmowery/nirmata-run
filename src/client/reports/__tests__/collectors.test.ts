import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  shouldIgnoreError,
  buildClientDiagnostics,
  initErrorCollectors,
} from '../collectors';
import { useReportStore } from '../report-store';

describe('Client Error Collectors', () => {
  beforeEach(() => {
    useReportStore.getState().resetForTesting();
  });

  describe('shouldIgnoreError', () => {
    it('ignores ResizeObserver loop error', () => {
      expect(shouldIgnoreError('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
      expect(shouldIgnoreError('ResizeObserver loop limit exceeded')).toBe(true);
    });

    it('ignores Script error without stack trace', () => {
      expect(shouldIgnoreError('Script error.', '')).toBe(true);
      expect(shouldIgnoreError('Script error.', undefined)).toBe(true);
      // If a stack is present, it is not ignored
      expect(shouldIgnoreError('Script error.', 'at foo (app.js:1:1)')).toBe(false);
    });

    it('ignores browser extension stack frames', () => {
      expect(
        shouldIgnoreError('Content script crashed', 'at chrome-extension://abcdef/content.js:10:5')
      ).toBe(true);
      expect(
        shouldIgnoreError('Content script crashed', 'at moz-extension://abcdef/content.js:10:5')
      ).toBe(true);
    });

    it('allows genuine application errors', () => {
      expect(
        shouldIgnoreError(
          'Cannot read properties of null',
          'at CombatSystem.execute (CombatSystem.ts:40:12)'
        )
      ).toBe(false);
    });
  });

  describe('buildClientDiagnostics', () => {
    it('collects route, user agent, build and viewport information', () => {
      const diag = buildClientDiagnostics();
      expect(diag.build).toBeDefined();
      expect(diag.viewport).toBeDefined();
      expect(diag.recentLogs).toBeDefined();
      expect(diag.recentActions).toBeDefined();
    });
  });

  describe('initErrorCollectors', () => {
    it('attaches and cleanly removes window event listeners', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const cleanup = initErrorCollectors();
      expect(addSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

      cleanup();
      expect(removeSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });
  });

  describe('checkPendingFatalCrash (H-2, L-9)', () => {
    it('rejects and clears corrupt sessionStorage JSON without crashing', async () => {
      const { checkPendingFatalCrash } = await import('../collectors');
      const { useReportStore, PENDING_CRASH_STORAGE_KEY } = await import('../report-store');
      useReportStore.getState().resetForTesting();
      sessionStorage.setItem(PENDING_CRASH_STORAGE_KEY, '{not valid json');

      checkPendingFatalCrash();

      expect(sessionStorage.getItem(PENDING_CRASH_STORAGE_KEY)).toBeNull();
      expect(useReportStore.getState().activeCrash).toBeNull();

      sessionStorage.setItem(PENDING_CRASH_STORAGE_KEY, JSON.stringify([{ bad: 'shape' }]));
      checkPendingFatalCrash();
      expect(sessionStorage.getItem(PENDING_CRASH_STORAGE_KEY)).toBeNull();
      expect(useReportStore.getState().activeCrash).toBeNull();
    });

    it('recovers valid multi-crash array into preStatusQueue until status loads', async () => {
      const { checkPendingFatalCrash } = await import('../collectors');
      const { useReportStore, PENDING_CRASH_STORAGE_KEY } = await import('../report-store');
      const origFetch = globalThis.fetch;
      const diag = {
        build: 'test',
        route: '/',
        userAgent: 'vitest',
        viewport: { w: 1024, h: 768 },
        gameStatus: 'IDLE',
        recentLogs: [],
        recentActions: [],
        recentMessages: [],
      };
      try {
        useReportStore.getState().resetForTesting();
        useReportStore.setState({
          status: { available: false, mode: 'off' },
          statusLoaded: false,
          preStatusQueue: [],
        });

        const persisted = [
          {
            origin: 'client',
            source: 'CLIENT_ERROR',
            error: { name: 'Fatal1', message: 'First fatal' },
            diagnostics: diag,
            fingerprint: 'fp_fatal_1',
          },
          {
            origin: 'client',
            source: 'CLIENT_REJECTION',
            error: { name: 'Fatal2', message: 'Second fatal' },
            diagnostics: diag,
            fingerprint: 'fp_fatal_2',
          },
        ];
        sessionStorage.setItem(PENDING_CRASH_STORAGE_KEY, JSON.stringify(persisted));

        checkPendingFatalCrash();

        expect(useReportStore.getState().preStatusQueue).toHaveLength(2);
        expect(useReportStore.getState().activeCrash).toBeNull();

        globalThis.fetch = (async () =>
          new Response(JSON.stringify({ available: true, mode: 'dry-run' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })) as typeof fetch;

        await useReportStore.getState().fetchStatus();

        const state = useReportStore.getState();
        expect(state.preStatusQueue).toHaveLength(0);
        expect(state.activeCrash?.fingerprint).toBe('fp_fatal_1');
        expect(state.pendingQueue).toHaveLength(1);
        expect(state.pendingQueue[0]?.fingerprint).toBe('fp_fatal_2');
      } finally {
        globalThis.fetch = origFetch;
        sessionStorage.removeItem(PENDING_CRASH_STORAGE_KEY);
      }
    });
  });
});
