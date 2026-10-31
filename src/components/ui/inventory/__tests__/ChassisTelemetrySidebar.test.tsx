import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ChassisTelemetrySidebar } from '../ChassisTelemetrySidebar';
import { gameStore } from '@/game/ui/store';

describe('ChassisTelemetrySidebar Component', () => {
  beforeEach(() => {
    gameStore.setState({
      player: {
        hp: 18,
        maxHp: 20,
        xp: 120,
        level: 2,
        statuses: [],
        heat: 25,
        maxHeat: 100,
        shellName: 'vanguard-v1',
        mods: [],
      },
      stability: 90,
      maxStability: 100,
      abilities: [
        {
          name: 'Phase_Shift.sh',
          slotIndex: 0,
          heatCost: 25,
          range: 5,
          effectType: 'dash',
          templateId: 'phase-shift',
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders current shell name, archetype kanji, and class subtitle', () => {
    render(<ChassisTelemetrySidebar />);

    expect(screen.getByText('VANGUARD-V1')).toBeDefined();
    expect(screen.getByText('突撃型')).toBeDefined();
    expect(screen.getByText('Skirmisher Assault Unit')).toBeDefined();
    expect(screen.getByText(/● TK-VEC \/\/ HIGH MOBILITY/i)).toBeDefined();
  });

  it('renders all chassis subsystem metrics', () => {
    render(<ChassisTelemetrySidebar />);

    expect(screen.getByText('BASE SPEED')).toBeDefined();
    expect(screen.getByText('120 T/SEC')).toBeDefined();
    expect(screen.getByText('ARMOR RATING')).toBeDefined();
    expect(screen.getByText('2 DMG RED')).toBeDefined();
    expect(screen.getByText('MAX HEALTH')).toBeDefined();
    expect(screen.getByText('18 / 20 HP')).toBeDefined();
    expect(screen.getByText('REALITY STABILITY')).toBeDefined();
    expect(screen.getByText('90%')).toBeDefined();
    expect(screen.getByText('CORE HEAT')).toBeDefined();
    expect(screen.getByText('25 / 100 H')).toBeDefined();
  });

  it('renders active firmware abilities and empty ports', () => {
    render(<ChassisTelemetrySidebar />);

    expect(screen.getByText('Phase_Shift.sh')).toBeDefined();
    expect(screen.getByText('+25H')).toBeDefined();
    expect(screen.getByText('R:5')).toBeDefined();
    expect(screen.getAllByText('[PORT EMPTY]').length).toBe(2);
  });

  it('renders nominal operational state when no debuffs exist', () => {
    render(<ChassisTelemetrySidebar />);

    expect(screen.getByText(/NOMINAL \/\/ ALL SYSTEMS OPTIMAL/i)).toBeDefined();
  });

  it('renders active status tags when statuses are present', () => {
    gameStore.setState({
      player: {
        ...gameStore.getState().player,
        statuses: ['OVERCLOCKED', 'VOID_TAINT'],
      },
    });

    render(<ChassisTelemetrySidebar />);

    expect(screen.getByText('OVERCLOCKED')).toBeDefined();
    expect(screen.getByText('VOID_TAINT')).toBeDefined();
  });

  it('displays rich ItemTooltip when hovering over the shell card', () => {
    render(<ChassisTelemetrySidebar />);

    const shellCard = screen.getByRole('button', { name: /View telemetry for VANGUARD-V1/i });
    fireEvent.pointerEnter(shellCard, { clientX: 200, clientY: 200 });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeDefined();
    expect(screen.getByText(/SKIRMISHER ASSAULT PLATFORM/i)).toBeDefined();
    expect(screen.getByText(/Lightweight high-mobility skirmisher frame/i)).toBeDefined();

    fireEvent.pointerLeave(shellCard);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('displays rich ItemTooltip when hovering over a stat row', () => {
    render(<ChassisTelemetrySidebar />);

    const speedRow = screen.getByRole('button', { name: /Inspect BASE SPEED/i });
    fireEvent.pointerEnter(speedRow, { clientX: 220, clientY: 300 });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeDefined();
    expect(screen.getByText(/LOCOMOTION VELOCITY/i)).toBeDefined();
    expect(screen.getByText(/Determines the chassis movement rate/i)).toBeDefined();

    fireEvent.pointerLeave(speedRow);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('displays rich ItemTooltip when hovering over an ability', () => {
    render(<ChassisTelemetrySidebar />);

    const abilityBtn = screen.getByRole('button', { name: /Firmware 1: Phase_Shift\.sh/i });
    fireEvent.pointerEnter(abilityBtn, { clientX: 250, clientY: 400 });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeDefined();
    expect(within(tooltip).getByText(/Phase_Shift\.sh/i)).toBeDefined();
    expect(within(tooltip).getByText(/High-velocity quantum displacement drive/i)).toBeDefined();

    fireEvent.pointerLeave(abilityBtn);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('displays rich ItemTooltip when hovering over operational states', () => {
    render(<ChassisTelemetrySidebar />);

    const statesContainer = screen.getByRole('button', { name: /Inspect active chassis operational states/i });
    fireEvent.pointerEnter(statesContainer, { clientX: 250, clientY: 500 });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeDefined();
    expect(screen.getByText(/CHASSIS OPERATIONAL STATUS/i)).toBeDefined();
    expect(screen.getByText(/Real-time neural and physical condition/i)).toBeDefined();

    fireEvent.pointerLeave(statesContainer);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
