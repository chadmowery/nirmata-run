'use client';

import React, { useEffect } from 'react';
import { logger } from '@engine/utils/logger';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { RunMode } from '@/shared/run-mode';
import { RunModeCard } from './RunModeCard';
import { LeaderboardPanel } from './LeaderboardPanel';
import { PanelCard, BtnLever, DottedSpecRow } from '../atomic';
import styles from './InitializeTab.module.css';

export const InitializeTab: React.FC = () => {
  const modeAvailability = useStore(gameStore, (s) => s.modeAvailability);
  const setModeAvailability = useStore(gameStore, (s) => s.setModeAvailability);
  const selectedRunMode = useStore(gameStore, (s) => s.selectedRunMode);
  const setSelectedRunMode = useStore(gameStore, (s) => s.setSelectedRunMode);
  const setRitualActive = useStore(gameStore, (s) => s.setRitualActive);
  const hasOverflow = useStore(gameStore, (s) => s.hasOverflow);
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);
  const shellTemplates = useStore(gameStore, (s) => s.shellTemplates);
  const selectedShellIndex = useStore(gameStore, (s) => s.selectedShellIndex);

  useEffect(() => {
    const fetchAvailability = async () => {
      if (!playerProfile?.sessionId) return;
      try {
        const response = await fetch(
          `/api/run-mode/available?sessionId=${playerProfile.sessionId}`,
        );
        if (response.ok) {
          const data = await response.json();
          setModeAvailability(data.modes);
          if (!selectedRunMode && data.modes?.length > 0) {
            setSelectedRunMode(data.modes[0].mode);
          }
        }
      } catch (error) {
        logger.error('Failed to fetch mode availability:', 'UI', error);
      }
    };

    fetchAvailability();
  }, [playerProfile?.sessionId, selectedRunMode, setModeAvailability, setSelectedRunMode]);

  const handleLaunch = () => {
    if (selectedRunMode) {
      setRitualActive(true);
    }
  };

  const selectedModeData = modeAvailability?.find((m) => m.mode === selectedRunMode);
  const activeShell = shellTemplates[selectedShellIndex] || { name: 'VANGUARD-v1' };

  return (
    <div className={styles.initRoot}>
      {/* Top 3-Card Run Mode Grid */}
      <div className={styles.runModeGrid}>
        {modeAvailability?.map((mode) => (
          <RunModeCard
            key={mode.mode}
            availability={mode}
            selected={selectedRunMode === mode.mode}
            disabled={hasOverflow}
            onSelect={() => setSelectedRunMode(mode.mode)}
          />
        ))}

        {hasOverflow && (
          <div className={styles.overflowOverlay}>
            <div className={styles.overflowMessage}>
              ⚠️ 警告: VAULT OVERFLOW DETECTED // RESOLVE CARGO BAYS BEFORE DEPLOYMENT
            </div>
          </div>
        )}
      </div>

      {/* Selected Protocol Commitment Bar */}
      {selectedRunMode && selectedModeData && (
        <PanelCard
          title="DEPLOYMENT PROTOCOL COMMITMENT"
          badge={selectedRunMode.toUpperCase()}
        >
          <div className={styles.commitmentBar}>
            <div className={styles.commitmentInfo}>
              <div style={{ fontSize: '13px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase' }}>
                {selectedModeData.name} // AUTHORIZATION READY
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-dim)', maxWidth: '600px' }}>
                {selectedModeData.description}
              </div>

              <div style={{ display: 'flex', gap: '24px', marginTop: '8px' }}>
                <DottedSpecRow label="ACTIVE CHASSIS" value={activeShell.name} style={{ width: '220px' }} />
                <DottedSpecRow label="REWARD MULTIPLIER" value={selectedRunMode === RunMode.WEEKLY ? '4.0x' : '1.0x'} style={{ width: '200px' }} />
              </div>
            </div>

            <BtnLever
              variant={selectedRunMode === RunMode.WEEKLY ? 'danger' : 'primary'}
              disabled={hasOverflow || !selectedModeData.available}
              onClick={handleLaunch}
              rightSlot="[発進確認] →"
            >
              COMMIT TO DEPLOYMENT RITUAL
            </BtnLever>
          </div>
        </PanelCard>
      )}

      {/* Embedded Mode Leaderboard if Daily or Weekly */}
      {selectedRunMode && selectedRunMode !== RunMode.SIMULATION && (
        <LeaderboardPanel mode={selectedRunMode} sessionId={playerProfile?.sessionId || ''} />
      )}
    </div>
  );
};
