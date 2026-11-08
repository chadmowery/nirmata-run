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

  private findTargetPos(playerPos: { x: number; y: number }): { x: number; y: number } | null {
    if (!this.context) return null;

    const anchors = this.context.world.query(AnchorMarker, Position);
    const staircases = this.context.world.query(StaircaseMarker, Position);

    const candidates: Array<{ x: number; y: number; priority: number; dist: number }> = [];

    for (const eid of anchors) {
      const pos = this.context.world.getComponent(eid, Position);
      const marker = this.context.world.getComponent(eid, AnchorMarker);
      if (pos) {
        const dist = Math.abs(pos.x - playerPos.x) + Math.abs(pos.y - playerPos.y);
        // Unused anchor is priority 1, used anchor is priority 3
        const priority = marker?.used ? 3 : 1;
        candidates.push({ x: pos.x, y: pos.y, priority, dist });
      }
    }

    for (const eid of staircases) {
      const pos = this.context.world.getComponent(eid, Position);
      if (pos) {
        const dist = Math.abs(pos.x - playerPos.x) + Math.abs(pos.y - playerPos.y);
        // Staircase is priority 1 (co-equal with unused anchor, closest wins)
        candidates.push({ x: pos.x, y: pos.y, priority: 1, dist });
      }
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.dist - b.dist;
    });

    return { x: candidates[0].x, y: candidates[0].y };
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

      const isHostile = this.context.world.hasComponent(occId, Hostile);

      if (avoidHostilesAndProps) {
        // Safe pass: route around hostiles, props, and blocking entities
        if (
          isHostile ||
          this.context.world.hasComponent(occId, Prop) ||
          this.context.world.hasComponent(occId, BlocksMovement)
        ) {
          return false;
        }
      } else {
        // Direct pass: hostiles can be navigated through (player bump-attacks them along the path).
        // Only non-hostile entities that block movement (solid walls, locked doors, lockers) are impassable.
        if (!isHostile && this.context.world.hasComponent(occId, BlocksMovement)) {
          return false;
        }
      }
    }
    return true;
  }

  private computePath(
    playerPos: { x: number; y: number },
    targetPos: { x: number; y: number },
  ): [number, number][] {
    // 1. Direct path: shortest path through the floor geometry (treating hostiles as passable bump-attack targets)
    const directAstar = new AStar(
      targetPos.x,
      targetPos.y,
      (x, y) => this.isTilePassable(x, y, playerPos, targetPos, false),
      { topology: 4 },
    );

    const directPath: [number, number][] = [];
    directAstar.compute(playerPos.x, playerPos.y, (x, y) => {
      directPath.push([x, y]);
    });

    // 2. Safe path: try routing around hostiles/props if an enemy-free path exists with minimal detour
    const safeAstar = new AStar(
      targetPos.x,
      targetPos.y,
      (x, y) => this.isTilePassable(x, y, playerPos, targetPos, true),
      { topology: 4 },
    );

    const safePath: [number, number][] = [];
    safeAstar.compute(playerPos.x, playerPos.y, (x, y) => {
      safePath.push([x, y]);
    });

    // If safe path exists and does not require a significant detour (<= 2 steps longer than direct), prefer it
    if (safePath.length > 0 && (directPath.length === 0 || safePath.length <= directPath.length + 2)) {
      return safePath;
    }

    return directPath;
  }

  private async runLoop(): Promise<void> {
    while (this.isAutoPathing && this.context) {
      if (!this.context.turnManager.canAcceptInput() || !this.context.playerId) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }

      const playerPos = this.context.world.getComponent(this.context.playerId, Position);
      const health = this.context.world.getComponent(this.context.playerId, Health);
      if (!playerPos || (health && (!health.isAlive || health.current <= 0))) {
        this.cancel();
        break;
      }

      // Find Anchor or Staircase
      const targetPos = this.findTargetPos(playerPos);
      if (!targetPos) {
        logger.warn('[DEBUG] No anchor or staircase found on this floor');
        this.cancel();
        break;
      }

      // If already at target tile, arrived!
      if (playerPos.x === targetPos.x && playerPos.y === targetPos.y) {
        logger.info('[DEBUG] Arrived at anchor/stairs');
        this.cancel();
        break;
      }

      const path = this.computePath(playerPos, targetPos);

      if (path.length === 0) {
        logger.warn('[DEBUG] No path found to anchor/stairs');
        this.cancel();
        break;
      }

      // Arrived at destination (path length 1 means player is at targetPos)
      if (path.length <= 1) {
        logger.info('[DEBUG] Arrived at anchor/stairs');
        this.cancel();
        break;
      }

      // Next step along path
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
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }
}
