import { NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import economy from '../../../../game/entities/templates/economy.json';

const UpgradeRequestSchema = z.object({
  sessionId: z.string(),
  shellId: z.string(),
  stat: z.enum(['speed', 'armor', 'stability', 'additionalPorts']),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = UpgradeRequestSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ 
        error: 'Invalid request', 
        details: result.error 
      }, { status: 400 });
    }

    const { sessionId, shellId, stat } = result.data;
    const profile = await profileRepository.load(sessionId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.shellUpgrades[shellId]) {
      profile.shellUpgrades[shellId] = { speed: 0, armor: 0, stability: 0, additionalPorts: 0 };
    }

    const currentLevel = (profile.shellUpgrades[shellId] as any)[stat];
    let cost = 0;

    if (stat === 'additionalPorts') {
      cost = Math.floor(
        economy.costs.shellUpgrade.additionalPort.baseCost * 
        Math.pow(economy.costs.shellUpgrade.additionalPort.perPortMultiplier, currentLevel)
      );
    } else {
      const config = (economy.costs.shellUpgrade as any)[stat];
      if (!config) {
         // Stability might not be in economy.json yet, fallback to armor formula if missing
         const fallback = economy.costs.shellUpgrade.armor;
         cost = Math.floor(fallback.baseCost * Math.pow(fallback.perLevelMultiplier, currentLevel));
      } else {
         cost = Math.floor(config.baseCost * Math.pow(config.perLevelMultiplier, currentLevel));
      }
    }

    if (profile.wallet.flux < cost) {
      return NextResponse.json({ 
        error: 'Insufficient Flux', 
        required: cost, 
        current: profile.wallet.flux 
      }, { status: 400 });
    }

    // Deduct and upgrade
    profile.wallet.flux -= cost;
    (profile.shellUpgrades[shellId] as any)[stat]++;

    await profileRepository.save(profile);

    return NextResponse.json({ 
      success: true, 
      newLevel: (profile.shellUpgrades[shellId] as any)[stat],
      cost,
      remainingFlux: profile.wallet.flux 
    });

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
