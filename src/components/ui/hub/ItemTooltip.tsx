'use client';

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
  const tooltipRef = useRef<HTMLDivElement>(null);
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

    const el = tooltipRef.current;
    const tooltipWidth = el ? el.offsetWidth : 320;
    const tooltipHeight = el ? el.offsetHeight : 280;
    const margin = 16;

    let targetX = position.x + margin;
    let targetY = position.y + margin;

    // Flip horizontally if overflow on right
    if (targetX + tooltipWidth > window.innerWidth - margin) {
      targetX = position.x - tooltipWidth - margin;
    }

    // Flip vertically if overflow on bottom
    if (targetY + tooltipHeight > window.innerHeight - margin) {
      targetY = position.y - tooltipHeight - margin;
    }

    // Hard clamp to ensure the tooltip is never cut off by viewport edges
    const maxX = Math.max(margin, window.innerWidth - tooltipWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - tooltipHeight - margin);
    targetX = Math.max(margin, Math.min(targetX, maxX));
    targetY = Math.max(margin, Math.min(targetY, maxY));

    setCoords({ x: targetX, y: targetY });
  }, [position.x, position.y, providedMetadata, item]);

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
          socketedSoftware: item.socketedSoftware,
        })
      : null);

  if (!metadata) return null;

  const tooltipElement = (
    <div
      ref={tooltipRef}
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

      {/* Loaded Software Subroutine Modifiers Box */}
      {metadata.socketedSoftwareDetails && metadata.socketedSoftwareDetails.length > 0 && (
        <div className={styles.softwareModBox}>
          <div className={styles.modBoxHeader}>LOADED SOFTWARE SUBROUTINE // MODIFIERS</div>
          {metadata.socketedSoftwareDetails.map((sw) => (
            <div key={sw.id} className={styles.modEntry}>
              <div className={styles.modHeader}>
                <span className={styles.modIcon}>⚡</span>
                <span className={styles.modName}>{sw.name}</span>
                <span className={styles.modSlot}>[{sw.targetSlot.toUpperCase()}]</span>
              </div>
              <div className={styles.modEffect}>{sw.effect}</div>
            </div>
          ))}
        </div>
      )}

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
