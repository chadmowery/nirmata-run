'use client';

import React from 'react';
import { logger } from '@engine/utils/logger';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import economyConfig from '@/game/entities/templates/economy.json';
import { BtnLever, TaikokuStamp } from '../atomic';
import styles from './BlueprintPanel.module.css';

export const BlueprintPanel: React.FC = () => {
  const profile = useStore(gameStore, (s) => s.playerProfile);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);
  const setCompilingBlueprintId = useStore(gameStore, (s) => s.setCompilingBlueprintId);
  const compilingBlueprintId = useStore(gameStore, (s) => s.compilingBlueprintId);

  if (!profile) return null;

  const libraryIds = new Set(profile.blueprintLibrary.map((b) => b.blueprintId));

  const lockedFiles = profile.vault.filter(
    (item) =>
      (item.itemType === 'firmware' || item.itemType === 'augment') &&
      !libraryIds.has(item.templateId),
  );

  const uniqueLockedFiles = Array.from(
    new Map(lockedFiles.map((item) => [item.templateId, item])).values(),
  );

  const compiledLibrary = profile.blueprintLibrary;

  const handleCompile = async (
    templateId: string,
    type: 'firmware' | 'augment',
    rarity: string,
  ) => {
    if (!profile) return;

    const cost = (economyConfig.costs.compilation as Record<string, number>)[rarity] || 50;
    if (profile.wallet.flux < cost) return;

    setCompilingBlueprintId(templateId);

    try {
      const response = await fetch('/api/economy/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: profile.sessionId,
          blueprintId: templateId,
          type,
          rarity,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        updateProfileOptimistic((p) => ({
          ...p,
          wallet: {
            ...p.wallet,
            flux: data.remainingFlux ?? p.wallet.flux - cost,
          },
          blueprintLibrary: [
            ...p.blueprintLibrary,
            {
              blueprintId: templateId,
              type,
              compiledAt: Date.now(),
            },
          ],
        }));
      }
    } catch (error) {
      logger.error('Compilation failed:', 'UI', error);
    } finally {
      setCompilingBlueprintId(null);
    }
  };

  return (
    <div className={styles.panelRoot}>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--c-accent-secondary)', marginBottom: '8px', fontWeight: 800 }}>
          COMPILED BLUEPRINTS ({compiledLibrary.length})
        </div>
        {compiledLibrary.length === 0 ? (
          <div className={styles.emptyState}>NO COMPILED ARCHIVES // FABRICATE FROM VAULT</div>
        ) : (
          compiledLibrary.map((bp) => (
            <div key={bp.blueprintId} className={`${styles.blueprintEntry} ${styles.compiled}`}>
              <div className={styles.blueprintMeta}>
                <span className={styles.blueprintName}>{bp.blueprintId}</span>
                <span className={styles.blueprintType}>TYPE: {bp.type.toUpperCase()} // READY</span>
              </div>
              <TaikokuStamp variant="secured">COMPILED // OK</TaikokuStamp>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '12px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--c-accent)', marginBottom: '8px', fontWeight: 800 }}>
          RAW DATA CORES AWAITING COMPILATION ({uniqueLockedFiles.length})
        </div>
        {uniqueLockedFiles.length === 0 ? (
          <div className={styles.emptyState}>NO UNCOMPILED CORES IN VAULT</div>
        ) : (
          uniqueLockedFiles.map((item) => {
            const cost =
              (economyConfig.costs.compilation as Record<string, number>)[item.rarityTier] || 50;
            const canAfford = profile.wallet.flux >= cost;
            const isCompiling = compilingBlueprintId === item.templateId;

            return (
              <div key={item.templateId} className={`${styles.blueprintEntry} ${styles.available}`}>
                <div className={styles.blueprintMeta}>
                  <span className={styles.blueprintName}>{item.templateId}</span>
                  <span className={styles.blueprintType}>
                    TIER: {item.rarityTier.toUpperCase()} // COST: {cost} FLX
                  </span>
                </div>

                <BtnLever
                  variant="primary"
                  disabled={!canAfford || isCompiling}
                  onClick={() =>
                    handleCompile(
                      item.templateId,
                      item.itemType as 'firmware' | 'augment',
                      item.rarityTier,
                    )
                  }
                  rightSlot={`${cost} FLX`}
                >
                  {isCompiling ? 'COMPILING...' : 'COMPILE'}
                </BtnLever>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BlueprintPanel;
