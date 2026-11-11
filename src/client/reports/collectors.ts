/**
 * Client error listeners, browser diagnostics collectors, and fatal crash recovery.
 * Captures window errors, unhandled rejections, and builds structured diagnostic snapshots.
 */

import { computeCrashFingerprint } from '@/shared/reports/fingerprint';
import type { ClientDiagnostics, CrashSource } from '@/shared/reports/schemas';
import { logRingBuffer, actionRingBuffer } from './ring-buffers';
import { useReportStore, PENDING_CRASH_STORAGE_KEY } from './report-store';
import { gameStore } from '@/game/ui/store';

/**
 * Filter rules (§5.1):
 * - Ignore `ResizeObserver loop...`
 * - Ignore `Script error.` with no stack
 * - Ignore stacks containing `chrome-extension://` or `moz-extension://`
 */
export function shouldIgnoreError(message: string, stack?: string): boolean {
  if (!message && !stack) return true;

  if (message.includes('ResizeObserver loop')) {
    return true;
  }

  if (message.includes('Script error.') && (!stack || stack.length === 0)) {
    return true;
  }

  if (stack && (stack.includes('chrome-extension://') || stack.includes('moz-extension://'))) {
    return true;
  }

  return false;
}

/**
 * Builds client-visible diagnostics according to Data Contracts (§4).
 */
export function buildClientDiagnostics(): ClientDiagnostics {
  const isBrowser = typeof window !== 'undefined';
  const gState = gameStore ? gameStore.getState() : null;

  const recentMessages: string[] = [];
  if (gState && Array.isArray(gState.messages)) {
    for (const m of gState.messages.slice(-10)) {
      if (typeof m === 'object' && m && 'text' in m) {
        recentMessages.push(String(m.text).slice(0, 500));
      } else if (typeof m === 'string') {
        recentMessages.push(String(m).slice(0, 500));
      }
    }
  }

  return {
    build: process.env.NEXT_PUBLIC_BUILD_SHA || 'dev',
    route: isBrowser ? window.location.pathname : '/',
    userAgent: isBrowser ? navigator.userAgent : 'Node/Server',
    viewport: {
      w: isBrowser ? window.innerWidth : 1920,
      h: isBrowser ? window.innerHeight : 1080,
    },
    gameStatus: gState?.gameStatus ? String(gState.gameStatus) : 'UNKNOWN',
    mode: gState?.launchConfig?.mode ? String(gState.launchConfig.mode) : undefined,
    floor: typeof gState?.currentFloor === 'number' ? gState.currentFloor : undefined,
    turn: typeof gState?.stats?.turns === 'number' ? gState.stats.turns : undefined,
    shellId: gState?.launchConfig?.shellId ? String(gState.launchConfig.shellId) : undefined,
    recentLogs: logRingBuffer.toArray(),
    recentActions: actionRingBuffer.toArray(),
    recentMessages,
  };
}

/**
 * Handles capturing an error and queueing it to reportStore.
 */
export function captureClientCrash(
  source: Exclude<CrashSource, 'SERVER_TURN' | 'SERVER_5XX'>,
  name: string,
  message: string,
  stack?: string,
  componentStack?: string
): void {
  if (shouldIgnoreError(message, stack)) {
    return;
  }

  const diagnostics = buildClientDiagnostics();
  const fingerprint = computeCrashFingerprint(source, name, message, stack);

  useReportStore.getState().queueCrash({
    origin: 'client',
    source,
    fingerprint,
    error: {
      name,
      message,
      stack,
      componentStack,
    },
    diagnostics,
  });
}

/**
 * Recovers any fatal pending crash that occurred right before an unexpected page exit/reload.
 */
export function checkPendingFatalCrash(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;

  try {
    const raw = window.sessionStorage.getItem(PENDING_CRASH_STORAGE_KEY);
    if (raw) {
      window.sessionStorage.removeItem(PENDING_CRASH_STORAGE_KEY);
      const parsed = JSON.parse(raw);
      if (parsed && parsed.fingerprint) {
        useReportStore.getState().queueCrash(parsed);
      }
    }
  } catch {
    // Ignore corrupted storage
  }
}

/**
 * Arms global window error and unhandledrejection listeners.
 * Returns an unregister function.
 */
export function initErrorCollectors(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  // Check for recovered draft from previous fatal crash
  checkPendingFatalCrash();

  const errorHandler = (event: ErrorEvent) => {
    const err = event.error;
    const name = err?.name || 'Error';
    const message = event.message || String(err || 'Unknown error');
    const stack = err?.stack || '';
    captureClientCrash('CLIENT_ERROR', name, message, stack);
  };

  const rejectionHandler = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const name = reason?.name || 'UnhandledRejection';
    const message = reason?.message || String(reason || 'Unhandled Promise Rejection');
    const stack = reason?.stack || '';
    captureClientCrash('CLIENT_REJECTION', name, message, stack);
  };

  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', rejectionHandler);

  return () => {
    window.removeEventListener('error', errorHandler);
    window.removeEventListener('unhandledrejection', rejectionHandler);
  };
}
