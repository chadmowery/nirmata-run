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
    expect(btn.getAttribute('data-hold-button')).toBeNull();

    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('sets data-hold-button="true" when holdToConfirm is true', () => {
    render(
      <BtnLever variant="cyan" holdToConfirm={true}>
        COMPILE
      </BtnLever>,
    );

    const btn = screen.getByRole('button', { name: /COMPILE/i });
    expect(btn.getAttribute('data-hold-button')).toBe('true');
  });

  it('supports hold-to-confirm progress bar over 2s and fires onHoldComplete', () => {
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

  it('safely calls onClick with a full synthetic event and handles stopPropagation', () => {
    const handleClick = vi.fn((e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
    });

    render(
      <BtnLever
        variant="primary"
        holdToConfirm={true}
        holdDurationMs={2000}
        onClick={handleClick}
        rightSlot="100 CR"
      >
        PURCHASE
      </BtnLever>,
    );

    const btn = screen.getByRole('button', { name: /PURCHASE/i });

    // Press down
    act(() => {
      fireEvent.pointerDown(btn, { button: 0 });
    });

    // Advance 2s
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Action should fire with fully functional synthetic event
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick.mock.calls[0][0].preventDefault).toBeDefined();
    expect(handleClick.mock.calls[0][0].stopPropagation).toBeDefined();

    // User releases pointer
    act(() => {
      fireEvent.pointerUp(btn);
      fireEvent.click(btn);
    });

    // Releasing and native click should NOT trigger onClick a second time
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('displays real-time hold percentage while holding and CONFIRMED when complete', () => {
    render(
      <BtnLever
        variant="cyan"
        holdToConfirm={true}
        holdDurationMs={2000}
        rightSlot="INITIAL"
      >
        CHARGE
      </BtnLever>,
    );

    const btn = screen.getByRole('button', { name: /CHARGE/i });
    expect(screen.getByText('INITIAL')).toBeDefined();

    // Press down
    act(() => {
      fireEvent.pointerDown(btn, { button: 0 });
    });

    // Advance 1000ms (50%)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/HOLD 50%/i)).toBeDefined();

    // Advance another 1000ms (100%)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/CONFIRMED/i)).toBeDefined();
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

  it('supports keyboard Space/Enter hold to confirm', () => {
    const handleClick = vi.fn();
    render(
      <BtnLever
        variant="primary"
        holdToConfirm={true}
        holdDurationMs={2000}
        onClick={handleClick}
      >
        KEYBOARD ACTION
      </BtnLever>,
    );

    const btn = screen.getByRole('button', { name: /KEYBOARD ACTION/i });

    // Press Space
    act(() => {
      fireEvent.keyDown(btn, { key: ' ' });
    });
    expect(btn.getAttribute('data-holding')).toBe('true');

    // Advance 2000ms
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(handleClick).toHaveBeenCalledTimes(1);

    // Release Space
    act(() => {
      fireEvent.keyUp(btn, { key: ' ' });
    });

    // Wait for reset
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(btn.getAttribute('data-holding')).toBe('false');
  });
});
