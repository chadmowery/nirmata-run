'use client';

import { useEffect } from 'react';
import { useHotloadToastStore } from './toast-store';

/**
 * Non-blocking top-right telemetry pill displayed in development mode
 * when hotload commits or LIVE_SYNC previews are active.
 */
export function HotloadToastOverlay() {
  const activeToast = useHotloadToastStore((s) => s.activeToast);
  const liveSyncActive = useHotloadToastStore((s) => s.liveSyncActive);
  const clearToast = useHotloadToastStore((s) => s.clearToast);

  useEffect(() => {
    if (!activeToast) return;
    const timer = window.setTimeout(() => {
      clearToast();
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [activeToast, clearToast]);

  if (!activeToast && !liveSyncActive) {
    return null;
  }

  return (
    <div
      data-testid="hotload-toast-overlay"
      style={{
        position: 'fixed',
        top: '12px',
        right: '14px',
        zIndex: 9500,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '6px',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '11px',
        letterSpacing: '0.06em',
      }}
    >
      {liveSyncActive && (
        <div
          style={{
            padding: '4px 10px',
            background: 'rgba(11, 17, 30, 0.86)',
            border: '1px solid rgba(0, 240, 255, 0.55)',
            color: '#00f0ff',
            borderRadius: '2px',
            boxShadow: '0 0 12px rgba(0, 240, 255, 0.2)',
          }}
        >
          ● LIVE SYNC ACTIVE
        </div>
      )}
      {activeToast && (
        <div
          style={{
            padding: '4px 10px',
            background: 'rgba(11, 17, 30, 0.88)',
            border:
              activeToast.mode === 'REVERT'
                ? '1px solid rgba(255, 102, 0, 0.65)'
                : '1px solid rgba(0, 240, 255, 0.5)',
            color: activeToast.mode === 'REVERT' ? '#ff9944' : '#f4f4f0',
            borderRadius: '2px',
          }}
        >
          <span style={{ color: '#00f0ff' }}>[HOTLOAD]</span>{' '}
          <span>
            {activeToast.domain} // {activeToast.targetId}
          </span>{' '}
          <span style={{ color: '#79889e' }}>({Math.max(1, activeToast.latencyMs)}ms)</span>
        </div>
      )}
    </div>
  );
}
