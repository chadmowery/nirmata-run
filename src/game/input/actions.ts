/**
 * Semantic game actions mapped from physical input.
 */
export enum GameAction {
  MOVE_NORTH = 'MOVE_NORTH',
  MOVE_SOUTH = 'MOVE_SOUTH',
  MOVE_EAST = 'MOVE_EAST',
  MOVE_WEST = 'MOVE_WEST',
  WAIT = 'WAIT',
  PAUSE = 'PAUSE',
}

/**
 * Default keyboard bindings using event.code for layout independence.
 */
export const DEFAULT_BINDINGS: Record<string, GameAction> = {
  // Arrow keys
  ArrowUp: GameAction.MOVE_NORTH,
  ArrowDown: GameAction.MOVE_SOUTH,
  ArrowLeft: GameAction.MOVE_WEST,
  ArrowRight: GameAction.MOVE_EAST,
  
  // WASD keys
  KeyW: GameAction.MOVE_NORTH,
  KeyS: GameAction.MOVE_SOUTH,
  KeyA: GameAction.MOVE_WEST,
  KeyD: GameAction.MOVE_EAST,
  
  // Wait
  Period: GameAction.WAIT,
  Numpad5: GameAction.WAIT,
  
  // UI
  Escape: GameAction.PAUSE,
};

/**
 * Mapping of movement actions to grid offsets.
 */
export const DIRECTIONS: Record<string, { dx: number; dy: number }> = {
  [GameAction.MOVE_NORTH]: { dx: 0, dy: -1 },
  [GameAction.MOVE_SOUTH]: { dx: 0, dy: 1 },
  [GameAction.MOVE_WEST]: { dx: -1, dy: 0 },
  [GameAction.MOVE_EAST]: { dx: 1, dy: 0 },
};

/**
 * Type guard to check if an action is a movement action.
 */
export function isMovementAction(action: GameAction): boolean {
  return [
    GameAction.MOVE_NORTH,
    GameAction.MOVE_SOUTH,
    GameAction.MOVE_WEST,
    GameAction.MOVE_EAST,
  ].includes(action);
}
