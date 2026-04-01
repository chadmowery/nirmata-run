'use client';

import React, { useRef, useEffect } from 'react';
import { useDebugStore, TimelineEvent } from '../../game/debug/debug-store';
import styles from './EventTimelinePanel.module.css';

const EventTimelinePanel: React.FC = () => {
  const { 
    timelineEvents, 
    timelineVisible, 
    clearTimeline, 
    excludedEventTypes, 
    toggleEventType, 
    isGroupingEnabled, 
    setGroupingEnabled 
  } = useDebugStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get all unique event types from the current log plus some common ones
  const allEventTypes = Array.from(new Set([
    'FOV_UPDATED',
    'ENTITY_MOVED',
    'TURN_START',
    'TURN_END',
    ...timelineEvents.map(e => e.type)
  ])).sort();

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
          <button className={styles.clearButton} onClick={clearTimeline}>Clear</button>
        </div>
      </div>
      
      <div className={styles.filterBar}>
        <span className={styles.filterTitle}>Show:</span>
        <div className={styles.filterTags}>
          {allEventTypes.map(type => (
            <label key={type} className={`${styles.filterTag} ${excludedEventTypes.has(type) ? styles.tagDisabled : styles.tagEnabled}`}>
              <input 
                type="checkbox" 
                checked={!excludedEventTypes.has(type)} 
                onChange={() => toggleEventType(type)} 
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.eventList} ref={scrollRef}>
        {timelineEvents.map((event: TimelineEvent) => (
          <div key={event.id} className={styles.eventItem}>
            <div className={styles.eventHeader}>
              <span className={styles.timestamp}>
                {new Date(event.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}.{String(event.timestamp % 1000).padStart(3, '0')}
              </span>
              <span className={`${styles.originTag} ${
                event.origin === 'client' ? styles.originClient : 
                event.origin === 'server' ? styles.originServer : 
                styles.originUi
              }`}>
                {event.origin}
              </span>
              <span className={styles.eventType}>
                {event.type}
                {event.count > 1 && <span className={styles.eventCount}>(x{event.count})</span>}
              </span>
            </div>
            {!!event.payload && typeof event.payload === 'object' && Object.keys(event.payload as object).length > 0 && (
              <pre className={styles.payload}>
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventTimelinePanel;
