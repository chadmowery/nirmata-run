import React, { useEffect } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { RunMode } from '@/shared/run-mode';
import { RunModeCard } from './RunModeCard';
import { LeaderboardPanel } from './LeaderboardPanel';
import styles from './InitializeTab.module.css';

export const InitializeTab: React.FC = () => {
  const modeAvailability = useStore(gameStore, (s) => s.modeAvailability);
  const setModeAvailability = useStore(gameStore, (s) => s.setModeAvailability);
  const selectedRunMode = useStore(gameStore, (s) => s.selectedRunMode);
  const setSelectedRunMode = useStore(gameStore, (s) => s.setSelectedRunMode);
  const setRitualActive = useStore(gameStore, (s) => s.setRitualActive);
  const hasOverflow = useStore(gameStore, (s) => s.hasOverflow);
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);

  useEffect(() => {
    const fetchAvailability = async () => {
      if (!playerProfile?.sessionId) return;
      try {
        const response = await fetch(`/api/run-mode/available?sessionId=${playerProfile.sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setModeAvailability(data.modes);
        }
      } catch (error) {
        console.error('Failed to fetch mode availability:', error);
      }
    };

    fetchAvailability();
  }, [playerProfile?.sessionId, setModeAvailability]);

  const handleLaunch = () => {
    if (selectedRunMode) {
      setRitualActive(true);
    }
  };

  const selectedModeData = modeAvailability?.find(m => m.mode === selectedRunMode);

  return (
    <div className={styles.tab}>
      <h2 className={styles.heading}>DEPLOYMENT_PROTOCOL</h2>
      
      <div className={styles.modeContainer}>
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
              VAULT_OVERFLOW // RESOLVE_BEFORE_LAUNCH
            </div>
          </div>
        )}
      </div>

      {selectedRunMode && selectedModeData && (
        <div className={styles.detailsPanel}>
          <div className={styles.rules}>
            <h3 className={styles.rulesHeading}>PROTOCOL_SPECIFICATIONS</h3>
            <p className={styles.rulesText}>{selectedModeData.description}</p>
            
            <button
              className={`${styles.launchButton} ${
                selectedRunMode === RunMode.WEEKLY ? styles.launchWeekly : styles.launchStandard
              }`}
              onClick={handleLaunch}
            >
              {selectedRunMode === RunMode.SIMULATION && 'INITIALIZE_SIMULATION'}
              {selectedRunMode === RunMode.DAILY && 'ENTER_DAILY_CHALLENGE'}
              {selectedRunMode === RunMode.WEEKLY && (
                <>
                  <span className={styles.warningIcon}>⚠</span> COMMIT_TO_ONE-SHOT
                </>
              )}
            </button>
          </div>

          <LeaderboardPanel 
            mode={selectedRunMode} 
            sessionId={playerProfile?.sessionId || ''} 
          />
        </div>
      )}
    </div>
  );
};
