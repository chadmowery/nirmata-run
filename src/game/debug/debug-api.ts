import { GameContext } from '../types';
import { ActionIntent } from '@shared/types';

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
    console.log(`[DEBUG] Requested Heat set to ${amount}`);
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
    console.log(`[DEBUG] Requested Kernel Panic Tier ${tier} (${severity}: ${effectName})`);
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
    console.log(`[DEBUG] Requested HP set to ${amount}`);
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
    console.log(`[DEBUG] Requested Stability set to ${amount}`);
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
    console.log(`[DEBUG] Requested status: ${effectName} for ${duration} turns`);
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
    console.log(`[DEBUG] Requested ${amount} scrap`);
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
    console.log(`[DEBUG] Requested ${amount} flux`);
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
    console.log(`[DEBUG] Requested blueprint: ${blueprintId}`);
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
    console.log(`[DEBUG] Requested forced descend of ${count} floors`);
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
    console.log(`[DEBUG] Requested deadzone at player position`);
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
    console.log(`[DEBUG] Requested session clear`);
  }
}
