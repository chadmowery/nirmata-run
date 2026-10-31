'use client';

import React, { useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import BlueprintPanel from './BlueprintPanel';
import SoftwareShop from './SoftwareShop';
import { PanelCard, DottedSpecRow, BtnLever } from '../atomic';
import styles from './WorkshopTab.module.css';

export const WorkshopTab: React.FC = () => {
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressMessage, setCompressMessage] = useState<string | null>(null);

  if (!playerProfile) {
    return <div className={styles.loading}>INITIALIZING_WORKSHOP_TERMINAL // VEC-OS 1.0.4...</div>;
  }

  const scrapWallet = playerProfile.wallet?.scrap ?? 0;
  const fluxWallet = playerProfile.wallet?.flux ?? 0;
  const libraryCount = playerProfile.blueprintLibrary?.length ?? 0;

  const handleCompress = async () => {
    if (scrapWallet < 100 || fluxWallet >= 1000 || isCompressing) return;

    setIsCompressing(true);
    setCompressMessage(null);

    // Optimistic update
    updateProfileOptimistic((p) => ({
      ...p,
      wallet: {
        scrap: Math.max(0, p.wallet.scrap - 100),
        flux: Math.min(1000, p.wallet.flux + 1),
      },
    }));

    try {
      const res = await fetch('/api/economy/compress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: playerProfile.sessionId, amount: 1 }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Compression failed');
      }

      setCompressMessage('SUCCESS: Compressed 100 CR → +1 FLX');
      setTimeout(() => setCompressMessage(null), 3500);
    } catch (err) {
      // Revert optimistic update
      updateProfileOptimistic((p) => ({
        ...p,
        wallet: {
          scrap: p.wallet.scrap + 100,
          flux: Math.max(0, p.wallet.flux - 1),
        },
      }));
      setCompressMessage(`ERROR: ${err instanceof Error ? err.message : 'Compression failed'}`);
    } finally {
      setIsCompressing(false);
    }
  };

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
            {compressMessage && (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  fontWeight: 800,
                  textAlign: 'center',
                  padding: '4px',
                  background: compressMessage.startsWith('SUCCESS')
                    ? 'rgba(0, 240, 255, 0.1)'
                    : 'rgba(255, 0, 85, 0.1)',
                  color: compressMessage.startsWith('SUCCESS')
                    ? 'var(--c-accent-secondary)'
                    : 'var(--c-danger)',
                  border: `1px solid ${
                    compressMessage.startsWith('SUCCESS')
                      ? 'var(--c-accent-secondary)'
                      : 'var(--c-danger)'
                  }`,
                }}
              >
                {compressMessage}
              </div>
            )}

            {fluxWallet >= 1000 && (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--c-warning)',
                  textAlign: 'center',
                }}
              >
                [FLUX CAPACITY MAXED // 1,000 FLX CAP]
              </div>
            )}

            <BtnLever
              variant="cyan"
              disabled={scrapWallet < 100 || fluxWallet >= 1000 || isCompressing}
              holdToConfirm={true}
              onClick={handleCompress}
              rightSlot={isCompressing ? 'SYNTHESIZING...' : '100 CR'}
            >
              {isCompressing ? 'COMPRESSING FLUX...' : 'COMPRESS 1 FLUX'}
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
