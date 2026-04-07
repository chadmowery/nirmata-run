'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore, HubTab } from '@/game/ui/store';
import { Lock } from 'lucide-react';
import styles from './TabBar.module.css';

export const TabBar: React.FC = () => {
  const activeTab = useStore(gameStore, (s) => s.activeTab);
  const setActiveTab = useStore(gameStore, (s) => s.setActiveTab);
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);
  const hasOverflow = useStore(gameStore, (s) => s.hasOverflow);
  const overflowCount = useStore(gameStore, (s) => s.overflowCount);

  const tabs: { id: HubTab; label: string }[] = [
    { id: 'shell', label: 'SHELL' },
    { id: 'loadout', label: 'LOADOUT' },
    { id: 'workshop', label: 'WORKSHOP' },
    { id: 'vault', label: 'VAULT' },
    { id: 'initialize', label: 'INITIALIZE' },
  ];

  const handleTabClick = (id: HubTab) => {
    if (id === 'initialize' && hasOverflow) return;
    setActiveTab(id);
  };

  const wallet = playerProfile?.wallet || { scrap: 0, flux: 0 };

  return (
    <nav className={styles.tabBar} aria-label="Hub Navigation">
      <div className={styles.tabs}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isLocked = tab.id === 'initialize' && hasOverflow;
          const showBadge = tab.id === 'vault' && hasOverflow;

          return (
            <button
              key={tab.id}
              className={`${styles.tab} ${isActive ? styles.activeTab : ''} ${isLocked ? styles.lockedTab : ''}`}
              onClick={() => handleTabClick(tab.id)}
              disabled={isLocked && activeTab !== tab.id}
              aria-label={`${tab.label} ${isLocked ? '(Locked due to overflow)' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {isLocked && <Lock className={styles.lockIcon} size={12} />}
              {tab.label}
              {showBadge && (
                <span className={styles.badge} aria-label={`${overflowCount} items in overflow`}>
                  {overflowCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.wallet}>
        <div className={styles.scrap}>
          SCRAP: <span className={styles.scrapValue}>{wallet.scrap.toLocaleString()}</span>
        </div>
        <div className={styles.flux}>
          // FLUX: <span className={styles.fluxValue}>{wallet.flux.toLocaleString()}</span>
        </div>
      </div>
    </nav>
  );
};
