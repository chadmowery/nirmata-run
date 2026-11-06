import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { resolveFilePath, atomicWrite, errorResponse, regenerateTemplateIndex } from '../../utils';
import { RawTemplateSchema } from '../../schemas';

const DIR = path.join(process.cwd(), 'src/game/entities/templates/mixins');

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  const { name } = await params;
  const filePath = resolveFilePath(DIR, name);
  if (!filePath) return errorResponse('Invalid name', 400);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(content));
  } catch {
    return errorResponse('Not found', 404);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  const { name } = await params;
  const filePath = resolveFilePath(DIR, name);
  if (!filePath) return errorResponse('Invalid name', 400);

  try {
    const body = await req.json();

    if (body.name && body.name !== name) {
      return errorResponse(`Mixin name in body ('${body.name}') does not match route param ('${name}')`, 400);
    }

    const parseResult = RawTemplateSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(`Invalid mixin schema: ${parseResult.error.message}`, 400);
    }

    await atomicWrite(filePath, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  const { name } = await params;
  const filePath = resolveFilePath(DIR, name);
  if (!filePath) return errorResponse('Invalid name', 400);

  try {
    await fs.unlink(filePath);
    await regenerateTemplateIndex();
    return NextResponse.json({ success: true });
  } catch {
    return errorResponse('Not found', 404);
  }
}
