import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShellEditor } from '../ShellEditor';
import { useGamedataStore } from '../../store';

vi.mock('../../shared/SpritePicker', () => ({
  SpritePicker: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (val: string) => void;
  }) => (
    <input
      data-testid="mock-sprite-picker"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const mockBastionShell = {
  id: 'bastion-v1',
  name: 'BASTION-v1',
  sprite: 'bastion-v1-south',
  defaultDirection: 'south',
  directionalSprites: {
    north: 'bastion-v1-north',
    east: 'bastion-v1-east',
    south: 'bastion-v1-south',
    west: 'bastion-v1-west',
  },
  baseStats: { speed: 80, stability: 10, armor: 3, maxHealth: 25 },
  basePorts: { maxFirmware: 1, maxAugment: 1, maxSoftware: 1 },
  upgrades: [],
  starterLoadout: ['neural-spike'],
};

describe('ShellEditor Component', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useGamedataStore.setState({
      dirty: false,
      activeEffectiveData: null,
      activeValidationStatus: undefined,
    } as any);

    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/dev/gamedata/shells/bastion-v1' && (!init || init.method === 'GET')) {
        return {
          ok: true,
          json: async () => structuredClone(mockBastionShell),
        } as Response;
      }
      if (url === '/api/dev/gamedata/shells/vanguard-v1' && (!init || init.method === 'GET')) {
        return {
          ok: true,
          json: async () => ({
            id: 'vanguard-v1',
            name: 'VANGUARD-v1',
            sprite: 'player_vanguard',
            baseStats: { speed: 120, stability: 5, armor: 2, maxHealth: 20 },
            basePorts: { maxFirmware: 2, maxAugment: 1, maxSoftware: 2 },
            upgrades: [],
            starterLoadout: [],
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ success: true }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('displays and saves configured cardinal direction sprites and default facing direction', async () => {
    render(<ShellEditor id="bastion-v1" />);

    await waitFor(() => {
      expect(screen.getByText('Cardinal Direction Sprites (N / E / S / W)')).toBeTruthy();
    });

    const pickers = screen.getAllByTestId('mock-sprite-picker') as HTMLInputElement[];
    // 0: Base Sprite, 1: North, 2: East, 3: South, 4: West
    expect(pickers).toHaveLength(5);
    expect(pickers[0].value).toBe('bastion-v1-south');
    expect(pickers[1].value).toBe('bastion-v1-north');
    expect(pickers[2].value).toBe('bastion-v1-east');
    expect(pickers[3].value).toBe('bastion-v1-south');
    expect(pickers[4].value).toBe('bastion-v1-west');

    // Change North sprite key & switch Default Facing to North (syncs Base Sprite)
    fireEvent.change(pickers[1], { target: { value: 'custom-bastion-n' } });
    const defaultSelect = screen.getByLabelText('Default Facing') as HTMLSelectElement;
    fireEvent.change(defaultSelect, { target: { value: 'north' } });

    expect((screen.getAllByTestId('mock-sprite-picker')[0] as HTMLInputElement).value).toBe(
      'custom-bastion-n',
    );

    fireEvent.click(screen.getByRole('button', { name: 'SAVE' }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([u, i]) => u === '/api/dev/gamedata/shells/bastion-v1' && i?.method === 'PUT',
      );
      expect(putCall).toBeDefined();
      const body = JSON.parse(String(putCall?.[1]?.body));
      expect(body.defaultDirection).toBe('north');
      expect(body.sprite).toBe('custom-bastion-n');
      expect(body.directionalSprites).toEqual({
        north: 'custom-bastion-n',
        east: 'bastion-v1-east',
        south: 'bastion-v1-south',
        west: 'bastion-v1-west',
      });
    });
  });

  it('auto-fills and clears directional sprites for a shell without initial cardinal directions', async () => {
    render(<ShellEditor id="vanguard-v1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Auto-Fill vanguard-v1/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Auto-Fill vanguard-v1/i }));

    const pickers = screen.getAllByTestId('mock-sprite-picker') as HTMLInputElement[];
    expect(pickers[0].value).toBe('vanguard-v1-south');
    expect(pickers[1].value).toBe('vanguard-v1-north');
    expect(pickers[2].value).toBe('vanguard-v1-east');
    expect(pickers[3].value).toBe('vanguard-v1-south');
    expect(pickers[4].value).toBe('vanguard-v1-west');

    fireEvent.click(screen.getByRole('button', { name: 'CLEAR' }));
    const cleared = screen.getAllByTestId('mock-sprite-picker') as HTMLInputElement[];
    expect(cleared[1].value).toBe('');
    expect(cleared[2].value).toBe('');
    expect(cleared[3].value).toBe('');
    expect(cleared[4].value).toBe('');
  });
});
