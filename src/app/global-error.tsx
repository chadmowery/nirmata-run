'use client';

import React, { useEffect } from 'react';
import { captureClientCrash } from '@/client/reports/collectors';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientCrash(
      'REACT_RENDER',
      error.name || 'FatalRenderError',
      error.message || 'Fatal render error caught by root global-error boundary',
      error.stack
    );
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-black text-cyan-400 font-mono min-h-screen flex items-center justify-center p-4">
        <div
          role="alert"
          className="max-w-lg w-full border border-red-500/50 bg-zinc-950 p-6 shadow-2xl shadow-red-950/50"
        >
          <div className="flex items-center space-x-2 border-b border-red-500/30 pb-3 mb-4">
            <span className="text-red-500 font-bold">🛑 SYSTEM KERNEL FAULT</span>
            <span className="text-xs text-zinc-500">// ROOT ISOLATION</span>
          </div>
          <p className="text-sm text-zinc-300 mb-4">
            The application encountered a fatal initialization or root layout error.
          </p>
          <div className="bg-black/70 border border-zinc-800 p-3 mb-5 text-xs text-red-400 font-mono break-words max-h-40 overflow-y-auto">
            {error.message || 'Unknown root error'}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => reset()}
              className="flex-1 py-2 px-4 bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-500 text-cyan-200 text-xs font-bold uppercase tracking-wider transition-colors"
            >
              RECOVER STATE
            </button>
            <button
              onClick={() => window.location.reload()}
              className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-300 text-xs font-bold uppercase tracking-wider transition-colors"
            >
              FULL RELOAD
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
