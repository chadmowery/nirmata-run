import { NextRequest, NextResponse } from 'next/server';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { createDefaultProfile } from '@/shared/profile';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }
  try {
    let profile = await profileRepository.load(sessionId);
    if (!profile) {
      profile = createDefaultProfile(sessionId);
      await profileRepository.save(profile);
    }
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[Profile] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
