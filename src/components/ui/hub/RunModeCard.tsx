'use client';

import React from 'react';
import { RunMode } from '@/shared/run-mode';
import { ModeAvailability } from '@/game/ui/store';
import { TaikokuStamp } from '../atomic';
import styles from './RunModeCard.module.css';

interface RunModeCardProps {
  availability: ModeAvailability;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}

export const RunModeCard: React.FC<RunModeCardProps> = ({
  availability,
  selected,
  disabled,
  onSelect,
}) => {
  const isWeekly = availability.mode === RunMode.WEEKLY;
  const isDaily = availability.mode === RunMode.DAILY;
  const isExhausted = !availability.available && availability.attemptsRemaining !== 'unlimited';

  const badgeText = isWeekly
    ? 'PERMADEATH'
    : isDaily
      ? 'DAILY SEED'
      : 'TRAINING';

  const multiplierText = isWeekly ? '4.0x REWARDS' : isDaily ? '1.5x REWARDS' : '1.0x REWARDS';

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''} ${
        disabled || isExhausted ? styles.disabled : ''
      } ${isWeekly ? styles.weekly : ''}`}
      onClick={() => !disabled && !isExhausted && onSelect()}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${availability.name} mode, ${availability.available ? 'available' : 'unavailable'}`}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled && !isExhausted) {
          onSelect();
        }
      }}
    >
      <div>
        <div className={styles.headerRow}>
          <h3 className={styles.name}>{availability.name}</h3>
          <TaikokuStamp variant={isWeekly ? 'danger' : isDaily ? 'cyan' : 'secured'}>
            {badgeText}
          </TaikokuStamp>
        </div>

        <div className={styles.attempts}>
          {availability.attemptsRemaining === 'unlimited'
            ? 'UNLIMITED ACCESS // SYNTHETIC MATRIX'
            : `ATTEMPTS REMAINING: ${availability.attemptsRemaining}`}
        </div>

        <p className={styles.description}>{availability.description}</p>
      </div>

      <div className={styles.footerRow}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--c-scrap)', fontWeight: 800 }}>
          {multiplierText}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--c-text-dim)' }}>
          {availability.available ? 'READY' : availability.reason || 'LOCKED'}
        </span>
      </div>
    </div>
  );
};
