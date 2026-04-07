import React, { useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import economyConfig from '@/game/entities/templates/economy.json';
import styles from './BlueprintPanel.module.css';

const BlueprintPanel: React.FC = () => {
  const profile = useStore(gameStore, (s) => s.playerProfile);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);
  const setCompilingBlueprintId = useStore(gameStore, (s) => s.setCompilingBlueprintId);
  const compilingBlueprintId = useStore(gameStore, (s) => s.compilingBlueprintId);

  const [lastCompiledId, setLastCompiledId] = useState<string | null>(null);

  if (!profile) return null;

  const libraryIds = new Set(profile.blueprintLibrary.map((b) => b.blueprintId));

  // Items in vault that are firmware or augment and not in library
  const lockedFiles = profile.vault.filter(
    (item) => (item.itemType === 'firmware' || item.itemType === 'augment') && !libraryIds.has(item.templateId)
  );

  // Group by templateId to avoid duplicates in the UI if multiple of same item in vault
  const uniqueLockedFiles = Array.from(new Map(lockedFiles.map(item => [item.templateId, item])).values());

  const compiledLibrary = profile.blueprintLibrary;

  const handleCompile = async (templateId: string, type: 'firmware' | 'augment', rarity: string) => {
    if (!profile) return;
    
    const cost = (economyConfig.costs.compilation as any)[rarity] || 50;
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
        
        // Optimistic update
        updateProfileOptimistic((p) => ({
          ...p,
          wallet: {
            ...p.wallet,
            flux: data.remainingFlux ?? (p.wallet.flux - cost),
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

        setLastCompiledId(templateId);
        setTimeout(() => setLastCompiledId(null), 1000);
      }
    } catch (error) {
      console.error('Compilation failed:', error);
    } finally {
      setCompilingBlueprintId(null);
    }
  };

  return (
    <div className={styles.panelRoot}>
      <div className={styles.column}>
        <h3 className={styles.columnHeading}>LOCKED_FILES</h3>
        {uniqueLockedFiles.length === 0 ? (
          <div className={styles.emptyState}>NO_LOCKED_FILES // RUN_DEEPER_TO_DISCOVER</div>
        ) : (
          <div className={styles.list}>
            {uniqueLockedFiles.map((item) => {
              const cost = (economyConfig.costs.compilation as any)[item.rarityTier] || 50;
              const canAfford = profile.wallet.flux >= cost;
              const isCompiling = compilingBlueprintId === item.templateId;

              return (
                <div key={item.templateId} className={`${styles.item} ${isCompiling ? styles.sliding : ''}`}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{item.templateId}</span>
                    <span className={styles.itemType}>{item.itemType.toUpperCase()} • {item.rarityTier.toUpperCase()}</span>
                  </div>
                  <button
                    className={`${styles.compileButton} ${!canAfford ? styles.compileButtonDisabled : ''}`}
                    disabled={!canAfford || isCompiling}
                    onClick={() => handleCompile(item.templateId, item.itemType as any, item.rarityTier)}
                  >
                    COMPILE_BLUEPRINT: <span className={!canAfford ? styles.costInsufficient : ''}>{cost} FLUX</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.column}>
        <h3 className={styles.columnHeading}>COMPILED_LIBRARY</h3>
        {compiledLibrary.length === 0 ? (
          <div className={styles.emptyState}>COMPILED_LIBRARY_EMPTY</div>
        ) : (
          <div className={styles.list}>
            {compiledLibrary.map((entry) => (
              <div 
                key={entry.blueprintId} 
                className={`${styles.item} ${lastCompiledId === entry.blueprintId ? styles.compileFlash : ''}`}
              >
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{entry.blueprintId}</span>
                  <span className={styles.itemType}>{entry.type.toUpperCase()} • COMPILED</span>
                </div>
                <span className={styles.status}>AVAILABLE</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlueprintPanel;
