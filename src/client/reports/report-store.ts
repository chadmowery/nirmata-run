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
  RedactedCrashPreview,
  ClientDiagnostics,
  CrashSource,
} from '@/shared/reports/schemas';

export const DONT_ASK_AGAIN_KEY = 'nr_reports_dont_ask_again';
export const PENDING_CRASH_STORAGE_KEY = 'nr_crash_pending_draft';

export type PendingCrash =
  | {
      origin: 'server';
      source: 'SERVER_TURN' | 'SERVER_5XX';
      draftId: string;
      sessionId: string;
      fingerprint: string;
      preview: RedactedCrashPreview;
    }
  | {
      origin: 'client';
      source: Exclude<CrashSource, 'SERVER_TURN' | 'SERVER_5XX'>;
      fingerprint: string;
      error: {
        name: string;
        message: string;
        stack?: string;
        componentStack?: string;
      };
      diagnostics: ClientDiagnostics;
      sessionId?: string;
    };

interface ReportStoreState {
  status: ReportsStatus;
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
        set({ status });
      }
    } catch {
      // Offline or network error
    }
  },

  queueCrash: (crash: PendingCrash) => {
    const { status, activeCrash, pendingQueue, suppressedFingerprints } = get();

    // 1. If feature is disabled, never prompt (§5.2)
    if (!status.available) return;

    // 2. If player opted out for this session, suppress auto prompts
    if (typeof window !== 'undefined' && window.sessionStorage?.getItem(DONT_ASK_AGAIN_KEY) === 'true') {
      return;
    }

    // 3. Once per fingerprint per session (§5.2)
    if (suppressedFingerprints.has(crash.fingerprint)) {
      return;
    }

    // 4. One modal at a time; additional crashes queue (max 3, oldest dropped)
    if (activeCrash) {
      if (pendingQueue.some((q) => q.fingerprint === crash.fingerprint)) {
        return;
      }
      const newQueue = [...pendingQueue];
      if (newQueue.length >= 3) {
        newQueue.shift();
      }
      newQueue.push(crash);
      set({ pendingQueue: newQueue });
      return;
    }

    // Store in sessionStorage in case of fatal page exit
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(PENDING_CRASH_STORAGE_KEY, JSON.stringify(crash));
      } catch {
        // ignore
      }
    }

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
    const { activeCrash, pendingQueue, suppressedFingerprints } = get();

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

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(PENDING_CRASH_STORAGE_KEY);
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
      suppressedFingerprints.add(activeCrash.fingerprint);

      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          window.sessionStorage.removeItem(PENDING_CRASH_STORAGE_KEY);
        } catch {
          // ignore
        }
      }

      set({
        isSubmitting: false,
        submissionResult: result,
      });

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ isSubmitting: false, submissionError: msg });
      throw err;
    }
  },

  openManualReport: () => {
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
