import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { IssueReporterRoot } from '../IssueReporterRoot';
import { useReportStore } from '@client/reports/report-store';

describe('IssueReporterRoot', () => {
  beforeEach(() => {
    useReportStore.getState().resetForTesting();
    useReportStore.getState().closeManualReport();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mounts cleanly and opens manual report when F8 is pressed outside inputs', () => {
    render(<IssueReporterRoot />);

    expect(useReportStore.getState().isManualModalOpen).toBe(false);

    fireEvent.keyDown(window, { key: 'F8' });
    expect(useReportStore.getState().isManualModalOpen).toBe(true);
  });

  it('ignores F8 keypress when an input or textarea element is focused', () => {
    const { container } = render(
      <div>
        <IssueReporterRoot />
        <input data-testid="test-input" />
      </div>
    );

    const input = container.querySelector('input')!;
    input.focus();

    fireEvent.keyDown(input, { key: 'F8' });
    expect(useReportStore.getState().isManualModalOpen).toBe(false);
  });

  it('ignores F8 and openManualReport when reporting status.available is false (M-9)', () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ available: false, mode: 'off' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as unknown as typeof fetch;

    try {
      useReportStore.setState({ status: { available: false, mode: 'off' }, statusLoaded: true });
      render(<IssueReporterRoot />);

      fireEvent.keyDown(window, { key: 'F8' });
      expect(useReportStore.getState().isManualModalOpen).toBe(false);

      useReportStore.getState().openManualReport();
      expect(useReportStore.getState().isManualModalOpen).toBe(false);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
