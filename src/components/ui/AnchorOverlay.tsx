'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { TaikokuPlacard, DottedSpecRow, BtnLever } from './atomic';
import styles from './AnchorOverlay.module.css';

export const AnchorOverlay: React.FC = () => {
  const anchorData = useStore(gameStore, (s) => s.anchorData);
  const makeAnchorDecision = useStore(gameStore, (s) => s.makeAnchorDecision);
  const hideAnchorOverlay = useStore(gameStore, (s) => s.hideAnchorOverlay);

  if (!anchorData) return null;

  const handleExtract = () => {
    makeAnchorDecision('extract');
  };

  const handleDescend = () => {
    if (anchorData.inventory.scrap < anchorData.descendCost) return;
    makeAnchorDecision('descend');
  };

  const canDescend = anchorData.inventory.scrap >= anchorData.descendCost;
  const totalItems =
    anchorData.inventory.firmware.length +
    anchorData.inventory.augments.length +
    anchorData.inventory.software.length;

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="anchor-title"
    >
      <div className={styles.modalContent}>
        <TaikokuPlacard
          kanji="現実固定装置"
          title="STABILITY ANCHOR TERMINAL // EXTRACTION PROTOCOL"
          stampText="アンカー展開 // LOCK"
          stampVariant="cyan"
          onClose={hideAnchorOverlay}
          closeLabel="✕ ABORT [ESC]"
          style={{ marginBottom: 0, border: 'none', borderBottom: '3px solid #000000' }}
        />

        <div className={styles.modalBody}>
          <div style={{ fontSize: '11px', color: 'var(--c-text-dim)', lineHeight: 1.5 }}>
            Reality anchor deployed. Operators may extract immediately to guarantee 100% salvage
            and persistent profile sync, or pay the tether cost to stabilize reality and proceed
            deeper into the void.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <DottedSpecRow
              label="CURRENT FLOOR DEPTH"
              value={`SUB-LEVEL ${String(anchorData.floorNumber).padStart(2, '0')}`}
            />
            <DottedSpecRow
              label="UNSECURED SCRAP RECOVERED"
              value={`${anchorData.inventory.scrap.toLocaleString()} CR`}
              valueColor="var(--c-scrap)"
            />
            <DottedSpecRow
              label="UNSECURED ASSET CHIPS"
              value={`${totalItems} MODULES`}
            />
            <DottedSpecRow
              label="REALITY STABILITY INDEX"
              value={`${Math.round(anchorData.stabilityPercent)}% [LOCKED]`}
              valueColor="var(--c-accent-secondary)"
            />
            <DottedSpecRow
              label="NEXT SUB-LEVEL ENEMY TIER"
              value={anchorData.nextFloorEnemyTier}
              valueColor="var(--c-danger)"
            />
            <DottedSpecRow
              label="ESTIMATED STABILITY AFTER DESCENT"
              value={`+40% -> ${anchorData.estimatedStabilityAfterDescent}%`}
              valueColor="var(--c-accent)"
            />
          </div>

          <div className={styles.decisionRow}>
            <BtnLever variant="primary" onClick={handleExtract} rightSlot="100% REWARD">
              INITIATE EXTRACTION [離脱承認]
            </BtnLever>

            <BtnLever
              variant="cyan"
              disabled={!canDescend}
              onClick={handleDescend}
              rightSlot={`${anchorData.descendCost} CR`}
            >
              PAY TETHER & DESCEND [降下]
            </BtnLever>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnchorOverlay;
