import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  shouldIgnoreError,
  buildClientDiagnostics,
  initErrorCollectors,
} from '../collectors';
import { useReportStore } from '../report-store';

describe('Client Error Collectors', () => {
  beforeEach(() => {
    useReportStore.getState().resetForTesting();
  });

  describe('shouldIgnoreError', () => {
    it('ignores ResizeObserver loop error', () => {
      expect(shouldIgnoreError('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
      expect(shouldIgnoreError('ResizeObserver loop limit exceeded')).toBe(true);
    });

    it('ignores Script error without stack trace', () => {
      expect(shouldIgnoreError('Script error.', '')).toBe(true);
      expect(shouldIgnoreError('Script error.', undefined)).toBe(true);
      // If a stack is present, it is not ignored
      expect(shouldIgnoreError('Script error.', 'at foo (app.js:1:1)')).toBe(false);
    });

    it('ignores browser extension stack frames', () => {
      expect(
        shouldIgnoreError('Content script crashed', 'at chrome-extension://abcdef/content.js:10:5')
      ).toBe(true);
      expect(
        shouldIgnoreError('Content script crashed', 'at moz-extension://abcdef/content.js:10:5')
      ).toBe(true);
    });

    it('allows genuine application errors', () => {
      expect(
        shouldIgnoreError(
          'Cannot read properties of null',
          'at CombatSystem.execute (CombatSystem.ts:40:12)'
        )
      ).toBe(false);
    });
  });

  describe('buildClientDiagnostics', () => {
    it('collects route, user agent, build and viewport information', () => {
      const diag = buildClientDiagnostics();
      expect(diag.build).toBeDefined();
      expect(diag.viewport).toBeDefined();
      expect(diag.recentLogs).toBeDefined();
      expect(diag.recentActions).toBeDefined();
    });
  });

  describe('initErrorCollectors', () => {
    it('attaches and cleanly removes window event listeners', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const cleanup = initErrorCollectors();
      expect(addSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

      cleanup();
      expect(removeSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });
  });
});
