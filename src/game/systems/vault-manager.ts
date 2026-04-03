import { loadProfile, saveProfile, VaultItem } from './profile-persistence';
import economy from '../entities/templates/economy.json';

export const VAULT_MAX_SLOTS = 30;

export const SELL_VALUES: Record<string, number> = {
  common: 15,
  uncommon: 30,
  rare: 60,
  legendary: 150,
};

/**
 * Infers item type from templateId.
 * Firmware: ends with .sh, .exe, .sys
 * Augment: ends with .arc
 * Software: anything else
 */
export function inferItemType(templateId: string): 'firmware' | 'augment' | 'software' {
  const lower = templateId.toLowerCase();
  if (lower.endsWith('.sh') || lower.endsWith('.exe') || lower.endsWith('.sys')) {
    return 'firmware';
  }
  if (lower.endsWith('.arc')) {
    return 'augment';
  }
  return 'software';
}

/**
 * Deposits items into the session's profile overflow.
 */
export async function depositToOverflow(sessionId: string, items: VaultItem[]): Promise<void> {
  const profile = await loadProfile(sessionId);
  if (!profile) return;

  profile.overflow.push(...items);
  await saveProfile(profile);
}

/**
 * Removes an item from overflow by entityId.
 * Returns true if item was found and removed.
 */
export async function discardOverflowItem(sessionId: string, entityId: number): Promise<boolean> {
  const profile = await loadProfile(sessionId);
  if (!profile) return false;

  const initialLength = profile.overflow.length;
  profile.overflow = profile.overflow.filter(item => item.entityId !== entityId);
  
  const success = profile.overflow.length < initialLength;
  if (success) {
    await saveProfile(profile);
  }
  return success;
}

/**
 * Sells an item from overflow for Scrap.
 * Respects economy scrap cap.
 */
export async function sellOverflowItem(
  sessionId: string, 
  entityId: number
): Promise<{ success: boolean; scrapGained: number }> {
  const profile = await loadProfile(sessionId);
  if (!profile) return { success: false, scrapGained: 0 };

  const itemIndex = profile.overflow.findIndex(item => item.entityId === entityId);
  if (itemIndex === -1) return { success: false, scrapGained: 0 };

  const item = profile.overflow[itemIndex];
  const scrapGained = SELL_VALUES[item.rarityTier.toLowerCase()] || 0;

  // Remove item
  profile.overflow.splice(itemIndex, 1);

  // Add scrap with cap
  const maxScrap = economy.caps.scrap;
  profile.wallet.scrap = Math.min(profile.wallet.scrap + scrapGained, maxScrap);

  await saveProfile(profile);
  return { success: true, scrapGained };
}

/**
 * Moves items from overflow to vault up to VAULT_MAX_SLOTS.
 */
export async function moveOverflowToVault(
  sessionId: string
): Promise<{ moved: number; remaining: number }> {
  const profile = await loadProfile(sessionId);
  if (!profile) return { moved: 0, remaining: 0 };

  const slotsAvailable = VAULT_MAX_SLOTS - profile.vault.length;
  if (slotsAvailable <= 0) {
    return { moved: 0, remaining: profile.overflow.length };
  }

  const itemsToMove = profile.overflow.splice(0, slotsAvailable);
  profile.vault.push(...itemsToMove);

  await saveProfile(profile);
  return { moved: itemsToMove.length, remaining: profile.overflow.length };
}

/**
 * Returns true if the session has items in overflow.
 */
export async function hasOverflow(sessionId: string): Promise<boolean> {
  const profile = await loadProfile(sessionId);
  return (profile?.overflow.length ?? 0) > 0;
}
