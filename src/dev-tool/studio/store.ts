'use client';
import { create } from 'zustand';
import { Section, SelectedItem } from './types';

interface GamedataStore {
  // Sidebar state
  expandedSections: Set<Section>;
  toggleSection: (section: Section) => void;

  // Selection state
  selectedItem: SelectedItem | null;
  selectItem: (section: Section, name: string) => void;
  clearSelection: () => void;

  // Data lists (populated from API)
  sectionItems: Record<Section, string[]>;
  setSectionItems: (section: Section, items: string[]) => void;

  // Editor dirty state
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;

  // Clone support (D-06): editors read cloneSource on mount when isNew=true
  cloneSource: string | null;
  setCloneSource: (name: string) => void;
  clearCloneSource: () => void;

  // Active telemetry and validation state for the inspector column
  activeEffectiveData: unknown;
  setActiveEffectiveData: (data: unknown) => void;
  activeValidationStatus: {
    zodValid: boolean;
    ecsResult?: {
      valid: boolean;
      errors: { id: string; message: string }[];
      warnings: { id: string; message: string }[];
    };
    prefabResult?: {
      valid: boolean;
      errors: { id: string; message: string }[];
      warnings: { id: string; message: string }[];
    };
  } | null;
  setActiveValidationStatus: (status: GamedataStore['activeValidationStatus']) => void;
}

export const useGamedataStore = create<GamedataStore>((set) => ({
  expandedSections: new Set<Section>(['entities']),
  toggleSection: (section) =>
    set((state) => {
      const next = new Set(state.expandedSections);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return { expandedSections: next };
    }),

  selectedItem: null,
  selectItem: (section, name) =>
    set({
      selectedItem: { section, name },
      isDirty: false,
      activeEffectiveData: null,
      activeValidationStatus: null,
    }),
  clearSelection: () =>
    set({
      selectedItem: null,
      isDirty: false,
      activeEffectiveData: null,
      activeValidationStatus: null,
    }),

  sectionItems: {
    entities: [],
    mixins: [],
    spawnTables: [],
    componentSchemas: [],
    shells: [],
    prefabs: [],
    configs: [],
    audioCues: [],
  },
  setSectionItems: (section, items) =>
    set((state) => ({
      sectionItems: { ...state.sectionItems, [section]: items },
    })),

  isDirty: false,
  setDirty: (dirty) => set({ isDirty: dirty }),

  // Clone support: editors check this on mount to pre-populate from existing item
  cloneSource: null,
  setCloneSource: (name) => set({ cloneSource: name }),
  clearCloneSource: () => set({ cloneSource: null }),

  activeEffectiveData: null,
  setActiveEffectiveData: (data) => set({ activeEffectiveData: data }),
  activeValidationStatus: null,
  setActiveValidationStatus: (status) => set({ activeValidationStatus: status }),
}));
