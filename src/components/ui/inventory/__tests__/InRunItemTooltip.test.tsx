import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InRunItemTooltip } from '../InRunItemTooltip';
import { EquipmentDef, SoftwareDef, TemplateId, RarityTier, Children } from '@shared/components';
import type { ComponentDef } from '@engine/ecs/types';

describe('InRunItemTooltip Component', () => {
  beforeEach(() => {
    const mockEntities: Record<number, Record<string, unknown>> = {
      100: {
        equipment: { name: 'Titanium Edge', slotType: 'weapon' },
        templateId: { id: 'sword-v1' },
        rarityTier: { tier: 'rare' },
        children: { entityIds: [101] },
      },
      101: {
        software: { name: 'Bleed.exe', targetSlot: 'weapon', type: 'bleed-v1' },
        templateId: { id: 'bleed-v1' },
      },
      200: {
        software: {
          name: 'Phase_Shift.sh',
          targetSlot: 'weapon',
          type: 'phase-shift',
          baseMagnitude: 10,
          description: 'High-velocity quantum displacement drive.',
        },
        templateId: { id: 'phase-shift' },
        rarityTier: { tier: 'uncommon' },
      },
    };

    (window as unknown as { gameContext: { world: unknown } }).gameContext = {
      world: {
        getComponent: <T,>(entityId: number, component: ComponentDef<T>) => {
          const ent = mockEntities[entityId];
          if (!ent) return undefined;
          if (component === EquipmentDef) return ent.equipment as T;
          if (component === SoftwareDef) return ent.software as T;
          if (component === TemplateId) return ent.templateId as T;
          if (component === RarityTier) return ent.rarityTier as T;
          if (component === Children) return ent.children as T;
          return undefined;
        },
        hasComponent: (entityId: number, component: ComponentDef<unknown>) => {
          const ent = mockEntities[entityId];
          if (!ent) return false;
          if (component === EquipmentDef) return !!ent.equipment;
          if (component === SoftwareDef) return !!ent.software;
          return false;
        },
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders equipment item with socketed software', () => {
    render(<InRunItemTooltip entityId={100} position={{ x: 100, y: 100 }} />);

    expect(screen.getByText(/Titanium Edge/i)).toBeDefined();
    expect(screen.getByText('TACTICAL WEAPON')).toBeDefined();
    expect(screen.getByText('RARE')).toBeDefined();
    expect(screen.getByText(/LOADED SOFTWARE SUBROUTINE \/\/ MODIFIERS:/i)).toBeDefined();
    expect(screen.getByText(/⚡ BLEED\.EXE/i)).toBeDefined();
  });

  it('renders software item details and socket target bay', () => {
    render(<InRunItemTooltip entityId={200} position={{ x: 100, y: 100 }} />);

    expect(screen.getByText(/Phase_Shift\.sh/i)).toBeDefined();
    expect(screen.getByText('KERNEL SUBROUTINE')).toBeDefined();
    expect(screen.getByText(/SOCKET TARGET:\s+WEAPON\s+BAY/i)).toBeDefined();
  });

  it('toggles deep stats when Alt key is pressed', () => {
    render(<InRunItemTooltip entityId={200} position={{ x: 100, y: 100 }} />);

    expect(screen.queryByText(/ENTITY ID: #200/i)).toBeNull();

    fireEvent.keyDown(window, { key: 'Alt' });
    expect(screen.getByText(/ENTITY ID: #200/i)).toBeDefined();
    expect(screen.getByText(/TEMPLATE: phase-shift/i)).toBeDefined();

    fireEvent.keyUp(window, { key: 'Alt' });
    expect(screen.queryByText(/ENTITY ID: #200/i)).toBeNull();
  });

  it('clamps tooltip position inside screen bounds when cursor is near bottom-right', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });

    render(<InRunItemTooltip entityId={100} position={{ x: 1010, y: 750 }} />);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeDefined();

    const leftPx = parseInt(tooltip.style.left, 10);
    const topPx = parseInt(tooltip.style.top, 10);

    expect(leftPx).toBeLessThanOrEqual(1024 - 280 - 16);
    expect(leftPx).toBeGreaterThanOrEqual(16);

    expect(topPx).toBeLessThanOrEqual(768 - 220 - 16);
    expect(topPx).toBeGreaterThanOrEqual(16);
  });
});
