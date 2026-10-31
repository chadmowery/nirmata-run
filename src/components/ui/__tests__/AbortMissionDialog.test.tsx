import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AbortMissionDialog } from '../AbortMissionDialog';
import { gameStore } from '@/game/ui/store';
import { GameState } from '@/game/states/types';

describe('AbortMissionDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    gameStore.setState({
      abortDialogVisible: true,
      gameStatus: GameState.Paused,
      currentFloor: 3,
      stats: { turns: 42, kills: 7 },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders modal dialog with placard, warnings, and casualty consequences', () => {
    render(<AbortMissionDialog />);

    expect(screen.getByText(/EMERGENCY ABORT PROTOCOL \/\/ OPERATOR DESYNC/i)).toBeDefined();
    expect(screen.getByText(/MANUAL TERMINATION OF ACTIVE DEPLOYMENT/i)).toBeDefined();
    expect(screen.getByText(/PERMANENT CARGO DISINTEGRATION/i)).toBeDefined();
    expect(screen.getByText(/PITY SALVAGE RECOVERY ONLY \(50%\)/i)).toBeDefined();
    expect(screen.getByText(/OPERATOR CASUALTY RECORD \(KIA\)/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /RESUME MISSION/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /CONFIRM DESYNC & ABORT/i })).toBeDefined();
  });

  it('closes dialog on resume button click', () => {
    const handleClose = vi.fn();
    render(<AbortMissionDialog onClose={handleClose} />);

    const resumeBtn = screen.getByRole('button', { name: /RESUME MISSION/i });
    fireEvent.click(resumeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('closes dialog on Escape key press', () => {
    const handleClose = vi.fn();
    render(<AbortMissionDialog onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('triggers abort and desync when confirming hold button', async () => {
    const handleConfirm = vi.fn();
    render(<AbortMissionDialog onConfirmAbort={handleConfirm} />);

    const abortBtn = screen.getByRole('button', { name: /CONFIRM DESYNC & ABORT/i });

    // Press down
    act(() => {
      fireEvent.pointerDown(abortBtn, { button: 0 });
    });

    // Advance 2s
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });
});
