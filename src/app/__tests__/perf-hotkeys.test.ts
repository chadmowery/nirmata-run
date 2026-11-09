import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePerfStore } from '@dev-tool/perf/perf-store';

describe('Performance Monitor Hotkey Handling (macOS & Standard)', () => {
  beforeEach(() => {
    usePerfStore.setState({ mode: 'OFF', lastActiveMode: 'STANDARD', ghostMode: false });
    vi.clearAllMocks();
  });

  const dispatchHotkey = (eventInit: Partial<KeyboardEvent> & { target?: HTMLElement }) => {
    const defaultInit = {
      bubbles: true,
      cancelable: true,
      ...eventInit,
    };

    const e = new KeyboardEvent('keydown', defaultInit);
    if (eventInit.target) {
      Object.defineProperty(e, 'target', { value: eventInit.target, writable: false });
    }

    // Mirror page.tsx handleHotkeys dispatch logic
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return e;
    }

    const isF3 = e.key === 'F3';
    const isAltP =
      e.altKey &&
      (e.code === 'KeyP' || e.key === 'p' || e.key === 'P' || e.key === 'π' || e.key === '∏');
    const isCtrlShiftP =
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      (e.code === 'KeyP' || e.key === 'p' || e.key === 'P');

    if (isF3 || isAltP || isCtrlShiftP) {
      e.preventDefault();
      if (e.shiftKey) {
        usePerfStore.getState().cycleMode();
      } else if (e.altKey && isF3) {
        usePerfStore.getState().toggleGhost();
      } else {
        usePerfStore.getState().toggleMode();
      }
    }
    return e;
  };

  it('handles F3 toggle and Shift+F3 cycle mode', () => {
    dispatchHotkey({ key: 'F3' });
    expect(usePerfStore.getState().mode).toBe('STANDARD');

    dispatchHotkey({ key: 'F3', shiftKey: true });
    expect(usePerfStore.getState().mode).toBe('EXPANDED');
  });

  it('handles Alt+F3 ghost mode toggle', () => {
    usePerfStore.setState({ mode: 'STANDARD', ghostMode: false });
    dispatchHotkey({ key: 'F3', altKey: true });
    expect(usePerfStore.getState().ghostMode).toBe(true);

    dispatchHotkey({ key: 'F3', altKey: true });
    expect(usePerfStore.getState().ghostMode).toBe(false);
  });

  it('handles macOS Option+P (key: "π", code: "KeyP") toggle', () => {
    usePerfStore.setState({ mode: 'OFF' });
    dispatchHotkey({ key: 'π', code: 'KeyP', altKey: true });
    expect(usePerfStore.getState().mode).toBe('STANDARD');

    dispatchHotkey({ key: 'π', code: 'KeyP', altKey: true });
    expect(usePerfStore.getState().mode).toBe('OFF');
  });

  it('handles macOS Shift+Option+P (key: "∏", code: "KeyP") cycle mode', () => {
    usePerfStore.setState({ mode: 'OFF' });
    dispatchHotkey({ key: '∏', code: 'KeyP', altKey: true, shiftKey: true });
    expect(usePerfStore.getState().mode).toBe('MINI');

    dispatchHotkey({ key: '∏', code: 'KeyP', altKey: true, shiftKey: true });
    expect(usePerfStore.getState().mode).toBe('STANDARD');
  });

  it('handles Ctrl+Shift+P cycle mode', () => {
    usePerfStore.setState({ mode: 'OFF' });
    dispatchHotkey({ key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true });
    expect(usePerfStore.getState().mode).toBe('MINI');
  });

  it('ignores hotkeys when typing in input or textarea', () => {
    usePerfStore.setState({ mode: 'OFF' });
    const inputEl = document.createElement('input');

    dispatchHotkey({ key: 'F3', target: inputEl });
    expect(usePerfStore.getState().mode).toBe('OFF');

    dispatchHotkey({ key: 'π', code: 'KeyP', altKey: true, target: inputEl });
    expect(usePerfStore.getState().mode).toBe('OFF');
  });
});
