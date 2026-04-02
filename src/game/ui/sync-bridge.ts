import { GameContext } from '../types';
import { gameStore, GameStatus } from './store';
import { GameState } from '../states/types';
import { Health } from '@shared/components/health';
import { Progression } from '@shared/components/progression';
import { Position, PositionData } from '@shared/components/position';
import { SpriteComponent } from '@shared/components/sprite';
import { Stability } from '@shared/components/stability';
import { Scrap } from '@shared/components/scrap';
import { FloorState } from '@shared/components/floor-state';
import { FirmwareSlots } from '@shared/components/firmware-slots';
import { AugmentSlots } from '@shared/components/augment-slots';
import { SoftwareSlots } from '@shared/components/software-slots';
import { getDepthBand } from '../generation/dungeon-generator';

export function syncEngineToStore(context: GameContext) {
  const { eventBus, world } = context;

  // Helper to update player stats from world state
  const refreshPlayerStats = () => {
    console.log('[SYNC] Refreshing player stats. context.playerId:', context.playerId);
    if (!context.playerId) return;

    const health = world.getComponent(context.playerId, Health);
    const progression = world.getComponent(context.playerId, Progression);
    const stability = world.getComponent(context.playerId, Stability);
    const scrap = world.getComponent(context.playerId, Scrap);
    const floorState = world.getComponent(context.playerId, FloorState);

    console.log('[SYNC] Found health:', health, 'progression:', progression);

    const store = gameStore.getState();
    store.updatePlayerStats({
      hp: health?.current ?? 0,
      maxHp: health?.max ?? 0,
      xp: progression?.xp ?? 0,
      level: progression?.level ?? 1,
    });

    if (stability) {
      store.updateStability(stability.current, stability.max);
    }

    if (scrap) {
      store.updateScrap(scrap.amount);
    }

    if (floorState) {
      const band = getDepthBand(floorState.currentFloor);
      store.updateFloor(floorState.currentFloor, band ? band.label : 'Unknown');
    }
  };

  // Helper to update specific visible entity's health
  const updateVisibleEntityHealth = (entityId: number) => {
    const state = gameStore.getState();
    const entityIndex = state.visibleEntities.findIndex(e => e.id === entityId);
    if (entityIndex !== -1) {
      const health = world.getComponent(entityId, Health);
      if (health) {
        const updatedEntities = [...state.visibleEntities];
        updatedEntities[entityIndex] = {
          ...updatedEntities[entityIndex],
          hp: health.current,
          maxHp: health.max,
        };
        state.setVisibleEntities(updatedEntities);
      }
    }
  };

  // 1. Initial Sync
  refreshPlayerStats();
  // REMOVED: gameStore.getState().setGameStatus(context.fsm.getCurrentState() as GameStatus);
  // This was causing a race condition in React by triggering a cleanup/init cycle.
  // The engine emits its own STATE_TRANSITION once it's actually ready.

  // Local tracking for run stats
  let peakHeat = 0;
  
  // Register Listeners

  // Health updates
  eventBus.on('DAMAGE_DEALT', (event) => {
    if (event.defenderId === context.playerId) {
      refreshPlayerStats();
    } else {
      updateVisibleEntityHealth(event.defenderId);
    }
  });

  eventBus.on('HEALED', (event) => {
    if (event.entityId === context.playerId) {
      refreshPlayerStats();
    } else {
      updateVisibleEntityHealth(event.entityId);
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

  // TURN_END listener
  eventBus.on('TURN_END', (event) => {
    gameStore.getState().updateStats({ turns: event.turnNumber });
    refreshPlayerStats(); // Refresh everything each turn
  });

  // Heat updates
  eventBus.on('HEAT_CHANGED', (event) => {
    if (event.entityId === context.playerId) {
      if (event.newHeat > peakHeat) {
        peakHeat = event.newHeat;
      }
      refreshPlayerStats();
    }
  });

  // Stability updates
  eventBus.on('STABILITY_CHANGED', (event) => {
    if (event.entityId === context.playerId) {
      refreshPlayerStats();
    }
  });

  // Floor updates
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  eventBus.on('FLOOR_TRANSITION', (event) => {
    refreshPlayerStats();
  });

  // Anchor interaction - show overlay
  eventBus.on('ANCHOR_INTERACTION', (event) => {
    if (event.entityId === context.playerId) {
      gameStore.getState().showAnchorOverlay({
        floorNumber: event.floorNumber,
        stabilityPercent: event.stabilityPercent,
        inventory: event.inventory,
        descendCost: event.descendCost,
        nextFloorEnemyTier: event.nextFloorEnemyTier,
        estimatedStabilityAfterDescent: event.estimatedStabilityAfterDescent,
        anchorId: event.anchorId
      });
    }
  });

  // Staircase interaction - show overlay
  eventBus.on('STAIRCASE_INTERACTION', (event) => {
    if (event.entityId === context.playerId) {
      gameStore.getState().showStaircaseOverlay({
        targetFloor: event.targetFloor,
        staircaseId: event.staircaseId
      });
    }
  });

  // Helper to process run ending (Shared by extraction and death)
  const handleRunEnd = (reason: string, floorNumber: number) => {
    const player = context.playerId;
    let firmwareCount = 0;
    let augmentCount = 0;
    let softwareCount = 0;

    if (player) {
      const fSlots = world.getComponent(player, FirmwareSlots);
      const aSlots = world.getComponent(player, AugmentSlots);
      const sSlots = world.getComponent(player, SoftwareSlots);
      
      firmwareCount = fSlots?.equipped.length ?? 0;
      augmentCount = aSlots?.equipped.length ?? 0;
      softwareCount = sSlots?.equipped.length ?? 0;
    }

    const runScrap = gameStore.getState().scrap;
    const isExtraction = reason.toLowerCase() === 'extraction';
    
    // Add scrap to wallet ON EXTRACTION
    if (isExtraction) {
      gameStore.getState().addScrapToWallet(runScrap);
    }

    const results = {
      reason,
      floorNumber,
      enemiesKilled: gameStore.getState().stats.kills,
      turnsElapsed: gameStore.getState().stats.turns,
      peakHeat: Math.round(peakHeat),
      itemsSecured: { 
        firmware: firmwareCount, 
        augments: augmentCount, 
        software: softwareCount, 
        scrap: runScrap 
      },
      score: (floorNumber * 100) + (gameStore.getState().stats.kills * 10) + runScrap
    };

    if (isExtraction) {
      gameStore.getState().showRunResults(results);
    } else {
      gameStore.getState().showBSOD(reason);
      gameStore.getState().setRunResultsData(results);
    }

    // Always transition to GameOver status to stop engine input
    gameStore.getState().setGameStatus(GameState.GameOver);
  };

  // Run End handler
  eventBus.on('RUN_ENDED', (event) => {
    handleRunEnd(event.reason, event.floorNumber);
  });

  // Entity Death
  eventBus.on('ENTITY_DIED', (event) => {
    if (event.entityId === context.playerId) {
      const floorState = world.getComponent(context.playerId, FloorState);
      handleRunEnd('CRITICAL_SYSTEM_FAILURE', floorState?.currentFloor ?? 1);
    } else {
      // It was an enemy death (likely)
      const state = gameStore.getState();
      const currentKills = state.stats.kills;
      state.updateStats({ kills: currentKills + 1 });

      // Remove dead entity from visible threats
      const updatedEntities = state.visibleEntities.filter(e => e.id !== event.entityId);
      state.setVisibleEntities(updatedEntities);
    }
  });
}
