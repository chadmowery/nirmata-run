import { createStore } from 'zustand/vanilla';
import { GameState } from '../states/types';
import { EventOriginContext } from '../../shared/utils/event-context';
import { PlayerProfile, VaultItem } from '@/shared/profile';
import { RunMode } from '@/shared/run-mode';
import { ShellTemplate } from '@/game/shells/types';

export type GameStatus = GameState;
export type MessageType = 'info' | 'combat' | 'error';

export type HubTab = 'shell' | 'loadout' | 'workshop' | 'vault' | 'initialize';

export interface ModeAvailability {
  mode: RunMode;
  name: string;
  description: string;
  available: boolean;
  reason: string | null;
  attemptsRemaining: number | 'unlimited';
}

export interface MessageEntry {
  id: string;
  text: string;
  count: number;
  type: MessageType;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  statuses: string[];
  heat: number;
  maxHeat: number;
  shellName: string;
  mods: string[];
}

export interface AbilityData {
  name: string;
  slotIndex: number;
  heatCost: number;
  range: number;
  effectType: string;
}

export interface VisibleEntity {
  id: number;
  name: string;
  hp: number;
  maxHp: number;
}

export interface RunStats {
  turns: number;
  kills: number;
}

export interface AnchorOverlayData {
  floorNumber: number;
  stabilityPercent: number;
  inventory: { firmware: string[]; augments: string[]; software: string[]; scrap: number };
  descendCost: number;
  nextFloorEnemyTier: string;
  estimatedStabilityAfterDescent: number;
  anchorId: number;
}

export interface StaircaseOverlayData {
  targetFloor: number;
  staircaseId: number;
}

export interface RunResultsData {
  reason: string;
  floorNumber: number;
  enemiesKilled: number;
  turnsElapsed: number;
  peakHeat: number;
  itemsSecured: { firmware: number; augments: number; software: number; scrap: number };
  score: number;
  deathReason?: string;
}

export interface UIState {
  player: PlayerStats;
  messages: MessageEntry[];
  gameStatus: GameStatus;
  visibleEntities: VisibleEntity[];
  stats: RunStats;
  
  // Phase 12 stability & floor state
  stability: number;       // 0-100
  maxStability: number;    // 100
  currentFloor: number;    // 1-15
  depthBand: string;       // "CORRUPTED_DATA" | "STATIC_HORRORS" | "LOGIC_BREAKERS"
  scrap: number;           // Current Scrap amount
  walletScrap: number;     // Session-level persistent Scrap
  
  // Overlays
  anchorOverlayVisible: boolean;
  anchorData: AnchorOverlayData | null;
  staircaseOverlayVisible: boolean;
  staircaseData: StaircaseOverlayData | null;
  runResultsVisible: boolean;
  runResults: RunResultsData | null;
  bsodVisible: boolean;
  bsodReason: string;

  // Phase 15: Hub state
  activeTab: HubTab;
  playerProfile: PlayerProfile | null;
  shellTemplates: ShellTemplate[];
  profileLoading: boolean;
  profileError: string | null;
  selectedShellIndex: number;
  draggedItem: VaultItem | null;
  dragOverSlot: string | null;
  compilingBlueprintId: string | null;
  selectedRunMode: RunMode | null;
  modeAvailability: ModeAvailability[] | null;
  ritualActive: boolean;
  bootSequenceActive: boolean;
  hasOverflow: boolean;
  overflowCount: number;
  launchConfig: { mode: RunMode; seed: string; sessionId: string } | null;

  // New gameplay feedback fields
  abilities: AbilityData[];
  targetingActive: boolean;
  targetingSlotIndex: number;
  targetingRange: number;
  targetingX: number;
  targetingY: number;

  // Actions
  updatePlayerStats: (stats: Partial<PlayerStats>) => void;
  addMessage: (text: string, type: MessageType) => void;
  setGameStatus: (status: GameStatus) => void;
  setVisibleEntities: (entities: VisibleEntity[]) => void;
  updateStats: (stats: Partial<RunStats>) => void;
  
  // Phase 12 actions
  updateStability: (stability: number, max: number) => void;
  updateFloor: (floor: number, band: string) => void;
  updateScrap: (amount: number) => void;
  showAnchorOverlay: (data: AnchorOverlayData) => void;
  hideAnchorOverlay: () => void;
  makeAnchorDecision: (decision: 'extract' | 'descend') => void;
  showStaircaseOverlay: (data: StaircaseOverlayData) => void;
  hideStaircaseOverlay: () => void;
  makeStaircaseDecision: (confirmed: boolean) => void;
  showRunResults: (results: RunResultsData) => void;
  setRunResultsData: (results: RunResultsData) => void;
  showBSOD: (reason: string) => void;
  hideBSOD: () => void;
  addScrapToWallet: (amount: number) => void;
  resetRunStats: () => void;

