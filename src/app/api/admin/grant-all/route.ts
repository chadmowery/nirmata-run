import { NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { grantDebugVaultAndCurrencies } from '@/shared/vault';
import { createDefaultProfile } from '@/shared/profile';

const GrantAllRequestSchema = z.object({
  sessionId: z.string().optional(),
});

export async function POST(req: Request) {
  const envBlocked = checkNonProductionOnly();
  if (envBlocked) return envBlocked;

  try {
    let sessionId: string | undefined;
    if (req.headers.get('content-type')?.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      const result = GrantAllRequestSchema.safeParse(body);
      if (result.success) {
        sessionId = result.data.sessionId;
      }
    }

    const finalSessionId = sessionId || 'default-player-session';
    let profile = await profileRepository.load(finalSessionId);
    if (!profile) {
      profile = createDefaultProfile(finalSessionId);
    }

    const grantResult = grantDebugVaultAndCurrencies(profile);
    await profileRepository.save(profile);

    return NextResponse.json({
      success: true,
      message: `Granted ${grantResult.itemsGranted} items to Vault and added 1000 of each currency`,
      result: grantResult,
      vaultCount: profile.vault.length,
      wallet: profile.wallet,
      profile,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 },
    );
  }
}
