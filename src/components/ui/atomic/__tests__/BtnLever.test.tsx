import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BtnLever } from '../BtnLever';

describe('BtnLever Atomic Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders standard lever button and triggers onClick', () => {
    const handleClick = vi.fn();
    render(
      <BtnLever variant="primary" onClick={handleClick} rightSlot="100 FLX">
        UPGRADE
      </BtnLever>,
    );

    const btn = screen.getByRole('button', { name: /UPGRADE/i });
    expect(btn).toBeDefined();
    expect(screen.getByText('100 FLX')).toBeDefined();

    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('supports hold-to-confirm progress bar over 2s and fires action on completion', () => {
    const handleConfirm = vi.fn();
    render(
      <BtnLever
        variant="cyan"
        holdToConfirm={true}
        holdDurationMs={2000}
        onHoldComplete={handleConfirm}
        rightSlot="CONFIRM"
      >
        SOCKET SOFTWARE
      </BtnLever>,
    );

    const btn = screen.getByRole('button', { name: /SOCKET SOFTWARE/i });
    expect(btn.getAttribute('data-holding')).toBe('false');

    // 1. Press and hold down
    act(() => {
      fireEvent.pointerDown(btn, { button: 0 });
    });
    expect(btn.getAttribute('data-holding')).toBe('true');

    // Advance 1 second (halfway)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(handleConfirm).not.toHaveBeenCalled();

    // Advance another 1.1s (reaches 2s threshold)
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancels hold if released before duration and does not trigger action', () => {
    const handleConfirm = vi.fn();
    render(
      <BtnLever
        variant="danger"
        holdToConfirm={true}
        holdDurationMs={2000}
        onHoldComplete={handleConfirm}
      >
        SALVAGE
      </BtnLever>,
    );

    const btn = screen.getByRole('button', { name: /SALVAGE/i });

    // Press down
    act(() => {
      fireEvent.pointerDown(btn, { button: 0 });
    });
    expect(btn.getAttribute('data-holding')).toBe('true');

    // Advance 800ms
    act(() => {
      vi.advanceTimersByTime(800);
    });

    // Release before 2s
    act(() => {
      fireEvent.pointerUp(btn);
    });
    expect(btn.getAttribute('data-holding')).toBe('false');

    // Advance past remaining duration
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(handleConfirm).not.toHaveBeenCalled();
  });

  it('cancels hold if pointer leaves button', () => {
    const handleConfirm = vi.fn();
    render(
      <BtnLever
        variant="primary"
        holdToConfirm={true}
        holdDurationMs={2000}
        onHoldComplete={handleConfirm}
      >
        PURCHASE
      </BtnLever>,
    );

    const btn = screen.getByRole('button', { name: /PURCHASE/i });

    act(() => {
      fireEvent.pointerDown(btn, { button: 0 });
    });
    expect(btn.getAttribute('data-holding')).toBe('true');

    act(() => {
      fireEvent.pointerLeave(btn);
    });
    expect(btn.getAttribute('data-holding')).toBe('false');
    expect(handleConfirm).not.toHaveBeenCalled();
  });
});
