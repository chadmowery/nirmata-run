'use client';

import React, { useRef, useEffect } from 'react';
import { useDebugStore } from '../debug/debug-store';
import styles from './EventTimelinePanel.module.css';

export const EventTimelinePanel: React.FC = () => {
  const {
    timelineEvents,
    timelineVisible,
    clearTimeline,
    excludedEventTypes,
    toggleEventType,
    isGroupingEnabled,
    setGroupingEnabled,
    exportTimeline,
  } = useDebugStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get all unique event types from the current log plus some common ones
  const allEventTypes = Array.from(
    new Set([
      'FOV_UPDATED',
      'ENTITY_MOVED',
      'TURN_START',
      'TURN_END',
      ...timelineEvents.map((e) => e.type),
    ]),
  ).sort();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [timelineEvents]);

  if (!timelineVisible) return null;

  return (
    <div className={styles.timelinePanel} id="debug-timeline-panel">
      <div className={styles.panelHeader}>
        <div className={styles.title}>Event Timeline Log</div>
        <div className={styles.headerActions}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={isGroupingEnabled}
              onChange={(e) => setGroupingEnabled(e.target.checked)}
            />
            Group
          </label>
          <div className={styles.headerButtons}>
            <button
              className={styles.saveButton}
              onClick={exportTimeline}
              disabled={timelineEvents.length === 0}
            >
              Save Log
            </button>
            <button className={styles.clearButton} onClick={clearTimeline}>
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterTitle}>Filter Event Types</div>
        <div className={styles.filterTags}>
          {allEventTypes.map((type) => {
            const isExcluded = excludedEventTypes.has(type);
            return (
              <label
                key={type}
                className={`${styles.filterTag} ${
                  isExcluded ? styles.tagDisabled : styles.tagEnabled
                }`}
              >
                <input
                  type="checkbox"
                  checked={!isExcluded}
                  onChange={() => toggleEventType(type)}
                />
                {type}
              </label>
            );
          })}
        </div>
      </div>

      <div className={styles.eventList} ref={scrollRef}>
        {timelineEvents.map((event) => {
          const time = new Date(event.timestamp).toLocaleTimeString();
          const originClass =
            event.origin === 'client'
              ? styles.originClient
              : event.origin === 'server'
                ? styles.originServer
                : styles.originUi;

          return (
            <div key={event.id} className={styles.eventItem}>
              <div className={styles.eventHeader}>
                <span className={styles.timestamp}>{time}</span>
                <span className={`${styles.originTag} ${originClass}`}>{event.origin}</span>
                <span className={styles.eventType}>{event.type}</span>
                {event.count > 1 && (
                  <span className={styles.eventCount}>(x{event.count})</span>
                )}
              </div>
              {event.payload !== undefined && (
                <div className={styles.payload}>
                  {JSON.stringify(event.payload, null, 2)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EventTimelinePanel;
