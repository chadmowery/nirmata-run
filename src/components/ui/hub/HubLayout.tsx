'use client';

import React, { useEffect } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { TabBar } from './TabBar';
import { ShellTab } from './ShellTab';
import { LoadoutTab } from './LoadoutTab';
import WorkshopTab from './WorkshopTab';
import VaultTab from './VaultTab';
import { InitializeTab } from './InitializeTab';
import { RitualOverlay } from './RitualOverlay';
import { BootSequence } from './BootSequence';
import styles from './HubLayout.module.css';

interface HubLayoutProps {
  onLaunchComplete: () => void;
}

export const HubLayout: React.FC<HubLayoutProps> = ({ onLaunchComplete }) => {
  const activeTab = useStore(gameStore, (s) => s.activeTab);
  const setActiveTab = useStore(gameStore, (s) => s.setActiveTab);
  const setPlayerProfile = useStore(gameStore, (s) => s.setPlayerProfile);
  const profileLoading = useStore(gameStore, (s) => s.profileLoading);
  const profileError = useStore(gameStore, (s) => s.profileError);
  const setProfileLoading = useStore(gameStore, (s) => s.setProfileLoading);
  const setProfileError = useStore(gameStore, (s) => s.setProfileError);
  const runResults = useStore(gameStore, (s) => s.runResults);
  const ritualActive = useStore(gameStore, (s) => s.ritualActive);
  const bootSequenceActive = useStore(gameStore, (s) => s.bootSequenceActive);

  useEffect(() => {
    const fetchProfile = async () => {
      setProfileLoading(true);
      setProfileError(null);

      // Get sessionId from localStorage or generate new one
      let sessionId = localStorage.getItem('nimrata_sessionId');
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem('nimrata_sessionId', sessionId);
      }

      try {
        const response = await fetch(`/api/profile?sessionId=${sessionId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch player profile');
        }
        const data = await response.json();
        setPlayerProfile(data.profile);
      } catch (err) {
        setProfileError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();

    // Determine default tab (D-03)
    if (runResults) {
      setActiveTab('vault');
    } else {
      setActiveTab('shell');
    }
  }, []);

  if (profileLoading) {
    return (
      <div className={styles.hubRoot}>
        <div className={styles.loadingState}>
          INITIALIZING_NEURAL_LINK...
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className={styles.hubRoot}>
        <div className={styles.errorState}>
          <p>LINK_ERROR: {profileError}</p>
          <button onClick={() => window.location.reload()}>RETRY_CONNECTION</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.hubRoot}>
      <TabBar />
      <div className={styles.tabContent}>
        {activeTab === 'shell' && <ShellTab />}
        {activeTab === 'loadout' && <LoadoutTab />}
        {activeTab === 'workshop' && <WorkshopTab />}
        {activeTab === 'vault' && <VaultTab />}
        {activeTab === 'initialize' && <InitializeTab />}
      </div>

      {ritualActive && <RitualOverlay />}
      {bootSequenceActive && <BootSequence onComplete={onLaunchComplete} />}
    </div>
  );
};
