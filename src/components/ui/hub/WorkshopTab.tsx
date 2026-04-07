import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import BlueprintPanel from './BlueprintPanel';
import SoftwareShop from './SoftwareShop';
import ShellUpgradePanel from './ShellUpgradePanel';
import styles from './WorkshopTab.module.css';

const WorkshopTab: React.FC = () => {
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);

  if (!playerProfile) {
    return (
      <div className={styles.loading}>
        INITIALIZING_WORKSHOP_TERMINAL...
      </div>
    );
  }

  return (
    <div className={styles.tabRoot}>
      <header className={styles.header}>
        <h2 className={styles.heading}>COMPILATION_TERMINAL</h2>
      </header>

      <section className={styles.section}>
        <BlueprintPanel />
      </section>

      <div className={styles.separator} />

      <section className={styles.section}>
        <SoftwareShop />
      </section>

      <div className={styles.separator} />

      <section className={styles.section}>
        <ShellUpgradePanel />
      </section>
    </div>
  );
};

export default WorkshopTab;
