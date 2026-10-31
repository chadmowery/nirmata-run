'use client';

import React, { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { PanelCard } from './atomic';
import styles from './styles.module.css';

export const MessageLog: React.FC = () => {
  const messages = useStore(gameStore, (s) => s.messages);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  const getTag = (type: string) => {
    switch (type) {
      case 'combat':
        return '[COMBAT]';
      case 'error':
        return '[KERNEL]';
      case 'warning':
        return '[ALERT]';
      default:
        return '[TELEMETRY]';
    }
  };

  const getTagColor = (type: string) => {
    switch (type) {
      case 'combat':
        return 'var(--c-danger)';
      case 'error':
        return 'var(--c-danger)';
      case 'warning':
        return 'var(--c-warning)';
      default:
        return 'var(--c-accent-secondary)';
    }
  };

  return (
    <PanelCard
      title="COMBAT TELEMETRY"
      badge="LIVE FEED"
      className={styles.telemetryFeed}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', flex: 1 }}>
        {messages.map((msg) => (
          <div key={msg.id} className={styles.logItem}>
            <span className={styles.logTag} style={{ color: getTagColor(msg.type) }}>
              {getTag(msg.type)}
            </span>
            <span className={styles.logMsg}>{msg.text}</span>
            {msg.count > 1 && (
              <span style={{ color: 'var(--c-accent)', fontWeight: 800 }}>
                (x{msg.count})
              </span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </PanelCard>
  );
};

export default MessageLog;
