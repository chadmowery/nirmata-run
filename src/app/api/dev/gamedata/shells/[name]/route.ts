import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { globalShellRegistry } from '@/game/shells/server';
import type { ShellTemplate } from '@/game/shells/server/types';
import { normalizeDirectionalSprites } from '@shared/utils/shell-sprite-util';
import { resolveFilePath, atomicWrite, errorResponse, regenerateShellTemplateIndex } from '../../utils';
import { ShellTemplateSchema } from '../../schemas';
import { hotloadBus } from '@/server/dev/hotload-bus';
import { reconcileShellAcrossSessions } from '@/server/dev/hotload-reconciler';

const DIR = path.join(process.cwd(), 'src/game/shells/shared/templates');

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

    if (body.id && body.id !== name) {
      return errorResponse(`Shell id in body ('${body.id}') does not match route param ('${name}')`, 400);
    }

    const parseResult = ShellTemplateSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(`Invalid shell template schema: ${parseResult.error.message}`, 400);
    }

    const normalizedDirectional = normalizeDirectionalSprites(parseResult.data.directionalSprites);
    const sanitizedBody: ShellTemplate = {
      ...(parseResult.data as ShellTemplate),
      directionalSprites: normalizedDirectional,
      defaultDirection: normalizedDirectional ? parseResult.data.defaultDirection : undefined,
    };
    if (!normalizedDirectional) {
      delete sanitizedBody.directionalSprites;
      delete sanitizedBody.defaultDirection;
    }

    await atomicWrite(filePath, sanitizedBody);
    const sessionPatches = reconcileShellAcrossSessions(sanitizedBody);
    hotloadBus.publishCommit('shell', name, sanitizedBody, sessionPatches);
    return NextResponse.json({ success: true, sessionPatches });
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
    globalShellRegistry.removeTemplate(name);
    await regenerateShellTemplateIndex();
    return NextResponse.json({ success: true });
  } catch {
    return errorResponse('Not found', 404);
  }
}
