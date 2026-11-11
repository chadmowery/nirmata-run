import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reportableFetch } from '../reportable-fetch';
import { useReportStore } from '../report-store';

describe('reportableFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReportStore.getState().resetForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('passes through 200 and 4xx responses without triggering crash reports', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 400,
      statusText: 'Bad Request',
      ok: false,
      json: async () => ({ error: 'Validation failed' }),
    }));

    const queueSpy = vi.spyOn(useReportStore.getState(), 'queueCrash');

    await reportableFetch('/api/action', { method: 'POST' });
    expect(queueSpy).not.toHaveBeenCalled();
  });

  it('captures 500 server error on /api/* routes and queues an API_FAILURE crash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 500,
      statusText: 'Internal Server Error',
      ok: false,
      clone: () => ({
        json: async () => ({ error: 'Database transaction lock timeout' }),
      }),
    }));

    await reportableFetch('/api/action', { method: 'POST' });

    const activeCrash = useReportStore.getState().activeCrash;
    expect(activeCrash).toBeDefined();
    expect(activeCrash?.origin).toBe('client');
    if (activeCrash && activeCrash.origin === 'client') {
      expect(activeCrash.source).toBe('API_FAILURE');
      expect(activeCrash.error.message).toContain('Database transaction lock timeout');
    }
  });

  it('does not report errors on /api/reports routes to prevent reporting loops', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 500,
      statusText: 'Internal Server Error',
      ok: false,
      clone: () => ({ json: async () => ({}) }),
    }));

    const queueSpy = vi.spyOn(useReportStore.getState(), 'queueCrash');

    await reportableFetch('/api/reports', { method: 'POST' });
    expect(queueSpy).not.toHaveBeenCalled();
  });
});
