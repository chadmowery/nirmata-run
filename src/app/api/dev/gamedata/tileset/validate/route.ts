import { NextResponse } from 'next/server';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { validateTilesetManifest, validateThemeFile } from '../../tileset-validator';
import { errorResponse } from '../../utils';

export async function GET(req: Request) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  try {
    const url = new URL(req.url);
    const themeId = url.searchParams.get('theme') ?? 'default';
    const result = await validateThemeFile(themeId);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}

export async function POST(req: Request) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  try {
    const body = await req.json();
    const result = validateTilesetManifest(body);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Invalid JSON payload', 400);
  }
}
