'use client';

import React from 'react';
import { TaikokuStamp } from './TaikokuStamp';

export interface TaikokuPlacardProps {
  kanji: string;
  title: string;
  tag?: string;
  stampText?: string;
  stampVariant?: 'danger' | 'cyan' | 'secured';
  metaText?: string;
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const TaikokuPlacard: React.FC<TaikokuPlacardProps> = ({
  kanji,
  title,
  tag,
  stampText,
  stampVariant = 'danger',
  metaText,
  onClose,
  closeLabel = '✕ CLOSE [ESC]',
  className = '',
  style,
}) => {
  return (
    <header className={`taikoku-placard ${className}`} style={style}>
      <div className="placard-title">
        <span className="placard-kanji">{kanji}</span>
        <span>{title}</span>
        {tag && <span className="placard-tag">{tag}</span>}
      </div>

      <div className="placard-meta">
        {stampText && <TaikokuStamp variant={stampVariant}>{stampText}</TaikokuStamp>}
        {metaText && <span>{metaText}</span>}
        {onClose && (
          <button
            type="button"
            className="tool-btn"
            onClick={onClose}
            aria-label={closeLabel}
            style={{ color: 'var(--c-danger)', borderColor: 'var(--c-danger)' }}
          >
            {closeLabel}
          </button>
        )}
      </div>
    </header>
  );
};
