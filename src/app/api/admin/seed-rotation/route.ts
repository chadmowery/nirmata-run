import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loadSeedRotation, rotateSeed } from '@/app/persistence/seed-rotation';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { logger } from '@engine/utils/logger';

const SeedRotationRequestSchema = z.object({
  type: z.enum(['daily', 'weekly']),
});

/**
 * GET /api/admin/seed-rotation
 * Returns the current seed rotation status.
 */
export async function GET() {
  const envBlocked = checkNonProductionOnly();
  if (envBlocked) return envBlocked;

  try {
    const rotation = await loadSeedRotation();
    return NextResponse.json({ rotation });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/seed-rotation
 * Manually rotates a specific seed.
 */
export async function POST(req: NextRequest) {
  const envBlocked = checkNonProductionOnly();
  if (envBlocked) return envBlocked;

  try {
    const body = await req.json();
    const result = SeedRotationRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid seed type', details: result.error },
        { status: 400 },
      );
    }

    const { type } = result.data;
    const newSeed = await rotateSeed(type);
    return NextResponse.json({ success: true, newSeed });
  } catch (error) {
    logger.error('[AdminSeedRotation] Error:', 'API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
