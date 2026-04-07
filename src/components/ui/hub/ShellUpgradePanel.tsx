import React, { useState, useEffect } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import economyConfig from '@/game/entities/templates/economy.json';
import { ShellTemplate } from '@/game/shells/types';
import styles from './ShellUpgradePanel.module.css';

const ShellUpgradePanel: React.FC = () => {
  const profile = useStore(gameStore, (s) => s.playerProfile);
  const selectedShellIndex = useStore(gameStore, (s) => s.selectedShellIndex);
  const updateProfileOptimistic = useStore(gameStore, (s) => s.updateProfileOptimistic);

  const [shells, setShells] = useState<ShellTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShells = async () => {
      try {
        const response = await fetch('/api/shells');
        if (response.ok) {
          const data = await response.json();
          setShells(data.templates);
        }
      } catch (error) {
        console.error('Failed to fetch shells:', error);
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

  const upgrades = profile.shellUpgrades[activeShell.id] || {
    speed: 0,
    armor: 0,
    stability: 0,
    additionalPorts: 0,
  };

  const calculateCost = (baseCost: number, multiplier: number, currentLevel: number) => {
    return Math.floor(baseCost * Math.pow(multiplier, currentLevel));
  };

  const handleUpgrade = async (stat: 'speed' | 'armor' | 'stability' | 'additionalPorts') => {
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
      // For stability, use average or fallback if not in economy.json
      baseCost = 35;
      multiplier = 1.5;
    }

    const cost = calculateCost(baseCost, multiplier, upgrades[stat]);
    if (profile.wallet.flux < cost) return;

    try {
      const response = await fetch('/api/economy/upgrade', {
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
        
        // Optimistic update
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
            [stat]: data.newLevel ?? (shellUpgrades[stat] + 1),
          };

          return {
            ...p,
            wallet: {
              ...p.wallet,
              flux: data.remainingFlux ?? (p.wallet.flux - cost),
            },
            shellUpgrades: newUpgrades,
          };
        });
      }
    } catch (error) {
      console.error('Upgrade failed:', error);
    }
  };

  const upgradeOptions = [
    { id: 'speed', label: 'SPEED +1', baseValue: activeShell.baseStats.speed, currentBonus: upgrades.speed, key: 'speed' },
    { id: 'armor', label: 'ARMOR +1', baseValue: activeShell.baseStats.armor, currentBonus: upgrades.armor, key: 'armor' },
    { id: 'additionalPorts', label: 'NEW PORT: SOFTWARE', baseValue: activeShell.basePorts.maxSoftware, currentBonus: upgrades.additionalPorts, key: 'additionalPorts' },
  ] as const;

  return (
    <div className={styles.upgradeRoot}>
      <h3 className={styles.heading}>SHELL_UPGRADE_TERMINAL // {activeShell.name}</h3>
      <div className={styles.upgradeList}>
        {upgradeOptions.map((opt) => {
          let baseCost = 0;
          let multiplier = 1.0;
          if (opt.key === 'speed') {
            baseCost = economyConfig.costs.shellUpgrade.speed.baseCost;
            multiplier = economyConfig.costs.shellUpgrade.speed.perLevelMultiplier;
          } else if (opt.key === 'armor') {
            baseCost = economyConfig.costs.shellUpgrade.armor.baseCost;
            multiplier = economyConfig.costs.shellUpgrade.armor.perLevelMultiplier;
          } else if (opt.key === 'additionalPorts') {
            baseCost = economyConfig.costs.shellUpgrade.additionalPort.baseCost;
            multiplier = economyConfig.costs.shellUpgrade.additionalPort.perPortMultiplier;
          }

          const cost = calculateCost(baseCost, multiplier, opt.currentBonus);
          const canAfford = profile.wallet.flux >= cost;

          return (
            <div key={opt.id} className={styles.upgradeRow}>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>{opt.label}</span>
                <span className={styles.statValue}>
                  {opt.baseValue + opt.currentBonus} → {opt.baseValue + opt.currentBonus + 1}
                </span>
              </div>
              <div className={styles.dots} />
              <div className={styles.costAction}>
                <span className={`${styles.cost} ${!canAfford ? styles.costInsufficient : ''}`}>
                  {cost} FLUX
                </span>
                <button
                  className={`${styles.upgradeButton} ${!canAfford ? styles.upgradeButtonDisabled : ''}`}
                  disabled={!canAfford}
                  onClick={() => handleUpgrade(opt.key)}
                >
                  APPLY_UPGRADE
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShellUpgradePanel;
