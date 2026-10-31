import React from 'react';
import { Cpu, Zap, Terminal, Crosshair, Shield, Box } from 'lucide-react';
import styles from './ItemIcon.module.css';

export type ItemIconType =
  | 'firmware'
  | 'augment'
  | 'software'
  | 'equipment'
  | 'weapon'
  | 'armor'
  | string;

export type ItemIconSize = 'sm' | 'md' | 'lg';

export interface ItemIconProps {
  templateId?: string;
  name?: string;
  itemType?: ItemIconType;
  rarityTier?: string;
  abbreviation?: string;
  size?: ItemIconSize;
  showAbbreviation?: boolean;
  showBorder?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const KNOWN_ITEM_ABBREVIATIONS: Record<string, string> = {
  // Firmware
  'phase-shift': 'PS',
  'neural-spike': 'NS',
  'extended-sight': 'ES',
  'basic-strike': 'BS',
  'kinetic-link': 'KL',
  'ghost-pulse': 'GP',
  'logic-jam': 'LJ',

  // Augments
  'displacement-venting': 'DV',
  'static-siphon': 'SS',
  'neural-feedback': 'NF',
  'phased-overdrive': 'PO',
  'neural-recursion': 'NR',
  'static-collapse': 'SC',
  'void-echo': 'VE',

  // Software
  'bleed-v0': 'B0',
  'bleed-v1': 'B1',
  'bleed-v2': 'B2',
  'bleed-v3': 'B3',
  'auto-loader-v0': 'L0',
  'auto-loader-v1': 'L1',
  'auto-loader-v2': 'L2',
  'auto-loader-v3': 'L3',
  'vampire-v0': 'V0',
  'vampire-v1': 'V1',
  'vampire-v2': 'V2',
  'vampire-v3': 'V3',
  'health-potion': 'HP',
  'buffer-overflow': 'BO',

  // Equipment - Weapons
  'rifle-v0': 'R0',
  'rifle-v1': 'R1',
  'rifle-v2': 'R2',
  'rifle-v3': 'R3',

  // Equipment - Armor
  'armor-v0': 'A0',
  'armor-v1': 'A1',
  'armor-v2': 'A2',
  'armor-v3': 'A3',
};

/**
 * Returns a 2-letter abbreviation for an item based on its templateId or name.
 */
export function getItemAbbreviation(templateId?: string, name?: string): string {
  if (templateId) {
    const lower = templateId.toLowerCase();
    if (KNOWN_ITEM_ABBREVIATIONS[lower]) {
      return KNOWN_ITEM_ABBREVIATIONS[lower];
    }
    const clean = lower.replace(/\.(sh|exe|sys|arc|msi)$/i, '');
    if (KNOWN_ITEM_ABBREVIATIONS[clean]) {
      return KNOWN_ITEM_ABBREVIATIONS[clean];
    }
    if (clean.includes('-')) {
      const parts = clean.split('-');
      if (parts[0] && parts[1]) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
    }
    if (clean.includes('_')) {
      const parts = clean.split('_');
      if (parts[0] && parts[1]) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
    }
    if (clean.length >= 2) {
      return clean.slice(0, 2).toUpperCase();
    }
  }

  if (name && name.length >= 2) {
    const parts = name.trim().split(/[\s_-]+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  return 'IT';
}

/**
 * Returns color hexadecimal code based on item rarity tier.
 */
export function getRarityColor(rarity?: string): string {
  switch (rarity?.toLowerCase()) {
    case 'uncommon':
      return '#00F0FF'; // Vibrant Cyan
    case 'rare':
      return '#FFB800'; // High-visibility Amber / Gold
    case 'legendary':
      return '#FF0055'; // Vibrant Crimson / Pink
    case 'common':
    default:
      return '#8A99AD'; // Slate / Muted Silver
  }
}

/**
 * Selects an appropriate Lucide icon component according to item type.
 */
function renderTypeIcon(type?: string, size = 16) {
  const norm = type?.toLowerCase() || '';
  if (norm === 'firmware') return <Cpu size={size} />;
  if (norm === 'augment') return <Zap size={size} />;
  if (norm === 'software') return <Terminal size={size} />;
  if (norm === 'weapon') return <Crosshair size={size} />;
  if (norm === 'armor') return <Shield size={size} />;
  if (norm === 'equipment') return <Crosshair size={size} />;
  return <Box size={size} />;
}

export const ItemIcon: React.FC<ItemIconProps> = ({
  templateId,
  name,
  itemType,
  rarityTier = 'common',
  abbreviation,
  size = 'md',
  showAbbreviation = true,
  showBorder = true,
  className,
  style,
}) => {
  const color = getRarityColor(rarityTier);
  const abbrev = abbreviation || getItemAbbreviation(templateId, name);

  const iconPx = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;

  const sizeClass =
    size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : styles.sizeMd;

  return (
    <div
      className={`${styles.itemIconContainer} ${sizeClass} ${className || ''}`}
      style={{
        border: showBorder ? `1.5px solid ${color}` : 'none',
        boxShadow: showBorder ? `0 0 8px ${color}33, inset 0 0 6px ${color}1a` : 'none',
        ...style,
      }}
      aria-label={`${name || templateId || 'Item'} (${itemType || 'item'}, ${rarityTier})`}
    >
      <div className={styles.iconGlyph} style={{ color }}>
        {renderTypeIcon(itemType, iconPx)}
      </div>

      {showAbbreviation && (
        <span className={styles.abbrev} style={{ color }}>
          {abbrev}
        </span>
      )}

      {showBorder && <div className={styles.cornerPip} style={{ background: color }} />}
    </div>
  );
};

export default ItemIcon;
