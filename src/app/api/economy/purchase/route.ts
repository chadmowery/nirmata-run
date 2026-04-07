import { NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { generateShopStock } from '../../../../game/systems/shop-rotation';
import { VAULT_MAX_SLOTS, inferItemType } from '@/shared/vault';
import { VaultItem } from '@/shared/profile';

const PurchaseRequestSchema = z.object({
  sessionId: z.string(),
  itemIndex: z.number().int().min(0).max(5),
  weekSeed: z.number(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = PurchaseRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: result.error
      }, { status: 400 });
    }

    const { sessionId, itemIndex, weekSeed } = result.data;
    const profile = await profileRepository.load(sessionId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const stock = generateShopStock(weekSeed);
    const item = stock[itemIndex];

    if (!item) {
      return NextResponse.json({ error: 'Invalid item index' }, { status: 400 });
    }

    if (profile.wallet.scrap < item.price) {
      return NextResponse.json({
        error: 'Insufficient Scrap',
        required: item.price,
        current: profile.wallet.scrap
      }, { status: 400 });
    }

    // Check vault capacity per user requirement
    if (profile.vault.length >= VAULT_MAX_SLOTS) {
      return NextResponse.json({ 
        error: 'Vault is full', 
        capacity: VAULT_MAX_SLOTS 
      }, { status: 400 });
    }

    // Deduct
    profile.wallet.scrap -= item.price;

    // Persist purchased item to Vault
    const now = Date.now();
    const vaultItem: VaultItem = {
      entityId: now,
      templateId: item.templateId,
      rarityTier: item.rarity,
      itemType: inferItemType(item.templateId),
      extractedAtFloor: 0, // 0 indicates Hub purchase
      extractedAtTimestamp: now,
    };

    profile.vault.push(vaultItem);

    await profileRepository.save(profile);

    return NextResponse.json({
      success: true,
      purchased: item,
      vaultItem, // Return the official VaultItem with the server-generated ID
      remainingScrap: profile.wallet.scrap
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
