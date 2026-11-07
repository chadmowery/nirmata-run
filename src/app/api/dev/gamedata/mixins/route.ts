import { NextResponse } from 'next/server';
import path from 'path';
import { access } from 'fs/promises';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { listJsonFiles, atomicWrite, resolveFilePath, errorResponse, regenerateTemplateIndex } from '../utils';
import { RawTemplateSchema } from '../schemas';

const DIR = path.join(process.cwd(), 'src/game/entities/templates/mixins');

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

    const parseResult = RawTemplateSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(`Invalid mixin schema: ${parseResult.error.message}`, 400);
    }

    const filePath = resolveFilePath(DIR, body.name);
    if (!filePath) return errorResponse('Invalid mixin name', 400);

    try {
      await access(filePath);
      return errorResponse(`Mixin '${body.name}' already exists`, 409);
    } catch {
      /* file doesn't exist — good */
    }

    await atomicWrite(filePath, body);
    await regenerateTemplateIndex();

    return NextResponse.json({ success: true, name: body.name }, { status: 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
