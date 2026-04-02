'use client';
import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import styles from './RunResultsScreen.module.css';
import { GameState } from '@/game/states/types';

export const RunResultsScreen: React.FC = () => {
  const runResults = useStore(gameStore, (s) => s.runResults);
  const setGameStatus = useStore(gameStore, (s) => s.setGameStatus);

  if (!runResults) return null;

  const isExtraction = runResults.reason.toLowerCase() === 'extraction';
  
  // Calculate score if not provided or to ensure accuracy
  // Score formula: (floorsCleared * 100) + (enemiesKilled * 10) + (scrap * 1)
  const calculatedScore = (runResults.floorNumber * 100) + 
                          (runResults.enemiesKilled * 10) + 
                          (runResults.itemsSecured.scrap * 1);

  const handleReinitialize = () => {
    setGameStatus(GameState.MainMenu);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <h1 className={isExtraction ? styles.headingExtract : styles.headingDeath}>
          {isExtraction ? 'RUN_COMPLETE // EXTRACTION_SUCCESSFUL' : 'CONNECTION_LOST // CRITICAL_SYSTEM_FAILURE'}
        </h1>

        {runResults.deathReason && !isExtraction && (
          <p className={styles.deathReason}>CAUSE: {runResults.deathReason}</p>
        )}

        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>FLOORS_CLEARED</span>
            <span className={styles.statValue}>{runResults.floorNumber}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>THREATS_NEUTRALIZED</span>
            <span className={styles.statValue}>{runResults.enemiesKilled}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>TURNS_ELAPSED</span>
            <span className={styles.statValue}>{runResults.turnsElapsed}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>PEAK_HEAT</span>
            <span className={styles.statValue}>{runResults.peakHeat}%</span>
          </div>
        </div>

        <div className={styles.manifestSection}>
          <h3 className={styles.sectionHeading}>{isExtraction ? 'ITEMS_SECURED' : 'ITEMS_LOST'}</h3>
          <div className={styles.manifestGrid}>
            <div className={styles.manifestItem}>FIRMWARE: {runResults.itemsSecured.firmware}</div>
            <div className={styles.manifestItem}>AUGMENTS: {runResults.itemsSecured.augments}</div>
            <div className={styles.manifestItem}>SOFTWARE: {runResults.itemsSecured.software}</div>
            <div className={styles.manifestItem}>SCRAP: {runResults.itemsSecured.scrap}</div>
          </div>
        </div>

        <div className={styles.score}>
          SCORE: {calculatedScore.toLocaleString()}
        </div>

        <button 
          className={`${styles.reinitButton} ${!isExtraction ? styles.reinitButtonDeath : ''}`}
          onClick={handleReinitialize}
        >
          REINITIALIZE
        </button>
      </div>
    </div>
  );
};
