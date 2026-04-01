import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const events = await req.json();
    if (!Array.isArray(events)) {
      return NextResponse.json({ error: 'Invalid events' }, { status: 400 });
    }

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
    const logContent = events.map((e: { timestamp: number; origin: string; type: string; payload?: unknown }) => {
      const ts = new Date(e.timestamp).toISOString();
      const payload = e.payload && typeof e.payload === 'object' && Object.keys(e.payload as object).length > 0 
        ? ` | Payload: ${JSON.stringify(e.payload)}` 
        : '';
      return `[${ts}] [${e.origin.toUpperCase()}] ${e.type}${payload}`;
    }).join('\n');

    await fs.writeFile(logFile, logContent, 'utf-8');

    return NextResponse.json({ success: true, path: jsonFile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Debug Log Error:', error);
    return NextResponse.json({ error: 'Failed to write debug log', message }, { status: 500 });
  }
}