  // Phase 15: Hub actions
  setActiveTab: (tab: HubTab) => void;
  setPlayerProfile: (profile: PlayerProfile) => void;
  setShellTemplates: (templates: ShellTemplate[]) => void;
  setProfileLoading: (loading: boolean) => void;
  setProfileError: (error: string | null) => void;
  setSelectedShellIndex: (index: number) => void;
  setDraggedItem: (item: VaultItem | null) => void;
  setDragOverSlot: (slot: string | null) => void;
  setCompilingBlueprintId: (id: string | null) => void;
  setSelectedRunMode: (mode: RunMode | null) => void;
  setModeAvailability: (modes: ModeAvailability[]) => void;
  setRitualActive: (active: boolean) => void;
  setBootSequenceActive: (active: boolean) => void;
  setLaunchConfig: (config: { mode: RunMode; seed: string; sessionId: string } | null) => void;
  updateProfileOptimistic: (updater: (profile: PlayerProfile) => PlayerProfile) => void;
  resetHubState: () => void;
  setAbilities: (abilities: AbilityData[]) => void;
  setTargeting: (active: boolean, slotIndex: number, range: number, x?: number, y?: number) => void;
  updateTargetingCursor: (x: number, y: number) => void;
}

const MAX_MESSAGES = 50;

