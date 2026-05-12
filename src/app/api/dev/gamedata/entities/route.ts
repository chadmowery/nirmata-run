import { NextResponse } from 'next/server';
import path from 'path';
import { listJsonFiles, atomicWrite, resolveFilePath, errorResponse } from '../utils';
import { access } from 'fs/promises';

const DIR = path.join(process.cwd(), 'src/game/entities/templates');

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
    if (!filePath) return errorResponse('Invalid template name. Use lowercase alphanumeric with hyphens.', 400);

    // Check file doesn't already exist
    try {
      await access(filePath);
      return errorResponse(`Template '${body.name}' already exists`, 409);
    } catch {
      /* file doesn't exist — good */
    }

    await atomicWrite(filePath, body);
    return NextResponse.json({ success: true, name: body.name }, { status: 201 });
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
}
