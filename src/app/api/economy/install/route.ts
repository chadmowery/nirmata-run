import { NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import economy from '../../../../game/entities/templates/economy.json';

const InstallRequestSchema = z.object({
  sessionId: z.string(),
  blueprintId: z.string(),
  shellId: z.string(),
  type: z.enum(['firmware', 'augment']),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = InstallRequestSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: result.error 
      }, { status: 400 });
    }

    const { sessionId, blueprintId, shellId, type } = result.data;
    const profile = await profileRepository.load(sessionId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if in library
    if (!profile.blueprintLibrary.some(b => b.blueprintId === blueprintId)) {
      return NextResponse.json({ error: 'Blueprint not compiled' }, { status: 400 });
    }

    const cost = (economy.costs.installation as any)[type];
    if (profile.wallet.scrap < cost) {
      return NextResponse.json({ 
        error: 'Insufficient Scrap', 
        required: cost, 
        current: profile.wallet.scrap 
      }, { status: 400 });
    }

    // Deduct and install
    profile.wallet.scrap -= cost;
    profile.installedItems.push({
      blueprintId,
      type,
      shellId,
      isLegacy: false
    });

    await profileRepository.save(profile);

    return NextResponse.json({ 
      success: true, 
      remainingScrap: profile.wallet.scrap 
    });

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