export const gameStore = createStore<UIState>((set) => ({
  player: {
    hp: 0,
    maxHp: 0,
    xp: 0,
    level: 1,
    statuses: [],
    heat: 0,
    maxHeat: 100,
    shellName: 'None',
    mods: [],
  },
  messages: [],
  gameStatus: GameState.MainMenu,
  visibleEntities: [],
  stats: {
    turns: 0,
    kills: 0,
  },

  // Phase 12 defaults
  stability: 100,
  maxStability: 100,
  currentFloor: 1,
  depthBand: 'CORRUPTED_DATA',
  scrap: 0,
  walletScrap: 0,
  anchorOverlayVisible: false,
  anchorData: null,
  staircaseOverlayVisible: false,
  staircaseData: null,
  runResultsVisible: false,
  runResults: null,
  bsodVisible: false,
  bsodReason: '',

  // Phase 15: Hub defaults
  activeTab: 'shell' as HubTab,
  playerProfile: null,
  shellTemplates: [],
  profileLoading: false,
  profileError: null,
  selectedShellIndex: 0,
  draggedItem: null,
  dragOverSlot: null,
  compilingBlueprintId: null,
  selectedRunMode: null,
  modeAvailability: null,
  ritualActive: false,
  bootSequenceActive: false,
  hasOverflow: false,
  overflowCount: 0,
  launchConfig: null,
  abilities: [],
  targetingActive: false,
  targetingSlotIndex: -1,
  targetingRange: 0,
  targetingX: 0,
  targetingY: 0,

  updatePlayerStats: (stats) => 
    set((state) => ({
      player: { ...state.player, ...stats },
    })),

  updateStats: (stats: Partial<RunStats>) => 
    set((state) => ({
      stats: { ...state.stats, ...stats },
    })),

  addMessage: (text, type) =>
    set((state) => {
      const lastMessage = state.messages[0];
      
      if (lastMessage && lastMessage.text === text && lastMessage.type === type) {
        // Update count of identical consecutive message
        const updatedMessages = [...state.messages];
        updatedMessages[0] = {
          ...lastMessage,
          count: lastMessage.count + 1,
        };
        return { messages: updatedMessages };
      }

      // Add new message
      const newMessage: MessageEntry = {
        id: Math.random().toString(36).substring(2, 9),
        text,
        count: 1,
        type,
      };

      const newMessages = [newMessage, ...state.messages];
      if (newMessages.length > MAX_MESSAGES) {
        newMessages.pop();
      }

      return { messages: newMessages };
    }),

  setGameStatus: (status) => set({ gameStatus: status }),

  setVisibleEntities: (entities) => set({ visibleEntities: entities }),

  // Phase 12 actions
  updateStability: (stability, max) => set({ stability, maxStability: max }),
  updateFloor: (floor, band) => set({ currentFloor: floor, depthBand: band }),
  updateScrap: (amount) => set({ scrap: amount }),
  showAnchorOverlay: (data) => set({ anchorOverlayVisible: true, anchorData: data }),
  hideAnchorOverlay: () => set({ anchorOverlayVisible: false, anchorData: null }),
  makeAnchorDecision: (decision: 'extract' | 'descend') => {
    // In a real environment, we'd use a better bridge, but for now we use the global context
    const context = (window as unknown as { gameContext: { eventBus: { emit: (event: string, payload: unknown) => void, flush: () => void } } }).gameContext;
    const state = gameStore.getState();
    if (context && state.anchorData) {
      const previousOrigin = EventOriginContext.current;
      EventOriginContext.current = 'ui';

      context.eventBus.emit('ANCHOR_DECISION_MADE', { 
        decision,
        anchorId: state.anchorData.anchorId,
        descendCost: state.anchorData.descendCost,
        floorNumber: state.anchorData.floorNumber
      });
      context.eventBus.flush();

      EventOriginContext.current = previousOrigin;
    }
    set({ anchorOverlayVisible: false, anchorData: null });
  },

  showStaircaseOverlay: (data) => set({ staircaseOverlayVisible: true, staircaseData: data }),
  hideStaircaseOverlay: () => set({ staircaseOverlayVisible: false, staircaseData: null }),
  makeStaircaseDecision: (confirmed) => {
    const context = (window as unknown as { gameContext: { eventBus: { emit: (event: string, payload: unknown) => void, flush: () => void }, playerId: number } }).gameContext;
    const state = gameStore.getState();
    if (context) {
      const previousOrigin = EventOriginContext.current;
      EventOriginContext.current = 'ui';

      context.eventBus.emit('STAIRCASE_DECISION_MADE', { 
        confirmed,
        targetFloor: state.staircaseData?.targetFloor ?? 0,
        staircaseId: state.staircaseData?.staircaseId ?? 0
      });
      context.eventBus.flush();

      EventOriginContext.current = previousOrigin;
    }
    set({ staircaseOverlayVisible: false, staircaseData: null });
  },

  showRunResults: (results) => set({ runResultsVisible: true, runResults: results }),
  setRunResultsData: (results) => set({ runResults: results }),
  showBSOD: (reason) => set({ bsodVisible: true, bsodReason: reason }),
  hideBSOD: () => set({ bsodVisible: false, bsodReason: '' }),
  addScrapToWallet: (amount) => set((state) => ({ walletScrap: state.walletScrap + amount })),
  resetRunStats: () => set({
    scrap: 0,
    stats: { turns: 0, kills: 0 },
    player: {
      hp: 0,
      maxHp: 0,
      xp: 0,
      level: 1,
      statuses: [],
      heat: 0,
      maxHeat: 100,
      shellName: 'None',
      mods: [],
    },
    stability: 100,
    currentFloor: 1,
    runResults: null,
    runResultsVisible: false,
    bsodVisible: false,
    bsodReason: '',
  }),

  // Phase 15: Hub actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setPlayerProfile: (profile) => set({
    playerProfile: profile,
    hasOverflow: profile.overflow.length > 0,
    overflowCount: profile.overflow.length,
  }),
  setShellTemplates: (templates) => set({ shellTemplates: templates }),
  setProfileLoading: (loading) => set({ profileLoading: loading }),
  setProfileError: (error) => set({ profileError: error }),
  setSelectedShellIndex: (index) => set({ selectedShellIndex: index }),
  setDraggedItem: (item) => set({ draggedItem: item }),
  setDragOverSlot: (slot) => set({ dragOverSlot: slot }),
  setCompilingBlueprintId: (id) => set({ compilingBlueprintId: id }),
  setSelectedRunMode: (mode) => set({ selectedRunMode: mode }),
  setModeAvailability: (modes) => set({ modeAvailability: modes }),
  setRitualActive: (active) => set({ ritualActive: active }),
  setBootSequenceActive: (active) => set({ bootSequenceActive: active }),
  setLaunchConfig: (config) => set({ launchConfig: config }),
  updateProfileOptimistic: (updater) => set((state) => {
    if (!state.playerProfile) return {};
    const updated = updater(state.playerProfile);
    return {
      playerProfile: updated,
      hasOverflow: updated.overflow.length > 0,
      overflowCount: updated.overflow.length,
    };
  }),
  resetHubState: () => set({
    playerProfile: null,
    shellTemplates: [],
    profileLoading: false,
    profileError: null,
    selectedShellIndex: 0,
    draggedItem: null,
    dragOverSlot: null,
    compilingBlueprintId: null,
    selectedRunMode: null,
    modeAvailability: null,
    ritualActive: false,
    bootSequenceActive: false,
  }),
  setAbilities: (abilities) => set({ abilities }),
  setTargeting: (active, slotIndex, range, x = 0, y = 0) => 
    set({ 
      targetingActive: active, 
      targetingSlotIndex: slotIndex, 
      targetingRange: range,
      targetingX: x,
      targetingY: y
    }),
  updateTargetingCursor: (x, y) => set({ targetingX: x, targetingY: y }),
}));
