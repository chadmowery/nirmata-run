import { create } from 'zustand';
import { EventOrigin } from '@engine/utils/event-context';
import { logger } from '@engine/utils/logger';

export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: string;
  payload: unknown;
  origin: EventOrigin;
  count: number;
}

interface DebugState {
  timelineEvents: TimelineEvent[];
  timelineVisible: boolean;
  excludedEventTypes: Set<string>;
  isGroupingEnabled: boolean;

  addTimelineEvent: (type: string, payload: unknown, origin: EventOrigin) => void;
  toggleTimeline: () => void;
  clearTimeline: () => void;
  toggleEventType: (type: string) => void;
  setGroupingEnabled: (enabled: boolean) => void;
  exportTimeline: () => Promise<void>;
}

const MAX_TIMELINE_EVENTS = 200;

export const useDebugStore = create<DebugState>((set) => ({
  timelineEvents: [],
  timelineVisible: false,
  excludedEventTypes: new Set(['FOV_UPDATED']),
  isGroupingEnabled: true,

  addTimelineEvent: (type, payload, origin) =>
    set((state) => {
      if (state.excludedEventTypes.has(type)) return state;

      const lastEvent = state.timelineEvents[0];
      if (
        state.isGroupingEnabled &&
        lastEvent &&
        lastEvent.type === type &&
        lastEvent.origin === origin
      ) {
        // Group with last event
        const updatedEvents = [...state.timelineEvents];
        updatedEvents[0] = {
          ...lastEvent,
          count: lastEvent.count + 1,
          timestamp: Date.now(),
        };
        return { timelineEvents: updatedEvents };
      }

      const newEvent: TimelineEvent = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
        type,
        payload,
        origin,
        count: 1,
      };

      const updated = [newEvent, ...state.timelineEvents];
      if (updated.length > MAX_TIMELINE_EVENTS) {
        updated.length = MAX_TIMELINE_EVENTS;
      }

      return { timelineEvents: updated };
    }),

  toggleTimeline: () => set((state) => ({ timelineVisible: !state.timelineVisible })),

  clearTimeline: () => set({ timelineEvents: [] }),

  toggleEventType: (type) =>
    set((state) => {
      const next = new Set(state.excludedEventTypes);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return { excludedEventTypes: next };
    }),

  setGroupingEnabled: (enabled) => set({ isGroupingEnabled: enabled }),

  exportTimeline: async () => {
    try {
      const state = useDebugStore.getState();
      const events = state.timelineEvents;

      const response = await fetch('/api/debug/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        throw new Error(`Export failed with status: ${response.status}`);
      }

      logger.info('Timeline exported to debug/session_events.json', 'DEBUG');
    } catch (error) {
      logger.error('Timeline export failed', 'DEBUG', { error });
    }
  },
}));
