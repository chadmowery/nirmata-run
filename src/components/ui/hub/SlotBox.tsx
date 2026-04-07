import React from 'react';
import styles from './SlotBox.module.css';

interface SlotBoxProps {
  filled: boolean;
  legacy?: boolean;
  itemName?: string;
  slotType: 'firmware' | 'augment' | 'software';
  onHover?: (name: string) => void;
  onHoverEnd?: () => void;
}

export const SlotBox: React.FC<SlotBoxProps> = ({
  filled,
  legacy = false,
  itemName,
  slotType,
  onHover,
  onHoverEnd
}) => {
  const handleMouseEnter = () => {
    if (filled && itemName && onHover) {
      onHover(itemName);
    }
  };

  const initials = itemName ? itemName.substring(0, 2).toUpperCase() : '';

  return (
    <div 
      className={`
        ${styles.slotBox} 
        ${filled ? styles.filled : styles.empty} 
        ${legacy ? styles.legacy : ''}
        ${styles[slotType]}
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onHoverEnd}
      aria-label={`${slotType} slot: ${filled ? (itemName || 'equipped') : 'empty'}${legacy ? ' (LEGACY)' : ''}`}
    >
      <div className={styles.icon}>
        {filled ? (
          <span className={styles.initials}>{initials || '■'}</span>
        ) : (
          <span className={styles.emptyIcon}>□</span>
        )}
      </div>
      {legacy && <div className={styles.legacyTag}>LEGACY</div>}
      {filled && legacy && <div className={styles.legacyOverlay} />}
    </div>
  );
};
