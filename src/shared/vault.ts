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
