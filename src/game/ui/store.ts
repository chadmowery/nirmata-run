import { createStore } from 'zustand/vanilla';
import { GameState } from '../states/types';

export type GameStatus = GameState;
export type MessageType = 'info' | 'combat' | 'error';

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
  
  // Overlays
  anchorOverlayVisible: boolean;
  anchorData: AnchorOverlayData | null;
  staircaseOverlayVisible: boolean;
  staircaseData: StaircaseOverlayData | null;
  runResultsVisible: boolean;
  runResults: RunResultsData | null;
  bsodVisible: boolean;
  bsodReason: string;

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
  showBSOD: (reason: string) => void;
  hideBSOD: () => void;
}

const MAX_MESSAGES = 50;

export const gameStore = createStore<UIState>((set) => ({
  player: {
    hp: 0,
    maxHp: 0,
    xp: 0,
    level: 1,
    statuses: [],
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
  anchorOverlayVisible: false,
  anchorData: null,
  staircaseOverlayVisible: false,
  staircaseData: null,
  runResultsVisible: false,
  runResults: null,
  bsodVisible: false,
  bsodReason: '',

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
      context.eventBus.emit('ANCHOR_DECISION_MADE', { 
        decision,
        anchorId: state.anchorData.anchorId,
        descendCost: state.anchorData.descendCost,
        floorNumber: state.anchorData.floorNumber
      });
      context.eventBus.flush();
    }
    set({ anchorOverlayVisible: false, anchorData: null });
  },

  showStaircaseOverlay: (data) => set({ staircaseOverlayVisible: true, staircaseData: data }),
  hideStaircaseOverlay: () => set({ staircaseOverlayVisible: false, staircaseData: null }),
  makeStaircaseDecision: (confirmed) => {
    const context = (window as unknown as { gameContext: { eventBus: { emit: (event: string, payload: unknown) => void, flush: () => void }, playerId: number } }).gameContext;
    const state = gameStore.getState();
    if (context) {
      context.eventBus.emit('STAIRCASE_DECISION_MADE', { 
        confirmed,
        targetFloor: state.staircaseData?.targetFloor ?? 0,
        staircaseId: state.staircaseData?.staircaseId ?? 0
      });
      context.eventBus.flush();
    }
    set({ staircaseOverlayVisible: false, staircaseData: null });
  },

  showRunResults: (results) => set({ runResultsVisible: true, runResults: results }),
  showBSOD: (reason) => set({ bsodVisible: true, bsodReason: reason }),
  hideBSOD: () => set({ bsodVisible: false, bsodReason: '' }),
}));
