import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HotkeysModal } from '../HotkeysModal';

describe('HotkeysModal Component', () => {
  let onCloseMock: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onCloseMock = vi.fn<() => void>();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal dialog with placard, categories, and key badges', () => {
    render(<HotkeysModal onClose={onCloseMock} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(screen.getByText(/OPERATOR INPUT DIRECTIVES/i)).toBeDefined();
    expect(screen.getByText(/Locomotion & Melee Combat/i)).toBeDefined();
    expect(screen.getByText(/Firmware Subroutines & Aim/i)).toBeDefined();
    expect(screen.getByText(/Chassis Vitals & Software/i)).toBeDefined();
    expect(screen.getByText(/Environment & Exploration/i)).toBeDefined();
    expect(screen.getByText(/Tactical Sensor Camera/i)).toBeDefined();
    expect(screen.getByText(/Field Terminal & Manuals/i)).toBeDefined();
  });

  it('calls onClose when Escape key is pressed', () => {
    render(<HotkeysModal onClose={onCloseMock} />);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when h or H key is pressed', () => {
    render(<HotkeysModal onClose={onCloseMock} />);

    fireEvent.keyDown(window, { key: 'h', code: 'KeyH' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'H', code: 'KeyH' });
    expect(onCloseMock).toHaveBeenCalledTimes(2);
  });

  it('does not call onClose when other keys are pressed', () => {
    render(<HotkeysModal onClose={onCloseMock} />);

    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    fireEvent.keyDown(window, { key: 'Space', code: 'Space' });
    fireEvent.keyDown(window, { key: 'w', code: 'KeyW' });
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('calls onClose when clicking outside modal on backdrop', () => {
    render(<HotkeysModal onClose={onCloseMock} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the modal content', () => {
    render(<HotkeysModal onClose={onCloseMock} />);

    const title = screen.getByText(/OPERATOR INPUT DIRECTIVES/i);
    fireEvent.click(title);
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('removes the keydown listener when unmounted', () => {
    const { unmount } = render(<HotkeysModal onClose={onCloseMock} />);
    unmount();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onCloseMock).not.toHaveBeenCalled();
  });
});
