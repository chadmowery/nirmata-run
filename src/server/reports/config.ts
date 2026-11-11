/**
 * Server configuration for issue reporting and GitHub integration.
 * Server-only module; must never be imported by client code.
 */

import type { ReportsStatus } from '@/shared/reports/schemas';

export interface ReportsServerConfig {
  githubToken?: string;
  githubRepo: string;
  githubIssuesEnabled: boolean;
  crashCapPerHour: number;
  manualCapPerHour: number;
  buildSha: string;
  isProduction: boolean;
}

export function getReportsServerConfig(): ReportsServerConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const crashCap = parseInt(process.env.REPORTS_CRASH_CAP_PER_HOUR || '40', 10);
  const manualCap = parseInt(process.env.REPORTS_MANUAL_CAP_PER_HOUR || '20', 10);

  return {
    githubToken: process.env.GITHUB_ISSUES_TOKEN || undefined,
    githubRepo: process.env.GITHUB_ISSUES_REPO || 'chadmowery/nirmata-run',
    githubIssuesEnabled: process.env.GITHUB_ISSUES_ENABLED === 'true',
    crashCapPerHour: Number.isFinite(crashCap) && crashCap > 0 ? crashCap : 40,
    manualCapPerHour: Number.isFinite(manualCap) && manualCap > 0 ? manualCap : 20,
    buildSha: process.env.NEXT_PUBLIC_BUILD_SHA || 'dev',
    isProduction,
  };
}

/**
 * Computes availability status for reports.
 * - In prod: 'live' if token + repo set, else 'off' (feature hides).
 * - In dev/test: 'live' if GITHUB_ISSUES_ENABLED=true and token+repo set, else 'dry-run' (enabled, logs to disk).
 */
export function getReportsStatus(config: ReportsServerConfig = getReportsServerConfig()): ReportsStatus {
  const hasAuth = Boolean(config.githubToken && config.githubRepo);

  if (config.isProduction) {
    if (hasAuth) {
      return { available: true, mode: 'live' };
    }
    return { available: false, mode: 'off' };
  }

  // Development / Test
  if (config.githubIssuesEnabled && hasAuth) {
    return { available: true, mode: 'live' };
  }

  return { available: true, mode: 'dry-run' };
}
