import { create } from 'zustand';
import { EventOrigin } from '../../shared/utils/event-context';

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
}

const MAX_TIMELINE_EVENTS = 200;

export const useDebugStore = create<DebugState>((set) => ({
  timelineEvents: [],
  timelineVisible: false,
  excludedEventTypes: new Set(['FOV_UPDATED']),
  isGroupingEnabled: true,

  addTimelineEvent: (type, payload, origin) => set((state) => {
    if (state.excludedEventTypes.has(type)) return state;

    const lastEvent = state.timelineEvents[0];
    if (state.isGroupingEnabled && lastEvent && lastEvent.type === type && lastEvent.origin === origin) {
      // Group with last event
      const updatedEvents = [...state.timelineEvents];
      updatedEvents[0] = {
        ...lastEvent,
        timestamp: Date.now(), // Update timestamp to newest
        count: lastEvent.count + 1,
        payload, // Always use the newest payload
      };
      return { timelineEvents: updatedEvents };
    }

    const newEvent: TimelineEvent = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      type,
      payload,
      origin,
      count: 1,
    };

    const newEvents = [newEvent, ...state.timelineEvents];
    if (newEvents.length > MAX_TIMELINE_EVENTS) {
      newEvents.pop();
    }

    return { timelineEvents: newEvents };
  }),

  toggleTimeline: () => set((state) => ({ timelineVisible: !state.timelineVisible })),

  clearTimeline: () => set({ timelineEvents: [] }),

  toggleEventType: (type) => set((state) => {
    const newExcluded = new Set(state.excludedEventTypes);
    if (newExcluded.has(type)) {
      newExcluded.delete(type);
    } else {
      newExcluded.add(type);
    }
    return { excludedEventTypes: newExcluded };
  }),

  setGroupingEnabled: (enabled) => set({ isGroupingEnabled: enabled }),
}));
