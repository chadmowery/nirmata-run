'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { PanelCard } from './atomic';
import styles from './styles.module.css';

export const PlayerHUD: React.FC = () => {
  const player = useStore(gameStore, (s) => s.player);
  const scrap = useStore(gameStore, (s) => s.scrap);
  const heatTier = useStore(gameStore, (s) => s.heatTier);

  const hpPercent = (player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0) || 0;
  const xpNextLevel = (player.level || 1) * 100;
  const xpPercent = (xpNextLevel > 0 ? (player.xp / xpNextLevel) * 100 : 0) || 0;
  const heatPercent = (player.maxHeat > 0 ? (player.heat / player.maxHeat) * 100 : 0) || 0;

  const isGlitched = player.statuses.includes('HUD_GLITCH') || player.heat > player.maxHeat;

  return (
    <PanelCard
      title="CHASSIS DIAGNOSTICS"
      badge={player.shellName || 'VANGUARD-v1'}
      className={`${styles.hudColLeft} ${isGlitched ? styles.hudGlitch : ''}`}
    >
      {/* Runner Identity Block */}
      <div className={styles.runnerIdentityCard}>
        <div className={styles.runnerAvatar}>@</div>
        <div className={styles.runnerInfo}>
          <span className={styles.runnerCallsign}>OPERATOR // RUNNER</span>
          <span className={styles.runnerSub}>SYNC: 99.8% NOMINAL</span>
        </div>
      </div>

      {/* HP Capacity Meter */}
      <div className={styles.meterContainer} style={{ marginTop: '8px' }}>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>HEALTH CAPACITY</span>
          <span className={styles.statValue}>
            {player.hp} / {player.maxHp}
          </span>
        </div>
        <div className={styles.meterTrack}>
          <div className={styles.meterFillHp} style={{ width: `${Math.min(100, hpPercent)}%` }} />
        </div>
      </div>

      {/* Level & XP */}
      <div className={styles.statRow}>
        <span className={styles.statLabel}>NEURAL LEVEL</span>
        <span className={styles.statValue}>{player.level}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.statLabel}>ACCUMULATED XP</span>
        <span className={styles.statValue}>
          {player.xp} / {xpNextLevel}
        </span>
      </div>
      <div className={styles.barContainer}>
        <div className={`${styles.barFill} ${styles.xpBar}`} style={{ width: `${Math.min(100, xpPercent)}%` }} />
      </div>

      {/* Scrap Counter */}
      <div className={styles.statRow}>
        <span className={styles.statLabel}>RECOVERED SCRAP</span>
        <span className={styles.statValue} style={{ color: 'var(--c-scrap)' }}>
          {scrap.toLocaleString()} CR
        </span>
      </div>

      {/* Core Heat Dissipation Meter */}
      <div className={styles.meterContainer} style={{ marginTop: '6px' }}>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>CORE HEAT DISSIPATION</span>
          <span className={styles.statValue} style={{ color: heatPercent > 70 ? 'var(--c-danger)' : 'var(--c-warning)' }}>
            {Math.round(player.heat)} / {player.maxHeat} [TIER-{heatTier}]
          </span>
        </div>
        <div className={styles.meterTrack}>
          <div className={styles.meterFillHeat} style={{ width: `${Math.min(100, heatPercent)}%` }} />
        </div>
      </div>

      {/* Active Status Effects */}
      {player.statuses.length > 0 && (
        <div className={styles.modsContainer}>
          <div className={styles.modsHeader}>ACTIVE STATUS VECTOR</div>
          <div className={styles.modsList}>
            {player.statuses.map((status, i) => (
              <span key={i} className={`${styles.modBadge} ${styles.statusBadge}`}>
                {status}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Active Mods */}
      {player.mods.length > 0 && (
        <div className={styles.modsContainer}>
          <div className={styles.modsHeader}>SOCKETED MODS</div>
          <div className={styles.modsList}>
            {player.mods.map((mod, i) => (
              <span key={i} className={styles.modBadge}>
                {mod}
              </span>
            ))}
          </div>
        </div>
      )}
    </PanelCard>
  );
};

export default PlayerHUD;
