'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import BlueprintPanel from './BlueprintPanel';
import SoftwareShop from './SoftwareShop';
import { PanelCard, DottedSpecRow, BtnLever } from '../atomic';
import styles from './WorkshopTab.module.css';

export const WorkshopTab: React.FC = () => {
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);

  if (!playerProfile) {
    return <div className={styles.loading}>INITIALIZING_WORKSHOP_TERMINAL // VEC-OS 1.0.4...</div>;
  }

  const scrapWallet = playerProfile.wallet?.scrap ?? 0;
  const fluxWallet = playerProfile.wallet?.flux ?? 0;
  const libraryCount = playerProfile.blueprintLibrary?.length ?? 0;

  return (
    <div className="three-col-grid">
      {/* Column 1: Blueprint Repository */}
      <PanelCard title="BLUEPRINT REPOSITORY" badge={`${libraryCount} ARCHIVED`}>
        <BlueprintPanel />
      </PanelCard>

      {/* Column 2: Quantum Compilation Chamber & Subroutine Shop */}
      <PanelCard title="QUANTUM COMPILATION CHAMBER" badge="SOFTWARE REQUISITION">
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--c-accent-secondary)' }}>
            SYNTHESIS BUS BUFFER STATUS: [ONLINE]
          </div>

          <div className={styles.compilationProgressTrack}>
            <div className={styles.compilationProgressFill} />
          </div>

          <SoftwareShop />
        </div>
      </PanelCard>

      {/* Column 3: Scrap Recycling & Salvage Terminal */}
      <PanelCard title="SCRAP RECYCLING & SALVAGE" badge="CONVERSION">
        <div className={styles.salvageBox}>
          <div style={{ fontSize: '11px', color: 'var(--c-text-dim)', lineHeight: 1.5 }}>
            Scrap harvested from void operations can be compressed into high-density Meta Flux
            alloys for permanent hardware unlocks.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '8px 0' }}>
            <DottedSpecRow
              label="SCRAP BALANCE"
              value={`${scrapWallet.toLocaleString()} CR`}
              valueColor="var(--c-scrap)"
            />
            <DottedSpecRow
              label="META FLUX"
              value={`${fluxWallet.toLocaleString()} FLX`}
              valueColor="var(--c-accent-secondary)"
            />
            <DottedSpecRow label="COMPRESSION RATIO" value="100 CR : 1 FLX" />
            <DottedSpecRow label="SALVAGE YIELD" value="50% RECOVERY" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
            <BtnLever
              variant="cyan"
              disabled={scrapWallet < 100}
              onClick={() => {
                // Future expansion for scrap-flux conversion
              }}
              rightSlot="100 CR"
            >
              COMPRESS 1 FLUX
            </BtnLever>

            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--c-text-dim)',
                textAlign: 'center',
              }}
            >
              TAIKOKU LOGISTICS SALVAGE DOCK MK-IV
            </div>
          </div>
        </div>
      </PanelCard>
    </div>
  );
};

export default WorkshopTab;
