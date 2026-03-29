import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '@engine/events/event-bus';
import { GameEvents } from '@game/events/types';
import { createTargetingManager } from './targeting';

describe('Targeting Manager', () => {
  let eventBus: EventBus<GameEvents>;
  let onConfirm: ReturnType<typeof vi.fn>;
  let targetingManager: ReturnType<typeof createTargetingManager>;

  beforeEach(() => {
    eventBus = new EventBus<GameEvents>();
    onConfirm = vi.fn();
    targetingManager = createTargetingManager(eventBus, onConfirm);
  });

  it('startTargeting sets cursor to player position and active=true', () => {
    targetingManager.startTargeting(0, 10, 10, 5, 'dash');
    
    const state = targetingManager.getState();
    expect(state.active).toBe(true);
    expect(state.cursorX).toBe(10);
    expect(state.cursorY).toBe(10);
    expect(state.firmwareSlotIndex).toBe(0);
    expect(state.range).toBe(5);
  });

  it('moveCursor updates cursor coordinates', () => {
    targetingManager.startTargeting(0, 10, 10, 5, 'dash');
    targetingManager.moveCursor(1, -1);
    
    const state = targetingManager.getState();
    expect(state.cursorX).toBe(11);
    expect(state.cursorY).toBe(9);
  });

  it('moveCursor respects range for ranged abilities (Manhattan)', () => {
    targetingManager.startTargeting(0, 10, 10, 2, 'ranged_attack');
    
    // Move to (12, 10) - distance 2 (OK)
    targetingManager.moveCursor(1, 0);
    targetingManager.moveCursor(1, 0);
    expect(targetingManager.getState().cursorX).toBe(12);
    
    // Try to move to (13, 10) - distance 3 (Too far)
    targetingManager.moveCursor(1, 0);
    expect(targetingManager.getState().cursorX).toBe(12);
  });

  it('confirm calls onConfirm callback and sets active=false', () => {
    targetingManager.startTargeting(1, 10, 10, 5, 'ranged_attack');
    targetingManager.moveCursor(2, 2);
    targetingManager.confirm();
    
    expect(onConfirm).toHaveBeenCalledWith(1, 12, 12);
    expect(targetingManager.isActive()).toBe(false);
  });

  it('cancel sets active to false', () => {
    targetingManager.startTargeting(0, 10, 10, 5, 'dash');
    targetingManager.cancel();
    
    expect(targetingManager.isActive()).toBe(false);
  });

  it('emits TARGETING_STARTED on start', () => {
    const spy = vi.fn();
    eventBus.on('TARGETING_STARTED', spy);
    
    targetingManager.startTargeting(2, 5, 5, 3, 'toggle_vision');
    eventBus.flush();
    
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ 
      firmwareSlotIndex: 2, 
      range: 3, 
      effectType: 'toggle_vision' 
    }));
  });
});
