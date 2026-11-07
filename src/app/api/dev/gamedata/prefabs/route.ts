import { NextResponse } from 'next/server';
import path from 'path';
import { access } from 'fs/promises';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { listJsonFiles, atomicWrite, resolveFilePath, errorResponse, regenerateTemplateIndex } from '../utils';
import { RoomPrefabTemplateSchema } from '../schemas';
import { validatePrefabRules } from '../prefab-validator';

const DIR = path.join(process.cwd(), 'src/game/generation/prefabs');

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

    const parseResult = RoomPrefabTemplateSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(`Invalid room prefab schema: ${parseResult.error.message}`, 400);
    }

    const valResult = validatePrefabRules(body);
    if (!valResult.valid) {
      return errorResponse(
        `Structural Prefab Validation Failed: ${valResult.errors.map((e) => e.message).join('; ')}`,
        422,
      );
    }

    const filePath = resolveFilePath(DIR, body.id);
    if (!filePath) return errorResponse('Invalid prefab id', 400);

    try {
      await access(filePath);
      return errorResponse(`Prefab '${body.id}' already exists`, 409);
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
