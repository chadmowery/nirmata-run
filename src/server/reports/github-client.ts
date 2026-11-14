/**
 * Thin GitHub REST API client using native fetch.
 * Server-only; handles label safety, rate-limit status mapping, and authentication errors.
 */

import { logger } from '@engine/utils/logger';

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody?: unknown
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export class GitHubAuthError extends GitHubApiError {
  constructor(message: string, status: number, responseBody?: unknown) {
    super(message, status, responseBody);
    this.name = 'GitHubAuthError';
  }
}

export class GitHubRateLimitError extends GitHubApiError {
  constructor(
    message: string,
    status: number,
    public readonly retryAfterSeconds: number,
    responseBody?: unknown
  ) {
    super(message, status, responseBody);
    this.name = 'GitHubRateLimitError';
  }
}

export class GitHubNetworkError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'GitHubNetworkError';
  }
}

export interface GitHubIssueResponse {
  number: number;
  html_url: string;
  labels: string[];
}

export interface GitHubIssueState {
  number: number;
  state: 'open' | 'closed';
  title: string;
}

export interface GitHubClientOptions {
  token?: string;
  repo: string;
  fetchFn?: typeof fetch;
}

export class GitHubClient {
  private readonly token?: string;
  private readonly repo: string;
  private readonly fetch: typeof fetch;
  private readonly ensuredLabels = new Set<string>();

  constructor(options: GitHubClientOptions) {
    this.token = options.token;
    this.repo = options.repo;
    this.fetch = options.fetchFn || globalThis.fetch;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'nirmata-run-reporter',
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('https://')
      ? endpoint
      : `https://api.github.com/repos/${this.repo}${endpoint}`;

    let res: Response;
    try {
      res = await this.fetch(url, {
        ...init,
        headers: {
          ...this.getHeaders(),
          ...(init.headers as Record<string, string> | undefined),
        },
      });
    } catch (err) {
      throw new GitHubNetworkError(`Network failure while requesting ${endpoint}`, err);
    }

    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = await res.text().catch(() => '<unreadable>');
      }

      const bodyMessage =
        typeof body === 'object' && body && 'message' in body
          ? String((body as { message: unknown }).message)
          : typeof body === 'string'
          ? body
          : '';
      const lowerMsg = bodyMessage.toLowerCase();
      const retryHeader = res.headers?.get('retry-after');
      const remainingHeader = res.headers?.get('x-ratelimit-remaining');
      const is403RateLimit =
        res.status === 403 &&
        (Boolean(retryHeader) ||
          remainingHeader === '0' ||
          lowerMsg.includes('rate limit') ||
          lowerMsg.includes('secondary'));

      if (res.status === 401 || (res.status === 403 && !is403RateLimit)) {
        throw new GitHubAuthError(`GitHub authentication failed (${res.status})`, res.status, body);
      }

      if (res.status === 429 || is403RateLimit) {
        const resetHeader = res.headers?.get('x-ratelimit-reset');
        let retrySeconds = 60;
        if (retryHeader) {
          retrySeconds = parseInt(retryHeader, 10) || 60;
        } else if (resetHeader) {
          const resetEpoch = parseInt(resetHeader, 10);
          if (resetEpoch) {
            retrySeconds = Math.max(1, resetEpoch - Math.floor(Date.now() / 1000));
          }
        }
        throw new GitHubRateLimitError(
          `GitHub rate limit reached (${res.status})`,
          res.status,
          retrySeconds,
          body
        );
      }

      if (res.status >= 500) {
        throw new GitHubNetworkError(`GitHub server error (${res.status})`, body);
      }

