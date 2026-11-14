/**
 * Zustand store for in-game issue and crash reporting.
 * Manages modal queues, fingerprint suppression, and session opt-out.
 */

import { create } from 'zustand';
import type {
  ReportsStatus,
  ReportResult,
  ManualReportRequest,
  CrashApproveRequest,
  CrashDraftOffer,
  PendingCrash,
} from '@/shared/reports/schemas';

export { type PendingCrash };

export const DONT_ASK_AGAIN_KEY = 'nr_reports_dont_ask_again';
export const PENDING_CRASH_STORAGE_KEY = 'nr_crash_pending_draft';

function persistPendingCrashes(activeCrash: PendingCrash | null, pendingQueue: PendingCrash[]): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const items = [...(activeCrash ? [activeCrash] : []), ...pendingQueue];
    if (items.length === 0) {
      window.sessionStorage.removeItem(PENDING_CRASH_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(PENDING_CRASH_STORAGE_KEY, JSON.stringify(items));
    }
  } catch {
    // ignore storage quota/security failures
  }
}

function clearPersistedPendingCrashes(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(PENDING_CRASH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

interface ReportStoreState {
  status: ReportsStatus;
  statusLoaded: boolean;
  preStatusQueue: PendingCrash[];
  activeCrash: PendingCrash | null;
  pendingQueue: PendingCrash[];
  isManualModalOpen: boolean;
  suppressedFingerprints: Set<string>;
  isSubmitting: boolean;
  submissionResult: ReportResult | null;
  submissionError: string | null;

  // Actions
  fetchStatus: () => Promise<void>;
  queueCrash: (crash: PendingCrash) => void;
  queueServerCrash: (offer: CrashDraftOffer, sessionId: string) => void;
  dismissActiveCrash: (dontAskAgain?: boolean) => void;
  submitActiveCrash: (note?: string) => Promise<ReportResult>;
  openManualReport: () => void;
  closeManualReport: () => void;
  submitManualReport: (req: ManualReportRequest) => Promise<ReportResult>;
  clearSubmissionState: () => void;
  resetForTesting: () => void;
}

export const useReportStore = create<ReportStoreState>((set, get) => ({
  status: { available: false, mode: 'off' },
  statusLoaded: false,
  preStatusQueue: [],
  activeCrash: null,
  pendingQueue: [],
  isManualModalOpen: false,
  suppressedFingerprints: new Set<string>(),
  isSubmitting: false,
  submissionResult: null,
  submissionError: null,

  fetchStatus: async () => {
    try {
      const res = await fetch('/api/reports/status');
      if (res.ok) {
        const status = (await res.json()) as ReportsStatus;
        const buffered = get().preStatusQueue;
        set({ status, statusLoaded: true, preStatusQueue: [] });
        if (status.available) {
          for (const crash of buffered) {
            get().queueCrash(crash);
          }
        } else {
          clearPersistedPendingCrashes();
        }
        return;
      }
    } catch {
      // Offline or network error
    }
    set({ statusLoaded: true, preStatusQueue: [] });
  },

  queueCrash: (crash: PendingCrash) => {
    const { status, statusLoaded, preStatusQueue, activeCrash, pendingQueue, suppressedFingerprints } = get();

    // 1. If player opted out for this session, suppress auto prompts
    if (typeof window !== 'undefined' && window.sessionStorage?.getItem(DONT_ASK_AGAIN_KEY) === 'true') {
      return;
    }

    // 2. Once per fingerprint per session (§5.2)
    if (suppressedFingerprints.has(crash.fingerprint)) {
      return;
    }

    // 3. Before initial status resolves, buffer early/boot crashes rather than dropping them (H-2)
    if (!statusLoaded) {
      if (preStatusQueue.some((q) => q.fingerprint === crash.fingerprint)) {
        return;
      }
      const nextPre = [...preStatusQueue];
      if (nextPre.length >= 4) {
        nextPre.shift();
      }
      nextPre.push(crash);
      set({ preStatusQueue: nextPre });
      persistPendingCrashes(nextPre[0] ?? null, nextPre.slice(1));
      return;
    }

    // 4. If feature is explicitly disabled, never prompt (§5.2)
    if (!status.available) return;

    // 5. One modal at a time; additional crashes queue (max 3, oldest dropped)
    if (activeCrash) {
      if (activeCrash.fingerprint === crash.fingerprint) {
        return;
      }
      if (pendingQueue.some((q) => q.fingerprint === crash.fingerprint)) {
        return;
      }
      const newQueue = [...pendingQueue];
      if (newQueue.length >= 3) {
        newQueue.shift();
      }
      newQueue.push(crash);
      set({ pendingQueue: newQueue });
      persistPendingCrashes(activeCrash, newQueue);
      return;
    }

    persistPendingCrashes(crash, pendingQueue);
    set({ activeCrash: crash, submissionResult: null, submissionError: null });
  },

  queueServerCrash: (offer: CrashDraftOffer, sessionId: string) => {
    get().queueCrash({
      origin: 'server',
      source: offer.source ?? 'SERVER_TURN',
      draftId: offer.draftId,
      sessionId,
      fingerprint: offer.fingerprint,
      preview: offer.preview,
    });
  },

  dismissActiveCrash: (dontAskAgain = false) => {
    const { activeCrash, pendingQueue, suppressedFingerprints, isSubmitting } = get();

    // Ignore dismissal while a crash submission is actively in flight (M-8)
    if (isSubmitting) return;

    if (activeCrash) {
      suppressedFingerprints.add(activeCrash.fingerprint);
    }

    if (dontAskAgain && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(DONT_ASK_AGAIN_KEY, 'true');
      } catch {
        // ignore
      }
    }

    let nextCrash: PendingCrash | null = null;
    let nextQueue = pendingQueue;

    if (pendingQueue.length > 0) {
      nextCrash = pendingQueue[0];
      nextQueue = pendingQueue.slice(1);
    }

    persistPendingCrashes(nextCrash, nextQueue);

    set({
      activeCrash: nextCrash,
      pendingQueue: nextQueue,
      submissionResult: null,
      submissionError: null,
    });
  },

  submitActiveCrash: async (note?: string): Promise<ReportResult> => {
    const { activeCrash, suppressedFingerprints } = get();
    if (!activeCrash) {
      throw new Error('No active crash to submit');
    }

    const submittedFingerprint = activeCrash.fingerprint;
    const submittedDraftId = activeCrash.origin === 'server' ? activeCrash.draftId : undefined;
    const matchesSubmitted = () => {
      const curr = get().activeCrash;
      if (!curr || curr.fingerprint !== submittedFingerprint) return false;
      if (curr.origin === 'server' && curr.draftId !== submittedDraftId) return false;
      return true;
    };

    set({ isSubmitting: true, submissionError: null });

    let payload: CrashApproveRequest;
    if (activeCrash.origin === 'server') {
      payload = {
        source: activeCrash.source,
        draftId: activeCrash.draftId,
        sessionId: activeCrash.sessionId,
        note,
      };
    } else {
      payload = {
        source: activeCrash.source,
        sessionId: activeCrash.sessionId,
        note,
        error: activeCrash.error,
        diagnostics: activeCrash.diagnostics,
        fingerprint: activeCrash.fingerprint,
      };
    }

    try {
      const res = await fetch('/api/reports/crash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errMsg = `Server returned ${res.status}`;
        try {
          const json = await res.json();
          if (json.error) errMsg = json.error;
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }

      const result = (await res.json()) as ReportResult;
      suppressedFingerprints.add(submittedFingerprint);

      persistPendingCrashes(null, get().pendingQueue);

      set(
        matchesSubmitted()
          ? { isSubmitting: false, submissionResult: result }
          : { isSubmitting: false }
      );

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set(
        matchesSubmitted()
          ? { isSubmitting: false, submissionError: msg }
          : { isSubmitting: false }
      );
      throw err;
    }
  },

  openManualReport: () => {
    if (!get().status.available) return;
    set({ isManualModalOpen: true, submissionResult: null, submissionError: null });
  },

  closeManualReport: () => {
    set({ isManualModalOpen: false, submissionResult: null, submissionError: null });
  },

  submitManualReport: async (req: ManualReportRequest): Promise<ReportResult> => {
    set({ isSubmitting: true, submissionError: null });

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (!res.ok) {
        let errMsg = `Server returned ${res.status}`;
        try {
          const json = await res.json();
          if (json.error) errMsg = json.error;
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }

      const result = (await res.json()) as ReportResult;
      set({ isSubmitting: false, submissionResult: result });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ isSubmitting: false, submissionError: msg });
      throw err;
    }
  },

  clearSubmissionState: () => {
    set({ isSubmitting: false, submissionResult: null, submissionError: null });
  },

  resetForTesting: () => {
    set({
      status: { available: true, mode: 'dry-run' },
      statusLoaded: true,
      preStatusQueue: [],
      activeCrash: null,
      pendingQueue: [],
      isManualModalOpen: false,
      suppressedFingerprints: new Set<string>(),
      isSubmitting: false,
      submissionResult: null,
      submissionError: null,
    });
  },
}));
