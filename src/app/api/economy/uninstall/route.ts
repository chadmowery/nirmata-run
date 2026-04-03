import { NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';

const UninstallRequestSchema = z.object({
  sessionId: z.string(),
  blueprintId: z.string(),
  shellId: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = UninstallRequestSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: result.error 
      }, { status: 400 });
    }

    const { sessionId, blueprintId, shellId } = result.data;
    const profile = await profileRepository.load(sessionId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const index = profile.installedItems.findIndex(i => i.blueprintId === blueprintId && i.shellId === shellId);
    
    if (index === -1) {
      return NextResponse.json({ error: 'Item not installed on this Shell' }, { status: 400 });
    }

    // Remove from installed list
    profile.installedItems.splice(index, 1);

    await profileRepository.save(profile);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
