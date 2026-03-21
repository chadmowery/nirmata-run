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
    console.log('[SYNC] Refreshing player stats. context.playerId:', context.playerId);
    if (!context.playerId) return;

    const health = world.getComponent(context.playerId, Health);
    const progression = world.getComponent(context.playerId, Progression);

    console.log('[SYNC] Found health:', health, 'progression:', progression);

    gameStore.getState().updatePlayerStats({
      hp: health?.current ?? 0,
      maxHp: health?.max ?? 0,
      xp: progression?.xp ?? 0,
      level: progression?.level ?? 1,
    });
  };

  // 1. Initial Sync
  refreshPlayerStats();
  // REMOVED: gameStore.getState().setGameStatus(context.fsm.getCurrentState() as GameStatus);
  // This was causing a race condition in React by triggering a cleanup/init cycle.
  // The engine emits its own STATE_TRANSITION once it's actually ready.

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

  // Item pickup
  eventBus.on('ITEM_PICKED_UP', (event) => {
    if (event.entityId === context.playerId) {
      refreshPlayerStats();
    }
  });

  // Game Status
  eventBus.on('STATE_TRANSITION', (event) => {
    console.log('[SYNC] STATE_TRANSITION:', event.newState);
    gameStore.getState().setGameStatus(event.newState as GameStatus);
    if (event.newState === GameState.Playing) {
      refreshPlayerStats();
    }
  });

  // Dungeon generation
  eventBus.on('DUNGEON_GENERATED', () => {
    console.log('[SYNC] DUNGEON_GENERATED');
    refreshPlayerStats();
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
        const currentHp = health?.current ?? 0;
        const maxHp = health?.max ?? 1; // Prevent division by zero
        return {
          id: id as number,
          name: sprite?.key || 'Unknown',
          hp: currentHp,
          maxHp: maxHp,
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
