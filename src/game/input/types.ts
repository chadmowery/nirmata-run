import { GameAction } from './actions';

/**
 * Callback for when a game action is triggered by input.
 */
export type ActionHandler = (action: GameAction) => void;
