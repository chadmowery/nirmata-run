'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { TaikokuPlacard, DottedSpecRow, BtnLever } from './atomic';
import styles from './StaircaseOverlay.module.css';

export const StaircaseOverlay: React.FC = () => {
  const staircaseData = useStore(gameStore, (s) => s.staircaseData);
  const makeStaircaseDecision = useStore(gameStore, (s) => s.makeStaircaseDecision);

  if (!staircaseData) return null;

  const targetStr = String(staircaseData.targetFloor).padStart(2, '0');
  const currentStr = String(Math.max(1, staircaseData.targetFloor - 1)).padStart(2, '0');

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="staircase-title"
    >
      <div className={styles.modalContent}>
        <TaikokuPlacard
          kanji="隔壁降下"
          title={`AIRLOCK DESCENT // TRANSIT TO SUB-LEVEL ${targetStr}`}
          stampText="昇降機降下 // DESCENT"
          stampVariant="cyan"
          onClose={() => makeStaircaseDecision(false)}
          closeLabel="✕ ABORT [ESC]"
          style={{ marginBottom: 0, border: 'none', borderBottom: '3px solid #000000' }}
        />

        <div className={styles.modalBody}>
          <div style={{ fontSize: '11px', color: 'var(--c-text-dim)', lineHeight: 1.5 }}>
            Airlock decompression verified. Transit to Sub-Level {targetStr} will conclude current
            sector operations. Reality stability will deplete upon transit gate disengagement.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <DottedSpecRow label="CURRENT SUB-LEVEL" value={`SECTOR ${currentStr}`} />
            <DottedSpecRow
              label="DESTINATION SUB-LEVEL"
              value={`SECTOR ${targetStr}`}
              valueColor="var(--c-accent-secondary)"
            />
            <DottedSpecRow
              label="STABILITY DRAIN PENALTY"
              value="-20.0% BASE DRAIN"
              valueColor="var(--c-warning)"
            />
            <DottedSpecRow
              label="THREAT ESCALATION"
              value="ELEVATED CORRUPTION"
              valueColor="var(--c-danger)"
            />
          </div>

          <BtnLever
            variant="cyan"
            onClick={() => makeStaircaseDecision(true)}
            rightSlot="[降下承認] →"
            style={{ width: '100%', padding: '12px 20px', marginTop: '6px' }}
          >
            AUTHORIZE AIRLOCK DESCENT // 昇降機降下
          </BtnLever>
        </div>
      </div>
    </div>
  );
};

export default StaircaseOverlay;
