'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useReportStore } from '@/client/reports/report-store';
import { buildClientDiagnostics } from '@/client/reports/collectors';
import type { ReportKind } from '@/shared/reports/labels';
import { uiAudio } from '@/game/audio/ui-audio';
import { gameStore } from '@/game/ui/store';
import { TaikokuPlacard, BtnLever } from '../atomic';
import { DiagnosticsPreview } from './DiagnosticsPreview';
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

  useEffect(() => {
    if (!isManualModalOpen) return;
    uiAudio.playModalOpen();
    setTitle('');
    setDescription('');
    setValidationError(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeManualReport();
      }
      e.stopPropagation();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      uiAudio.playModalClose();
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isManualModalOpen, closeManualReport]);

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

    const diagnostics = includeDiagnostics ? buildClientDiagnostics() : undefined;
    const activeSessionId = gameStore?.getState()?.launchConfig?.sessionId;

    try {
      await submitManualReport({
        kind,
        title: title.trim(),
        description: description.trim(),
        includeDiagnostics,
        sessionId: activeSessionId,
        diagnostics,
      });
    } catch {
      // Handled in store
    }
  }, [kind, title, description, includeDiagnostics, submitManualReport]);

  if (!isManualModalOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-report-title"
      onClick={closeManualReport}
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <TaikokuPlacard
          kanji="問題報告"
          title="REPORT ISSUE // FIELD INTELLIGENCE & TELEMETRY"
          stampText="INTEL // MANUAL"
          stampVariant="cyan"
          onClose={closeManualReport}
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

                {includeDiagnostics && (
                  <DiagnosticsPreview diagnostics={buildClientDiagnostics()} />
                )}
              </div>

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
              <BtnLever onClick={closeManualReport} disabled={isSubmitting}>
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
