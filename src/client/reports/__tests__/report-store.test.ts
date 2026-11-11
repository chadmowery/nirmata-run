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
});
