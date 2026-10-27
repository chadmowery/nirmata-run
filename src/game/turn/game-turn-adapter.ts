import { World } from '@engine/ecs/world';
import { EntityId } from '@engine/ecs/types';
import { TurnSchedulerAdapter } from '@engine/turn/types';
import { EngineEvents } from '@engine/events/types';
import { Actor, Energy, Health, Acting } from '@shared/components';

export interface GameTurnAdapterConfig {
  defaultActionCost?: number;
  waitActionCost?: number;
}

/**
 * Concrete turn scheduler adapter connecting the generic engine TurnManager
 * to Nirmata Runner's ECS components (Actor, Energy, Health, Acting).
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
    const health = this.world.getComponent(actorId, Health);
    return !health || health.isAlive;
  }

  canActorAct(actorId: EntityId, threshold: number): boolean {
    const energy = this.world.getComponent(actorId, Energy);
    return Boolean(energy && energy.current >= threshold);
  }

  accumulateEnergy(actorId: EntityId): void {
    const energy = this.world.getComponent(actorId, Energy);
    if (energy) {
      const currentData = { ...energy };
      currentData.current += currentData.speed;
      this.world.addComponent(actorId, Energy, currentData);
    }
  }

  deductActionCost(actorId: EntityId, cost: number): void {
    const energy = this.world.getComponent(actorId, Energy);
    if (energy) {
      const updatedData = { ...energy, current: energy.current - cost };
      this.world.addComponent(actorId, Energy, updatedData);
    }
  }

  isPrimaryActor(actorId: EntityId): boolean {
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

  getActionCost(_actorId: EntityId, action: string): number {
    if (action === 'WAIT') {
      return this.config?.waitActionCost ?? 500;
    }
    return this.config?.defaultActionCost ?? 1000;
  }

  onBeforeActorAct(actorId: EntityId): void {
    this.world.addComponent(actorId, Acting, {});
  }

  onAfterActorAct(actorId: EntityId): void {
    this.world.removeComponent(actorId, Acting);
  }
}
