import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GlobalError from '../global-error';

describe('GlobalError (H-3)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders self-contained fault shell and hides report panel when status is unavailable', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ available: false, mode: 'off' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as unknown as typeof fetch;

    const reset = vi.fn();
    const err = new Error('Root layout blew up');
    render(<GlobalError error={err} reset={reset} />);

    expect(screen.getByRole('alert').textContent).toContain('Root layout blew up');
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/reports/status');
    });
    expect(screen.queryByRole('button', { name: /send crash report/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /try recover/i }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /^reload$/i })).toBeTruthy();
  });

  it('submits a self-contained REACT_RENDER crash report when reporting is available', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ available: true, mode: 'dry-run' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'dry-run', ref: 'NR-ROOT' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const err = new Error('Boot provider exploded');
    render(<GlobalError error={err} reset={vi.fn()} />);

    const sendBtn = await screen.findByRole('button', { name: /send crash report/i });
    const noteBox = screen.getByLabelText(/optional crash note/i);
    fireEvent.change(noteBox, { target: { value: 'Crashed right on cold boot' } });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/NR-ROOT/)).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/reports/crash',
      expect.objectContaining({
        method: 'POST',
      })
    );
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body.source).toBe('REACT_RENDER');
    expect(body.error.message).toBe('Boot provider exploded');
    expect(body.note).toBe('Crashed right on cold boot');
    expect(body.fingerprint).toHaveLength(16);
  });
});
