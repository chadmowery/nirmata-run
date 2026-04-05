import { NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import economyRaw from '../../../../game/entities/templates/economy.json';
import { EconomyConfig } from '@/shared/economy-types';
import { ShellUpgrades } from '@/shared/profile';

const economy = economyRaw as unknown as EconomyConfig;

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

    const upgrades = profile.shellUpgrades[shellId];
    const currentLevel = upgrades[stat as keyof ShellUpgrades];
    let cost = 0;

    if (stat === 'additionalPorts') {
      cost = Math.floor(
        economy.costs.shellUpgrade.additionalPort.baseCost *
        Math.pow(economy.costs.shellUpgrade.additionalPort.perPortMultiplier, currentLevel)
      );
    } else {
      // In this branch, stat is speed, armor, or stability
      const upgradeKey = stat as 'speed' | 'armor' | 'stability';
      const config = economy.costs.shellUpgrade[upgradeKey];
      
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
    upgrades[stat as keyof ShellUpgrades]++;

    await profileRepository.save(profile);

    return NextResponse.json({
      success: true,
      newLevel: upgrades[stat as keyof ShellUpgrades],
      cost,
      remainingFlux: profile.wallet.flux
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
