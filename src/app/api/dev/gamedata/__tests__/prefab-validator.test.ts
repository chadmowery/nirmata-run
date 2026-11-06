import { describe, it, expect } from 'vitest';
import { validatePrefabRules } from '../prefab-validator';
import type { RoomPrefabTemplate } from '@/game/generation/prefabs/types';

describe('Prefab Structural Validator (VAL-PRF-01 to VAL-PRF-06)', () => {
  const validRoom: RoomPrefabTemplate = {
    id: 'test-room',
    name: 'Test Room',
    faction: 'cyberacme',
    minFloor: 1,
    maxFloor: 5,
    width: 10,
    height: 10,
    layout: [
      '##########',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '##########',
    ],
    portals: [
      { x: 5, y: 0, direction: 'north' },
      { x: 5, y: 9, direction: 'south' },
    ],
    propSpawns: [
      { x: 2, y: 2, anchorType: 'PROP_DESK_CORNER', orientation: 'SOUTH' },
    ],
  };

  it('validates a well-formed room prefab', () => {
    const result = validatePrefabRules(validRoom);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('rejects layout with dimension mismatch (VAL-PRF-01)', () => {
    const invalid = { ...validRoom, layout: validRoom.layout.slice(0, 8) };
    const result = validatePrefabRules(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === 'VAL-PRF-01')).toBe(true);
  });

  it('rejects portal not on perimeter (VAL-PRF-02)', () => {
    const invalid = {
      ...validRoom,
      portals: [{ x: 3, y: 3, direction: 'north' as const }],
    };
    const result = validatePrefabRules(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === 'VAL-PRF-02')).toBe(true);
  });

  it('rejects portal on corner (VAL-PRF-02)', () => {
    const invalid = {
      ...validRoom,
      portals: [{ x: 0, y: 0, direction: 'north' as const }],
    };
    const result = validatePrefabRules(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === 'VAL-PRF-02')).toBe(true);
  });

  it('rejects isolated floor pockets (VAL-PRF-03)', () => {
    const isolated = {
      ...validRoom,
      layout: [
        '##########',
        '#..#.....#',
        '#..#.....#',
        '#..#.....#',
        '####.....#',
        '#........#',
        '#........#',
        '#........#',
        '#........#',
        '##########',
      ],
    };
    const result = validatePrefabRules(isolated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === 'VAL-PRF-03')).toBe(true);
  });

  it('rejects prop placed on wall or with front blocked by wall (VAL-PRF-04)', () => {
    const onWall = {
      ...validRoom,
      propSpawns: [{ x: 0, y: 0, anchorType: 'PROP_LOCKER_WALL' as const, orientation: 'SOUTH' as const }],
    };
    const resOnWall = validatePrefabRules(onWall);
    expect(resOnWall.valid).toBe(false);
    expect(resOnWall.errors.some((e) => e.id === 'VAL-PRF-04')).toBe(true);

    const blockedFront = {
      ...validRoom,
      propSpawns: [{ x: 1, y: 1, anchorType: 'PROP_LOCKER_WALL' as const, orientation: 'NORTH' as const }],
    };
    const resBlocked = validatePrefabRules(blockedFront);
    expect(resBlocked.valid).toBe(false);
    expect(resBlocked.errors.some((e) => e.id === 'VAL-PRF-04')).toBe(true);
  });

  it('rejects vault room missing V tile or rare container (VAL-PRF-05)', () => {
    const vaultMissingBoth = {
      ...validRoom,
      isVaultRoom: true,
    };
    const res = validatePrefabRules(vaultMissingBoth);
    expect(res.valid).toBe(false);
    expect(res.errors.filter((e) => e.id === 'VAL-PRF-05').length).toBe(2);
  });
});
