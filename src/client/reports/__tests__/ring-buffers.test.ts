import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RingBuffer, logRingBuffer, actionRingBuffer, initLoggerSink } from '../ring-buffers';
import { logger } from '@engine/utils/logger';

describe('Diagnostics Ring Buffers', () => {
  beforeEach(() => {
    logRingBuffer.clear();
    actionRingBuffer.clear();
  });

  it('bounds capacity and drops oldest items', () => {
    const buffer = new RingBuffer<number>(3);
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    expect(buffer.toArray()).toEqual([1, 2, 3]);

    buffer.push(4);
    expect(buffer.toArray()).toEqual([2, 3, 4]);
  });

  it('captures logs via logger sink hook, skips DEBUG entries, and cleans up on unregister (L-7)', () => {
    const unsubscribe = initLoggerSink();

    logger.debug('High frequency debug noise', 'TEST');
    logger.info('Test diagnostic message 1', 'TEST');
    logger.warn('Test diagnostic message 2', 'TEST');

    const logs = logRingBuffer.toArray();
    expect(logs.length).toBe(2);
    expect(logs[0].msg).toBe('Test diagnostic message 1');
    expect(logs[0].level).toBe('INFO');
    expect(logs[1].msg).toBe('Test diagnostic message 2');
    expect(logs[1].level).toBe('WARN');

    unsubscribe();

    logger.error('After unsubscribe', 'TEST');
    expect(logRingBuffer.toArray().length).toBe(2);
  });
});
