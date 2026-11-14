'use client';

import React, { useEffect, useState } from 'react';
import { logger } from '@engine/utils/logger';
import { RunMode } from '@/shared/run-mode';
import { reportableFetch } from '@client/reports';
import { PanelCard } from '../atomic';
import styles from './LeaderboardPanel.module.css';

interface LeaderboardEntry {
  playerName: string;
  score: number;
  floor: number;
  timestamp: string;
  turns?: number;
  shell?: string;
  hash?: string;
}

interface LeaderboardPanelProps {
  mode?: RunMode;
  sessionId?: string;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({ mode }) => {
  const [selectedMode, setSelectedMode] = useState<RunMode>(mode || RunMode.DAILY);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const activeMode = mode || selectedMode;

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const response = await reportableFetch(`/api/leaderboard/${activeMode}`);
        if (response.ok) {
          const data = await response.json();
          setEntries(data.entries || []);
        }
      } catch (error) {
        logger.error('Failed to fetch leaderboard:', 'UI', error);
      } finally {
        setLoading(false);
      }
    };

    if (activeMode === RunMode.DAILY || activeMode === RunMode.WEEKLY) {
      fetchLeaderboard();
    } else {
      setEntries([]);
      setLoading(false);
    }
  }, [activeMode]);

  const getRankClass = (idx: number) => {
    if (idx === 0) return styles.rank1;
    if (idx === 1) return styles.rank2;
    if (idx === 2) return styles.rank3;
    return '';
  };

  return (
    <PanelCard
      title="GLOBAL NEURAL RECON LEADERBOARD"
      badge={`${activeMode.toUpperCase()} LEAGUE`}
    >
      <div className={styles.leaderboardContainer}>
        {!mode && (
          <div className={styles.modeToggleBar}>
            <button
              type="button"
              className={`${styles.modeToggleBtn} ${selectedMode === RunMode.DAILY ? styles.active : ''}`}
              onClick={() => setSelectedMode(RunMode.DAILY)}
            >
              DAILY CHALLENGE
            </button>
            <button
              type="button"
              className={`${styles.modeToggleBtn} ${selectedMode === RunMode.WEEKLY ? styles.active : ''}`}
              onClick={() => setSelectedMode(RunMode.WEEKLY)}
            >
              WEEKLY ONE-SHOT
            </button>
          </div>
        )}

        {loading ? (
          <div className={styles.loading}>
            QUERYING VERIFIED OPERATOR ARCHIVES // VEC-OS 1.0.4...
          </div>
        ) : entries.length > 0 ? (
          <div className={styles.tableWrapper}>
            <table className={styles.leaderboardTable}>
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>CALLSIGN</th>
                  <th>DEPTH</th>
                  <th>SCORE</th>
                  <th>RECORD TIMESTAMP</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={`${entry.playerName}-${index}`}>
                    <td className={getRankClass(index)}>
                      #{String(index + 1).padStart(2, '0')}
                    </td>
                    <td style={{ fontWeight: 800 }}>{entry.playerName}</td>
                    <td>FLOOR {String(entry.floor).padStart(2, '0')}</td>
                    <td style={{ fontWeight: 900, color: 'var(--c-accent)' }}>
                      {entry.score.toLocaleString()} PTS
                    </td>
                    <td style={{ color: 'var(--c-text-dim)' }}>
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.empty}>
            NO CERTIFIED OPERATOR LOGS RECORDED FOR ACTIVE ROTATION PERIOD
          </div>
        )}
      </div>
    </PanelCard>
  );
};

export default LeaderboardPanel;
