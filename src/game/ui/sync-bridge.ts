import { GameContext } from '../types';
import { gameStore, GameStatus } from './store';
import { GameState } from '../states/types';
import { Health } from '@shared/components/health';
import { Progression } from '@shared/components/progression';
import { Position, PositionData } from '@shared/components/position';
import { SpriteComponent } from '@shared/components/sprite';

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

  // FOV updates
  eventBus.on('FOV_UPDATED', (event) => {
    const visibleEntities = world.query(Position)
      .filter(id => {
        // Skip player and only include entities with a position in the visible set
        if (id === context.playerId) return false;
        const pos = world.getComponent(id, Position) as PositionData;
        return pos && event.visibleSet.has(`${pos.x},${pos.y}`);
      })
      .map(id => {
        const health = world.getComponent(id, Health);
        const sprite = world.getComponent(id, SpriteComponent);
        return {
          id: id as number,
          name: sprite?.key || 'Unknown',
          hp: health?.current ?? 0,
          maxHp: health?.max ?? 0,
        };
      });

    gameStore.getState().setVisibleEntities(visibleEntities);
  });

  // Turn tracking
  eventBus.on('TURN_END', (event) => {
    gameStore.getState().updateStats({ turns: event.turnNumber });
  });

  // Entity Death
  eventBus.on('ENTITY_DIED', (event) => {
    if (event.entityId === context.playerId) {
      gameStore.getState().setGameStatus(GameState.GameOver);
    } else {
      // It was an enemy death (likely)
      const currentKills = gameStore.getState().stats.kills;
      gameStore.getState().updateStats({ kills: currentKills + 1 });
    }
  });
}
