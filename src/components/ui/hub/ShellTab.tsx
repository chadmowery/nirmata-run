import React, { useState, useEffect } from 'react';
import styles from './ShellTab.module.css';
import { ShellCarousel } from './ShellCarousel';
import { ShellTemplate } from '@/game/shells/types';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';

export const ShellTab: React.FC = () => {
  const [templates, setTemplates] = useState<ShellTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedShellIndex = useStore(gameStore, (s) => s.selectedShellIndex);
  const setSelectedShellIndex = useStore(gameStore, (s) => s.setSelectedShellIndex);

  const setShellTemplates = useStore(gameStore, (s) => s.setShellTemplates);

  useEffect(() => {
    const fetchShells = async () => {
      try {
        const response = await fetch('/api/shells');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data.templates);
          setShellTemplates(data.templates);
        }
      } catch (error) {
        console.error('Failed to fetch shells:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchShells();
  }, [setShellTemplates]);

  if (loading) {
    return <div className={styles.loading}>DIAGNOSTICS_RUNNING...</div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>SHELL_DIAGNOSTICS</h2>
      
      <div className={styles.carouselWrapper}>
        <ShellCarousel 
          shells={templates}
          selectedIndex={selectedShellIndex}
          onSelect={setSelectedShellIndex}
        />
      </div>

      <div className={styles.footer}>
        SHELL {selectedShellIndex + 1} OF {templates.length} // READY_FOR_DEPLOYMENT
      </div>
    </div>
  );
};
