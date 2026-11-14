'use client';

import React, { useState, useEffect } from 'react';
import { logger } from '@engine/utils/logger';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { reportableFetch } from '@client/reports';
import economyConfig from '@/game/entities/templates/economy.json';
import { ShellTemplate } from '@/game/shells/shared';
import { PanelCard, BtnLever } from '../atomic';
import styles from './ShellUpgradePanel.module.css';

export const ShellUpgradePanel: React.FC = () => {
  const profile = useStore(gameStore, (s) => s.playerProfile);
  const selectedShellIndex = useStore(gameStore, (s) => s.selectedShellIndex);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);

  const [shells, setShells] = useState<ShellTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShells = async () => {
      try {
        const response = await reportableFetch('/api/shells');
        if (response.ok) {
          const data = await response.json();
          setShells(data.templates);
          gameStore.getState().setShellTemplates(data.templates);
        }
      } catch (error) {
        logger.error('Failed to fetch shells:', 'UI', error);
      } finally {
        setLoading(false);
      }
    };
    fetchShells();
  }, []);

  if (loading) return <div className={styles.loading}>DIAGNOSTICS_RUNNING...</div>;
  if (!profile || shells.length === 0) return null;

  const activeShell = shells[selectedShellIndex];
  if (!activeShell) return null;

  const upgrades = profile.shellUpgrades?.[activeShell.id] || {
    speed: 0,
    armor: 0,
    stability: 0,
    additionalPorts: 0,
  };

  const calculateCost = (baseCost: number, multiplier: number, currentLevel: number) => {
    return Math.floor(baseCost * Math.pow(multiplier, currentLevel));
  };

  const upgradeDefs: {
    stat: 'speed' | 'armor' | 'stability' | 'additionalPorts';
    name: string;
    description: string;
    baseCost: number;
    multiplier: number;
    maxLevel: number;
  }[] = [
    {
      stat: 'speed',
      name: 'LOCOMOTION COILS',
      description: '+5 T/SEC BASE RUN VELOCITY',
      baseCost: economyConfig.costs.shellUpgrade.speed.baseCost,
      multiplier: economyConfig.costs.shellUpgrade.speed.perLevelMultiplier,
      maxLevel: 5,
    },
    {
      stat: 'armor',
      name: 'TITANIUM COMPOSITE PLATING',
      description: '+1 DAMAGE REDUCTION THRESHOLD',
      baseCost: economyConfig.costs.shellUpgrade.armor.baseCost,
      multiplier: economyConfig.costs.shellUpgrade.armor.perLevelMultiplier,
      maxLevel: 5,
    },
    {
      stat: 'stability',
      name: 'REALITY TETHER STABILIZER',
      description: '+10 MAX REALITY STABILITY RETENTION',
      baseCost: 35,
      multiplier: 1.5,
      maxLevel: 5,
    },
    {
      stat: 'additionalPorts',
      name: 'SUBROUTINE BUS EXPANSION',
      description: '+1 FIRMWARE / AUGMENT SOCKET PORT',
      baseCost: economyConfig.costs.shellUpgrade.additionalPort.baseCost,
      multiplier: economyConfig.costs.shellUpgrade.additionalPort.perPortMultiplier,
      maxLevel: 3,
    },
  ];

  const handleUpgrade = async (stat: 'speed' | 'armor' | 'stability' | 'additionalPorts') => {
    const def = upgradeDefs.find((d) => d.stat === stat);
    const currentLevel = upgrades[stat] || 0;
    if (def && currentLevel >= def.maxLevel) return;

    let baseCost = 0;
    let multiplier = 1.0;

    if (stat === 'speed') {
      baseCost = economyConfig.costs.shellUpgrade.speed.baseCost;
      multiplier = economyConfig.costs.shellUpgrade.speed.perLevelMultiplier;
    } else if (stat === 'armor') {
      baseCost = economyConfig.costs.shellUpgrade.armor.baseCost;
      multiplier = economyConfig.costs.shellUpgrade.armor.perLevelMultiplier;
    } else if (stat === 'additionalPorts') {
      baseCost = economyConfig.costs.shellUpgrade.additionalPort.baseCost;
      multiplier = economyConfig.costs.shellUpgrade.additionalPort.perPortMultiplier;
    } else {
      baseCost = 35;
      multiplier = 1.5;
    }

    const cost = calculateCost(baseCost, multiplier, currentLevel);
    if ((profile.wallet?.flux || 0) < cost) return;

    try {
      const response = await reportableFetch('/api/economy/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: profile.sessionId,
          shellId: activeShell.id,
          stat,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        updateProfileOptimistic((p) => {
          const newUpgrades = { ...p.shellUpgrades };
          const shellUpgrades = newUpgrades[activeShell.id] || {
            speed: 0,
            armor: 0,
            stability: 0,
            additionalPorts: 0,
          };

          newUpgrades[activeShell.id] = {
            ...shellUpgrades,
            [stat]: data.newLevel ?? (shellUpgrades[stat] || 0) + 1,
          };

          return {
            ...p,
            shellUpgrades: newUpgrades,
            wallet: {
              ...p.wallet,
              flux: data.remainingFlux ?? p.wallet.flux - cost,
            },
          };
        });
      }
    } catch (err) {
      logger.error('Failed to purchase shell upgrade:', 'UI', err);
    }
  };

  return (
    <PanelCard title="HARDWARE UPGRADE DOCK" badge="FLUX SINK">
      <div className={styles.upgradeRoot}>
        {upgradeDefs.map((def) => {
          const currentLevel = upgrades[def.stat] || 0;
          const isMaxed = currentLevel >= def.maxLevel;
          const cost = calculateCost(def.baseCost, def.multiplier, currentLevel);
          const canAfford = !isMaxed && (profile.wallet?.flux || 0) >= cost;

          return (
            <div key={def.stat} className={styles.upgradeRow}>
              <div className={styles.upgradeInfo}>
                <div className={styles.upgradeName}>{def.name}</div>
                <div style={{ fontSize: '10px', color: 'var(--c-text-dim)' }}>
                  {def.description}
                </div>

                {/* Progress Bar & Max Upgrade Meter */}
                <div className={styles.progressContainer}>
                  <div className={styles.progressMeta}>
                    <span className={styles.progressLabel}>
                      LEVEL MK-{currentLevel} / MK-{def.maxLevel}
                    </span>
                    {isMaxed && <span className={styles.maxBadge}>[MAXED]</span>}
                  </div>
                  <div
                    className={styles.progressTrack}
                    role="progressbar"
                    aria-valuenow={currentLevel}
                    aria-valuemin={0}
                    aria-valuemax={def.maxLevel}
                  >
                    {Array.from({ length: def.maxLevel }).map((_, idx) => {
                      const isFilled = idx < currentLevel;
                      return (
                        <div
                          key={idx}
                          className={`${styles.segmentPip} ${
                            isFilled
                              ? isMaxed
                                ? styles.segmentPipMaxed
                                : styles.segmentPipFilled
                              : ''
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <BtnLever
                variant="primary"
                disabled={!canAfford}
                holdToConfirm={!isMaxed}
                onClick={() => !isMaxed && handleUpgrade(def.stat)}
                rightSlot={isMaxed ? 'MAXED' : `${cost} FLX`}
              >
                {isMaxed ? 'MAXED' : 'UPGRADE'}
              </BtnLever>
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
};

export default ShellUpgradePanel;
