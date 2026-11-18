import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DEFAULT_FOV_CONFIG } from '@shared/fov-config';
import { DEFAULT_LIGHTING_CONFIG } from '@shared/lighting-config';
import { FovConfigPanel, LightingConfigPanel } from '../LightingFovConfigPanels';

describe('LightingFovConfigPanels', () => {
  it('renders every FOV/FOW slider in stacked field cells with explanatory tooltips', () => {
    const onChange = vi.fn();
    const { container } = render(
      <FovConfigPanel data={structuredClone(DEFAULT_FOV_CONFIG)} onChange={onChange} />,
    );

    const sliders = screen.getAllByRole('slider');
    // 7 in Panel 1 + 8 in Panel 2 + 3 in Panel 3 = 18 sliders
    expect(sliders).toHaveLength(18);

    // Every slider uses the overflow-safe .slider class inside a .fieldCell (not horizontal .fieldRow)
    for (const slider of sliders) {
      expect(slider.closest('[class*="fieldCell"]')).not.toBeNull();
      expect(slider.closest('[class*="fieldRow"]')).toBeNull();
    }

    // Every slider has an accessible [?] tooltip button that reveals an explanation
    const tipButtons = screen.getAllByRole('button', { name: /^About / });
    expect(tipButtons.length).toBeGreaterThanOrEqual(18);

    for (const btn of tipButtons) {
      fireEvent.click(btn);
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip.textContent?.trim().length).toBeGreaterThan(20);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('tooltip')).toBeNull();
    }

    expect(container.querySelectorAll('[class*="fieldGrid"]').length).toBeGreaterThanOrEqual(3);
  });

  it('renders every LightingConfigPanel slider with stacked field cells and explanatory tooltips', () => {
    const onChange = vi.fn();
    render(
      <LightingConfigPanel data={structuredClone(DEFAULT_LIGHTING_CONFIG)} onChange={onChange} />,
    );

    const sliders = screen.getAllByRole('slider');
    // 2 bloom + (5 factions * 2) + (4 conditions * 4) = 28 sliders
    expect(sliders).toHaveLength(28);

    for (const slider of sliders) {
      expect(slider.closest('[class*="fieldCell"]')).not.toBeNull();
      expect(slider.closest('[class*="fieldRow"]')).toBeNull();
    }

    // Spot-check a bloom slider tooltip
    fireEvent.mouseEnter(screen.getByRole('slider', { name: /Luminance Threshold/i }));
    expect(screen.getByRole('tooltip').textContent).toMatch(/Minimum pixel brightness/i);
  });
});
