import { GameAction } from './actions';

type SubmitActionFn = (action: GameAction) => void;

let submitActionRegistry: SubmitActionFn | null = null;

/**
 * Registers the engine's action submission function.
 */
export function registerInputBridge(fn: SubmitActionFn) {
  submitActionRegistry = fn;
}

import { logger } from '@engine/utils/logger';

/**
 * Dispatches a semantic game action from the UI to the engine.
 */
export function dispatchUIAction(action: GameAction) {
  if (!submitActionRegistry) {
    logger.warn('Input bridge called before registration', 'INPUT');
    return;
  }
  submitActionRegistry(action);
}
