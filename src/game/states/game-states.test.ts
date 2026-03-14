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
      'Playing',
      'Paused',
      'GameOver',
    ]);
  });

  it('GAME_TRANSITIONS has exactly 7 entries', () => {
    expect(GAME_TRANSITIONS.length).toBe(7);
  });

  it('createGameFSM starts at Loading state', () => {
    const fsm = createGameFSM();
    expect(fsm.getCurrentState()).toBe(GameState.Loading);
  });

  it('createGameFSM follows valid transition path (Loading -> MainMenu -> Playing)', () => {
    const fsm = createGameFSM();
    expect(fsm.transition(GameState.MainMenu)).toBe(true);
    expect(fsm.transition(GameState.Playing)).toBe(true);
    expect(fsm.getCurrentState()).toBe(GameState.Playing);
  });

  it('createGameFSM rejects invalid transitions (Loading -> Playing)', () => {
    const fsm = createGameFSM();
    expect(fsm.transition(GameState.Playing)).toBe(false);
    expect(fsm.getCurrentState()).toBe(GameState.Loading);
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
