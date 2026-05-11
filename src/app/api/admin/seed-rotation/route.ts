import { NextRequest, NextResponse } from 'next/server';
import { loadSeedRotation, rotateSeed } from '@/app/persistence/seed-rotation';

/**
 * GET /api/admin/seed-rotation
 * Returns the current seed rotation status.
 */
export async function GET() {
  try {
    const rotation = await loadSeedRotation();
    return NextResponse.json({ rotation });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { logger } from '@engine/utils/logger';

/**
 * POST /api/admin/seed-rotation
 * Manually rotates a specific seed.
 */
export async function POST(req: NextRequest) {
  try {
    const { type } = await req.json();

    if (type !== 'daily' && type !== 'weekly') {
      return NextResponse.json({ error: 'Invalid seed type' }, { status: 400 });
    }

    const newSeed = await rotateSeed(type);
    return NextResponse.json({ success: true, newSeed });
  } catch (error) {
    logger.error('[AdminSeedRotation] Error:', 'API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
