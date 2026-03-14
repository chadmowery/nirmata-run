import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '@engine/events/event-bus';
import { GameEvents } from './types';

describe('GameEvents Integration', () => {
  it('should work with engine EventBus and be type-safe', () => {
    // Creating an EventBus typed with GameEvents
    const bus = new EventBus<GameEvents>();
    const handler = vi.fn();

    // Subscribing to a game event
    bus.on('DAMAGE_DEALT', handler);

    // Emitting a game event
    const payload = {
      attackerId: 1,
      defenderId: 2,
      amount: 10,
    };
    bus.emit('DAMAGE_DEALT', payload);

    // Initial state (queued, not processed)
    expect(handler).not.toHaveBeenCalled();

    // Processing the queue
    bus.flush();

    // Verifying handler received correct payload
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('should handle ENTITY_DIED events', () => {
    const bus = new EventBus<GameEvents>();
    const handler = vi.fn();

    bus.on('ENTITY_DIED', handler);

    const payload = {
      entityId: 2,
      killerId: 1,
    };
    bus.emit('ENTITY_DIED', payload);
    bus.flush();

    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('should handle ITEM_PICKED_UP events', () => {
    const bus = new EventBus<GameEvents>();
    const handler = vi.fn();

    bus.on('ITEM_PICKED_UP', handler);

    const payload = {
      entityId: 1,
      itemId: 100,
    };
    bus.emit('ITEM_PICKED_UP', payload);
    bus.flush();

    expect(handler).toHaveBeenCalledWith(payload);
  });
});
