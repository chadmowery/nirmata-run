import { VaultItem, ProfileRepository } from '@shared/profile';
import { VAULT_MAX_SLOTS, getVaultItemValue } from '@shared/vault';
import { logger } from '@engine/utils/logger';
import economy from '../entities/templates/economy.json';

/**
 * Deposits items into the session's profile overflow.
 */
export async function depositToOverflow(
  repo: ProfileRepository,
  sessionId: string,
  items: VaultItem[],
): Promise<void> {
  const profile = await repo.load(sessionId);
  if (!profile) return;

  profile.overflow.push(...items);
  await repo.save(profile);
}

/**
 * Removes an item from overflow or vault by vaultItemId or entityId.
 * Returns true if item was found and removed.
 */
export async function discardOverflowItem(
  repo: ProfileRepository,
  sessionId: string,
  itemIdentifier: string | number,
): Promise<boolean> {
  const profile = await repo.load(sessionId);
  if (!profile) return false;

  const isTarget = (item: VaultItem) =>
    typeof itemIdentifier === 'string'
      ? item.vaultItemId === itemIdentifier || (item.entityId !== undefined && String(item.entityId) === itemIdentifier)
      : item.entityId === itemIdentifier || item.vaultItemId === String(itemIdentifier);

  let itemIndex = profile.overflow ? profile.overflow.findIndex(isTarget) : -1;
  let inOverflow = true;
  if (itemIndex === -1 && profile.vault) {
    itemIndex = profile.vault.findIndex(isTarget);
    inOverflow = false;
  }
  if (itemIndex === -1) return false;

  if (inOverflow) {
    profile.overflow.splice(itemIndex, 1);
  } else {
    profile.vault.splice(itemIndex, 1);
  }

  await repo.save(profile);
  logger.info(
    `Vault Manager: Discarded item ${itemIdentifier} from ${inOverflow ? 'overflow' : 'vault'} for session ${sessionId}`,
    'SYSTEM',
  );
  return true;
}

/**
 * Sells an item from overflow or vault for Scrap.
 * Respects economy scrap cap.
 */
export async function sellOverflowItem(
  repo: ProfileRepository,
  sessionId: string,
  itemIdentifier: string | number,
): Promise<{ success: boolean; scrapGained: number }> {
  const profile = await repo.load(sessionId);
  if (!profile) return { success: false, scrapGained: 0 };

  const isTarget = (item: VaultItem) =>
    typeof itemIdentifier === 'string'
      ? item.vaultItemId === itemIdentifier || (item.entityId !== undefined && String(item.entityId) === itemIdentifier)
      : item.entityId === itemIdentifier || item.vaultItemId === String(itemIdentifier);

  let itemIndex = profile.overflow ? profile.overflow.findIndex(isTarget) : -1;
  let inOverflow = true;
  if (itemIndex === -1 && profile.vault) {
    itemIndex = profile.vault.findIndex(isTarget);
    inOverflow = false;
  }
  if (itemIndex === -1) return { success: false, scrapGained: 0 };

  const item = inOverflow ? profile.overflow[itemIndex] : profile.vault[itemIndex];
  const scrapGained = getVaultItemValue(item);

  // Remove item
  if (inOverflow) {
    profile.overflow.splice(itemIndex, 1);
  } else {
    profile.vault.splice(itemIndex, 1);
  }

  // Add scrap with cap
  const maxScrap = economy.caps.scrap;
  profile.wallet.scrap = Math.min(profile.wallet.scrap + scrapGained, maxScrap);

  await repo.save(profile);
  logger.info(
    `Vault Manager: Sold item ${itemIdentifier} from ${inOverflow ? 'overflow' : 'vault'} for ${scrapGained} scrap for session ${sessionId}`,
    'SYSTEM',
  );
  return { success: true, scrapGained };
}

/**
 * Moves items from overflow to vault up to VAULT_MAX_SLOTS.
 */
export async function moveOverflowToVault(
  repo: ProfileRepository,
  sessionId: string,
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
  logger.info(
    `Vault Manager: Moved ${itemsToMove.length} items from overflow to vault for session ${sessionId}`,
    'SYSTEM',
  );
  return { moved: itemsToMove.length, remaining: profile.overflow.length };
}

/**
 * Returns true if the session has items in overflow.
 */
export async function hasOverflow(repo: ProfileRepository, sessionId: string): Promise<boolean> {
  const profile = await repo.load(sessionId);
  return (profile?.overflow.length ?? 0) > 0;
}
