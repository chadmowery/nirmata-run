import React from 'react';
import styles from './ShellStatCard.module.css';
import { ShellTemplate } from '@/game/shells/types';
import { ShellUpgrades, InstalledItem } from '@/shared/profile';
import { SlotBox } from './SlotBox';

interface ShellStatCardProps {
  shell: ShellTemplate;
  upgrades?: ShellUpgrades;
  installedItems: InstalledItem[];
}

export const ShellStatCard: React.FC<ShellStatCardProps> = ({
  shell,
  upgrades,
  installedItems
}) => {
  const getStatTotal = (stat: 'speed' | 'stability' | 'armor' | 'maxHealth') => {
    const base = shell.baseStats[stat];
    let upgrade = 0;
    if (upgrades) {
      if (stat === 'speed') upgrade = upgrades.speed;
      if (stat === 'stability') upgrade = upgrades.stability;
      if (stat === 'armor') upgrade = upgrades.armor;
      // maxHealth doesn't have an upgrade in the current schema, using 0
    }
    return { base, upgrade, total: base + upgrade };
  };

  const stats = [
    { label: 'SPEED', key: 'speed' as const },
    { label: 'STABILITY', key: 'stability' as const },
    { label: 'ARMOR', key: 'armor' as const },
    { label: 'MAX_HEALTH', key: 'maxHealth' as const },
  ];

  const archetypeIcon = shell.id.includes('striker') ? '◆' : 
                       shell.id.includes('bastion') ? '■' : '●';

  const firmwareSlots = installedItems.filter(i => i.type === 'firmware');
  const augmentSlots = installedItems.filter(i => i.type === 'augment');
  // Software slots are virtual for now as per spec
  const softwareSlots: any[] = []; 

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.icon}>{archetypeIcon}</div>
        <div className={styles.name}>{shell.name.toUpperCase()}</div>
      </div>

      <div className={styles.statsSection}>
        {stats.map(s => {
          const { base, upgrade, total } = getStatTotal(s.key);
          const percent = (total / 10) * 100;
          return (
            <div key={s.key} className={styles.statRow}>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>{s.label}</span>
                <span className={styles.statValue}>
                  {total} {upgrade > 0 && <span className={styles.upgrade}> (+{upgrade})</span>}
                </span>
              </div>
              <div className={styles.statBar}>
                <div 
                  className={styles.statFill} 
                  style={{ width: `${Math.min(percent, 100)}%` }} 
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.portsSection}>
        <h3 className={styles.portsHeading}>PORT_CONFIGURATION</h3>
        
        <div className={styles.portGroup}>
          <div className={styles.portLabel}>FIRMWARE</div>
          <div className={styles.slots}>
            {Array.from({ length: shell.basePorts.maxFirmware }).map((_, i) => (
              <SlotBox 
                key={`fw-${i}`}
                filled={i < firmwareSlots.length}
                itemName={firmwareSlots[i]?.blueprintId}
                slotType="firmware"
                legacy={firmwareSlots[i]?.isLegacy}
              />
            ))}
          </div>
        </div>

        <div className={styles.portGroup}>
          <div className={styles.portLabel}>AUGMENT</div>
          <div className={styles.slots}>
            {Array.from({ length: shell.basePorts.maxAugment }).map((_, i) => (
              <SlotBox 
                key={`aug-${i}`}
                filled={i < augmentSlots.length}
                itemName={augmentSlots[i]?.blueprintId}
                slotType="augment"
                legacy={augmentSlots[i]?.isLegacy}
              />
            ))}
          </div>
        </div>

        <div className={styles.portGroup}>
          <div className={styles.portLabel}>SOFTWARE</div>
          <div className={styles.slots}>
            {Array.from({ length: shell.basePorts.maxSoftware }).map((_, i) => (
              <SlotBox 
                key={`sw-${i}`}
                filled={i < softwareSlots.length}
                itemName={softwareSlots[i]?.name}
                slotType="software"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
