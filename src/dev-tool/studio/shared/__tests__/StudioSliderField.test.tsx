import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StudioSliderField } from '../StudioSliderField';

describe('StudioSliderField', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a labeled range slider with formatted value display and tooltip trigger', () => {
    const onChange = vi.fn();
    render(
      <StudioSliderField
        label="Base Sight Radius"
        valueDisplay="8 tiles"
        tooltipTag="FOV"
        tooltip="Default player line-of-sight radius in tiles."
        min={2}
        max={24}
        step={1}
        value={8}
        onChange={onChange}
      />,
    );

    const slider = screen.getByRole('slider', { name: /Base Sight Radius \(8 tiles\)/i }) as HTMLInputElement;
    expect(slider.value).toBe('8');
    expect(slider.getAttribute('aria-valuetext')).toBe('8 tiles');
    expect(slider.hasAttribute('title')).toBe(false);

    const tipBtn = screen.getByRole('button', { name: 'About Base Sight Radius' });
    expect(tipBtn.getAttribute('aria-expanded')).toBe('false');
    expect(tipBtn.hasAttribute('title')).toBe(false);
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.change(slider, { target: { value: '12' } });
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it('shows tooltip on hover/focus/click, links aria-describedby, keeps open when hovering tooltip, and dismisses on Escape', () => {
    vi.useFakeTimers();
    render(
      <StudioSliderField
        label="Desaturation"
        valueDisplay="65%"
        tooltipTag="FOW"
        tooltip="Color desaturation applied to explored Fog-of-War tiles."
        min={0}
        max={1}
        step={0.01}
        value={0.65}
        onChange={vi.fn()}
      />,
    );

    const slider = screen.getByRole('slider');
    const tipBtn = screen.getByRole('button', { name: 'About Desaturation' });

    // Hovering the slider shows the tooltip and wires aria-describedby
    fireEvent.mouseEnter(slider);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Color desaturation applied to explored Fog-of-War tiles.');
    expect(slider.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(tipBtn.getAttribute('aria-expanded')).toBe('true');

    // Moving pointer from slider onto the tooltip keeps it open (WCAG 1.4.13)
    fireEvent.mouseLeave(slider);
    fireEvent.mouseEnter(tooltip);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByRole('tooltip')).toBeDefined();

    // Pressing Escape dismisses immediately
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(tipBtn.getAttribute('aria-expanded')).toBe('false');

    // Clicking the [?] button pins the tooltip open until toggled or Escape pressed
    fireEvent.click(tipBtn);
    expect(screen.getByRole('tooltip')).toBeDefined();
    fireEvent.click(tipBtn);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
