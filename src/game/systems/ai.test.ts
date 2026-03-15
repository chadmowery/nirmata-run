import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAISystem } from './ai';
import { Grid } from '@engine/grid/grid';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { AIState, AIBehavior } from '@shared/components/ai-state';
import { FovAwareness } from '@shared/components/fov-awareness';
import { GameEvents } from '../events/types';

describe('AISystem', () => {
  let world: World;
  let grid: Grid;
  let eventBus: EventBus<GameEvents>;
  let movementSystem: any;
  let aiSystem: any;

  const PLAYER_ID = 1;
  const ENEMY_ID = 2;

  beforeEach(() => {
    grid = new Grid(10, 10);
    // Set all tiles to walkable and transparent by default
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        grid.setTile(x, y, { walkable: true, transparent: true });
      }
    }

    world = {
      query: vi.fn(),
      getComponent: vi.fn(),
      hasComponent: vi.fn(),
    } as any;

    eventBus = {
      emit: vi.fn(),
    } as any;

    movementSystem = {
      processMove: vi.fn(),
    };

    aiSystem = createAISystem(world, grid, movementSystem, eventBus);
  });

  const setupEntities = (playerPos: { x: number, y: number }, enemyPos: { x: number, y: number }) => {
    const playerActor = { isPlayer: true };
    const enemyAI: any = { behavior: AIBehavior.IDLE, sightRadius: 6 };
    const enemyAwareness: any = { canSeePlayer: false };

    vi.mocked(world.query).mockReturnValue([PLAYER_ID]);
    vi.mocked(world.getComponent).mockImplementation((id, comp) => {
      if (id === PLAYER_ID) {
        if (comp === Position) return playerPos;
        if (comp === Actor) return playerActor;
      }
      if (id === ENEMY_ID) {
        if (comp === Position) return enemyPos;
        if (comp === AIState) return enemyAI;
        if (comp === FovAwareness) return enemyAwareness;
      }
      return null;
    });

    return { enemyAI, enemyAwareness };
  };

  describe('FOV Awareness', () => {
    it('should detect player in clear line of sight', () => {
      const { enemyAwareness } = setupEntities({ x: 5, y: 5 }, { x: 2, y: 2 });
      
      aiSystem.processEnemyTurn(ENEMY_ID);

      expect(enemyAwareness.canSeePlayer).toBe(true);
      expect(enemyAwareness.lastKnownPlayerX).toBe(5);
      expect(enemyAwareness.lastKnownPlayerY).toBe(5);
    });

    it('should not detect player behind wall', () => {
      const { enemyAwareness } = setupEntities({ x: 5, y: 5 }, { x: 2, y: 5 });
      grid.setTile(3, 5, { transparent: false });
      
      aiSystem.processEnemyTurn(ENEMY_ID);

      expect(enemyAwareness.canSeePlayer).toBe(false);
    });

    it('should not detect player out of sight radius', () => {
      const { enemyAI, enemyAwareness } = setupEntities({ x: 9, y: 9 }, { x: 0, y: 0 });
      enemyAI.sightRadius = 5;
      
      aiSystem.processEnemyTurn(ENEMY_ID);

      expect(enemyAwareness.canSeePlayer).toBe(false);
    });
  });

  describe('State Transitions', () => {
    it('should transition from IDLE to CHASING when player is spotted', () => {
      const { enemyAI } = setupEntities({ x: 5, y: 5 }, { x: 2, y: 2 });
      enemyAI.behavior = AIBehavior.IDLE;

      aiSystem.processEnemyTurn(ENEMY_ID);

      expect(enemyAI.behavior).toBe(AIBehavior.CHASING);
    });

    it('should transition from CHASING to ATTACKING when adjacent to player', () => {
      const { enemyAI } = setupEntities({ x: 5, y: 5 }, { x: 4, y: 5 });
      enemyAI.behavior = AIBehavior.CHASING;

      aiSystem.processEnemyTurn(ENEMY_ID);

      expect(enemyAI.behavior).toBe(AIBehavior.ATTACKING);
    });

    it('should transition from ATTACKING to CHASING when player moves away', () => {
      const { enemyAI } = setupEntities({ x: 5, y: 5 }, { x: 3, y: 5 });
      enemyAI.behavior = AIBehavior.ATTACKING;

      aiSystem.processEnemyTurn(ENEMY_ID);

      expect(enemyAI.behavior).toBe(AIBehavior.CHASING);
    });

    it('should transition from CHASING to IDLE when player is lost', () => {
      const { enemyAI, enemyAwareness } = setupEntities({ x: 5, y: 5 }, { x: 2, y: 5 });
      grid.setTile(3, 5, { transparent: false });
      enemyAI.behavior = AIBehavior.CHASING;
      enemyAwareness.canSeePlayer = false;
      enemyAwareness.lastKnownPlayerX = undefined;

      aiSystem.processEnemyTurn(ENEMY_ID);

      expect(enemyAI.behavior).toBe(AIBehavior.IDLE);
    });
  });

  describe('Actions', () => {
    it('should move toward player when CHASING', () => {
      setupEntities({ x: 5, y: 5 }, { x: 3, y: 5 });
      const { enemyAI } = setupEntities({ x: 5, y: 5 }, { x: 3, y: 5 });
      enemyAI.behavior = AIBehavior.CHASING;

      aiSystem.processEnemyTurn(ENEMY_ID);

      expect(movementSystem.processMove).toHaveBeenCalledWith(ENEMY_ID, 1, 0);
    });

    it('should trigger bump attack when ATTACKING', () => {
      setupEntities({ x: 5, y: 5 }, { x: 4, y: 5 });
      const { enemyAI } = setupEntities({ x: 5, y: 5 }, { x: 4, y: 5 });
      enemyAI.behavior = AIBehavior.ATTACKING;

      aiSystem.processEnemyTurn(ENEMY_ID);

      expect(movementSystem.processMove).toHaveBeenCalledWith(ENEMY_ID, 1, 0);
    });

    it('should do nothing when IDLE and player not visible', () => {
      setupEntities({ x: 9, y: 9 }, { x: 0, y: 0 });
      const { enemyAI } = setupEntities({ x: 9, y: 9 }, { x: 0, y: 0 });
      enemyAI.behavior = AIBehavior.IDLE;
      enemyAI.sightRadius = 2;

      aiSystem.processEnemyTurn(ENEMY_ID);

      expect(movementSystem.processMove).not.toHaveBeenCalled();
    });
  });

  describe('Pathfinding', () => {
    it('should navigate around an L-shaped wall', () => {
      // Player at (5, 5), Enemy at (3, 5)
      // Wall at (4, 5) and (4, 6)
      const { enemyAI, enemyAwareness } = setupEntities({ x: 5, y: 5 }, { x: 3, y: 5 });
      enemyAI.behavior = AIBehavior.CHASING;
      enemyAwareness.lastKnownPlayerX = 5;
      enemyAwareness.lastKnownPlayerY = 5;
      
      grid.setTile(4, 5, { walkable: false, transparent: false });
      grid.setTile(4, 6, { walkable: false, transparent: false });

      aiSystem.processEnemyTurn(ENEMY_ID);

      // Path should go around, likely North or South
      // (3,5) -> (3,4) or (3,6)
      const call = vi.mocked(movementSystem.processMove).mock.calls[0];
      const dx = call[1];
      const dy = call[2];
      
      // It should NOT move East into the wall
      expect(dx).not.toBe(1);
      // It should move North or South
      expect(Math.abs(dx) + Math.abs(dy)).toBe(1);
    });
  });
});
