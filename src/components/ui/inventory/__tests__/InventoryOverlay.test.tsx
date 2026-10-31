import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InventoryOverlay } from '../InventoryOverlay';

describe('InventoryOverlay Component', () => {
  let fn: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    fn = vi.fn<() => void>();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal dialog with placard and close button', () => {
    render(<InventoryOverlay onClose={fn} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(screen.getByText(/TACTICAL BACKPACK & ACTIVE EQUIPMENT SLOTS/i)).toBeDefined();
    expect(screen.getByText(/✕ CLOSE \[ESC\]/i)).toBeDefined();
  });

  it('calls onClose when Escape key is pressed', () => {
    render(<InventoryOverlay onClose={fn} />);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when other keys are pressed', () => {
    render(<InventoryOverlay onClose={fn} />);

    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    fireEvent.keyDown(window, { key: 'Space', code: 'Space' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('calls onClose when clicking outside modal on backdrop', () => {
    render(<InventoryOverlay onClose={fn} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the modal content', () => {
    render(<InventoryOverlay onClose={fn} />);

    const title = screen.getByText(/TACTICAL BACKPACK & ACTIVE EQUIPMENT SLOTS/i);
    fireEvent.click(title);
    expect(fn).not.toHaveBeenCalled();
  });

  it('removes the keydown listener when unmounted', () => {
    const { unmount } = render(<InventoryOverlay onClose={fn} />);
    unmount();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(fn).not.toHaveBeenCalled();
  });
});
