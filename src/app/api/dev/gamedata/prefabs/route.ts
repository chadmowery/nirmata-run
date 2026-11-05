import { NextResponse } from 'next/server';
import path from 'path';
import { listJsonFiles, atomicWrite, resolveFilePath, errorResponse } from '../utils';
import { access } from 'fs/promises';

const DIR = path.join(process.cwd(), 'src/game/generation/prefabs');

export async function GET() {
  const names = await listJsonFiles(DIR);
  return NextResponse.json({ items: names });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.id || !body.name || !body.layout || !Array.isArray(body.layout)) {
      return errorResponse('Prefab requires id, name, and layout (array of strings) fields', 400);
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
    return NextResponse.json({ success: true, id: body.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
