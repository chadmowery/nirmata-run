import React from 'react';
import { RunMode } from '@/shared/run-mode';
import { ModeAvailability } from '@/game/ui/store';
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
  const isExhausted = !availability.available && availability.attemptsRemaining !== 'unlimited';

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''} ${
        disabled || isExhausted ? styles.disabled : ''
      } ${isWeekly ? styles.weekly : styles.standard}`}
      onClick={() => !disabled && !isExhausted && onSelect()}
      role="button"
      aria-pressed={selected}
      aria-label={`${availability.name} mode, ${availability.available ? 'available' : 'unavailable'}`}
    >
      <div className={styles.badge} />
      <div className={styles.content}>
        <h3 className={styles.name}>{availability.name}</h3>
        <div className={styles.attempts}>
          {availability.attemptsRemaining === 'unlimited'
            ? 'UNLIMITED_ACCESS'
            : `ATTEMPTS: ${availability.attemptsRemaining}`}
        </div>
        
        {isExhausted && (
          <div className={styles.exhaustedBadge}>ATTEMPT_EXHAUSTED</div>
        )}
        
        {!availability.available && availability.reason && !isExhausted && (
          <div className={styles.reason}>{availability.reason}</div>
        )}

        {!availability.available && !isExhausted && (
          <div className={styles.countdown}>
            RESET_IN: {availability.reason || 'WAITING'}
          </div>
        )}

        <div className={styles.description}>{availability.description}</div>
      </div>
    </div>
  );
};
