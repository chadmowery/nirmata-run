import React, { useState, useEffect } from 'react';
import styles from './ShellCarousel.module.css';
import { ShellStatCard } from './ShellStatCard';
import { ShellTemplate } from '@/game/shells/types';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';

interface ShellCarouselProps {
  shells: ShellTemplate[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export const ShellCarousel: React.FC<ShellCarouselProps> = ({
  shells,
  selectedIndex,
  onSelect
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);

  if (shells.length === 0) return null;

  const handlePrev = () => {
    if (selectedIndex > 0 && !isTransitioning) {
      triggerTransition(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex < shells.length - 1 && !isTransitioning) {
      triggerTransition(selectedIndex + 1);
    }
  };

  const triggerTransition = (newIndex: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      onSelect(newIndex);
      setIsTransitioning(false);
    }, 150);
  };

  const currentShell = shells[selectedIndex];
  const currentUpgrades = playerProfile?.shellUpgrades[currentShell.id];
  const installedItems = playerProfile?.installedItems.filter(i => i.shellId === currentShell.id) || [];

  return (
    <div className={styles.carousel}>
      <button 
        className={`${styles.arrow} ${selectedIndex === 0 ? styles.disabled : ''}`}
        onClick={handlePrev}
        disabled={selectedIndex === 0 || isTransitioning}
        aria-label="Previous Shell"
      >
        ◄
      </button>

      <div className={`${styles.cardContainer} ${isTransitioning ? styles.fade : ''}`}>
        <ShellStatCard 
          shell={currentShell}
          upgrades={currentUpgrades}
          installedItems={installedItems}
        />
      </div>

      <button 
        className={`${styles.arrow} ${selectedIndex === shells.length - 1 ? styles.disabled : ''}`}
        onClick={handleNext}
        disabled={selectedIndex === shells.length - 1 || isTransitioning}
        aria-label="Next Shell"
      >
        ►
      </button>
    </div>
  );
};
