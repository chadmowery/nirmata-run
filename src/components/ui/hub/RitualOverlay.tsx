'use client';

import React, { useState, useEffect } from 'react';
import { logger } from '@engine/utils/logger';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { RunMode } from '@/shared/run-mode';
import { InstalledItem } from '@/shared/profile';
import { TaikokuPlacard, DottedSpecRow, BtnLever } from '../atomic';

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

  const selectedModeData = modeAvailability?.find((m) => m.mode === selectedRunMode);
  const currentShell = shellTemplates[selectedShellIndex] || shellTemplates[0];

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
          shellId: currentShell.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLaunchConfig({
            mode: data.config.mode,
            seed: data.config.seed,
            sessionId: playerProfile.sessionId,
            shellId: data.config.shellId || currentShell.id,
          });
          setRitualActive(false);
          setBootSequenceActive(true);
        }
      }
    } catch (error) {
      logger.error('Launch failed:', 'UI', error);
    } finally {
      setIsDeploying(false);
    }
  };

  const isWeekly = selectedRunMode === RunMode.WEEKLY;
  const installedOnCurrent = playerProfile.installedItems.filter(
    (i: InstalledItem) => i.shellId === currentShell.id,
  );

  const firmwareList = installedOnCurrent
    .filter((i: InstalledItem) => i.type === 'firmware')
    .map((i: InstalledItem) => i.blueprintId)
    .join(', ') || 'NONE SOCKETED';

  const augmentList = installedOnCurrent
    .filter((i: InstalledItem) => i.type === 'augment')
    .map((i: InstalledItem) => i.blueprintId)
    .join(', ') || 'NONE SOCKETED';

  return (
    <div
      className="modal-backdrop-view"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ritual-heading"
    >
      <div className="modal-box" style={{ maxWidth: '740px', padding: '1.5rem', gap: '14px' }}>
        <TaikokuPlacard
          kanji="出撃前点検"
          title="PRE-FLIGHT HARDWARE VERIFICATION & LAUNCH RITUAL"
          stampText="出荷前検査 // PRE-FLIGHT"
          stampVariant={isWeekly ? 'danger' : 'cyan'}
          onClose={() => setRitualActive(false)}
          closeLabel="✕ ABORT [ESC]"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <DottedSpecRow label="SELECTED SHELL CHASSIS" value={currentShell.name} />
          <DottedSpecRow label="EQUIPPED FIRMWARE" value={firmwareList} />
          <DottedSpecRow label="EQUIPPED AUGMENT" value={augmentList} />
          <DottedSpecRow
            label="OPERATION MODE"
            value={selectedModeData?.name?.toUpperCase() || 'STANDARD'}
            valueColor={isWeekly ? 'var(--c-scrap)' : 'var(--c-accent-secondary)'}
          />
          <DottedSpecRow
            label="PERMADEATH PENALTY"
            value={isWeekly ? 'FULL HARDWARE PURGE' : 'STANDARD PROFILE PRESERVATION'}
            valueColor={isWeekly ? 'var(--c-danger)' : 'var(--c-accent)'}
          />
        </div>

        {/* Hazard Indemnity Notice */}
        <div
          style={{
            border: '1px dashed var(--c-danger)',
            background: 'rgba(255, 42, 75, 0.08)',
            padding: '12px',
            fontSize: '11px',
            color: 'var(--c-danger)',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>
            HAZARD INDEMNITY NOTICE // 危険免責事項
          </strong>
          Physical hardware zeroing occurs upon neural link severance. Unsecured equipment not
          extracted via Stability Anchor terminal will be permanently purged in sub-level void space.
        </div>

        <BtnLever
          variant={isWeekly ? 'danger' : 'primary'}
          disabled={isDeploying}
          onClick={handleConfirm}
          rightSlot="[発進承認] →"
          style={{ width: '100%', padding: '12px 20px', marginTop: '6px' }}
        >
          {isDeploying
            ? 'ENGAGING NEURAL LINK...'
            : 'AUTHORIZE LAUNCH // 発進承認 — ENGAGE NEURAL LINK'}
        </BtnLever>
      </div>
    </div>
  );
};

export default RitualOverlay;
