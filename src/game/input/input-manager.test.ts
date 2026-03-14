/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InputManager } from './input-manager';
import { GameAction } from './actions';

describe('InputManager', () => {
  let inputManager: InputManager;
  let mockHandler: any;

  beforeEach(() => {
    inputManager = new InputManager();
    mockHandler = vi.fn();
    inputManager.setActionHandler(mockHandler);
  });

  afterEach(() => {
    inputManager.disable();
    vi.clearAllMocks();
  });

  it('should dispatch correct GameAction via callback for mapped keys', () => {
    inputManager.enable();
    const event = new KeyboardEvent('keydown', { code: 'KeyW' });
    document.dispatchEvent(event);
    expect(mockHandler).toHaveBeenCalledWith(GameAction.MOVE_NORTH);
  });

  it('should ignore unmapped keys', () => {
    inputManager.enable();
    const event = new KeyboardEvent('keydown', { code: 'KeyX' });
    document.dispatchEvent(event);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should prevent default browser behavior for mapped keys', () => {
    inputManager.enable();
    const event = new KeyboardEvent('keydown', { code: 'ArrowDown', cancelable: true });
    vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should NOT prevent default for unmapped keys', () => {
    inputManager.enable();
    const event = new KeyboardEvent('keydown', { code: 'Slash', cancelable: true });
    vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('should support rebinding keys', () => {
    inputManager.enable();
    inputManager.rebind('KeyX', GameAction.WAIT);
    
    const event = new KeyboardEvent('keydown', { code: 'KeyX' });
    document.dispatchEvent(event);
    expect(mockHandler).toHaveBeenCalledWith(GameAction.WAIT);
  });

  it('should support unbinding keys', () => {
    inputManager.enable();
    inputManager.unbind('KeyW');
    
    const event = new KeyboardEvent('keydown', { code: 'KeyW' });
    document.dispatchEvent(event);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should return correct bindings for an action', () => {
    const bindings = inputManager.getBindingsForAction(GameAction.MOVE_NORTH);
    expect(bindings).toContain('ArrowUp');
    expect(bindings).toContain('KeyW');
  });

  it('should stop dispatching when disabled', () => {
    inputManager.enable();
    inputManager.disable();
    
    const event = new KeyboardEvent('keydown', { code: 'KeyW' });
    document.dispatchEvent(event);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should resume dispatching when re-enabled', () => {
    inputManager.enable();
    inputManager.disable();
    inputManager.enable();
    
    const event = new KeyboardEvent('keydown', { code: 'KeyW' });
    document.dispatchEvent(event);
    expect(mockHandler).toHaveBeenCalledWith(GameAction.MOVE_NORTH);
  });

  it('should avoid duplicate listeners on multiple enable() calls', () => {
    inputManager.enable();
    inputManager.enable();
    
    const event = new KeyboardEvent('keydown', { code: 'KeyW' });
    document.dispatchEvent(event);
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('should ignore repeating keys', () => {
    inputManager.enable();
    const event = new KeyboardEvent('keydown', { code: 'KeyW', repeat: true });
    document.dispatchEvent(event);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should ignore input when focused on input fields', () => {
    inputManager.enable();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true });
    input.dispatchEvent(event);
    
    expect(mockHandler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
