'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useReportStore } from '@/client/reports/report-store';
import { uiAudio } from '@/game/audio/ui-audio';
import { TaikokuPlacard, BtnLever } from '../atomic';
import { DiagnosticsPreview } from './DiagnosticsPreview';
import { useModalFocusTrap } from './useModalFocusTrap';
import styles from './ReportsModal.module.css';

export const ReportCrashModal: React.FC = () => {
  const activeCrash = useReportStore((s) => s.activeCrash);
  const isSubmitting = useReportStore((s) => s.isSubmitting);
  const submissionResult = useReportStore((s) => s.submissionResult);
  const submissionError = useReportStore((s) => s.submissionError);
  const dismissActiveCrash = useReportStore((s) => s.dismissActiveCrash);
  const submitActiveCrash = useReportStore((s) => s.submitActiveCrash);

  const [note, setNote] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalFocusTrap(Boolean(activeCrash), dialogRef);

  useEffect(() => {
    if (!activeCrash) return;
    uiAudio.playModalOpen();
    setNote('');

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Escape to dismiss unless a submission is currently in flight (M-8)
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!useReportStore.getState().isSubmitting) {
          dismissActiveCrash(false);
        }
      }
      // Stop event from propagating to game input manager
      e.stopPropagation();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      uiAudio.playModalClose();
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeCrash, dismissActiveCrash]);

  const handleSend = useCallback(async () => {
    try {
      await submitActiveCrash(note);
    } catch {
      // error handled in store
    }
  }, [note, submitActiveCrash]);

  if (!activeCrash) return null;

  const errorTitle = activeCrash.origin === 'server'
    ? `${activeCrash.preview.errorName}: ${activeCrash.preview.errorMessage}`
    : `${activeCrash.error.name}: ${activeCrash.error.message}`;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crash-report-title"
      onClick={() => {
        if (!isSubmitting) dismissActiveCrash(false);
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`${styles.modalContent} ${styles.dangerBorder}`}
        onClick={(e) => e.stopPropagation()}
      >
        <TaikokuPlacard
          kanji="障害報告"
          title="FAULT REPORT // TACTICAL SIMULATION EXCEPTION"
          titleId="crash-report-title"
          stampText="FAULT // LOGGED"
          stampVariant="danger"
          onClose={() => {
            if (!isSubmitting) dismissActiveCrash(false);
          }}
          closeLabel="✕ DISMISS [ESC]"
          style={{ marginBottom: 0, border: 'none', borderBottom: '2px solid var(--c-danger, #ff0055)' }}
        />

        <div className={styles.body}>
          {submissionResult ? (
            <div className={styles.resultPanel}>
              <div style={{ fontWeight: 800, fontSize: '13px' }}>
                {submissionResult.status === 'created' && 'REPORT TRANSMITTED // 作成完了'}
                {submissionResult.status === 'commented' && 'SIMILAR FAULT DETECTED // 追記事項追加'}
                {submissionResult.status === 'queued' && 'REPORT QUEUED // 送信待機中'}
                {submissionResult.status === 'dry-run' && 'DRY-RUN RECORDED // 記録完了'}
              </div>
              <div>
                Reference ID:{' '}
                <strong style={{ color: 'var(--c-accent, #d8ff00)' }}>
                  {submissionResult.ref}
                </strong>
              </div>
              <div style={{ fontSize: '11px', color: '#888' }}>
                {submissionResult.status === 'queued'
                  ? 'Your fault report has been saved to the local outbox and will retry automatically.'
                  : 'Diagnostic telemetry and report payload were successfully processed.'}
              </div>
            </div>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: '12px', color: '#ddd' }}>
                The simulation encountered an unhandled fault. A diagnostic ticket has been drafted.
                Review the telemetry below before approving transmission.
              </p>

              <div
                style={{
                  background: 'rgba(255, 0, 85, 0.08)',
                  border: '1px solid rgba(255, 0, 85, 0.3)',
                  padding: '10px',
                  color: 'var(--c-danger, #ff0055)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                {errorTitle}
              </div>

              <DiagnosticsPreview
                preview={activeCrash.origin === 'server' ? activeCrash.preview : undefined}
                error={activeCrash.origin === 'client' ? activeCrash.error : undefined}
                diagnostics={activeCrash.origin === 'client' ? activeCrash.diagnostics : undefined}
              />

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="crash-note-input">
                  <span>WHAT WERE YOU DOING? // 状況メモ (OPTIONAL)</span>
                  <span style={{ color: '#888' }}>{note.length}/1000</span>
                </label>
                <textarea
                  id="crash-note-input"
                  className={`${styles.input} ${styles.textarea}`}
                  placeholder="e.g. Activated teleport while moving onto an anchor..."
                  value={note}
                  maxLength={1000}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {submissionError && (
                <div className={styles.errorText} role="alert">
                  Error sending report: {submissionError}
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          {submissionResult ? (
            <BtnLever variant="primary" onClick={() => dismissActiveCrash(false)} rightSlot="[ESC]">
              CONTINUE [了解]
            </BtnLever>
          ) : (
            <>
              <BtnLever
                onClick={() => dismissActiveCrash(true)}
                disabled={isSubmitting}
              >
                DON&apos;T ASK AGAIN
              </BtnLever>
              <BtnLever
                onClick={() => dismissActiveCrash(false)}
                disabled={isSubmitting}
              >
                DON&apos;T SEND
              </BtnLever>
              <BtnLever
                variant="primary"
                onClick={handleSend}
                disabled={isSubmitting}
                rightSlot={isSubmitting ? '...' : undefined}
              >
                {isSubmitting ? 'TRANSMITTING...' : 'SEND REPORT [送信]'}
              </BtnLever>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
