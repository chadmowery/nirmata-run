import { NextResponse } from 'next/server';
import path from 'path';
import { listJsonFiles, atomicWrite, resolveFilePath, errorResponse } from '../utils';
import { access } from 'fs/promises';

const DIR = path.join(process.cwd(), 'src/game/entities/templates/mixins');

export async function GET() {
  const names = await listJsonFiles(DIR);
  return NextResponse.json({ items: names });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name || typeof body.name !== 'string') {
      return errorResponse('name field is required', 400);
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
    return NextResponse.json({ success: true, name: body.name }, { status: 201 });
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
}
