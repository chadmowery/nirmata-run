import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportIssueModal } from '../ReportIssueModal';
import { useReportStore } from '@/client/reports/report-store';

describe('ReportIssueModal', () => {
  beforeEach(() => {
    useReportStore.getState().resetForTesting();
    useReportStore.getState().closeManualReport();
  });

  it('renders nothing when isManualModalOpen is false', () => {
    const { container } = render(<ReportIssueModal />);
    expect(container.firstChild).toBeNull();
  });

  it('validates minimum title and description lengths', async () => {
    useReportStore.getState().openManualReport();
    render(<ReportIssueModal />);

    const submitBtn = screen.getByText(/SUBMIT REPORT/i);
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Title must be at least 5 characters/i)).toBeDefined();

    const titleInput = screen.getByPlaceholderText(/Weapon swap intent failed/i);
    fireEvent.change(titleInput, { target: { value: 'Valid Title Here' } });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Description must be at least 10 characters/i)).toBeDefined();
  });

  it('submits valid report with idempotencyKey and displays reference ID (M-10)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'created', ref: 'NR-MAN1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    useReportStore.getState().openManualReport();
    render(<ReportIssueModal />);

    const titleInput = screen.getByPlaceholderText(/Weapon swap intent failed/i);
    const descInput = screen.getByPlaceholderText(/Provide context, reproduction steps/i);

    fireEvent.change(titleInput, { target: { value: 'Stuck inside ventilation shaft' } });
    fireEvent.change(descInput, {
      target: { value: 'While moving south from sector 2, the collision check prevented movement.' },
    });

    const submitBtn = screen.getByText(/SUBMIT REPORT/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('NR-MAN1')).toBeDefined();
      expect(screen.getByText(/REPORT TRANSMITTED/i)).toBeDefined();
    });

    const sentBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as {
      idempotencyKey?: string;
    };
    expect(typeof sentBody.idempotencyKey).toBe('string');
    expect(sentBody.idempotencyKey!.length).toBeGreaterThan(8);

    vi.unstubAllGlobals();
  });

  it('closes when Cancel is clicked', () => {
    useReportStore.getState().openManualReport();
    render(<ReportIssueModal />);

    const cancelBtn = screen.getByText(/CANCEL/i);
    fireEvent.click(cancelBtn);

    expect(useReportStore.getState().isManualModalOpen).toBe(false);
  });
});
