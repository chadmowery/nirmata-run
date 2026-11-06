import { NextResponse } from 'next/server';
import path from 'path';
import { access } from 'fs/promises';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { listJsonFiles, atomicWrite, resolveFilePath, errorResponse, regenerateTemplateIndex } from '../utils';
import { ShellTemplateSchema } from '../schemas';

const DIR = path.join(process.cwd(), 'src/game/shells/shared/templates');

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

    const parseResult = ShellTemplateSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(`Invalid shell template schema: ${parseResult.error.message}`, 400);
    }

    const filePath = resolveFilePath(DIR, body.id);
    if (!filePath) return errorResponse('Invalid shell id', 400);

    try {
      await access(filePath);
      return errorResponse(`Shell template '${body.id}' already exists`, 409);
    } catch {
      /* file doesn't exist — good */
    }

    await atomicWrite(filePath, body);
    await regenerateTemplateIndex();

    return NextResponse.json({ success: true, id: body.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
