'use client';

import React from 'react';
import { EquipmentPanel } from './EquipmentPanel';
import { BackpackGrid } from './BackpackGrid';
import { TaikokuPlacard } from '../atomic';
import styles from './InventoryOverlay.module.css';

export const InventoryOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  return (
    <div
      className={styles.inventoryContainer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-title"
      onClick={onClose}
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <TaikokuPlacard
          kanji="戦術インベントリ"
          title="TACTICAL BACKPACK & ACTIVE EQUIPMENT SLOTS"
          stampText="SLOTS // 4x5 GRID"
          stampVariant="cyan"
          onClose={onClose}
          closeLabel="✕ CLOSE [ESC]"
          style={{ marginBottom: 0, border: 'none', borderBottom: '3px solid #000000' }}
        />

        <div className={styles.splitLayout}>
          <EquipmentPanel />
          <BackpackGrid />
        </div>
      </div>
    </div>
  );
};

export default InventoryOverlay;
