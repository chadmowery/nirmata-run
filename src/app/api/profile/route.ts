import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { createDefaultProfile } from '@/shared/profile';
import { logger } from '@engine/utils/logger';

const ProfileQuerySchema = z.object({
  sessionId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const parsed = ProfileQuerySchema.safeParse({
    sessionId: req.nextUrl.searchParams.get('sessionId'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Missing sessionId', details: parsed.error },
      { status: 400 },
    );
  }

  const { sessionId } = parsed.data;
  try {
    let profile = await profileRepository.load(sessionId);
    if (!profile) {
      profile = createDefaultProfile(sessionId);
      await profileRepository.save(profile);
    }
    return NextResponse.json({ profile });
  } catch (error) {
    logger.error('[Profile] Error:', 'API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
