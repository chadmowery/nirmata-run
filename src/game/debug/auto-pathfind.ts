import AStar from 'rot-js/lib/path/astar';
import { GameContext } from '../types';
import { AnchorMarker, Position, StaircaseMarker } from '@shared/components';
import { GameAction, DIRECTIONS } from '../input/actions';
import { ActionIntent } from '@shared/types';
import { logger } from '@shared/utils/logger';

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
    getActionIntent: (action: GameAction) => ActionIntent | null
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

  private async runLoop(): Promise<void> {
    while (this.isAutoPathing && this.context) {
      if (!this.context.turnManager.canAcceptInput() || !this.context.playerId) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      const playerPos = this.context.world.getComponent(this.context.playerId, Position);
      if (!playerPos) {
        this.cancel();
        break;
      }

      // Find Anchor or Staircase
      const anchors = this.context.world.query(AnchorMarker, Position);
      const staircases = this.context.world.query(StaircaseMarker, Position);
      let anchorPos: { x: number, y: number } | null = null;
      
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

      // Pathfind
      const astar = new AStar(anchorPos.x, anchorPos.y, (x, y) => {
        if (x === playerPos.x && y === playerPos.y) return true;
        if (x === anchorPos!.x && y === anchorPos!.y) return true;
        return this.context!.grid.isWalkable(x, y);
      }, { topology: 4 });

      const path: [number, number][] = [];
      astar.compute(playerPos.x, playerPos.y, (x, y) => {
        path.push([x, y]);
      });

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
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
