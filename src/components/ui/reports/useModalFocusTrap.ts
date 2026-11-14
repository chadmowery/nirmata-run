'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getAttribute('aria-hidden') !== 'true' && !el.hasAttribute('disabled')
  );
}

/**
 * Traps Tab/Shift+Tab keyboard focus within `containerRef` while `isOpen` is true,
 * moves initial focus into the dialog, and restores focus to the prior trigger on close.
 */
export function useModalFocusTrap(
  isOpen: boolean,
  containerRef: RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    if (!isOpen) return;

    const previousFocus =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const container = containerRef.current;
    if (container) {
      const focusables = getFocusableElements(container);
      const initialTarget = focusables[0] ?? container;
      initialTarget.focus();
    }

    const handleTabKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const el = containerRef.current;
      if (!el) return;

      const focusables = getFocusableElements(el);
      if (focusables.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !el.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !el.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleTabKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleTabKeyDown, true);
      if (previousFocus && typeof document !== 'undefined' && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [isOpen, containerRef]);
}
