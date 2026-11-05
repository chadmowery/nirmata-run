'use client';

import React, { useRef, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import styles from './TacticalInspectTooltip.module.css';

export const TacticalInspectTooltip: React.FC = () => {
  const hoveredEntity = useStore(gameStore, (s) => s.hoveredEntity);
  const detailedFlavorTextEnabled = useStore(gameStore, (s) => s.detailedFlavorTextEnabled);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number }>(() => ({
    x: hoveredEntity ? hoveredEntity.screenX + 16 : 0,
    y: hoveredEntity ? hoveredEntity.screenY + 16 : 0,
  }));

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || !hoveredEntity) return;

    const el = tooltipRef.current;
    const width = el ? el.offsetWidth : 310;
    const height = el ? el.offsetHeight : 240;
    const margin = 16;

    let targetX = hoveredEntity.screenX + margin;
    let targetY = hoveredEntity.screenY + margin;

    // Flip horizontally if overflow on right edge
    if (targetX + width > window.innerWidth - margin) {
      targetX = hoveredEntity.screenX - width - margin;
    }

    // Flip vertically if overflow on bottom edge
    if (targetY + height > window.innerHeight - margin) {
      targetY = hoveredEntity.screenY - height - margin;
    }

    // Clamp coordinates within visible viewport bounds
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);
    targetX = Math.max(margin, Math.min(targetX, maxX));
    targetY = Math.max(margin, Math.min(targetY, maxY));

    setCoords({ x: targetX, y: targetY });
  }, [hoveredEntity]);

  if (!hoveredEntity) {
    return null;
  }

  let variantClass = '';
  let badgeClass = styles.badgeCyan;
  if (hoveredEntity.badgeVariant === 'danger') {
    variantClass = styles.variantDanger;
    badgeClass = styles.badgeDanger;
  } else if (hoveredEntity.badgeVariant === 'orange') {
    variantClass = styles.variantOrange;
    badgeClass = styles.badgeOrange;
  } else if (hoveredEntity.badgeVariant === 'yellow') {
    variantClass = styles.variantYellow;
    badgeClass = styles.badgeYellow;
  }

  const hpPercent =
    hoveredEntity.maxHp && hoveredEntity.maxHp > 0
      ? Math.max(0, Math.min(100, ((hoveredEntity.hp ?? 0) / hoveredEntity.maxHp) * 100))
      : 0;

  const tooltipElement = (
    <div
      ref={tooltipRef}
      role="tooltip"
      className={`${styles.tooltipRoot} ${variantClass}`}
      style={{
        left: `${coords.x}px`,
        top: `${coords.y}px`,
      }}
    >
      {/* Corner Bracket Accents */}
      <span className={`${styles.cornerMark} ${styles.tl}`}>+</span>
      <span className={`${styles.cornerMark} ${styles.tr}`}>+</span>
      <span className={`${styles.cornerMark} ${styles.bl}`}>+</span>
      <span className={`${styles.cornerMark} ${styles.br}`}>+</span>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          {hoveredEntity.kanjiSub && (
            <span className={styles.kanjiSub}>{hoveredEntity.kanjiSub}</span>
          )}
          <h4 className={styles.title}>{hoveredEntity.name}</h4>
          {hoveredEntity.subTitle && (
            <span className={styles.subTitle}>{hoveredEntity.subTitle}</span>
          )}
        </div>

        {hoveredEntity.badge && (
          <span className={`${styles.badge} ${badgeClass}`}>{hoveredEntity.badge}</span>
        )}
      </div>

      {/* Vitals Bar (Enemies or Player) */}
      {hoveredEntity.maxHp !== undefined && (
        <div className={styles.vitalsRow}>
          <div className={styles.statBarContainer}>
            <div className={styles.statBarLabel}>
              <span>STRUCTURAL INTEGRITY</span>
              <span>
                {hoveredEntity.hp} / {hoveredEntity.maxHp} HP
              </span>
            </div>
            <div className={styles.statBarTrack}>
              <div className={styles.statBarFillHp} style={{ width: `${hpPercent}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Status Effects */}
      {hoveredEntity.statusEffects && hoveredEntity.statusEffects.length > 0 && (
        <div className={styles.statusEffectsList}>
          {hoveredEntity.statusEffects.map((effect, idx) => (
            <span key={idx} className={styles.statusChip}>
              {effect}
            </span>
          ))}
        </div>
      )}

      {/* Primary Description */}
      {hoveredEntity.description && (
        <p className={styles.description}>{hoveredEntity.description}</p>
      )}

      {/* Detailed Forensic Lore Block (Shown for detailed tiles or when flavorText is present) */}
      {hoveredEntity.flavorText && (
        <div className={styles.flavorBlock}>
          <span className={styles.flavorLabel}>FORENSIC ARCHIVE // LORE</span>
          <p className={styles.flavorText}>{hoveredEntity.flavorText}</p>
        </div>
      )}

      {/* Footer & Tactical Prompt */}
      <div className={styles.footer}>
        {hoveredEntity.interactionHint && (
          <div className={styles.hintRow}>
            <span>▶</span>
            <span>{hoveredEntity.interactionHint}</span>
          </div>
        )}

        <div className={styles.toggleHint}>
          <span>[T] FORENSICS: {detailedFlavorTextEnabled ? 'ON' : 'OFF'}</span>
          <span>GRID ({hoveredEntity.gridX}, {hoveredEntity.gridY})</span>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(tooltipElement, document.body);
};

export default TacticalInspectTooltip;
