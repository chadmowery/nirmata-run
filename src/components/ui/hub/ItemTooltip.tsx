'use client';

import React, { useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { VaultItem } from '@/shared/profile';
import { DottedSpecRow, TaikokuStamp } from '../atomic';
import { ItemMetadata, resolveItemMetadata } from './item-metadata';
import styles from './ItemTooltip.module.css';

export interface ItemTooltipProps {
  item?: VaultItem | null;
  metadata?: ItemMetadata | null;
  position: { x: number; y: number };
  visible: boolean;
  onDismiss?: () => void;
}

export const ItemTooltip: React.FC<ItemTooltipProps> = ({
  item,
  metadata: providedMetadata,
  position,
  visible,
  onDismiss,
}) => {
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number }>({
    x: position.x + 16,
    y: position.y + 16,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Escape key light-dismiss as per WCAG 1.4.13
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const tooltipWidth = 320;
    const tooltipHeight = 280;

    let targetX = position.x + 16;
    let targetY = position.y + 16;

    if (targetX + tooltipWidth > window.innerWidth - 12) {
      targetX = Math.max(12, position.x - tooltipWidth - 12);
    }
    if (targetY + tooltipHeight > window.innerHeight - 12) {
      targetY = Math.max(12, window.innerHeight - tooltipHeight - 12);
    }

    setCoords({ x: targetX, y: targetY });
  }, [position.x, position.y]);

  if (!mounted || !visible) return null;

  const metadata: ItemMetadata | null =
    providedMetadata ||
    (item
      ? resolveItemMetadata({
          templateId: item.templateId,
          type: item.itemType,
          rarity: item.rarityTier,
          floor: item.extractedAtFloor,
          entityId: item.entityId,
        })
      : null);

  if (!metadata) return null;

  const tooltipElement = (
    <div
      role="tooltip"
      aria-live="polite"
      className={styles.tooltipRoot}
      style={{
        left: `${coords.x}px`,
        top: `${coords.y}px`,
      }}
    >
      <div className={`${styles.cornerMark} ${styles.tl}`}>+</div>
      <div className={`${styles.cornerMark} ${styles.tr}`}>+</div>
      <div className={`${styles.cornerMark} ${styles.bl}`}>+</div>
      <div className={`${styles.cornerMark} ${styles.br}`}>+</div>

      {/* Header with Title, Kanji Subtitle, and Status Stamp */}
      <div className={styles.header}>
        <div>
          <div className={styles.kanjiSub}>{metadata.kanjiSub}</div>
          <h4 className={styles.title}>{metadata.name}</h4>
          <span className={styles.typeBadge}>{metadata.typeLabel}</span>
        </div>
        <TaikokuStamp variant={metadata.statusVariant}>{metadata.statusBadge}</TaikokuStamp>
      </div>

      {/* Description Box */}
      <div className={styles.descriptionBox}>{metadata.description}</div>

      {/* Specs Matrix */}
      {metadata.specs.length > 0 && (
        <div className={styles.specsList}>
          {metadata.specs.map((spec, idx) => (
            <DottedSpecRow
              key={`${spec.label}-${idx}`}
              label={spec.label}
              value={spec.value}
              valueColor={spec.color}
            />
          ))}
        </div>
      )}

      {/* Constructivist Footer */}
      <div className={styles.footer}>
        <span>{metadata.footerText || 'TAIKOKU LOGISTICS // TELEMETRY LINK ACTIVE'}</span>
        <span className={styles.footerLink}>[ESC: DISMISS]</span>
      </div>
    </div>
  );

  return createPortal(tooltipElement, document.body);
};

export default ItemTooltip;