      throw new GitHubApiError(`GitHub API error ${res.status} on ${endpoint}`, res.status, body);
    }

    return (await res.json()) as T;
  }

  /**
   * Idempotently ensures required labels exist in the target repository.
   * Tracks ensured state per label and only caches a label after 2xx or HTTP 422 (already_exists).
   */
  async ensureLabels(labels: string[]): Promise<void> {
    for (const label of labels) {
      if (this.ensuredLabels.has(label)) continue;
      try {
        await this.request('/labels', {
          method: 'POST',
          body: JSON.stringify({ name: label }),
        });
        this.ensuredLabels.add(label);
      } catch (err) {
        // HTTP 422: already_exists is expected and benign
        if (
          err instanceof GitHubApiError &&
          !(err instanceof GitHubAuthError) &&
          !(err instanceof GitHubRateLimitError) &&
          err.status === 422
        ) {
          this.ensuredLabels.add(label);
          continue;
        }
        // Do not cache failed labels so future calls retry after transient/auth issues recover
        logger.warn(`Could not ensure label '${label}'`, 'REPORTS', { err: String(err) });
      }
    }
  }

  /**
   * Creates a new GitHub issue with the ai-ready guarantee.
   */
  async createIssue(params: {
    title: string;
    body: string;
    labels: string[];
  }): Promise<GitHubIssueResponse> {
    const raw = await this.request<{
      number: number;
      html_url: string;
      labels: Array<{ name: string } | string>;
    }>('/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: params.title,
        body: params.body,
        labels: params.labels,
      }),
    });

    let returnedLabels = (raw.labels || []).map((l) => (typeof l === 'string' ? l : l.name));

    // Mandate: verify 'ai-ready' is present (Section 6.5)
    if (!returnedLabels.includes('ai-ready')) {
      logger.warn(`'ai-ready' label dropped during creation of #${raw.number}; attempting manual attachment...`, 'REPORTS');
      try {
        const added = await this.addLabelsToIssue(raw.number, ['ai-ready']);
        returnedLabels = added;
      } catch (addErr) {
        logger.error(`CRITICAL: Failed to attach 'ai-ready' label to #${raw.number}!`, 'REPORTS', { err: String(addErr) });
      }
    }

    return {
      number: raw.number,
      html_url: raw.html_url,
      labels: returnedLabels,
    };
  }

  /**
   * Posts a comment to an existing issue.
   */
  async addComment(issueNumber: number, body: string): Promise<{ id: number }> {
    return this.request<{ id: number }>(`/issues/${issueNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  /**
   * Fetches state of an existing issue.
   */
  async getIssue(issueNumber: number): Promise<GitHubIssueState> {
    const raw = await this.request<{ number: number; state: 'open' | 'closed'; title: string }>(
      `/issues/${issueNumber}`
    );
    return {
      number: raw.number,
      state: raw.state,
      title: raw.title,
    };
  }

  /**
   * Adds labels to an existing issue.
   */
  async addLabelsToIssue(issueNumber: number, labels: string[]): Promise<string[]> {
    const raw = await this.request<Array<{ name: string } | string>>(`/issues/${issueNumber}/labels`, {
      method: 'POST',
      body: JSON.stringify({ labels }),
    });
    return (raw || []).map((l) => (typeof l === 'string' ? l : l.name));
  }

  /**
   * Searches for an open issue containing the fingerprint marker.
   */
  async searchIssueByFingerprint(fingerprint: string): Promise<number | null> {
    const q = `repo:${this.repo} is:issue is:open "nr-fingerprint: ${fingerprint}" in:body`;
    const encoded = encodeURIComponent(q);
    const data = await this.request<{ items: Array<{ number: number }> }>(
      `https://api.github.com/search/issues?q=${encoded}&per_page=1`
    );
    if (data.items && data.items.length > 0) {
      return data.items[0].number;
    }
    return null;
  }
}

const gClientStore = globalThis as unknown as {
  __nirmataGitHubClients?: Map<string, GitHubClient>;
};

/**
 * Returns a shared singleton GitHubClient keyed by repo + token so ensureLabels() persists across requests.
 */
export function getGitHubClient(options: GitHubClientOptions): GitHubClient {
  if (options.fetchFn) {
    return new GitHubClient(options);
  }
  if (!gClientStore.__nirmataGitHubClients) {
    gClientStore.__nirmataGitHubClients = new Map();
  }
  const key = `${options.repo}::${options.token ?? ''}`;
  let client = gClientStore.__nirmataGitHubClients.get(key);
  if (!client) {
    client = new GitHubClient(options);
    gClientStore.__nirmataGitHubClients.set(key, client);
  }
  return client;
}
