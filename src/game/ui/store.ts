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

export interface UIState {
  player: PlayerStats;
  messages: MessageEntry[];
  gameStatus: GameStatus;
  visibleEntities: VisibleEntity[];
  stats: RunStats;
  
  // Actions
  updatePlayerStats: (stats: Partial<PlayerStats>) => void;
  addMessage: (text: string, type: MessageType) => void;
  setGameStatus: (status: GameStatus) => void;
  setVisibleEntities: (entities: VisibleEntity[]) => void;
  updateStats: (stats: Partial<RunStats>) => void;
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
}));
