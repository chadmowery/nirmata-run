import { NextResponse } from 'next/server';
import path from 'path';
import { access } from 'fs/promises';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { listJsonFiles, atomicWrite, resolveFilePath, errorResponse } from '../utils';
import { SpawnTableSchema } from '../schemas';

const DIR = path.join(process.cwd(), 'src/game/entities/templates/spawn-tables');

export async function GET() {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  const names = await listJsonFiles(DIR);
  return NextResponse.json({ items: names });
}

export async function POST(req: Request) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  try {
    const body = await req.json();

    const parseResult = SpawnTableSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(`Invalid spawn table schema: ${parseResult.error.message}`, 400);
    }

    const name = body.name || 'unnamed-table';
    const filePath = resolveFilePath(DIR, name);
    if (!filePath) return errorResponse('Invalid spawn table name', 400);

    try {
      await access(filePath);
      return errorResponse(`Spawn table '${name}' already exists`, 409);
    } catch {
      /* file doesn't exist — good */
    }

    await atomicWrite(filePath, body);
    return NextResponse.json({ success: true, name }, { status: 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
