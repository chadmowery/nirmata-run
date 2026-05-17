import React from 'react';
import styles from './InventoryOverlay.module.css';
import { EquipmentPanel } from './EquipmentPanel';
import { BackpackGrid } from './BackpackGrid';

export const InventoryOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className={styles.overlayContainer} onClick={onClose}>
      <div className={styles.splitLayout} onClick={e => e.stopPropagation()}>
        <EquipmentPanel />
        <BackpackGrid />
      </div>
    </div>
  );
};
