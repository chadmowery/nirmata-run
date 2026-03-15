import { GameAction } from './actions';

type SubmitActionFn = (action: GameAction) => void;

let submitActionRegistry: SubmitActionFn | null = null;

/**
 * Registers the engine's action submission function.
 */
export function registerInputBridge(fn: SubmitActionFn) {
  submitActionRegistry = fn;
}

/**
 * Dispatches a semantic game action from the UI to the engine.
 */
export function dispatchUIAction(action: GameAction) {
  if (!submitActionRegistry) {
    console.warn('Input bridge called before registration');
    return;
  }
  submitActionRegistry(action);
}
