import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@engine/utils/logger';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { promises as fs } from 'fs';
import path from 'path';

const DebugEventSchema = z.object({
  timestamp: z.number(),
  origin: z.string(),
  type: z.string(),
  payload: z.unknown().optional(),
});
const DebugLogRequestSchema = z.array(DebugEventSchema);

export async function POST(req: Request) {
  const envBlocked = checkNonProductionOnly();
  if (envBlocked) return envBlocked;

  try {
    const raw = await req.json();
    const result = DebugLogRequestSchema.safeParse(raw);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid events', details: result.error }, { status: 400 });
    }
    const events = result.data;

    const debugDir = path.join(process.cwd(), 'debug');

    // Ensure the directory exists
    try {
      await fs.mkdir(debugDir, { recursive: true });
    } catch {
      // Ignore error if exists
    }

    const jsonFile = path.join(debugDir, 'session_events.json');
    const logFile = path.join(debugDir, 'session_events.log');

    // Write compact JSON
    await fs.writeFile(jsonFile, JSON.stringify(events, null, 2), 'utf-8');

    // Write human-readable log
    const logContent = events
      .map((e: { timestamp: number; origin: string; type: string; payload?: unknown }) => {
        const ts = new Date(e.timestamp).toISOString();
        const payload =
          e.payload && typeof e.payload === 'object' && Object.keys(e.payload as object).length > 0
            ? ` | Payload: ${JSON.stringify(e.payload)}`
            : '';
        return `[${ts}] [${e.origin.toUpperCase()}] ${e.type}${payload}`;
      })
      .join('\n');

    await fs.writeFile(logFile, logContent, 'utf-8');

    return NextResponse.json({ success: true, path: jsonFile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Debug Log Error:', 'API', error);
    return NextResponse.json({ error: 'Failed to write debug log', message }, { status: 500 });
  }
}
