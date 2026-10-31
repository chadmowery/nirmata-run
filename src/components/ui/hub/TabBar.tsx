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

  const tabs: { id: HubTab; label: string; kanjiTag: string }[] = [
    { id: 'shell', label: 'SHELL', kanjiTag: '機体' },
    { id: 'loadout', label: 'LOADOUT', kanjiTag: '装備' },
    { id: 'workshop', label: 'WORKSHOP', kanjiTag: '工房' },
    { id: 'vault', label: 'VAULT', kanjiTag: '保管庫' },
    { id: 'initialize', label: 'INITIALIZE', kanjiTag: '出撃' },
    { id: 'leaderboards', label: 'LEADERBOARDS', kanjiTag: '順位' },
  ];

  const handleTabClick = (id: HubTab) => {
    if (id === 'initialize' && hasOverflow) return;
    setActiveTab(id);
  };

  const wallet = playerProfile?.wallet || { scrap: 0, flux: 0 };

  return (
    <nav className={styles.hubNavigation} aria-label="Neural Deck Navigation">
      <div className={styles.hubTabsRow}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isLocked = tab.id === 'initialize' && hasOverflow;
          const showBadge = tab.id === 'vault' && hasOverflow;

          return (
            <button
              key={tab.id}
              type="button"
              className={`${styles.hubTabBtn} ${isActive ? styles.active : ''}`}
              onClick={() => handleTabClick(tab.id)}
              disabled={isLocked && activeTab !== tab.id}
              aria-label={`${tab.label} [${tab.kanjiTag}] ${isLocked ? '(Locked due to overflow)' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {isLocked && <Lock size={12} style={{ marginRight: '4px' }} />}
              <span>
                {tab.label} [{tab.kanjiTag}]
              </span>
              {showBadge && (
                <span className={styles.tabBadge} aria-label={`${overflowCount} items in overflow`}>
                  ! {overflowCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.hubWalletBar}>
        <div className={styles.walletChip}>
          <span className={styles.walletChipLabel}>META FLUX:</span>
          <span className={styles.walletChipVal} style={{ color: 'var(--c-accent-secondary)' }}>
            {wallet.flux.toLocaleString()} FLX
          </span>
        </div>
        <div className={styles.walletChip}>
          <span className={styles.walletChipLabel}>RUN SCRAP:</span>
          <span className={styles.walletChipVal} style={{ color: 'var(--c-scrap)' }}>
            {wallet.scrap.toLocaleString()} CR
          </span>
        </div>
      </div>
    </nav>
  );
};
