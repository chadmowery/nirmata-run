import AStar from 'rot-js/lib/path/astar';
import { GameContext } from '@/game/types';
import {
  AnchorMarker,
  Health,
  Position,
  StaircaseMarker,
  BlocksMovement,
  Hostile,
  Prop,
} from '@shared/components';
import { GameAction, DIRECTIONS } from '@/game/input/actions';
import { ActionIntent } from '@shared/types';
import { logger } from '@engine/utils/logger';

/**
 * Handles automatic pathfinding to the floor's anchor (staircase).
 */
export class AutoPathfinder {
  private isAutoPathing: boolean = false;
  private context: GameContext | null = null;
  private sendActionToServer: (intent: ActionIntent | null) => Promise<void>;
  private getActionIntent: (action: GameAction) => ActionIntent | null;

  constructor(
    sendActionToServer: (intent: ActionIntent | null) => Promise<void>,
    getActionIntent: (action: GameAction) => ActionIntent | null,
  ) {
    this.sendActionToServer = sendActionToServer;
    this.getActionIntent = getActionIntent;
  }

  setContext(context: GameContext): void {
    this.context = context;
  }

  toggle(): void {
    if (this.isAutoPathing) {
      this.cancel();
    } else {
      this.start();
    }
  }

  start(): void {
    if (this.isAutoPathing || !this.context) return;
    this.isAutoPathing = true;
    logger.info('[DEBUG] Starting auto-pathfinding to anchor');
    this.runLoop();
  }

  cancel(): void {
    if (this.isAutoPathing) {
      this.isAutoPathing = false;
      logger.info('[DEBUG] Auto-pathfinding cancelled');
    }
  }

  isActive(): boolean {
    return this.isAutoPathing;
  }

  private isTilePassable(
    x: number,
    y: number,
    playerPos: { x: number; y: number },
    targetPos: { x: number; y: number },
    avoidHostilesAndProps: boolean,
  ): boolean {
    if (!this.context) return false;
    if (x === playerPos.x && y === playerPos.y) return true;
    if (x === targetPos.x && y === targetPos.y) return true;
    if (!this.context.grid.isWalkable(x, y)) return false;

    const occupants = this.context.grid.getEntitiesAt(x, y);
    for (const occId of occupants) {
      if (occId === this.context.playerId) continue;

      // Entities that strictly block physical movement are impassable
      if (this.context.world.hasComponent(occId, BlocksMovement)) {
        return false;
      }

      if (avoidHostilesAndProps) {
        // Safe pass: route around hostiles and props to reach anchor cleanly
        if (
          this.context.world.hasComponent(occId, Hostile) ||
          this.context.world.hasComponent(occId, Prop)
        ) {
          return false;
        }
      }
    }
    return true;
  }

  private computePath(
    playerPos: { x: number; y: number },
    anchorPos: { x: number; y: number },
  ): [number, number][] {
    // Pass 1: Try safe navigation avoiding hostiles and hazard props
    const safeAstar = new AStar(
      anchorPos.x,
      anchorPos.y,
      (x, y) => this.isTilePassable(x, y, playerPos, anchorPos, true),
      { topology: 4 },
    );

    let path: [number, number][] = [];
    safeAstar.compute(playerPos.x, playerPos.y, (x, y) => {
      path.push([x, y]);
    });

    if (path.length > 0) {
      return path;
    }

    // Pass 2: Fallback when corridor is blocked by hostiles/props; navigate through hostiles to engage
    const directAstar = new AStar(
      anchorPos.x,
      anchorPos.y,
      (x, y) => this.isTilePassable(x, y, playerPos, anchorPos, false),
      { topology: 4 },
    );

    path = [];
    directAstar.compute(playerPos.x, playerPos.y, (x, y) => {
      path.push([x, y]);
    });

    return path;
  }

  private async runLoop(): Promise<void> {
    while (this.isAutoPathing && this.context) {
      if (!this.context.turnManager.canAcceptInput() || !this.context.playerId) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      const playerPos = this.context.world.getComponent(this.context.playerId, Position);
      const health = this.context.world.getComponent(this.context.playerId, Health);
      if (!playerPos || (health && !health.isAlive)) {
        this.cancel();
        break;
      }

      // Find Anchor or Staircase
      const anchors = this.context.world.query(AnchorMarker, Position);
      const staircases = this.context.world.query(StaircaseMarker, Position);
      let anchorPos: { x: number; y: number } | null = null;

      if (anchors.length > 0) {
        anchorPos = this.context.world.getComponent(anchors[0], Position)!;
      } else if (staircases.length > 0) {
        anchorPos = this.context.world.getComponent(staircases[0], Position)!;
      }

      if (!anchorPos) {
        logger.warn('[DEBUG] No anchor found on this floor');
        this.cancel();
        break;
      }

      const path = this.computePath(playerPos, anchorPos);

      if (path.length === 0) {
        logger.warn('[DEBUG] No path found to anchor');
        this.cancel();
        break;
      }

      // Stop if 1 tile away (path length is 2: [player, neighbor])
      if (path.length <= 2) {
        logger.info('[DEBUG] Arrived near anchor');
        this.cancel();
        break;
      }

      // Next step
      const nextStep = path[1];
      const dx = nextStep[0] - playerPos.x;
      const dy = nextStep[1] - playerPos.y;

      // Determine GameAction
      let action: GameAction | null = null;
      for (const [key, dir] of Object.entries(DIRECTIONS)) {
        if (dir.dx === dx && dir.dy === dy) {
          action = key as GameAction;
          break;
        }
      }

      if (action) {
        const intent = this.getActionIntent(action);
        if (intent) {
          // Prediction
          this.context.turnManager.submitAction(action);
          // Actual (async)
          await this.sendActionToServer(intent);
        }
      }

      // Small delay to allow state to settle
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
