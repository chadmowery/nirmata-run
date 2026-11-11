import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getReportsStatus, getReportsServerConfig } from '../config';

describe('Reports Server Config & Status', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.GITHUB_ISSUES_TOKEN;
    delete process.env.GITHUB_ISSUES_REPO;
    delete process.env.GITHUB_ISSUES_ENABLED;
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('reports mode "off" in production when credentials are missing', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const status = getReportsStatus(getReportsServerConfig());
    expect(status).toEqual({ available: false, mode: 'off' });
  });

  it('reports mode "live" in production when credentials are set', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.GITHUB_ISSUES_TOKEN = 'ghp_secretToken123';
    process.env.GITHUB_ISSUES_REPO = 'chadmowery/nirmata-run';

    const status = getReportsStatus(getReportsServerConfig());
    expect(status).toEqual({ available: true, mode: 'live' });
  });

  it('reports mode "dry-run" in development by default (without GITHUB_ISSUES_ENABLED)', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    const status = getReportsStatus(getReportsServerConfig());
    expect(status).toEqual({ available: true, mode: 'dry-run' });
  });

  it('reports mode "live" in development when GITHUB_ISSUES_ENABLED=true and token is set', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    process.env.GITHUB_ISSUES_ENABLED = 'true';
    process.env.GITHUB_ISSUES_TOKEN = 'ghp_secretToken123';
    process.env.GITHUB_ISSUES_REPO = 'chadmowery/nirmata-run';

    const status = getReportsStatus(getReportsServerConfig());
    expect(status).toEqual({ available: true, mode: 'live' });
  });
});
