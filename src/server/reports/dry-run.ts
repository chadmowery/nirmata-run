/**
 * Dry-run writer for development and testing.
 * Writes would-be GitHub issues and comments to disk under logs/reports/.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '@/engine/utils/logger';
import type { ReportResult } from '@/shared/reports/schemas';

export interface DryRunPayload {
  ref: string;
  type: 'issue' | 'comment';
  title?: string;
  body: string;
  labels?: string[];
  issueNumber?: number;
  metadata?: Record<string, unknown>;
}

export function writeDryRunReport(payload: DryRunPayload): ReportResult {
  try {
    const logsDir = path.join(process.cwd(), 'logs', 'reports');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const filename = `report-${payload.ref}.json`;
    const targetPath = path.join(logsDir, filename);

    const record = {
      ...payload,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(targetPath, JSON.stringify(record, null, 2), 'utf-8');
    logger.info(`[DRY-RUN] Saved report draft to ${targetPath}`, 'REPORTS', {
      ref: payload.ref,
      type: payload.type,
      title: payload.title,
    });
  } catch (err) {
    logger.error('Failed to write dry-run report to logs/', 'REPORTS', { err: String(err) });
  }

  return {
    status: 'dry-run',
    ref: payload.ref,
  };
}
