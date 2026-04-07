import React, { useState, useEffect } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { RunMode } from '@/shared/run-mode';
import { InstalledItem } from '@/shared/profile';
import styles from './RitualOverlay.module.css';

export const RitualOverlay: React.FC = () => {
  const ritualActive = useStore(gameStore, (s) => s.ritualActive);
  const setRitualActive = useStore(gameStore, (s) => s.setRitualActive);
  const selectedRunMode = useStore(gameStore, (s) => s.selectedRunMode);
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);
  const shellTemplates = useStore(gameStore, (s) => s.shellTemplates);
  const selectedShellIndex = useStore(gameStore, (s) => s.selectedShellIndex);
  const modeAvailability = useStore(gameStore, (s) => s.modeAvailability);
  const setBootSequenceActive = useStore(gameStore, (s) => s.setBootSequenceActive);
  const setLaunchConfig = useStore(gameStore, (s) => s.setLaunchConfig);

  const [isDeploying, setIsDeploying] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ritualActive) {
        setRitualActive(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ritualActive, setRitualActive]);

  if (!ritualActive || !playerProfile || !shellTemplates.length) return null;

  const selectedModeData = modeAvailability?.find(m => m.mode === selectedRunMode);
  const currentShell = shellTemplates[selectedShellIndex];
  
  const handleConfirm = async () => {
    if (!selectedRunMode) return;
    
    setIsDeploying(true);
    try {
      const response = await fetch('/api/run-mode/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: playerProfile.sessionId,
          mode: selectedRunMode,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLaunchConfig({
            mode: data.config.mode,
            seed: data.config.seed,
            sessionId: playerProfile.sessionId,
          });
          setRitualActive(false);
          setBootSequenceActive(true);
        }
      }
    } catch (error) {
      console.error('Launch failed:', error);
    } finally {
      setIsDeploying(false);
    }
  };

  const isWeekly = selectedRunMode === RunMode.WEEKLY;
  const installedOnCurrent = playerProfile.installedItems.filter((i: InstalledItem) => i.shellId === currentShell.id);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="ritual-heading">
      <div className={styles.content}>
        <h2 id="ritual-heading" className={styles.heading}>DEPLOYMENT_REVIEW</h2>

        <div className={styles.section}>
          <h3 className={styles.sectionHeading}>ACTIVE_LOADOUT</h3>
          <div className={styles.loadoutGrid}>
            <div className={styles.loadoutItem}>
              <span className={styles.label}>SHELL:</span>
              <span className={styles.value}>{currentShell.name}</span>
            </div>
            <div className={styles.loadoutItem}>
              <span className={styles.label}>FIRMWARE:</span>
              <span className={styles.value}>
                {installedOnCurrent
                  .filter((i: InstalledItem) => i.type === 'firmware')
                  .map((i: InstalledItem) => i.blueprintId)
                  .join(', ') || 'NONE'}
              </span>
            </div>
            <div className={styles.loadoutItem}>
              <span className={styles.label}>AUGMENTS:</span>
              <span className={styles.value}>
                {installedOnCurrent
                  .filter((i: InstalledItem) => i.type === 'augment')
                  .map((i: InstalledItem) => i.blueprintId)
                  .join(', ') || 'NONE'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionHeading}>RISK_ASSESSMENT</h3>
          <div className={styles.riskInfo}>
            <p className={styles.modeName}>MODE: {selectedModeData?.name || selectedRunMode}</p>
            <p className={styles.stakes}>
              STAKES: {isWeekly ? 'FULL_LOOT_LOSS + FACTORY_RESET' : 'STANDARD_DEATH_PENALTY'}
            </p>
            {isWeekly && (
              <p className={styles.weeklyWarning}>
                ⚠ SHELL_FACTORY_RESET_ON_DEATH
              </p>
            )}
            <p className={styles.attempts}>
              ATTEMPT: {selectedModeData?.attemptsRemaining === 'unlimited' ? 'UNLIMITED' : 'FINAL'}
            </p>
          </div>
        </div>

        <button
          className={`${styles.confirmButton} ${isWeekly ? styles.confirmPink : styles.confirmCyan}`}
          onClick={handleConfirm}
          disabled={isDeploying}
        >
          {isDeploying ? 'DEPLOYING...' : 'CONFIRM_INITIALIZATION'}
        </button>
        
        <button 
          className={styles.cancelButton} 
          onClick={() => setRitualActive(false)}
          disabled={isDeploying}
        >
          ABORT_PROTOCOL
        </button>
      </div>
    </div>
  );
};
