import React, { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
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

  useEffect(() => {
    if (!bootSequenceActive) {
      setVisibleLines(0);
      setIsFadingOut(false);
      return;
    }

    const timer = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev < 4) return prev + 1;
        clearInterval(timer);
        return prev;
      });
    }, 250);

    return () => clearInterval(timer);
  }, [bootSequenceActive]);

  useEffect(() => {
    if (visibleLines === 4) {
      const holdTimer = setTimeout(() => {
        setIsFadingOut(true);
        const fadeTimer = setTimeout(() => {
          setBootSequenceActive(false);
          onComplete();
        }, 300);
        return () => clearTimeout(fadeTimer);
      }, 500);
      return () => clearTimeout(holdTimer);
    }
  }, [visibleLines, setBootSequenceActive, onComplete]);

  if (!bootSequenceActive) return null;

  const lines = [
    'INITIALIZING_SESSION...',
    'LOADING_NEURAL_DECK...',
    `SEED: ${launchConfig?.seed || 'UNKNOWN'}`,
    'DEPLOYING_SHELL...',
  ];

  return (
    <div className={`${styles.bootScreen} ${isFadingOut ? styles.fadeOut : ''}`}>
      <div className={styles.container}>
        {lines.slice(0, visibleLines).map((line, index) => (
          <div key={index} className={styles.line}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};
