'use client';
import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import styles from './AnchorOverlay.module.css';

export const AnchorOverlay: React.FC = () => {
  const anchorData = useStore(gameStore, (s) => s.anchorData);
  const makeAnchorDecision = useStore(gameStore, (s) => s.makeAnchorDecision);

  if (!anchorData) return null;

  const handleExtract = () => {
    makeAnchorDecision('extract');
  };

  const handleDescend = () => {
    if (anchorData.inventory.scrap < anchorData.descendCost) return;
    makeAnchorDecision('descend');
  };

  const hasItems = anchorData.inventory.firmware.length > 0 || 
                   anchorData.inventory.augments.length > 0 || 
                   anchorData.inventory.software.length > 0 ||
                   anchorData.inventory.scrap > 0;

  const canDescend = anchorData.inventory.scrap >= anchorData.descendCost;

  return (
    <div className={styles.overlay} role="dialog" aria-labelledby="anchor-title">
      <div className={styles.modal}>
        <h1 id="anchor-title" className={styles.title}>ANCHOR_LINK_ESTABLISHED</h1>
        <h2 className={styles.subtitle}>SYSTEM_HANDSHAKE // EXTRACTION_PROTOCOL</h2>

        <div className={styles.statusBar}>
          <span>CURRENT_FLOOR: {String(anchorData.floorNumber).padStart(2, '0')}</span>
          <span>REALITY: {Math.round(anchorData.stabilityPercent)}%</span>
        </div>

        <div className={styles.inventorySection}>
          <h3 className={styles.sectionHeading}>UNSECURED_ITEMS</h3>
          {!hasItems ? (
            <div className={styles.emptyState}>NO_UNSECURED_ITEMS // ALL_EQUIPMENT_LOCKED</div>
          ) : (
            <div className={styles.manifest}>
              {anchorData.inventory.firmware.length > 0 && (
                <details open>
                  <summary className={styles.categoryHeader}>FIRMWARE ({anchorData.inventory.firmware.length})</summary>
                  {anchorData.inventory.firmware.map((item, i) => (
                    <div key={i} className={styles.itemRow}>{item}</div>
                  ))}
                </details>
              )}
              {anchorData.inventory.augments.length > 0 && (
                <details open>
                  <summary className={styles.categoryHeader}>AUGMENTS ({anchorData.inventory.augments.length})</summary>
                  {anchorData.inventory.augments.map((item, i) => (
                    <div key={i} className={styles.itemRow}>{item}</div>
                  ))}
                </details>
              )}
              {anchorData.inventory.software.length > 0 && (
                <details open>
                  <summary className={styles.categoryHeader}>SOFTWARE ({anchorData.inventory.software.length})</summary>
                  {anchorData.inventory.software.map((item, i) => (
                    <div key={i} className={styles.itemRow}>{item}</div>
                  ))}
                </details>
              )}
              <details open>
                <summary className={styles.categoryHeader}>CURRENCY</summary>
                <div className={styles.itemRow}>Scrap: {anchorData.inventory.scrap}</div>
              </details>
            </div>
          )}
        </div>

        <div className={styles.buttonRow}>
          <button 
            className={styles.extractButton}
            onClick={handleExtract}
            aria-label="De-rezz and Extract"
          >
            DE-REZZ & EXTRACT
          </button>
          <div className={styles.descendContainer}>
            <button 
              className={styles.descendButton}
              onClick={handleDescend}
              disabled={!canDescend}
              aria-label="Stabilize and Descend"
            >
              STABILIZE & DESCEND
            </button>
            <div className={styles.riskInfo}>
              FLOOR {String(anchorData.floorNumber + 1).padStart(2, '0')} // {anchorData.nextFloorEnemyTier} // {anchorData.descendCost} SCRAP
            </div>
            {!canDescend && (
              <div className={styles.errorText}>
                INSUFFICIENT_SCRAP // {anchorData.descendCost} REQUIRED
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
