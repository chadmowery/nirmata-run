import { GameAction, DEFAULT_BINDINGS } from './actions';
import { ActionHandler } from './types';

/**
 * Manages keyboard input mapping to semantic game actions.
 */
export class InputManager {
  private bindings: Map<string, GameAction>;
  private handler: ActionHandler | null = null;
  private enabled: boolean = false;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private isRequestPending: boolean = false;

  constructor(bindings: Record<string, GameAction> = DEFAULT_BINDINGS) {
    this.bindings = new Map(Object.entries(bindings));
  }

  /**
   * Sets the callback for when an action is triggered.
   */
  setActionHandler(handler: ActionHandler): void {
    this.handler = handler;
  }

  /**
   * Sets whether a server request is currently pending.
   * While pending, all mapped inputs are ignored.
   */
  setRequestPending(pending: boolean): void {
    this.isRequestPending = pending;
  }

  /**
   * Enables input listening.
   */
  enable(): void {
    if (this.enabled) return;

    this.keydownHandler = (event: KeyboardEvent) => {
      // Ignore if event is repeating or if it's from an input element
      if (event.repeat) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      
      // Ignore if a request is pending
      if (this.isRequestPending) return;

      const action = this.bindings.get(event.code);
      if (action && this.handler) {
        // Prevent default browser behavior for mapped keys (e.g., arrow scrolling)
        event.preventDefault();
        this.handler(action);
      }
    };

    document.addEventListener('keydown', this.keydownHandler);
    this.enabled = true;
  }

  /**
   * Disables input listening.
   */
  disable(): void {
    if (!this.enabled || !this.keydownHandler) return;

    document.removeEventListener('keydown', this.keydownHandler);
    this.keydownHandler = null;
    this.enabled = false;
  }

  /**
   * Rebinds a key to an action.
   */
  rebind(keyCode: string, action: GameAction): void {
    this.bindings.set(keyCode, action);
  }

  /**
   * Removes a binding for a key.
   */
  unbind(keyCode: string): void {
    this.bindings.delete(keyCode);
  }

  /**
   * Gets all key codes bound to a specific action.
   */
  getBindingsForAction(action: GameAction): string[] {
    const keys: string[] = [];
    for (const [key, val] of this.bindings.entries()) {
      if (val === action) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * Checks if input is currently enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
