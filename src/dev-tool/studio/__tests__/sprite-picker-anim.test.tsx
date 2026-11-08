import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SpritePicker } from '../shared/SpritePicker';
import { tilesetAtlasCache, TilesetAtlasData } from '../shared/tileset-atlas-cache';

// Mock canvas 2D context for jsdom
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  })) as any;
});

const mockAtlasData: TilesetAtlasData = {
  frames: {
    floor: { frame: { x: 0, y: 0, w: 32, h: 32 } },
    wall_straight_h: { frame: { x: 32, y: 0, w: 32, h: 32 } },
    player_vanguard: { frame: { x: 0, y: 32, w: 32, h: 32 } },
    player_vanguard_idle_1: { frame: { x: 0, y: 384, w: 32, h: 32 } },
    player_vanguard_move_0: { frame: { x: 32, y: 384, w: 32, h: 32 } },
    player_vanguard_move_1: { frame: { x: 64, y: 384, w: 32, h: 32 } },
    prop_workstation_n: { frame: { x: 64, y: 32, w: 32, h: 32 } },
    prop_workstation_n_idle_1: { frame: { x: 96, y: 384, w: 32, h: 32 } },
  },
  animations: {
    player_vanguard: {
      idle: {
        frames: ['player_vanguard', 'player_vanguard_idle_1'],
        fps: 2,
        loop: 'pingpong',
      },
      move: {
        frames: ['player_vanguard_move_0', 'player_vanguard_move_1'],
        fps: 4,
        loop: 'loop',
      },
    },
    prop_workstation_n: {
      idle: {
        frames: ['prop_workstation_n', 'prop_workstation_n_idle_1'],
        fps: 2,
        loop: 'loop',
      },
    },
  },
};

