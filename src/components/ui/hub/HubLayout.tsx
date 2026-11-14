'use client';

import React, { useEffect } from 'react';
import { useStore } from 'zustand';
import { gameStore, HubTab } from '@/game/ui/store';
import { reportableFetch } from '@client/reports';
import { TabBar } from './TabBar';
import { ShellTab } from './ShellTab';
import { LoadoutTab } from './LoadoutTab';
import WorkshopTab from './WorkshopTab';
import VaultTab from './VaultTab';
import { InitializeTab } from './InitializeTab';
import { LeaderboardPanel } from './LeaderboardPanel';
import { RitualOverlay } from './RitualOverlay';
import { BootSequence } from './BootSequence';
import { TaikokuPlacard } from '../atomic';
import styles from './HubLayout.module.css';

interface HubLayoutProps {
  onLaunchComplete: () => void;
}

interface TabHeaderConfig {
  kanji: string;
  title: string;
  stampText: string;
  stampVariant: 'danger' | 'cyan' | 'secured';
}

const TAB_HEADER_MAP: Record<HubTab, TabHeaderConfig> = {
  shell: {
    kanji: '機体診断',
    title: 'SHELL CHASSIS DIAGNOSTICS & HARDWARE MOD DOCK',
    stampText: '認証完了 // DOCK ACTIVE',
    stampVariant: 'cyan',
  },
  loadout: {
    kanji: '装備換装',
    title: 'LOADOUT CONFIGURATION & FIRMWARE SOCKET MATRIX',
    stampText: '承認待 // SOCKET MATRIX',
    stampVariant: 'danger',
  },
  workshop: {
    kanji: '工作端末',
    title: 'BLUEPRINT COMPILATION & HARDWARE WORKSHOP',
    stampText: '製作可能 // FABRICATION',
    stampVariant: 'cyan',
  },
  vault: {
    kanji: '物資保管庫',
    title: 'PERSISTENT SECURE VAULT // 48-CONTAINER CARGO MATRIX',
    stampText: '封印済 // SEALED',
    stampVariant: 'secured',
  },
  initialize: {
    kanji: '出撃認可',
    title: 'DEPLOYMENT PROTOCOL // MISSION PROFILE & RUN MUTATORS',
    stampText: '出撃可能 // CLEAR TO LAUNCH',
    stampVariant: 'cyan',
  },
  leaderboards: {
    kanji: '戦績順位',
    title: 'GLOBAL NEURAL RECON LEADERBOARD // CERTIFIED OPERATORS',
    stampText: '認証済 // VERIFIED RUNS',
    stampVariant: 'cyan',
  },
};

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
  const setSystemSettingsModalVisible = useStore(
    gameStore,
    (s) => s.setSystemSettingsModalVisible,
  );

  // ESC key to toggle settings modal when not in critical overlays
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !ritualActive && !bootSequenceActive) {
        setSystemSettingsModalVisible(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ritualActive, bootSequenceActive, setSystemSettingsModalVisible]);

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
        const response = await reportableFetch(`/api/profile?sessionId=${sessionId}`);
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

    if (runResults) {
      setActiveTab('vault');
    } else {
      setActiveTab('shell');
    }
  }, [runResults, setActiveTab, setPlayerProfile, setProfileLoading, setProfileError]);

  const activeHeader = TAB_HEADER_MAP[activeTab] || TAB_HEADER_MAP.shell;

  return (
    <div className={styles.hubRoot}>
      <div className={styles.hubContainer}>
        {/* Dynamic Top Placard Header */}
        <TaikokuPlacard
          kanji={activeHeader.kanji}
          title={activeHeader.title}
          stampText={activeHeader.stampText}
          stampVariant={activeHeader.stampVariant}
          metaText="NEURAL DECK // HUB PROTOCOL"
        />

        {/* 6-Tab Navigation Bar & Monospace Wallet Chip Bar */}
        <TabBar />

        {/* Active Workspace */}
        {profileLoading && (
          <div className={styles.loadingState}>
            INITIALIZING_NEURAL_LINK // VEC-OS 1.0.4...
          </div>
        )}

        {profileError && (
          <div className={styles.errorState}>
            <p>LINK_ERROR: {profileError}</p>
            <button
              type="button"
              className="tool-btn"
              onClick={() => window.location.reload()}
              style={{ color: 'var(--c-danger)', borderColor: 'var(--c-danger)' }}
            >
              RETRY_CONNECTION
            </button>
          </div>
        )}

        {!profileLoading && !profileError && (
          <div className={styles.tabContent}>
            {activeTab === 'shell' && <ShellTab />}
            {activeTab === 'loadout' && <LoadoutTab />}
            {activeTab === 'workshop' && <WorkshopTab />}
            {activeTab === 'vault' && <VaultTab />}
            {activeTab === 'initialize' && <InitializeTab />}
            {activeTab === 'leaderboards' && <LeaderboardPanel />}
          </div>
        )}

        {ritualActive && <RitualOverlay />}
        {bootSequenceActive && <BootSequence onComplete={onLaunchComplete} />}
      </div>
    </div>
  );
};
