import type { GameContext } from './types';

let activeGameContext: GameContext | null = null;

/**
 * Sets the active client GameContext singleton and conditionally mirrors to window
 * exclusively in development mode. In production builds, window.gameContext is scrubbed.
 */
export function setActiveGameContext(ctx: GameContext | null): void {
  activeGameContext = ctx;
  if (typeof window !== 'undefined') {
    if (process.env.NODE_ENV === 'development') {
      (window as unknown as { gameContext?: GameContext }).gameContext = ctx ?? undefined;
    } else {
      delete (window as unknown as { gameContext?: GameContext }).gameContext;
    }
  }
}

/**
 * Accesses the active client GameContext without exposing it globally in production.
 */
export function getActiveGameContext(): GameContext | null {
  if (activeGameContext) return activeGameContext;
  if (typeof window !== 'undefined' && (window as unknown as { gameContext?: GameContext }).gameContext) {
    return (window as unknown as { gameContext?: GameContext }).gameContext!;
  }
  return null;
}
