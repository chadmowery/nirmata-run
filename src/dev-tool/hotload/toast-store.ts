import { create } from 'zustand';
import type { HotloadToastEntry } from './types';

interface HotloadToastState {
  activeToast: HotloadToastEntry | null;
  liveSyncActive: boolean;
  sseConnected: boolean;
  lastError: string | null;
  pushToast: (entry: HotloadToastEntry) => void;
  clearToast: () => void;
  setLiveSyncActive: (active: boolean) => void;
  setSseConnected: (connected: boolean) => void;
  setLastError: (err: string | null) => void;
}

export const useHotloadToastStore = create<HotloadToastState>((set) => ({
  activeToast: null,
  liveSyncActive: false,
  sseConnected: false,
  lastError: null,
  pushToast: (entry) => set({ activeToast: entry, lastError: null }),
  clearToast: () => set({ activeToast: null }),
  setLiveSyncActive: (active) => set({ liveSyncActive: active }),
  setSseConnected: (connected) => set({ sseConnected: connected }),
  setLastError: (err) => set({ lastError: err }),
}));
