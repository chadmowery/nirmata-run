'use client';

import React, { useEffect } from 'react';
import { useReportStore } from '@client/reports/report-store';
import { initLoggerSink } from '@client/reports/ring-buffers';
import { initErrorCollectors } from '@client/reports/collectors';
import { gameStore } from '@/game/ui/store';
import { ReportCrashModal } from './ReportCrashModal';
import { ReportIssueModal } from './ReportIssueModal';

export const IssueReporterRoot: React.FC = () => {
  const fetchStatus = useReportStore((s) => s.fetchStatus);
  const openManualReport = useReportStore((s) => s.openManualReport);

  useEffect(() => {
    // 1. Fetch server feature status
    void fetchStatus();

    // 2. Initialize logger buffer and window error collectors
    const cleanupLogger = initLoggerSink(() => [gameStore?.getState()?.launchConfig?.sessionId]);
    const cleanupErrors = initErrorCollectors();

    // 3. Global hotkey handler for F8
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'F8') {
        if (!useReportStore.getState().status.available) {
          return;
        }
        e.preventDefault();
        openManualReport();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cleanupLogger();
      cleanupErrors();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fetchStatus, openManualReport]);

  return (
    <>
      <ReportCrashModal />
      <ReportIssueModal />
    </>
  );
};

export default IssueReporterRoot;
