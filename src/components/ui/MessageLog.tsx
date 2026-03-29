'use client';

import React, { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import styles from './styles.module.css';

export const MessageLog: React.FC = () => {
  const messages = useStore(gameStore, (s) => s.messages);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0; // Recent messages at top in store, but UI might want them at bottom?
      // Actually, the store prepends messages (recent at [0]).
      // If we want traditional bottom-to-top history, we should reverse them or just scroll to top if prepending.
    }
  }, [messages]);

  return (
    <div className={`${styles.terminalPanel} ${styles.messageLogPanel}`}>
      <div className={styles.panelHeader}>Message Log</div>
      <div className={styles.scrollArea} ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`${styles.messageEntry} ${getMessageClass(msg.type)}`}>
            {msg.text}
            {msg.count > 1 && <span className={styles.msgCount}>(x{msg.count})</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

function getMessageClass(type: string) {
  switch (type) {
    case 'combat': return styles.msgCombat;
    case 'error': return styles.msgError;
    case 'info':
    default: return styles.msgInfo;
  }
}
