import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportCrashModal } from '../ReportCrashModal';
import { useReportStore, DONT_ASK_AGAIN_KEY } from '@client/reports/report-store';

describe('ReportCrashModal', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    useReportStore.getState().resetForTesting();
  });

  it('renders nothing when activeCrash is null', () => {
    const { container } = render(<ReportCrashModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders crash details and sealed manifest for server crash', () => {
    useReportStore.getState().queueCrash({
      origin: 'server',
      source: 'SERVER_TURN',
      draftId: 'draft-1234',
      sessionId: 'sess-abc',
      fingerprint: '1234567890abcdef',
      preview: {
        errorName: 'TypeError',
        errorMessage: 'Invalid entity reference',
        actionType: 'MOVE',
        floor: 2,
        turn: 14,
        sealedManifest: [
          { label: 'Player Component State', approxBytes: 150 },
          { label: 'Living Entities State', approxBytes: 400 },
        ],
      },
    });

    render(<ReportCrashModal />);

    expect(screen.getByText(/FAULT REPORT/i)).toBeDefined();
    expect(screen.getByText(/TypeError: Invalid entity reference/i)).toBeDefined();
    expect(screen.getByText(/Player Component State/i)).toBeDefined();
    expect(screen.getByText(/Living Entities State/i)).toBeDefined();
  });

  it('dismisses modal when "Don\'t send" is clicked', () => {
    useReportStore.getState().queueCrash({
      origin: 'server',
      source: 'SERVER_TURN',
      draftId: 'draft-1234',
      sessionId: 'sess-abc',
      fingerprint: '1234567890abcdef',
      preview: {
        errorName: 'Error',
        errorMessage: 'fail',
        actionType: 'MOVE',
        floor: 1,
        turn: 1,
        sealedManifest: [],
      },
    });

    render(<ReportCrashModal />);
    const dontSendBtn = screen.getByText(/DON'T SEND/i);
    fireEvent.click(dontSendBtn);

    expect(useReportStore.getState().activeCrash).toBeNull();
  });

  it('sets sessionStorage flag when "Don\'t ask again" is clicked', () => {
    useReportStore.getState().queueCrash({
      origin: 'server',
      source: 'SERVER_TURN',
      draftId: 'draft-1234',
      sessionId: 'sess-abc',
      fingerprint: '1234567890abcdef',
      preview: {
        errorName: 'Error',
        errorMessage: 'fail',
        actionType: 'MOVE',
        floor: 1,
        turn: 1,
        sealedManifest: [],
      },
    });

    render(<ReportCrashModal />);
    const dontAskBtn = screen.getByText(/DON'T ASK AGAIN/i);
    fireEvent.click(dontAskBtn);

    expect(window.sessionStorage.getItem(DONT_ASK_AGAIN_KEY)).toBe('true');
    expect(useReportStore.getState().activeCrash).toBeNull();
  });

  it('submits report and displays reference ID on send', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'created', ref: 'NR-7K3Q' }),
    }));

    useReportStore.getState().queueCrash({
      origin: 'server',
      source: 'SERVER_TURN',
      draftId: 'draft-1234',
      sessionId: 'sess-abc',
      fingerprint: '1234567890abcdef',
      preview: {
        errorName: 'Error',
        errorMessage: 'fail',
        actionType: 'MOVE',
        floor: 1,
        turn: 1,
        sealedManifest: [],
      },
    });

    render(<ReportCrashModal />);
    const sendBtn = screen.getByText(/SEND REPORT/i);
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText('NR-7K3Q')).toBeDefined();
      expect(screen.getByText(/REPORT TRANSMITTED/i)).toBeDefined();
    });

    vi.unstubAllGlobals();
  });

  it('wires aria-labelledby to crash-report-title and traps/restores focus (M-7)', () => {
    const triggerBtn = document.createElement('button');
    triggerBtn.textContent = 'Trigger';
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();

    useReportStore.getState().queueCrash({
      origin: 'server',
      source: 'SERVER_TURN',
      draftId: 'draft-a11y',
      sessionId: 'sess-abc',
      fingerprint: '1234567890abcdef',
      preview: {
        errorName: 'Error',
        errorMessage: 'focus trap test',
        actionType: 'MOVE',
        floor: 1,
        turn: 1,
        sealedManifest: [],
      },
    });

    const { rerender } = render(<ReportCrashModal />);
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBe('crash-report-title');
    expect(document.getElementById('crash-report-title')?.textContent).toContain('FAULT REPORT');
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Shift+Tab from first focusable wraps to last button inside dialog
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    // Dismissing restores focus to trigger element
    fireEvent.click(screen.getByText(/DON'T SEND/i));
    rerender(<ReportCrashModal />);
    expect(document.activeElement).toBe(triggerBtn);
    triggerBtn.remove();
  });
});
