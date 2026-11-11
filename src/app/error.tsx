'use client';

import React, { useEffect } from 'react';
import { captureClientCrash } from '@/client/reports/collectors';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientCrash(
      'REACT_RENDER',
      error.name || 'ReactRenderError',
      error.message || 'React render exception caught by segment error boundary',
      error.stack
    );
  }, [error]);

  return (
    <div
      role="alert"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 text-cyan-400 font-mono"
    >
      <div className="max-w-md w-full border border-cyan-500/40 bg-zinc-950 p-6 shadow-2xl shadow-cyan-950/50">
        <div className="flex items-center space-x-2 border-b border-cyan-500/20 pb-3 mb-4">
          <span className="text-red-500 font-bold">⚠️ CRITICAL FAULT</span>
          <span className="text-xs text-zinc-500">// SEGMENT FAULT ISOLATION</span>
        </div>
        <p className="text-sm text-zinc-300 mb-4">
          A rendering fault occurred in the tactical interface. The error diagnostics have been captured.
        </p>
        <div className="bg-black/60 border border-zinc-800 p-3 mb-5 text-xs text-red-400 break-words font-mono max-h-32 overflow-y-auto">
          {error.message || 'Unknown render error'}
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => reset()}
            className="flex-1 py-2 px-4 bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-500 text-cyan-200 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            RETRY COMPONENT
          </button>
          <button
            onClick={() => window.location.reload()}
            className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-300 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            REBOOT SYSTEM
          </button>
        </div>
      </div>
    </div>
  );
}
