import { describe, it, expect, beforeEach } from 'vitest';
import { useReportStore, DONT_ASK_AGAIN_KEY } from '../report-store';

describe('useReportStore', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    useReportStore.getState().resetForTesting();
  });

  it('queues crash and opens active crash modal when feature is available', () => {
    const store = useReportStore.getState();
    store.queueCrash({
      origin: 'client',
      source: 'CLIENT_ERROR',
      fingerprint: 'fp_crash_1',
      error: { name: 'TypeError', message: 'fail' },
      diagnostics: {
        build: 'dev',
        route: '/',
        userAgent: 'test',
        viewport: { w: 800, h: 600 },
        gameStatus: 'IN_RUN',
        recentLogs: [],
        recentActions: [],
        recentMessages: [],
      },
    });

    expect(useReportStore.getState().activeCrash).toBeDefined();
    expect(useReportStore.getState().activeCrash?.fingerprint).toBe('fp_crash_1');
  });

  it('suppresses identical fingerprint within the same session', () => {
    const crash = {
      origin: 'client' as const,
      source: 'CLIENT_ERROR' as const,
      fingerprint: 'fp_repeat',
      error: { name: 'TypeError', message: 'repeat' },
      diagnostics: {
        build: 'dev',
        route: '/',
        userAgent: 'test',
        viewport: { w: 800, h: 600 },
        gameStatus: 'IN_RUN',
        recentLogs: [],
        recentActions: [],
        recentMessages: [],
      },
    };

    useReportStore.getState().queueCrash(crash);
    // Dismiss once
    useReportStore.getState().dismissActiveCrash(false);

    // Queue again with same fingerprint: should be suppressed
    useReportStore.getState().queueCrash(crash);
    expect(useReportStore.getState().activeCrash).toBeNull();
  });

  it('suppresses auto prompt when "Don\'t ask again this session" is selected', () => {
    window.sessionStorage.setItem(DONT_ASK_AGAIN_KEY, 'true');

    useReportStore.getState().queueCrash({
      origin: 'client',
      source: 'CLIENT_ERROR',
      fingerprint: 'fp_suppressed_session',
      error: { name: 'Error', message: 'm' },
      diagnostics: {
        build: 'dev',
        route: '/',
        userAgent: 'test',
        viewport: { w: 800, h: 600 },
        gameStatus: 'IN_RUN',
        recentLogs: [],
        recentActions: [],
        recentMessages: [],
      },
    });

    expect(useReportStore.getState().activeCrash).toBeNull();
  });

  it('caps queue at 3 pending crashes, dropping the oldest', () => {
    const makeCrash = (fp: string) => ({
      origin: 'client' as const,
      source: 'CLIENT_ERROR' as const,
      fingerprint: fp,
      error: { name: 'Error', message: fp },
      diagnostics: {
        build: 'dev',
        route: '/',
        userAgent: 'test',
        viewport: { w: 800, h: 600 },
        gameStatus: 'IN_RUN',
        recentLogs: [],
        recentActions: [],
        recentMessages: [],
      },
    });

    // 1st crash becomes active
    useReportStore.getState().queueCrash(makeCrash('fp_1'));
    // 2nd, 3rd, 4th go to queue
    useReportStore.getState().queueCrash(makeCrash('fp_2'));
    useReportStore.getState().queueCrash(makeCrash('fp_3'));
    useReportStore.getState().queueCrash(makeCrash('fp_4'));

    expect(useReportStore.getState().pendingQueue.length).toBe(3);
    // 5th pushes fp_2 out
    useReportStore.getState().queueCrash(makeCrash('fp_5'));
    const queue = useReportStore.getState().pendingQueue;
    expect(queue.length).toBe(3);
    expect(queue.map((q) => q.fingerprint)).toEqual(['fp_3', 'fp_4', 'fp_5']);
  });

  it('preserves SERVER_5XX source when queuing server crash drafts (H-1)', () => {
    useReportStore.getState().queueServerCrash(
      {
        draftId: 'draft_5xx',
        fingerprint: 'fp_5xx_server',
        source: 'SERVER_5XX',
        preview: {
          errorName: 'Error',
          errorMessage: 'Outer 500 failure',
          actionType: 'WAIT',
          floor: 2,
          turn: 9,
          sealedManifest: [],
        },
      },
      'sess_h1_5xx'
    );

    const active = useReportStore.getState().activeCrash;
    expect(active).toBeDefined();
    expect(active?.origin).toBe('server');
    if (active && active.origin === 'server') {
      expect(active.source).toBe('SERVER_5XX');
      expect(active.draftId).toBe('draft_5xx');
    }
  });

  it('buffers pre-status crashes and flushes them when fetchStatus resolves available (H-2)', async () => {
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
      useReportStore.setState({
        status: { available: false, mode: 'off' },
        statusLoaded: false,
        preStatusQueue: [],
        activeCrash: null,
        pendingQueue: [],
      });

      useReportStore.getState().queueCrash({
        origin: 'client',
        source: 'CLIENT_ERROR',
        error: { name: 'BootError', message: 'Hydration mismatch' },
        diagnostics: diag,
        fingerprint: 'fp_boot_1',
      });

      expect(useReportStore.getState().activeCrash).toBeNull();
      expect(useReportStore.getState().preStatusQueue).toHaveLength(1);

      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ available: true, mode: 'dry-run' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })) as typeof fetch;

      await useReportStore.getState().fetchStatus();

      const state = useReportStore.getState();
      expect(state.statusLoaded).toBe(true);
      expect(state.preStatusQueue).toHaveLength(0);
      expect(state.activeCrash).not.toBeNull();
      expect(state.activeCrash?.fingerprint).toBe('fp_boot_1');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('drops buffered pre-status crashes when fetchStatus resolves unavailable (H-2)', async () => {
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
      useReportStore.setState({
        status: { available: false, mode: 'off' },
        statusLoaded: false,
        preStatusQueue: [],
        activeCrash: null,
        pendingQueue: [],
      });

      useReportStore.getState().queueCrash({
        origin: 'client',
        source: 'CLIENT_ERROR',
        error: { name: 'BootError', message: 'Early failure' },
        diagnostics: diag,
        fingerprint: 'fp_boot_2',
      });

      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ available: false, mode: 'off' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })) as typeof fetch;

      await useReportStore.getState().fetchStatus();

      const state = useReportStore.getState();
      expect(state.statusLoaded).toBe(true);
      expect(state.preStatusQueue).toHaveLength(0);
      expect(state.activeCrash).toBeNull();
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('ignores dismissActiveCrash while submitting and ignores stale submit results (M-8)', async () => {
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
      const crash1 = {
        origin: 'client' as const,
        source: 'CLIENT_ERROR' as const,
        error: { name: 'Err1', message: 'First' },
        diagnostics: diag,
        fingerprint: 'fp_m8_1',
      };
      const crash2 = {
        origin: 'client' as const,
        source: 'CLIENT_ERROR' as const,
        error: { name: 'Err2', message: 'Second' },
        diagnostics: diag,
        fingerprint: 'fp_m8_2',
      };

      useReportStore.setState({
        activeCrash: crash1,
        isSubmitting: true,
      });
      useReportStore.getState().dismissActiveCrash();
      expect(useReportStore.getState().activeCrash?.fingerprint).toBe('fp_m8_1');

      useReportStore.setState({
        activeCrash: crash1,
        isSubmitting: false,
        submissionResult: null,
      });

      let resolveFetch!: (res: Response) => void;
      globalThis.fetch = (() =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })) as typeof fetch;

      const submitPromise = useReportStore.getState().submitActiveCrash('note');
      expect(useReportStore.getState().isSubmitting).toBe(true);

      // Simulate activeCrash changing before the in-flight response returns
      useReportStore.setState({
        activeCrash: crash2,
        isSubmitting: false,
        submissionResult: null,
      });

      resolveFetch(
        new Response(JSON.stringify({ status: 'dry-run', ref: 'NR-ABCD' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      await submitPromise;

      const finalState = useReportStore.getState();
      expect(finalState.activeCrash?.fingerprint).toBe('fp_m8_2');
      expect(finalState.submissionResult).toBeNull();
      expect(finalState.isSubmitting).toBe(false);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
