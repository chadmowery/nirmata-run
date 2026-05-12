import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { resolveFilePath, atomicWrite, errorResponse } from '../../utils';

const DIR = path.join(process.cwd(), 'src/game/shells/shared/templates');

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
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
  const { name } = await params;
  const filePath = resolveFilePath(DIR, name);
  if (!filePath) return errorResponse('Invalid name', 400);

  try {
    const body = await req.json();
    if (!body.id || !body.name || !body.baseStats || !body.basePorts) {
      return errorResponse('Shell template requires id, name, baseStats, and basePorts fields', 400);
    }
    await atomicWrite(filePath, body);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const filePath = resolveFilePath(DIR, name);
  if (!filePath) return errorResponse('Invalid name', 400);

  try {
    await fs.unlink(filePath);
    return NextResponse.json({ success: true });
  } catch {
    return errorResponse('Not found', 404);
  }
}
