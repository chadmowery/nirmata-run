// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputManager } from '../../src/game/input/input-manager';
import { GameAction } from '../../src/game/input/actions';

describe('InputManager Bounded Buffer & Sequence Queuing', () => {
  let inputManager: InputManager;

  beforeEach(() => {
    inputManager = new InputManager();
  });

  it('executes action immediately when no request is in-flight', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    inputManager.setActionHandler(handler);
    inputManager.enable();

    // Simulate keydown
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));

    expect(handler).toHaveBeenCalledWith(GameAction.MOVE_EAST);
    expect(inputManager.getCurrentSeq()).toBe(1);
    expect(inputManager.getQueueLength()).toBe(0);
  });

  it('buffers rapid keystrokes up to maxQueueSize (3) when action is in-flight', async () => {
    let resolveFirst: () => void = () => {};
    const firstPromise = new Promise<void>((res) => {
      resolveFirst = res;
    });

    const calls: GameAction[] = [];
    const handler = vi.fn().mockImplementation((action: GameAction) => {
      calls.push(action);
      if (calls.length === 1) {
        return firstPromise;
      }
      return Promise.resolve();
    });

    inputManager.setActionHandler(handler);
    inputManager.enable();

    // 1. First key initiates in-flight request
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    expect(inputManager.getPendingStatus()).toBe(true);
    expect(calls).toEqual([GameAction.MOVE_EAST]);

    // 2. Rapid follow-up keystrokes while first is pending
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' })); // queued #1
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));  // queued #2
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));  // queued #3
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));    // exceeds maxQueueSize (3), dropped!

    expect(inputManager.getQueueLength()).toBe(3);

    // 3. Resolve first action
    resolveFirst();
    await vi.waitFor(() => expect(inputManager.getQueueLength()).toBe(0));

    // 4. Verify FIFO execution of buffered keys and dropped excess
    expect(calls).toEqual([
      GameAction.MOVE_EAST,
      GameAction.MOVE_EAST,
      GameAction.MOVE_SOUTH,
      GameAction.MOVE_WEST,
    ]);
    expect(inputManager.getCurrentSeq()).toBe(4);
  });

  it('executes immediate actions (e.g. PAUSE, TOGGLE_INVENTORY) even when a request is in flight', () => {
    const handler = vi.fn().mockReturnValue(new Promise(() => {})); // Never resolves (in flight)
    inputManager.setActionHandler(handler);
    inputManager.enable();

    // In flight move
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    expect(inputManager.getPendingStatus()).toBe(true);

    // Immediate action (PAUSE / Escape)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));

    expect(handler).toHaveBeenCalledWith(GameAction.PAUSE);
  });

  it('clears queue when clearQueue or disable is called', () => {
    const handler = vi.fn().mockReturnValue(new Promise(() => {})); // In flight
    inputManager.setActionHandler(handler);
    inputManager.enable();

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));

    expect(inputManager.getQueueLength()).toBe(2);

    inputManager.disable();
    expect(inputManager.getQueueLength()).toBe(0);
    expect(inputManager.getPendingStatus()).toBe(false);
  });
});
