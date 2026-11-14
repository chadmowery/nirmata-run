'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useReportStore } from '@client/reports/report-store';
import { buildClientDiagnostics } from '@client/reports/collectors';
import type { ReportKind } from '@shared/reports/labels';
import { uiAudio } from '@/game/audio/ui-audio';
import { gameStore } from '@/game/ui/store';
import { TaikokuPlacard, BtnLever } from '../atomic';
import { DiagnosticsPreview } from './DiagnosticsPreview';
import { useModalFocusTrap } from './useModalFocusTrap';
import styles from './ReportsModal.module.css';

const REPORT_KINDS: Array<{ kind: Exclude<ReportKind, 'CRASH'>; label: string }> = [
  { kind: 'BUG', label: 'BUG REPORT [バグ報告]' },
  { kind: 'FEATURE', label: 'FEATURE / TASK [機能要望]' },
  { kind: 'FEEDBACK', label: 'BALANCE FEEDBACK [調整意見]' },
  { kind: 'OTHER', label: 'OTHER [その他]' },
];

export const ReportIssueModal: React.FC = () => {
  const isManualModalOpen = useReportStore((s) => s.isManualModalOpen);
  const isSubmitting = useReportStore((s) => s.isSubmitting);
  const submissionResult = useReportStore((s) => s.submissionResult);
  const submissionError = useReportStore((s) => s.submissionError);
  const closeManualReport = useReportStore((s) => s.closeManualReport);
  const submitManualReport = useReportStore((s) => s.submitManualReport);

  const [kind, setKind] = useState<Exclude<ReportKind, 'CRASH'>>('BUG');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(isManualModalOpen, dialogRef);

  const isDirty = !submissionResult && (title.trim().length > 0 || description.trim().length > 0);

  const requestClose = useCallback(() => {
    if (useReportStore.getState().isSubmitting) return;
    if (isDirty) {
      setConfirmingDiscard((prev) => {
        if (prev) {
          closeManualReport();
          return false;
        }
        return true;
      });
      return;
    }
    setConfirmingDiscard(false);
    closeManualReport();
  }, [isDirty, closeManualReport]);

  useEffect(() => {
    if (!isManualModalOpen) return;
    uiAudio.playModalOpen();
    setTitle('');
    setDescription('');
    setValidationError(null);
    setConfirmingDiscard(false);
    setIdempotencyKey(
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `manual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    );
    return () => {
      uiAudio.playModalClose();
    };
  }, [isManualModalOpen]);

  useEffect(() => {
    if (!isManualModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        requestClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isManualModalOpen, requestClose]);

  const diagnosticsSnapshot = useMemo(
    () => (isManualModalOpen && includeDiagnostics ? buildClientDiagnostics() : undefined),
    [isManualModalOpen, includeDiagnostics]
  );

  const handleSubmit = useCallback(async () => {
    if (title.trim().length < 5) {
      setValidationError('Title must be at least 5 characters long.');
      return;
    }
    if (title.trim().length > 120) {
      setValidationError('Title must not exceed 120 characters.');
      return;
    }
    if (description.trim().length < 10) {
      setValidationError('Description must be at least 10 characters long.');
      return;
    }
    if (description.trim().length > 4000) {
      setValidationError('Description must not exceed 4,000 characters.');
      return;
    }

    setValidationError(null);

    const diagnostics = includeDiagnostics ? (diagnosticsSnapshot ?? buildClientDiagnostics()) : undefined;
    const activeSessionId = gameStore?.getState()?.launchConfig?.sessionId;

    try {
      await submitManualReport({
        kind,
        title: title.trim(),
        description: description.trim(),
        includeDiagnostics,
        sessionId: activeSessionId,
        idempotencyKey: idempotencyKey || undefined,
        diagnostics,
      });
    } catch {
      // Handled in store
    }
  }, [kind, title, description, includeDiagnostics, diagnosticsSnapshot, idempotencyKey, submitManualReport]);

  if (!isManualModalOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-report-title"
      onKeyDown={(e) => e.stopPropagation()}
      onClick={requestClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
      >
        <TaikokuPlacard
          kanji="問題報告"
          title="REPORT ISSUE // FIELD INTELLIGENCE & TELEMETRY"
          titleId="manual-report-title"
          stampText="INTEL // MANUAL"
          stampVariant="cyan"
          onClose={requestClose}
          closeLabel="✕ CLOSE [ESC]"
          style={{ marginBottom: 0, border: 'none', borderBottom: '2px solid var(--c-accent, #d8ff00)' }}
        />

        <div className={styles.body}>
          {submissionResult ? (
            <div className={styles.resultPanel}>
              <div style={{ fontWeight: 800, fontSize: '13px' }}>
                {submissionResult.status === 'created' && 'REPORT TRANSMITTED // 提出完了'}
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
                  ? 'Your report has been queued in the local outbox and will be delivered shortly.'
                  : 'Thank you for your report. It will be reviewed by the engineering protocol team.'}
              </div>
            </div>
          ) : (
            <>
              {/* Type selector */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>REPORT CATEGORY // 分類</label>
                <div className={styles.typeSelector}>
                  {REPORT_KINDS.map((k) => (
                    <button
                      key={k.kind}
                      type="button"
                      className={`${styles.typeButton} ${kind === k.kind ? styles.typeButtonActive : ''}`}
                      onClick={() => setKind(k.kind)}
                      disabled={isSubmitting}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title input */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="report-title-input">
                  <span>REPORT SUMMARY // 件名</span>
                  <span style={{ color: '#888' }}>{title.length}/120</span>
                </label>
                <input
                  id="report-title-input"
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Weapon swap intent failed during movement..."
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSubmitting}
                  aria-describedby={validationError ? 'report-error-msg' : undefined}
                />
              </div>

              {/* Description textarea */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="report-description-input">
                  <span>DETAILED DESCRIPTION // 詳細内容</span>
                  <span style={{ color: '#888' }}>{description.length}/4000</span>
                </label>
                <textarea
                  id="report-description-input"
                  className={`${styles.input} ${styles.textarea}`}
                  placeholder="Provide context, reproduction steps, or thoughts on balancing..."
                  value={description}
                  maxLength={4000}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  aria-describedby={validationError ? 'report-error-msg' : undefined}
                />
              </div>

              {/* Diagnostics opt-out */}
              <div className={styles.fieldGroup}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={includeDiagnostics}
                    onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                    disabled={isSubmitting}
                  />
                  <span>Attach diagnostic telemetry (build, route, recent actions)</span>
                </label>

                {includeDiagnostics && diagnosticsSnapshot && (
                  <DiagnosticsPreview diagnostics={diagnosticsSnapshot} />
                )}
              </div>

              {confirmingDiscard && (
                <div
                  role="alert"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '10px 12px',
                    border: '1px solid rgba(255, 193, 7, 0.5)',
                    background: 'rgba(255, 193, 7, 0.08)',
                    fontSize: '11px',
                    color: '#fcd34d',
                  }}
                >
                  <span>Unsaved report text detected. Discard this draft?</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => setConfirmingDiscard(false)}
                    >
                      KEEP EDITING
                    </button>
                    <button
                      type="button"
                      className="tool-btn"
                      style={{ color: 'var(--c-danger, #ff0055)', borderColor: 'var(--c-danger, #ff0055)' }}
                      onClick={closeManualReport}
                    >
                      DISCARD
                    </button>
                  </div>
                </div>
              )}

              {validationError && (
                <div id="report-error-msg" className={styles.errorText} role="alert">
                  {validationError}
                </div>
              )}

              {submissionError && (
                <div className={styles.errorText} role="alert">
                  Submission error: {submissionError}
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          {submissionResult ? (
            <BtnLever variant="primary" onClick={closeManualReport} rightSlot="[ESC]">
              DONE [完了]
            </BtnLever>
          ) : (
            <>
              <BtnLever onClick={requestClose} disabled={isSubmitting}>
                CANCEL [中止]
              </BtnLever>
              <BtnLever
                variant="primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
                rightSlot={isSubmitting ? '...' : undefined}
              >
                {isSubmitting ? 'TRANSMITTING...' : 'SUBMIT REPORT [提出]'}
              </BtnLever>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