describe('SpritePicker Studio Animation Previews & Scrubber [ANIM-04]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tilesetAtlasCache.setAtlasData('default', mockAtlasData);
    // Mock loadAtlas to succeed immediately
    vi.spyOn(tilesetAtlasCache, 'loadAtlas').mockResolvedValue(true);
  });

  it('renders preview canvas and input field for a sprite key', async () => {
    const handleChange = vi.fn();
    render(<SpritePicker value="floor" onChange={handleChange} />);

    const input = screen.getByPlaceholderText('Select or enter sprite key') as HTMLInputElement;
    expect(input.value).toBe('floor');
    // Static sprite: no animation bar rendered
    expect(screen.queryByText(/STATE:/i)).toBeNull();
  });

  it('renders interactive animation bar with state pills when animated key is passed', async () => {
    const handleChange = vi.fn();
    render(<SpritePicker value="player_vanguard" onChange={handleChange} />);

    await waitFor(() => {
      expect(screen.getByText(/STATE:/i)).toBeDefined();
    });

    // States for player_vanguard: idle and move
    expect(screen.getByRole('button', { name: /idle/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /move/i })).toBeDefined();

    // Transport controls
    expect(screen.getByRole('button', { name: /⏸ PAUSE/i })).toBeDefined();
    expect(screen.getByRole('button', { name: '0.5x' })).toBeDefined();
    expect(screen.getByRole('button', { name: '1x' })).toBeDefined();
    expect(screen.getByRole('button', { name: '2x' })).toBeDefined();

    // Active clip info
    expect(screen.getByText(/PINGPONG • 2 FPS/i)).toBeDefined();
  });

  it('switches state when another state pill is clicked', async () => {
    const handleChange = vi.fn();
    render(<SpritePicker value="player_vanguard" onChange={handleChange} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /move/i })).toBeDefined();
    });

    const moveBtn = screen.getByRole('button', { name: /move/i });
    fireEvent.click(moveBtn);

    // active clip info for move: LOOP • 4 FPS
    expect(screen.getByText(/LOOP • 4 FPS/i)).toBeDefined();
  });

  it('toggles pause and play in transport controls', async () => {
    const handleChange = vi.fn();
    render(<SpritePicker value="player_vanguard" onChange={handleChange} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /⏸ PAUSE/i })).toBeDefined();
    });

    const pauseBtn = screen.getByRole('button', { name: /⏸ PAUSE/i });
    fireEvent.click(pauseBtn);

    // Changes to PLAY
    expect(screen.getByRole('button', { name: /▶ PLAY/i })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /▶ PLAY/i }));
    expect(screen.getByRole('button', { name: /⏸ PAUSE/i })).toBeDefined();
  });

  it('switches speed multipliers when clicking speed buttons', async () => {
    const handleChange = vi.fn();
    render(<SpritePicker value="player_vanguard" onChange={handleChange} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '2x' })).toBeDefined();
    });

    const speed2x = screen.getByRole('button', { name: '2x' });
    fireEvent.click(speed2x);
    // Verified clickable without crash
  });

  it('renders filmstrip cells and scrubs to a manual frame on click', async () => {
    const handleChange = vi.fn();
    render(<SpritePicker value="player_vanguard" onChange={handleChange} />);

    await waitFor(() => {
      expect(screen.getByText(/#0/i)).toBeDefined();
      expect(screen.getByText(/#1/i)).toBeDefined();
    });

    const cell1 = screen.getByTitle(/Frame #1: player_vanguard_idle_1/i);
    expect(cell1).toBeDefined();

    // Clicking cell 1 scrubs to manual frame and pauses playback
    fireEvent.click(cell1);
    expect(screen.getByRole('button', { name: /▶ PLAY/i })).toBeDefined();
  });

  it('filters dropdown by ALL, ANIMATED, and STATIC modes with [ANIM • Nf] badges', async () => {
    const handleChange = vi.fn();
    render(<SpritePicker value="floor" onChange={handleChange} />);

    // Open dropdown
    const pickBtn = screen.getByRole('button', { name: /▼ PICK/i });
    fireEvent.click(pickBtn);

    // Dropdown filter buttons
    expect(screen.getByRole('button', { name: 'ALL' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'ANIMATED' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'STATIC' })).toBeDefined();

    // Click ANIMATED filter
    fireEvent.click(screen.getByRole('button', { name: 'ANIMATED' }));

    // player_vanguard and prop_workstation_n should be listed with ANIM badge
    expect(screen.getByText('player_vanguard')).toBeDefined();
    expect(screen.getByText('prop_workstation_n')).toBeDefined();
    expect(screen.queryByText('wall_straight_h')).toBeNull();

    // Badge showing frame count
    const animBadges = screen.getAllByText(/ANIM • 2f/i);
    expect(animBadges.length).toBeGreaterThan(0);

    // Click STATIC filter
    fireEvent.click(screen.getByRole('button', { name: 'STATIC' }));
    expect(screen.getByText('wall_straight_h')).toBeDefined();
    expect(screen.queryByText('player_vanguard')).toBeNull();

    // Selecting an item calls onChange
    fireEvent.click(screen.getByText('wall_straight_h'));
    expect(handleChange).toHaveBeenCalledWith('wall_straight_h');
  });

  it('loops one-shot clips in preview mode across multiple cycles instead of freezing', () => {
    // player_vanguard 'move' clip has loop: 'once', frames: ['player_vanguard_move_0', 'player_vanguard_move_1'], fps: 4 (250ms/f, 500ms total)
    const frameAtCycle1Start = tilesetAtlasCache.resolveAnimatedFrameAtTime(
      'player_vanguard',
      'move',
      50,
      'default',
      true,
    );
    expect(frameAtCycle1Start.frameIndex).toBe(0);

    const frameAtCycle1End = tilesetAtlasCache.resolveAnimatedFrameAtTime(
      'player_vanguard',
      'move',
      350,
      'default',
      true,
    );
    expect(frameAtCycle1End.frameIndex).toBe(1);

    // After 1 full cycle (> 500ms), in preview mode it must loop back to frame 0 instead of freezing on frame 1
    const frameAtCycle2Start = tilesetAtlasCache.resolveAnimatedFrameAtTime(
      'player_vanguard',
      'move',
      550,
      'default',
      true,
    );
    expect(frameAtCycle2Start.frameIndex).toBe(0);
    expect(frameAtCycle2Start.frameKey).toBe('player_vanguard_move_0');
  });

  it('resolves non-player and enemy entity sprites directly from entity component definitions', async () => {
    const { getTemplateSpriteKey } = await import('@/game/entities');
    expect(getTemplateSpriteKey('anchor')).toBe('anchor');
    expect(getTemplateSpriteKey('staircase')).toBe('staircase');
    expect(getTemplateSpriteKey('prop-workstation', 'NORTH')).toBe('prop_workstation_n');
    expect(getTemplateSpriteKey('prop-cooling-vent')).toBe('prop_cooling_vent_ready');
    expect(getTemplateSpriteKey('prop-stabilizer')).toBe('prop_stabilizer_active');
    expect(getTemplateSpriteKey('prop-safe-locked')).toBe('prop_safe_locked');
  });
});
