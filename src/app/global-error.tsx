'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { computeCrashFingerprint } from '@shared/reports/fingerprint';
import type { ClientDiagnostics, ReportResult, ReportsStatus } from '@shared/reports/schemas';
import { buildClientDiagnostics } from '@client/reports/collectors';

function buildFallbackDiagnostics(): ClientDiagnostics {
  const isBrowser = typeof window !== 'undefined';
  return {
    build: process.env.NEXT_PUBLIC_BUILD_SHA || 'dev',
    route: isBrowser ? window.location.pathname : '/',
    userAgent: isBrowser ? navigator.userAgent : 'Node/Server',
    viewport: {
      w: isBrowser ? window.innerWidth : 1920,
      h: isBrowser ? window.innerHeight : 1080,
    },
    gameStatus: 'FATAL_ERROR',
    recentLogs: [],
    recentActions: [],
    recentMessages: [],
  };
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reportsAvailable, setReportsAvailable] = useState(false);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<ReportResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errorName = error.name || 'FatalRenderError';
  const errorMessage = error.message || 'Fatal render error caught by root global-error boundary';
  const errorStack = error.stack;

  const { diagnostics, fingerprint } = useMemo(() => {
    let diag: ClientDiagnostics;
    try {
      diag = buildClientDiagnostics();
    } catch {
      diag = buildFallbackDiagnostics();
    }
    const fp = computeCrashFingerprint('REACT_RENDER', errorName, errorMessage, errorStack);
    return { diagnostics: diag, fingerprint: fp };
  }, [errorName, errorMessage, errorStack]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reports/status')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as ReportsStatus;
        if (!cancelled && data.available) {
          setReportsAvailable(true);
        }
      })
      .catch(() => {
        // Ignore network errors checking availability on fatal boot shell
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSendReport = async () => {
    if (isSubmitting || submitResult) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/reports/crash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'REACT_RENDER',
          error: {
            name: errorName.slice(0, 200),
            message: errorMessage.slice(0, 2000),
            stack: errorStack?.slice(0, 16384),
          },
          diagnostics,
          fingerprint,
          note: note.trim().slice(0, 1000) || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      } else {
        setSubmitResult(data as ReportResult);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Network error submitting crash report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          backgroundColor: '#050608',
          color: '#d4f5ff',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box',
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: '560px',
            width: '100%',
            backgroundColor: '#0c1016',
            border: '1px solid rgba(255, 77, 79, 0.55)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75)',
            padding: '24px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderBottom: '1px solid rgba(255, 77, 79, 0.3)',
              paddingBottom: '12px',
              marginBottom: '16px',
            }}
          >
            <span style={{ color: '#ff4d4f', fontWeight: 700, fontSize: '15px' }}>
              SYSTEM KERNEL FAULT
            </span>
            <span style={{ color: '#6b7280', fontSize: '12px' }}>// ROOT ISOLATION</span>
          </div>

          <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
            The application encountered a fatal initialization or root layout error.
          </p>

          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              border: '1px solid #1f2937',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#f87171',
              wordBreak: 'break-word',
              maxHeight: '140px',
              overflowY: 'auto',
            }}
          >
            <strong>{errorName}:</strong> {errorMessage}
          </div>

          {reportsAvailable && (
            <div
              style={{
                borderTop: '1px solid #1f2937',
                paddingTop: '14px',
                marginBottom: '16px',
              }}
            >
              {submitResult ? (
                <div
                  style={{
                    backgroundColor: 'rgba(0, 229, 255, 0.08)',
                    border: '1px solid rgba(0, 229, 255, 0.4)',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: '#67e8f9',
                  }}
                >
                  Crash report transmitted — Reference: <strong>{submitResult.ref}</strong> (
                  {submitResult.status})
                </div>
              ) : (
                <>
                  <label
                    htmlFor="global-error-note"
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: '6px',
                    }}
                  >
                    Optional Crash Note (what happened before the fault)
                  </label>
                  <textarea
                    id="global-error-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    disabled={isSubmitting}
                    placeholder="Steps or context (optional)..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      backgroundColor: '#05070a',
                      border: '1px solid #334155',
                      color: '#e2e8f0',
                      fontFamily: 'inherit',
                      fontSize: '12px',
                      padding: '8px',
                      marginBottom: '10px',
                      resize: 'vertical',
                    }}
                  />
                  {submitError && (
                    <div
                      style={{
                        marginBottom: '10px',
                        fontSize: '12px',
                        color: '#fca5a5',
                      }}
                    >
                      Failed to send report: {submitError}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSendReport()}
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      padding: '9px 14px',
                      backgroundColor: 'rgba(255, 77, 79, 0.2)',
                      border: '1px solid #ff4d4f',
                      color: '#fecaca',
                      fontFamily: 'inherit',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      cursor: isSubmitting ? 'wait' : 'pointer',
                    }}
                  >
                    {isSubmitting ? 'SENDING CRASH REPORT...' : 'SEND CRASH REPORT'}
                  </button>
                </>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                flex: 1,
                padding: '9px 14px',
                backgroundColor: 'rgba(0, 229, 255, 0.14)',
                border: '1px solid #00e5ff',
                color: '#a5f3fc',
                fontFamily: 'inherit',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              TRY RECOVER
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '9px 14px',
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                color: '#e2e8f0',
                fontFamily: 'inherit',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              RELOAD
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
