import React, { useEffect, useState } from 'react';
import { RunMode } from '@/shared/run-mode';
import styles from './LeaderboardPanel.module.css';

interface LeaderboardEntry {
  playerName: string;
  score: number;
  floor: number;
  timestamp: string;
}

interface LeaderboardPanelProps {
  mode: RunMode;
  sessionId: string;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({ mode, sessionId }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/leaderboard/${mode}`);
        if (response.ok) {
          const data = await response.json();
          setEntries(data.entries || []);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    if (mode === RunMode.DAILY || mode === RunMode.WEEKLY) {
      fetchLeaderboard();
    }
  }, [mode]);

  if (mode === RunMode.SIMULATION) return null;

  const heading = mode === RunMode.DAILY 
    ? `DAILY_LEADERBOARD // ${new Date().toISOString().split('T')[0]}`
    : `WEEKLY_LEADERBOARD // ${new Date().getFullYear()}-W${getWeekNumber(new Date())}`;

  return (
    <div className={styles.panel}>
      <h3 className={styles.heading}>{heading}</h3>
      <div className={styles.list}>
        {loading ? (
          <div className={styles.loading}>LOADING_RECORDS...</div>
        ) : entries.length > 0 ? (
          entries.map((entry, index) => (
            <div key={`${entry.playerName}-${index}`} className={styles.entry}>
              <div className={`${styles.rank} ${index < 3 ? styles.topRank : ''}`}>
                {index + 1}
              </div>
              <div className={styles.playerName}>{entry.playerName}</div>
              <div className={styles.floor}>FLOOR_{entry.floor}</div>
              <div className={styles.score}>{entry.score.toLocaleString()} PTS</div>
            </div>
          ))
        ) : (
          <div className={styles.empty}>NO_RUNS_RECORDED // PERIOD_ACTIVE</div>
        )}
      </div>
    </div>
  );
};

function getWeekNumber(d: Date) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}
