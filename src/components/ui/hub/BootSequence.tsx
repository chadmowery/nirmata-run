'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { BtnLever } from '../atomic';
import styles from './BootSequence.module.css';

interface BootSequenceProps {
  onComplete: () => void;
}

export const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const bootSequenceActive = useStore(gameStore, (s) => s.bootSequenceActive);
  const setBootSequenceActive = useStore(gameStore, (s) => s.setBootSequenceActive);
  const launchConfig = useStore(gameStore, (s) => s.launchConfig);

  const [visibleLines, setVisibleLines] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleFinish = useCallback(() => {
    setIsFadingOut(true);
    setTimeout(() => {
      setBootSequenceActive(false);
      onComplete();
    }, 250);
  }, [setBootSequenceActive, onComplete]);

  const lines = [
    '[0.012s] TAIKOKU KERNEL BOOT INITIALIZED... VEC-OS 1.0.4',
    '[0.084s] QUANTUM BUS SYNC: 1024-CHANNEL NEURAL ARRAY NOMINAL',
    `[0.210s] SEED ROTATION: #${launchConfig?.seed || 'W-4028'} VERIFIED`,
    `[0.450s] CHASSIS SYNC: ${launchConfig?.shellId || 'VANGUARD-v1'} LINKED [OK]`,
    '[0.720s] NEURAL LINK ENGAGED. ENTERING SUB-STRUCTURE.',
  ];

  useEffect(() => {
    if (!bootSequenceActive) {
      setVisibleLines(0);
      setIsFadingOut(false);
      return;
    }

    const timer = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev < lines.length) return prev + 1;
        clearInterval(timer);
        return prev;
      });
    }, 200);

    return () => clearInterval(timer);
  }, [bootSequenceActive, lines.length]);

  useEffect(() => {
    if (visibleLines === lines.length) {
      const holdTimer = setTimeout(() => {
        handleFinish();
      }, 500);
      return () => clearTimeout(holdTimer);
    }
  }, [visibleLines, lines.length, handleFinish]);

  if (!bootSequenceActive) return null;

  return (
    <div className={`${styles.bootScreen} ${isFadingOut ? styles.fadeOut : ''}`}>
      <div className={styles.terminalBox}>
        <div className={styles.terminalHeader}>
          <span>TAIKOKU KERNEL BOOT SEQUENCE // VEC-OS 1.0.4</span>
          <span style={{ color: 'var(--c-accent)' }}>[STATUS: ACTIVE]</span>
        </div>

        <div className={styles.terminalBody}>
          {lines.slice(0, visibleLines).map((line, idx) => {
            const isLast = idx === lines.length - 1;
            return (
              <div
                key={idx}
                className={`${styles.logLine} ${isLast ? styles.accent : ''}`}
              >
                {line}
              </div>
            );
          })}
        </div>

        <div className={styles.terminalFooter}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--c-text-dim)' }}>
            PRESS ESC OR SKIP TO ABBREVIATE SEQUENCE
          </span>
          <BtnLever variant="primary" onClick={handleFinish} rightSlot="→">
            SKIP BOOT [出撃]
          </BtnLever>
        </div>
      </div>
    </div>
  );
};
