import { NextResponse } from 'next/server';
import path from 'path';
import { listJsonFiles, atomicWrite, resolveFilePath, errorResponse } from '../utils';
import { access } from 'fs/promises';

const DIR = path.join(process.cwd(), 'src/game/shells/shared/templates');

export async function GET() {
  const names = await listJsonFiles(DIR);
  return NextResponse.json({ items: names });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.id || !body.name || !body.baseStats || !body.basePorts) {
      return errorResponse('Shell template requires id, name, baseStats, and basePorts fields', 400);
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
    return NextResponse.json({ success: true, id: body.id }, { status: 201 });
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
}
