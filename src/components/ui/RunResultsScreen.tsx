'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { GameState } from '@/game/states/types';
import { TaikokuStamp, BtnLever } from './atomic';
import styles from './RunResultsScreen.module.css';

export const RunResultsScreen: React.FC = () => {
  const runResults = useStore(gameStore, (s) => s.runResults);
  const setGameStatus = useStore(gameStore, (s) => s.setGameStatus);
  const setActiveTab = useStore(gameStore, (s) => s.setActiveTab);

  if (!runResults) return null;

  const isExtraction = runResults.reason.toLowerCase() === 'extraction';

  const calculatedScore =
    runResults.score ||
    runResults.floorNumber * 100 +
      runResults.enemiesKilled * 10 +
      (runResults.itemsSecured?.scrap ?? 0) * 1;

  const handleReturnToDeck = () => {
    setActiveTab('vault');
    setGameStatus(GameState.Hub);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.manifestBill}>
        {/* Bill of Lading Constructivist Header */}
        <div className={styles.billHeader}>
          <div>
            <div className={styles.billSubtitle}>
              対空重工業 // TAIKOKU HEAVY DYNAMICS // BILL OF LADING & POST-MISSION RECORD
            </div>
            <h1
              className={`${styles.billTitle} ${isExtraction ? styles.titleExtract : styles.titleDeath}`}
            >
              {isExtraction
                ? 'MISSION COMPLETED // EXTRACTION SUCCESSFUL'
                : 'NEURAL LINK SEVERED // OPERATOR KIA'}
            </h1>
            {runResults.deathReason && !isExtraction && (
              <div className={styles.deathReasonTag}>
                CATASTROPHIC VECTOR: {runResults.deathReason}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <TaikokuStamp variant={isExtraction ? 'secured' : 'danger'}>
              {isExtraction ? '承認済 // SECURED' : '全損 // CATASTROPHIC LOSS'}
            </TaikokuStamp>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 700,
                color: '#555555',
              }}
            >
              LOT: TK-RUN-{Date.now().toString().slice(-6)}
            </span>
          </div>
        </div>

        {/* 4-Column Telemetry Ledger Grid */}
        <div className={styles.ledgerGrid}>
          <div className={styles.ledgerCell}>
            <span className={styles.ledgerLabel}>FLOORS CLEARED</span>
            <span className={styles.ledgerVal}>{runResults.floorNumber}</span>
          </div>
          <div className={styles.ledgerCell}>
            <span className={styles.ledgerLabel}>THREATS NEUTRALIZED</span>
            <span className={styles.ledgerVal}>{runResults.enemiesKilled}</span>
          </div>
          <div className={styles.ledgerCell}>
            <span className={styles.ledgerLabel}>TURNS ELAPSED</span>
            <span className={styles.ledgerVal}>{runResults.turnsElapsed}</span>
          </div>
          <div className={styles.ledgerCell}>
            <span className={styles.ledgerLabel}>PEAK CORE HEAT</span>
            <span className={styles.ledgerVal}>{runResults.peakHeat ?? 0}%</span>
          </div>
        </div>

        {/* Recovered Cargo Manifest */}
        <div className={styles.cargoManifestBox}>
          <div className={styles.manifestHeader}>
            <span>{isExtraction ? 'RECOVERED ASSET MANIFEST' : 'UNSECURED ASSET CASUALTY REPORT'}</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              VERIFIED SCORE: {calculatedScore.toLocaleString()} PTS
            </span>
          </div>

          <div className={styles.manifestRow}>
            <span className={styles.manifestRowLabel}>
              {isExtraction ? 'RUN SCRAP SECURED TO VAULT' : 'SCRAP LOST IN VOID'}
            </span>
            <span className={styles.manifestRowVal} style={{ color: isExtraction ? '#007722' : 'var(--c-danger)' }}>
              {isExtraction ? `+${runResults.itemsSecured?.scrap ?? 0} CR` : `-${runResults.itemsSecured?.scrap ?? 0} CR`}
            </span>
          </div>

          <div className={styles.manifestRow}>
            <span className={styles.manifestRowLabel}>FIRMWARE HARDWARE MODULES</span>
            <span className={styles.manifestRowVal}>
              {runResults.itemsSecured?.firmware ?? 0} UNITS
            </span>
          </div>

          <div className={styles.manifestRow}>
            <span className={styles.manifestRowLabel}>TACTICAL AUGMENT CHIPS</span>
            <span className={styles.manifestRowVal}>
              {runResults.itemsSecured?.augments ?? 0} UNITS
            </span>
          </div>

          <div className={styles.manifestRow}>
            <span className={styles.manifestRowLabel}>SOFTWARE SUBROUTINES</span>
            <span className={styles.manifestRowVal}>
              {runResults.itemsSecured?.software ?? 0} UNITS
            </span>
          </div>
        </div>

        {/* Footer with Return Action */}
        <div className={styles.billFooter}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#444444' }}>
            TAIKOKU LOGISTICS AUTH: TK-MANIFEST-OK // RETURN TO RECOVERY TERMINAL
          </div>
          <BtnLever
            variant={isExtraction ? 'primary' : 'danger'}
            onClick={handleReturnToDeck}
            rightSlot="→"
          >
            RETURN TO NEURAL DECK [デッキ帰還]
          </BtnLever>
        </div>
      </div>
    </div>
  );
};
