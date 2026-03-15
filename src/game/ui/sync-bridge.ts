import { GameContext } from '../types';
import { gameStore, GameStatus } from './store';
import { EntityId } from '@engine/ecs/types';
import { Health } from '@shared/components/health';
import { Progression } from '@shared/components/progression';

export function syncEngineToStore(context: GameContext) {
  const { eventBus, world } = context;

  // Helper to update player stats from world state
  const refreshPlayerStats = () => {
    if (!context.playerId) return;

    const health = world.getComponent(context.playerId, Health);
    const progression = world.getComponent(context.playerId, Progression);

    gameStore.getState().updatePlayerStats({
      hp: health?.current ?? 0,
      maxHp: health?.max ?? 0,
      xp: progression?.xp ?? 0,
      level: progression?.level ?? 1,
    });
  };

  // 1. Initial Sync
  refreshPlayerStats();
  gameStore.getState().setGameStatus(context.fsm.getCurrentState() as GameStatus);

  // 2. Register Listeners
  
  // Health updates
  eventBus.on('DAMAGE_DEALT', (event) => {
    if (event.defenderId === context.playerId) {
      refreshPlayerStats();
    }
  });

  eventBus.on('HEALED', (event) => {
    if (event.entityId === context.playerId) {
      refreshPlayerStats();
    }
  });

  // XP / Level updates
  eventBus.on('XP_GAINED', (event) => {
    if (event.entityId === context.playerId) {
      refreshPlayerStats();
    }
  });

  // Messages
  eventBus.on('MESSAGE_EMITTED', (event) => {
    gameStore.getState().addMessage(event.text, event.type);
  });

  // Game Status
  eventBus.on('STATE_TRANSITION', (event) => {
    gameStore.getState().setGameStatus(event.newState as GameStatus);
  });

  // Entity Death messages (optional, could be done via MESSAGE_EMITTED too)
  eventBus.on('ENTITY_DIED', (event) => {
    // If we want specific UI feedback for deaths
  });
}
