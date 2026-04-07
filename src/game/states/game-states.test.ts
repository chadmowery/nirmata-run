import { describe, it, expect } from 'vitest';
import { GameState } from './types';
import { 
  GAME_TRANSITIONS, 
  ACTIVE_PHASES, 
  getActivePhases, 
  createGameFSM 
} from './game-states';
import { Phase } from '../../engine/ecs/types';

describe('Game States', () => {
  it('GameState enum has correct values', () => {
    expect(Object.values(GameState)).toEqual([
      'Loading',
      'MainMenu',
      'Hub',
      'Playing',
      'Paused',
      'GameOver',
    ]);
  });

  it('GAME_TRANSITIONS has expected entries', () => {
    // We added 5 new transitions for Hub, total should be 13
    expect(GAME_TRANSITIONS.length).toBe(13);
  });

  it('createGameFSM starts at Loading state', () => {
    const fsm = createGameFSM({} as any);
    expect(fsm.getCurrentState()).toBe(GameState.Loading);
  });

  it('createGameFSM follows valid transition path (Loading -> MainMenu -> Playing)', () => {
    const fsm = createGameFSM({} as any);
    expect(fsm.transition(GameState.MainMenu)).toBe(true);
    expect(fsm.transition(GameState.Playing)).toBe(true);
    expect(fsm.getCurrentState()).toBe(GameState.Playing);
  });

  it('createGameFSM rejects invalid transitions (MainMenu -> Loading)', () => {
    const fsm = createGameFSM({} as any);
    fsm.transition(GameState.MainMenu);
    expect(fsm.transition(GameState.Loading)).toBe(false);
    expect(fsm.getCurrentState()).toBe(GameState.MainMenu);
  });

  it('getActivePhases returns correct phases for each state', () => {
    expect(getActivePhases(GameState.Loading)).toEqual([]);
    expect(getActivePhases(GameState.MainMenu)).toEqual([Phase.RENDER]);
    expect(getActivePhases(GameState.Playing)).toEqual([
      Phase.PRE_TURN,
      Phase.ACTION,
      Phase.POST_TURN,
      Phase.RENDER,
    ]);
    expect(getActivePhases(GameState.Paused)).toEqual([Phase.RENDER]);
    expect(getActivePhases(GameState.GameOver)).toEqual([Phase.RENDER]);
  });
});
