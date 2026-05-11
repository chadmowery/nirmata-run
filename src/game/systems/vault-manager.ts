import { VaultItem, ProfileRepository } from '@shared/profile';
import { VAULT_MAX_SLOTS, SELL_VALUES } from '@shared/vault';
import { logger } from '@engine/utils/logger';
import economy from '../entities/templates/economy.json';

/**
 * Deposits items into the session's profile overflow.
 */
export async function depositToOverflow(
  repo: ProfileRepository,
  sessionId: string, 
  items: VaultItem[]
): Promise<void> {
  const profile = await repo.load(sessionId);
  if (!profile) return;

  profile.overflow.push(...items);
  await repo.save(profile);
}

/**
 * Removes an item from overflow by entityId.
 * Returns true if item was found and removed.
 */
export async function discardOverflowItem(
  repo: ProfileRepository,
  sessionId: string, 
  entityId: number
): Promise<boolean> {
  const profile = await repo.load(sessionId);
  if (!profile) return false;

  const initialLength = profile.overflow.length;
  profile.overflow = profile.overflow.filter(item => item.entityId !== entityId);
  
  const success = profile.overflow.length < initialLength;
  if (success) {
    await repo.save(profile);
    logger.info(`Vault Manager: Discarded item ${entityId} from overflow for session ${sessionId}`, 'SYSTEM');
  }
  return success;
}

/**
 * Sells an item from overflow for Scrap.
 * Respects economy scrap cap.
 */
export async function sellOverflowItem(
  repo: ProfileRepository,
  sessionId: string, 
  entityId: number
): Promise<{ success: boolean; scrapGained: number }> {
  const profile = await repo.load(sessionId);
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

  await repo.save(profile);
  logger.info(`Vault Manager: Sold item ${entityId} for ${scrapGained} scrap for session ${sessionId}`, 'SYSTEM');
  return { success: true, scrapGained };
}

/**
 * Moves items from overflow to vault up to VAULT_MAX_SLOTS.
 */
export async function moveOverflowToVault(
  repo: ProfileRepository,
  sessionId: string
): Promise<{ moved: number; remaining: number }> {
  const profile = await repo.load(sessionId);
  if (!profile) return { moved: 0, remaining: 0 };

  const slotsAvailable = VAULT_MAX_SLOTS - profile.vault.length;
  if (slotsAvailable <= 0) {
    return { moved: 0, remaining: profile.overflow.length };
  }

  const itemsToMove = profile.overflow.splice(0, slotsAvailable);
  profile.vault.push(...itemsToMove);

  await repo.save(profile);
  logger.info(`Vault Manager: Moved ${itemsToMove.length} items from overflow to vault for session ${sessionId}`, 'SYSTEM');
  return { moved: itemsToMove.length, remaining: profile.overflow.length };
}

/**
 * Returns true if the session has items in overflow.
 */
export async function hasOverflow(repo: ProfileRepository, sessionId: string): Promise<boolean> {
  const profile = await repo.load(sessionId);
  return (profile?.overflow.length ?? 0) > 0;
}
