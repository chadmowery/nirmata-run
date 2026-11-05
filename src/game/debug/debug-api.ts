import { GameContext } from '../types';
import { ActionIntent } from '@shared/types';
import { logger } from '@engine/utils/logger';

export type SendActionFn = (intent: ActionIntent) => Promise<void>;

export class DebugAPI {
  private context: GameContext;
  private sendAction: SendActionFn;

  constructor(context: GameContext, sendAction: SendActionFn) {
    this.context = context;
    this.sendAction = sendAction;
  }

  /**
   * Sets the player's heat to a specific value.
   */
  async setHeat(amount: number) {
    await this.sendAction({
      type: 'DEBUG_COMMAND',
      command: 'SET_HEAT',
      args: { amount },
    });
    logger.debug(`Requested Heat set to ${amount}`, 'DEBUG');
  }

  /**
   * Immediately forces a kernel panic consequence.
   */
  async triggerPanic(tier: number = 1, severity?: string, effectName?: string) {
    await this.sendAction({
      type: 'DEBUG_COMMAND',
      command: 'TRIGGER_PANIC',
      args: { tier, severity, effectName },
    });
    logger.debug(`Requested Kernel Panic Tier ${tier} (${severity}: ${effectName})`, 'DEBUG');
  }

  /**
   * Sets the player's health to a specific value.
   */
  async setHp(amount: number) {
    await this.sendAction({
      type: 'DEBUG_COMMAND',
      command: 'SET_HP',
      args: { amount },
    });
    logger.debug(`Requested HP set to ${amount}`, 'DEBUG');
  }

  /**
   * Modifies the stability meter.
   */
  async setStability(amount: number) {
    await this.sendAction({
      type: 'DEBUG_COMMAND',
      command: 'SET_STABILITY',
      args: { amount },
    });
    logger.debug(`Requested Stability set to ${amount}`, 'DEBUG');
  }

  /**
   * Applies a status effect.
   */
  async status(effectName: string, duration: number = 5) {
    // Note: We'll reuse SET_HP logic or similar if we wanted, but let's assume server handler supports 'STATUS'
    await this.sendAction({
      type: 'DEBUG_COMMAND',
      command: 'STATUS',
      args: { effectName, duration },
    });
    logger.debug(`Requested status: ${effectName} for ${duration} turns`, 'DEBUG');
  }

  /**
   * Spawns scrap and picks it up.
   */
  async giveScrap(amount: number = 100) {
    await this.sendAction({
      type: 'DEBUG_COMMAND',
      command: 'GIVE_CURRENCY',
      args: { type: 'scrap', amount },
    });
    logger.debug(`Requested ${amount} scrap`, 'DEBUG');
  }

  /**
   * Spawns flux and picks it up.
   */
  async giveFlux(amount: number = 10) {
    await this.sendAction({
      type: 'DEBUG_COMMAND',
      command: 'GIVE_CURRENCY',
      args: { type: 'flux', amount },
    });
    logger.debug(`Requested ${amount} flux`, 'DEBUG');
  }

  /**
   * Spawns a blueprint drop.
   */
  async giveBlueprint(blueprintId: string = 'debug_bp_1') {
    await this.sendAction({
      type: 'DEBUG_COMMAND',
      command: 'GIVE_CURRENCY',
      args: { type: 'blueprint', amount: 1, blueprintId },
    });
    logger.debug(`Requested blueprint: ${blueprintId}`, 'DEBUG');
  }

  /**
   * Forces a floor transition descent.
   */
  async descend(count: number = 1) {
    // We already have a STAIRCASE_DESCEND intent, but for debug we might want to force it
    await this.sendAction({
      type: 'DEBUG_COMMAND',
      command: 'DESCEND',
      args: { count },
    });
    logger.debug(`Requested forced descend of ${count} floors`, 'DEBUG');
  }

  /**
   * Spawns a dead zone tile under the player.
   */
  async deadzone() {
    await this.sendAction({
      type: 'DEBUG_COMMAND',
      command: 'SPAWN_DEADZONE',
      args: { duration: 5 },
    });
    logger.debug(`Requested deadzone at player position`, 'DEBUG');
  }
  /**
   * Clears all server sessions.
   */
  async clearSessions() {
    await this.sendAction({
      type: 'DEBUG_COMMAND',
      command: 'CLEAR_SESSIONS',
      args: {},
    });
    logger.debug(`Requested session clear`, 'DEBUG');
  }

  /**
   * Gives 1 of every item type to player vault (up to max slots) and 1000 of every currency.
   */
  async grantAll(sessionId?: string) {
    const sid =
      sessionId ||
      this.context.sessionId ||
      (typeof window !== 'undefined'
        ? window.localStorage?.getItem('nimrata_sessionId') || 'default-player-session'
        : 'default-player-session');

    try {
      const res = await fetch('/api/admin/grant-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });
      if (res.ok) {
        const data = await res.json();
        const { gameStore } = await import('@/game/ui/store');
        if (data.profile) {
          gameStore.getState().setPlayerProfile(data.profile);
        }
        logger.info(
          `[DebugAPI] GrantAll success: ${data.result.itemsGranted} items, scrap: ${data.wallet.scrap}, flux: ${data.wallet.flux}`,
          'DEBUG',
        );
        return data;
      }
    } catch (err) {
      logger.error('[DebugAPI] GrantAll failed:', 'DEBUG', err);
    }

    await this.sendAction({
      type: 'DEBUG_COMMAND',
      command: 'GRANT_ALL',
      args: { sessionId: sid },
    });
  }

  /**
   * Alias for grantAll.
   */
  async seedVault(sessionId?: string) {
    return this.grantAll(sessionId);
  }

  /**
   * Fully exposes the map tiles and removes fog of war.
   */
  exposeMap(): void {
    this.context.eventBus.emit('DEBUG_REVEAL_MAP', {});
    logger.info('DEBUG: Map fully revealed', 'DEBUG');
  }

  /**
   * Alias for exposeMap.
   */
  revealMap(): void {
    this.exposeMap();
  }

  /**
   * Shows the entire floor map and clears fog of war (triggered by /show-map).
   */
  showMap(): void {
    this.exposeMap();
  }
}
