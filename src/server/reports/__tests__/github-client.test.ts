import { describe, it, expect, vi } from 'vitest';
import {
  GitHubClient,
  GitHubAuthError,
  GitHubRateLimitError,
  GitHubNetworkError,
  GitHubApiError,
} from '../github-client';

describe('GitHubClient', () => {
  it('creates an issue and verifies ai-ready label', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        number: 42,
        html_url: 'https://github.com/chadmowery/nirmata-run/issues/42',
        labels: [{ name: 'ai-ready' }, { name: 'source:in-game' }, { name: 'bug' }],
      }),
    });

    const client = new GitHubClient({
      token: 'test_token',
      repo: 'chadmowery/nirmata-run',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const res = await client.createIssue({
      title: '[Bug] Broken door',
      body: 'Door does not open',
      labels: ['ai-ready', 'source:in-game', 'bug'],
    });

    expect(res.number).toBe(42);
    expect(res.labels).toContain('ai-ready');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('automatically attaches ai-ready if it was silently dropped by GitHub on creation', async () => {
    const fetchMock = vi
      .fn()
      // First call: issue created but labels dropped
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          number: 101,
          html_url: 'https://github.com/chadmowery/nirmata-run/issues/101',
          labels: [],
        }),
      })
      // Second call: manual label attachment
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'ai-ready' }],
      });

    const client = new GitHubClient({
      token: 'test_token',
      repo: 'chadmowery/nirmata-run',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const res = await client.createIssue({
      title: '[Crash] TypeError',
      body: 'crash body',
      labels: ['ai-ready', 'crash'],
    });

    expect(res.number).toBe(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.labels).toContain('ai-ready');
  });

  it('tolerates 422 already_exists when ensuring labels', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: 'already_exists' }),
    });

    const client = new GitHubClient({
      token: 'test_token',
      repo: 'chadmowery/nirmata-run',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    await expect(client.ensureLabels(['ai-ready', 'crash'])).resolves.not.toThrow();
  });

  it('throws GitHubAuthError on 401 or credential failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Bad credentials' }),
    });

    const client = new GitHubClient({
      token: 'bad_token',
      repo: 'chadmowery/nirmata-run',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    await expect(
      client.createIssue({ title: 't', body: 'b', labels: [] })
    ).rejects.toThrow(GitHubAuthError);
  });

  it('throws GitHubRateLimitError on 429 or secondary rate limit with retry-after header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '120' }),
      json: async () => ({ message: 'Rate limit exceeded' }),
    });

    const client = new GitHubClient({
      token: 'test_token',
      repo: 'chadmowery/nirmata-run',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    try {
      await client.createIssue({ title: 't', body: 'b', labels: [] });
      expect.fail('Expected GitHubRateLimitError');
    } catch (err) {
      expect(err).toBeInstanceOf(GitHubRateLimitError);
      expect((err as GitHubRateLimitError).retryAfterSeconds).toBe(120);
    }
  });

  it('throws GitHubNetworkError on 500 server error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ message: 'Bad Gateway' }),
    });

    const client = new GitHubClient({
      token: 'test_token',
      repo: 'chadmowery/nirmata-run',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    await expect(
      client.createIssue({ title: 't', body: 'b', labels: [] })
    ).rejects.toThrow(GitHubNetworkError);
  });
});
