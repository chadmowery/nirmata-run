import { Phase } from '../../engine/ecs/types';
import { StateMachine } from '../../engine/state-machine/state-machine';
import { StateConfig, TransitionTable } from '../../engine/state-machine/types';
import { GameState } from './types';

import { GameContext } from '../types';

export const GAME_TRANSITIONS: TransitionTable<GameState> = [
  [GameState.Loading, GameState.MainMenu],
  [GameState.Loading, GameState.Playing],
  [GameState.MainMenu, GameState.Hub],
  [GameState.MainMenu, GameState.Playing],
  [GameState.Hub, GameState.Playing],
  [GameState.Hub, GameState.MainMenu],
  [GameState.Playing, GameState.Hub],
  [GameState.Playing, GameState.Paused],
  [GameState.Playing, GameState.GameOver],
  [GameState.Paused, GameState.Playing],
  [GameState.Paused, GameState.MainMenu],
  [GameState.GameOver, GameState.Hub],
  [GameState.GameOver, GameState.MainMenu],
];

export const ACTIVE_PHASES: Record<GameState, Phase[]> = {
  [GameState.Loading]: [],
  [GameState.MainMenu]: [Phase.RENDER],
  [GameState.Hub]: [Phase.RENDER],
  [GameState.Playing]: [Phase.PRE_TURN, Phase.ACTION, Phase.POST_TURN, Phase.RENDER],
  [GameState.Paused]: [Phase.RENDER],
  [GameState.GameOver]: [Phase.RENDER],
};

export const GAME_STATE_CONFIGS: Record<GameState, StateConfig<GameState, GameContext>> = {
  [GameState.Loading]: {},
  [GameState.MainMenu]: {},
  [GameState.Hub]: {},
  [GameState.Playing]: {},
  [GameState.Paused]: {},
  [GameState.GameOver]: {},
};

export function getActivePhases(state: GameState): Phase[] {
  return ACTIVE_PHASES[state];
}

export function createGameFSM(context: GameContext): StateMachine<GameState, GameContext> {
  return new StateMachine<GameState, GameContext>(
    GameState.Loading,
    GAME_STATE_CONFIGS,
    GAME_TRANSITIONS,
    context
  );
}
