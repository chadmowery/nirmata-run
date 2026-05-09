import { describe, it, expect, beforeEach } from 'vitest';
import { createAISystem } from './ai';
import { Grid } from '@engine/grid/grid';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { AIState, AIBehavior } from '@shared/components/ai-state';
import { FovAwareness } from '@shared/components/fov-awareness';
import { MoveIntent } from '@shared/components/intents';
import { GameplayEvents } from '@shared/events/types';

describe('AISystem', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let aiSystem: any;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);
    
    // Set all tiles to walkable and transparent by default
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        grid.setTile(x, y, { walkable: true, transparent: true });
      }
    }

    aiSystem = createAISystem(world, grid, eventBus);
  });

  const setupEntities = (playerPos: { x: number, y: number }, enemyPos: { x: number, y: number }) => {
    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, playerPos);
    grid.addEntity(playerId, playerPos.x, playerPos.y);

    const enemyId = world.createEntity();
    world.addComponent(enemyId, Position, enemyPos);
    world.addComponent(enemyId, AIState, { behavior: AIBehavior.IDLE, sightRadius: 6, behaviorType: 'vanguard' });
    world.addComponent(enemyId, FovAwareness, { canSeePlayer: false });
    grid.addEntity(enemyId, enemyPos.x, enemyPos.y);

    return { playerId, enemyId };
  };

  describe('FOV Awareness', () => {
    it('should detect player in clear line of sight', () => {
      const { enemyId } = setupEntities({ x: 5, y: 5 }, { x: 2, y: 2 });
      
      aiSystem.processEnemyTurn(enemyId);

      const awareness = world.getComponent(enemyId, FovAwareness);
      expect(awareness?.canSeePlayer).toBe(true);
      expect(awareness?.lastKnownPlayerX).toBe(5);
      expect(awareness?.lastKnownPlayerY).toBe(5);
    });

    it('should not detect player behind wall', () => {
      const { enemyId } = setupEntities({ x: 5, y: 5 }, { x: 2, y: 5 });
      grid.setTile(3, 5, { transparent: false });
      
      aiSystem.processEnemyTurn(enemyId);

      const awareness = world.getComponent(enemyId, FovAwareness);
      expect(awareness?.canSeePlayer).toBe(false);
    });
  });

  describe('State Transitions', () => {
    it('should transition from IDLE to CHASING when player is spotted', () => {
      const { enemyId } = setupEntities({ x: 5, y: 5 }, { x: 2, y: 2 });
      
      aiSystem.processEnemyTurn(enemyId);

      const aiState = world.getComponent(enemyId, AIState);
      expect(aiState?.behavior).toBe(AIBehavior.CHASING);
    });

    it('should transition from CHASING to ATTACKING when adjacent to player', () => {
      const { enemyId } = setupEntities({ x: 5, y: 5 }, { x: 4, y: 5 });
      world.patchComponent(enemyId, AIState, { behavior: AIBehavior.CHASING });

      aiSystem.processEnemyTurn(enemyId);

      const aiState = world.getComponent(enemyId, AIState);
      expect(aiState?.behavior).toBe(AIBehavior.ATTACKING);
    });
  });

  describe('Actions', () => {
    it('should attach MoveIntent toward player when CHASING', () => {
      const { enemyId } = setupEntities({ x: 5, y: 5 }, { x: 3, y: 5 });
      world.patchComponent(enemyId, AIState, { behavior: AIBehavior.CHASING });

      aiSystem.processEnemyTurn(enemyId);

      const intent = world.getComponent(enemyId, MoveIntent);
      expect(intent).toEqual({ dx: 1, dy: 0 });
    });

    it('should attach MoveIntent (which triggers bump attack) when ATTACKING', () => {
      const { enemyId } = setupEntities({ x: 5, y: 5 }, { x: 4, y: 5 });
      world.patchComponent(enemyId, AIState, { behavior: AIBehavior.ATTACKING });

      aiSystem.processEnemyTurn(enemyId);

      const intent = world.getComponent(enemyId, MoveIntent);
      expect(intent).toEqual({ dx: 1, dy: 0 });
    });
  });
});
