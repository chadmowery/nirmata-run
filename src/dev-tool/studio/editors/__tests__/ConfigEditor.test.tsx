import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigEditor } from '../ConfigEditor';

const mockAmbianceConfig = {
  scenes: {
    mainMenu: {
      cueId: 'amb_main_menu',
      description: 'Main Menu vector scanline oscilloscope drone',
    },
    hub: {
      cueId: 'amb_hub_deck',
      description: 'Safe zone hub air circulation',
    },
  },
  depthBands: [
    {
      id: 'band_1_corrupted',
      label: 'CORRUPTED_DATA',
      floorRange: { min: 1, max: 5 },
      cueId: 'amb_band_1_corrupted',
      baseVolume: 0.6,
      description: 'Floors 1–5 (Subnet)',
    },
  ],
  sectorConditions: [
    {
      condition: 'NOMINAL',
      cutoffMultiplier: 1.0,
      resonanceQ: 1.0,
      description: 'Clean baseline',
    },
  ],
  ducking: {
    stabilityAnchorCutoffHz: 380,
    pauseMenuCutoffHz: 380,
    duckingRampDurationSec: 0.25,
    crossfadeDurationSec: 0.8,
  },
};

describe('ConfigEditor — Ambiance System Config Visual Editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/dev/gamedata/configs/ambiance')) {
        if (init?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, name: 'ambiance' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockAmbianceConfig,
        });
      }
      if (url.includes('/api/dev/gamedata/audio-cues')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: ['amb_main_menu', 'amb_hub_deck', 'amb_band_1_corrupted'],
            cues: [
              { id: 'amb_main_menu', bus: 'ambiance', mode: 'synth' },
              { id: 'amb_hub_deck', bus: 'ambiance', mode: 'synth' },
              { id: 'amb_band_1_corrupted', bus: 'ambiance', mode: 'synth' },
            ],
          }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
  });

  it('renders structured visual sections for ambiance configuration', async () => {
    render(<ConfigEditor name="ambiance" />);

    await waitFor(() => {
      expect(screen.getByText(/System Config:\s*ambiance/i)).toBeDefined();
    });

    expect(screen.getByText('Scene Ambiance Tracks')).toBeDefined();
    expect(screen.getByText('Progression Depth Bands (Floor Ambiance)')).toBeDefined();
    expect(screen.getByText(/Sector Conditions & Environmental Filter Overrides/i)).toBeDefined();
    expect(screen.getByText('Ducking & Dynamic Filter Parameters')).toBeDefined();

    expect(screen.getByText(/Main Menu \(Oscilloscope Drone\)/i)).toBeDefined();
    expect(screen.getByText(/Hub Deck \(Safe Zone Air & Data Pulse\)/i)).toBeDefined();
  });

  it('allows adding and removing depth bands', async () => {
    render(<ConfigEditor name="ambiance" />);

    await waitFor(() => {
      expect(screen.getByText(/System Config:\s*ambiance/i)).toBeDefined();
    });

    const addBandBtn = screen.getByText('+ ADD DEPTH BAND');
    fireEvent.click(addBandBtn);

    await waitFor(() => {
      expect(screen.getByText(/Band 2: SECTOR_2/i)).toBeDefined();
    });

    const removeBtns = screen.getAllByText('REMOVE BAND');
    expect(removeBtns.length).toBe(2);
    fireEvent.click(removeBtns[1]);

    await waitFor(() => {
      expect(screen.queryByText(/Band 2: SECTOR_2/i)).toBeNull();
    });
  });

  it('allows adding and removing sector conditions', async () => {
    render(<ConfigEditor name="ambiance" />);

    await waitFor(() => {
      expect(screen.getByText(/System Config:\s*ambiance/i)).toBeDefined();
    });

    const addCondBtn = screen.getByText('+ ADD SECTOR CONDITION');
    fireEvent.click(addCondBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue('HAZARD_2')).toBeDefined();
    });

    const removeBtns = screen.getAllByText('REMOVE');
    expect(removeBtns.length).toBe(2);
    fireEvent.click(removeBtns[1]);

    await waitFor(() => {
      expect(screen.queryByDisplayValue('HAZARD_2')).toBeNull();
    });
  });

  it('saves modified ambiance configuration via PUT request', async () => {
    render(<ConfigEditor name="ambiance" />);

    await waitFor(() => {
      expect(screen.getByText(/System Config:\s*ambiance/i)).toBeDefined();
    });

    const saveBtn = screen.getByText('SAVE');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/dev/gamedata/configs/ambiance',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
  });
});
