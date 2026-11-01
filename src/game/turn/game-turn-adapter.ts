import { World } from '@engine/ecs/world';
import { EntityId } from '@engine/ecs/types';
import { TurnSchedulerAdapter } from '@engine/turn/types';
import { EngineEvents } from '@engine/events/types';
import { Actor, Energy, Health, Acting, StatusEffects, Dying } from '@shared/components';

export interface GameTurnAdapterConfig {
  defaultActionCost?: number;
  waitActionCost?: number;
}

/**
 * Concrete turn scheduler adapter connecting the generic engine TurnManager
 * to Nirmata Runner's ECS components (Actor, Energy, Health, Acting, Dying).
 */
export class GameTurnAdapter<
  TEvents extends EngineEvents = EngineEvents,
> implements TurnSchedulerAdapter<EntityId> {
  constructor(
    private world: World<TEvents>,
    private config?: GameTurnAdapterConfig,
  ) {}

  getCandidateActors(): EntityId[] {
    return this.world.query(Actor, Energy);
  }

  isActorActive(actorId: EntityId): boolean {
    if (!this.world.entityExists(actorId)) return false;
    if (this.world.hasComponent(actorId, Dying)) return false;
    const health = this.world.getComponent(actorId, Health);
    return !health || health.isAlive;
  }

  canActorAct(actorId: EntityId, threshold: number): boolean {
    if (!this.world.entityExists(actorId) || this.world.hasComponent(actorId, Dying)) return false;
    const energy = this.world.getComponent(actorId, Energy);
    return Boolean(energy && energy.current >= threshold);
  }

  accumulateEnergy(actorId: EntityId): void {
    if (!this.world.entityExists(actorId) || this.world.hasComponent(actorId, Dying)) return;
    const energy = this.world.getComponent(actorId, Energy);
    if (energy) {
      const currentData = { ...energy };
      currentData.current += currentData.speed;
      this.world.addComponent(actorId, Energy, currentData);
    }
  }

  deductActionCost(actorId: EntityId, cost: number): void {
    if (!this.world.entityExists(actorId)) return;
    const energy = this.world.getComponent(actorId, Energy);
    if (energy) {
      const updatedData = { ...energy, current: energy.current - cost };
      this.world.addComponent(actorId, Energy, updatedData);
    }
  }

  isPrimaryActor(actorId: EntityId): boolean {
    if (!this.world.entityExists(actorId)) return false;
    const actor = this.world.getComponent(actorId, Actor);
    return Boolean(actor?.isPlayer);
  }

  getPrimaryActor(): EntityId | null {
    const actors = this.world.query(Actor);
    for (const id of actors) {
      const actor = this.world.getComponent(id, Actor);
      if (actor?.isPlayer) return id;
    }
    return null;
  }

  getActionCost(actorId: EntityId, action: string): number {
    if (!this.world.entityExists(actorId)) return 1000;
    if (action === 'WAIT') {
      return this.config?.waitActionCost ?? 500;
    }
    let cost = this.config?.defaultActionCost ?? 1000;

    // DESIGN-03: Wire MOVEMENT_SLOW into movement action cost
    if (action.startsWith('MOVE') || action === 'MOVE') {
      const statusEffects = this.world.getComponent(actorId, StatusEffects);
      const slow = statusEffects?.effects.find((e) => e.name === 'MOVEMENT_SLOW');
      if (slow) {
        const magnitude = slow.magnitude || 50;
        cost = Math.round(cost * (1 + magnitude / 100));
      }
    }

    return cost;
  }

  onBeforeActorAct(actorId: EntityId): void {
    if (!this.world.entityExists(actorId) || this.world.hasComponent(actorId, Dying)) return;
    this.world.addComponent(actorId, Acting, {});
  }

  onAfterActorAct(actorId: EntityId): void {
    if (!this.world.entityExists(actorId)) return;
    if (this.world.hasComponent(actorId, Acting)) {
      this.world.removeComponent(actorId, Acting);
    }
  }
}
