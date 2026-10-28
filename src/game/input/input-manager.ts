import { GameAction, DEFAULT_BINDINGS, isMovementAction, DIRECTIONS } from './actions';
import { ActionHandler } from './types';
import { TargetingManager } from './targeting';

/**
 * Manages keyboard input mapping to semantic game actions.
 */
export class InputManager {
  private bindings: Map<string, GameAction>;
  private handler: ActionHandler | null = null;
  private targetingManager: TargetingManager | null = null;
  private enabled: boolean = false;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private isProcessing: boolean = false;
  private actionQueue: GameAction[] = [];
  private maxQueueSize: number = 3;
  private currentSeq: number = 0;

  constructor(bindings: Record<string, GameAction> = DEFAULT_BINDINGS) {
    this.bindings = new Map(Object.entries(bindings));
  }

  /**
   * Sets the targeting manager to intercept movement keys.
   */
  setTargetingManager(tm: TargetingManager): void {
    this.targetingManager = tm;
  }

  /**
   * Sets the callback for when an action is triggered.
   */
  setActionHandler(handler: ActionHandler): void {
    this.handler = handler;
  }

  /**
   * Sets whether an external request is currently pending.
   * When pending becomes false, any buffered actions are drained.
   */
  setRequestPending(pending: boolean): void {
    this.isProcessing = pending;
    if (!pending && this.actionQueue.length > 0 && this.enabled) {
      const nextAction = this.actionQueue.shift()!;
      this.processAction(nextAction);
    }
  }

  /**
   * Gets whether input processing is currently in flight.
   */
  getPendingStatus(): boolean {
    return this.isProcessing;
  }

  /**
   * Gets the current number of buffered actions in the queue.
   */
  getQueueLength(): number {
    return this.actionQueue.length;
  }

  /**
   * Gets the current monotonic action sequence counter.
   */
  getCurrentSeq(): number {
    return this.currentSeq;
  }

  /**
   * Clears all pending queued actions.
   */
  clearQueue(): void {
    this.actionQueue = [];
  }

  private isImmediateAction(action: GameAction): boolean {
    return (
      action === GameAction.TOGGLE_INVENTORY ||
      action === GameAction.PAUSE ||
      action === GameAction.DEBUG_PATHFIND_ANCHOR ||
      action === GameAction.DEBUG_TOGGLE_TIMELINE
    );
  }

  private enqueueOrExecute(action: GameAction): void {
    if (!this.handler) return;

    if (this.isImmediateAction(action)) {
      this.handler(action);
      return;
    }

    if (this.isProcessing) {
      if (this.actionQueue.length < this.maxQueueSize) {
        this.actionQueue.push(action);
      }
      return;
    }

    this.processAction(action);
  }

  private async processAction(action: GameAction): Promise<void> {
    if (!this.handler || !this.enabled) return;

    this.isProcessing = true;
    this.currentSeq++;

    try {
      await Promise.resolve(this.handler(action));
    } finally {
      this.isProcessing = false;
      if (this.actionQueue.length > 0 && this.enabled) {
        const nextAction = this.actionQueue.shift()!;
        this.processAction(nextAction);
      }
    }
  }

  /**
   * Enables input listening.
   */
  enable(): void {
    if (this.enabled) return;

    this.keydownHandler = (event: KeyboardEvent) => {
      // Ignore if event is repeating or if it's from an input element
      if (event.repeat) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;

      // Construct the lookup key including modifiers
      let lookupKey = event.code;
      if (event.shiftKey) lookupKey = `Shift+${lookupKey}`;
      if (event.ctrlKey) lookupKey = `Control+${lookupKey}`;
      if (event.altKey) lookupKey = `Alt+${lookupKey}`;
      if (event.metaKey) lookupKey = `Meta+${lookupKey}`;

      // Handle targeting mode interception
      if (this.targetingManager?.isActive()) {
        const action = this.bindings.get(event.code); // Target mode still uses raw codes for movement

        // Map movement keys to cursor movement
        if (action && isMovementAction(action)) {
          const dir = DIRECTIONS[action];
          if (dir) {
            event.preventDefault();
            this.targetingManager.moveCursor(dir.dx, dir.dy);
            return;
          }
        }

        // Confirm/Cancel targeting
        if (event.code === 'Enter' || event.code === 'Space') {
          event.preventDefault();
          this.targetingManager.confirm();
          return;
        }
        if (event.code === 'Escape') {
          event.preventDefault();
          this.targetingManager.cancel();
          return;
        }

        // Ignore other keys while targeting
        return;
      }

      const action = this.bindings.get(lookupKey) || this.bindings.get(event.code);
      if (action && this.handler) {
        // Prevent default browser behavior for mapped keys (e.g., arrow scrolling)
        event.preventDefault();
        this.enqueueOrExecute(action);
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
    this.clearQueue();
    this.isProcessing = false;
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
