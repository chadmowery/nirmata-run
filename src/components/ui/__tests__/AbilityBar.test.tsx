import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AbilityBar } from '../AbilityBar';
import { gameStore } from '@/game/ui/store';

describe('AbilityBar Component', () => {
  beforeEach(() => {
    gameStore.setState({
      abilities: [
        {
          name: 'Neural_Spike.exe',
          slotIndex: 0,
          heatCost: 20,
          range: 6,
          effectType: 'ranged_attack',
          templateId: 'neural-spike',
          damageAmount: 12,
        },
        {
          name: 'Basic_Strike.exe',
          slotIndex: 1,
          heatCost: 15,
          range: 1,
          effectType: 'melee_attack',
          templateId: 'basic-strike',
          damageAmount: 8,
        },
      ],
      targetingActive: false,
      targetingSlotIndex: -1,
    });
  });

  it('renders abilities with hotkeys and heat tags', () => {
    render(<AbilityBar />);

    expect(screen.getByText('[1]')).toBeDefined();
    expect(screen.getByText('Neural_Spike.exe')).toBeDefined();
    expect(screen.getByText('+20H')).toBeDefined();

    expect(screen.getByText('[2]')).toBeDefined();
    expect(screen.getByText('Basic_Strike.exe')).toBeDefined();
    expect(screen.getByText('+15H')).toBeDefined();

    expect(screen.getByText('[PORT EMPTY]')).toBeDefined();
  });

  it('shows rich ItemTooltip when hovering over an active ability', async () => {
    render(<AbilityBar />);

    const abilityBtn = screen.getByRole('button', { name: /Neural_Spike\.exe/i });
    fireEvent.pointerEnter(abilityBtn, { clientX: 200, clientY: 300 });

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeDefined();
      expect(screen.getByText(/神経撃針 \/\/ NEURAL SPIKE/i)).toBeDefined();
      expect(screen.getByText(/FIRMWARE \/\/ SYSTEM PROGRAM/i)).toBeDefined();
      expect(screen.getByText(/Direct wireless logic spike focused on remote cybernetic targets/i)).toBeDefined();
    });

    fireEvent.pointerLeave(abilityBtn);
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).toBeNull();
    });
  });
});
