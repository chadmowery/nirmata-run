import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from './event-bus';

interface TestEvents {
  TEST_EVENT: { data: string };
  OTHER_EVENT: { value: number };
  RECURSIVE_EVENT: { count: number };
}

describe('EventBus', () => {
  let bus: EventBus<TestEvents>;

  beforeEach(() => {
    bus = new EventBus<TestEvents>();
  });

  it('should register and call a handler when flushed', () => {
    const handler = vi.fn();
    bus.on('TEST_EVENT', handler);
    bus.emit('TEST_EVENT', { data: 'hello' });
    
    expect(handler).not.toHaveBeenCalled();
    
    bus.flush();
    expect(handler).toHaveBeenCalledWith({ data: 'hello' });
  });

  it('should not call a handler after unsubscribe', () => {
    const handler = vi.fn();
    bus.on('TEST_EVENT', handler);
    bus.off('TEST_EVENT', handler);
    bus.emit('TEST_EVENT', { data: 'hello' });
    bus.flush();
    
    expect(handler).not.toHaveBeenCalled();
  });

  it('should support multiple handlers for the same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.on('TEST_EVENT', handler1);
    bus.on('TEST_EVENT', handler2);
    bus.emit('TEST_EVENT', { data: 'hello' });
    bus.flush();
    
    expect(handler1).toHaveBeenCalledWith({ data: 'hello' });
    expect(handler2).toHaveBeenCalledWith({ data: 'hello' });
  });

  it('should dispatch different event types independently', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.on('TEST_EVENT', handler1);
    bus.on('OTHER_EVENT', handler2);
    
    bus.emit('TEST_EVENT', { data: 'hello' });
    bus.flush();
    expect(handler1).toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();

    bus.emit('OTHER_EVENT', { value: 42 });
    bus.flush();
    expect(handler2).toHaveBeenCalledWith({ value: 42 });
  });

  it('should handle recursive flushes', () => {
    const sequence: number[] = [];
    
    bus.on('RECURSIVE_EVENT', ({ count }) => {
      sequence.push(count);
      if (count > 0) {
        bus.emit('RECURSIVE_EVENT', { count: count - 1 });
      }
    });

    bus.emit('RECURSIVE_EVENT', { count: 3 });
    bus.flush();

    expect(sequence).toEqual([3, 2, 1, 0]);
  });

  it('should throw when max flush depth is exceeded', () => {
    bus.on('TEST_EVENT', () => {
      bus.emit('TEST_EVENT', { data: 'loop' });
    });

    bus.emit('TEST_EVENT', { data: 'start' });
    expect(() => bus.flush()).toThrow('Max flush depth of 10 exceeded');
  });

  it('should clear all handlers and the queue', () => {
    const handler = vi.fn();
    bus.on('TEST_EVENT', handler);
    bus.emit('TEST_EVENT', { data: 'should not fire' });
    bus.clear();
    bus.flush();
    
    expect(handler).not.toHaveBeenCalled();
    
    bus.emit('TEST_EVENT', { data: 'still should not fire' });
    bus.flush();
    expect(handler).not.toHaveBeenCalled();
  });
});
