import { EventBus } from '@engine/events/event-bus';
import { GameEvents } from '@game/events/types';

/**
 * Represents the current state of the targeting mode.
 */
export interface TargetingState {
  active: boolean;
  firmwareSlotIndex: number;
  cursorX: number;
  cursorY: number;
  playerX: number;
  playerY: number;
  range: number;
  effectType: string;
}

/**
 * Interface for the targeting manager.
 */
export interface TargetingManager {
  startTargeting(
    slotIndex: number, 
    playerX: number, 
    playerY: number, 
    range: number, 
    effectType: string
  ): void;
  moveCursor(dx: number, dy: number): void;
  confirm(): void;
  cancel(): void;
  isActive(): boolean;
  getState(): TargetingState;
}

/**
 * Creates a targeting manager to handle cursor-based tile selection.
 */
export function createTargetingManager(
  eventBus: EventBus<GameEvents>,
  onConfirm: (slotIndex: number, targetX: number, targetY: number) => void,
  gridWidth: number = 100, // Default large bounds if not provided
  gridHeight: number = 100
): TargetingManager {
  let state: TargetingState = {
    active: false,
    firmwareSlotIndex: -1,
    cursorX: 0,
    cursorY: 0,
    playerX: 0,
    playerY: 0,
    range: 0,
    effectType: ''
  };

  return {
    startTargeting(slotIndex, playerX, playerY, range, effectType) {
      state = {
        active: true,
        firmwareSlotIndex: slotIndex,
        cursorX: playerX,
        cursorY: playerY,
        playerX,
        playerY,
        range,
        effectType
      };
      
      eventBus.emit('TARGETING_STARTED', { ...state });
      eventBus.flush();
    },

    moveCursor(dx, dy) {
      if (!state.active) return;

      const newX = Math.max(0, Math.min(gridWidth - 1, state.cursorX + dx));
      const newY = Math.max(0, Math.min(gridHeight - 1, state.cursorY + dy));

      // Range validation: Manhattan distance from player
      const dist = Math.abs(newX - state.playerX) + Math.abs(newY - state.playerY);
      
      if (state.range > 0 && dist > state.range) {
        // Block movement if range is exceeded
        return;
      }

      state.cursorX = newX;
      state.cursorY = newY;

      eventBus.emit('TARGETING_CURSOR_MOVED', { x: newX, y: newY });
      eventBus.flush();
    },

    confirm() {
      if (!state.active) return;

      const { firmwareSlotIndex, cursorX, cursorY } = state;
      state.active = false;
      
      onConfirm(firmwareSlotIndex, cursorX, cursorY);
      
      eventBus.emit('TARGETING_CONFIRMED', { 
        targetX: cursorX, 
        targetY: cursorY 
      });
      eventBus.flush();
    },

    cancel() {
      if (!state.active) return;
      state.active = false;
      eventBus.emit('TARGETING_CANCELLED', {});
      eventBus.flush();
    },

    isActive() {
      return state.active;
    },

    getState() {
      return { ...state };
    }
  };
}
