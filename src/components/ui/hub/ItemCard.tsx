import React, { useState, useRef } from 'react';
import { VaultItem } from '@/shared/profile';
import { ItemIcon } from '../atomic';
import styles from './ItemCard.module.css';

interface ItemCardProps {
  item: VaultItem;
  onDragStart: (item: VaultItem) => void;
  onHover?: (item: VaultItem, e: React.PointerEvent) => void;
  onHoverEnd?: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onDragStart, onHover, onHoverEnd }) => {
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const getRarityClass = () => {
    switch (item.rarityTier.toLowerCase()) {
      case 'common':
        return styles.rarityCommon;
      case 'uncommon':
        return styles.rarityUncommon;
      case 'rare':
        return styles.rarityRare;
      case 'legendary':
        return styles.rarityLegendary;
      default:
        return styles.rarityCommon;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Left click only

    setIsDragging(true);
    onDragStart(item);

    // Create ghost element
    const card = cardRef.current;
    if (!card) return;

    const ghost = card.cloneNode(true) as HTMLDivElement;
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '1000';
    ghost.style.opacity = '0.8';
    ghost.style.width = `${card.offsetWidth}px`;
    ghost.style.height = `${card.offsetHeight}px`;
    ghost.style.left = `${e.clientX - e.nativeEvent.offsetX}px`;
    ghost.style.top = `${e.clientY - e.nativeEvent.offsetY}px`;
    ghost.style.transition = 'none';
    document.body.appendChild(ghost);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      ghost.style.left = `${moveEvent.clientX - e.nativeEvent.offsetX}px`;
      ghost.style.top = `${moveEvent.clientY - e.nativeEvent.offsetY}px`;
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      document.body.removeChild(ghost);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div
      ref={cardRef}
      className={`
        ${styles.card} 
        ${getRarityClass()} 
        ${isDragging ? styles.dragging : ''}
      `}
      onPointerDown={handlePointerDown}
      onPointerEnter={(e) => onHover?.(item, e)}
      onPointerLeave={onHoverEnd}
    >
      <div className={styles.iconContainer}>
        <ItemIcon
          templateId={item.templateId}
          name={item.templateId}
          itemType={item.itemType}
          rarityTier={item.rarityTier}
          size="sm"
        />
      </div>
      <div className={styles.content}>
        <div className={styles.itemName}>{item.templateId}</div>
        <div className={styles.itemMeta}>
          <span className={styles.itemType}>{item.itemType.toUpperCase()}</span>
          <span className={styles.dot}>•</span>
          <span className={styles.rarityText}>{item.rarityTier.toUpperCase()}</span>
          {item.socketedSoftware && item.socketedSoftware.length > 0 && (
            <>
              <span className={styles.dot}>•</span>
              <span className={styles.swTag}>
                SW: {item.socketedSoftware.join(', ').toUpperCase()}
              </span>
            </>
          )}
        </div>
      </div>
      {item.extractedAtFloor > 10 && <div className={styles.legacyTag}>LEGACY</div>}
    </div>
  );
};
