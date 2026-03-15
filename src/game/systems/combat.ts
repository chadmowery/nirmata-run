import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { EntityId } from '@engine/ecs/types';
import { Attack, Defense, LootTable, Health, Position } from '@shared/components';
import { GameEvents } from '../events/types';

import { ComponentRegistry } from '@engine/entity/types';

/**
 * Combat system that resolves damage and handles entity death.
 */
export function createCombatSystem(
  world: World,
  grid: Grid,
  eventBus: EventBus<GameEvents>,
  entityFactory: EntityFactory,
  componentRegistry: ComponentRegistry
) {
  const resolveBumpAttack = (payload: GameEvents['BUMP_ATTACK']) => {
    const { attackerId, defenderId } = payload;

    const attackerAttack = world.getComponent(attackerId, Attack);
    const defenderHealth = world.getComponent(defenderId, Health);
    const defenderDefense = world.getComponent(defenderId, Defense);

    if (!attackerAttack || !defenderHealth) {
      return;
    }

    const armor = defenderDefense?.armor ?? 0;
    const damage = Math.max(1, attackerAttack.power - armor);

    defenderHealth.current = Math.max(0, defenderHealth.current - damage);

    // Update world with new health data
    world.addComponent(defenderId, Health, { ...defenderHealth });

    eventBus.emit('DAMAGE_DEALT', {
      attackerId,
      defenderId,
      amount: damage,
    });

    if (defenderHealth.current <= 0) {
      handleDeath(defenderId, attackerId);
    }
  };

  const handleDeath = (entityId: EntityId, killerId: EntityId) => {
    const pos = world.getComponent(entityId, Position);
    const lootTable = world.getComponent(entityId, LootTable);

    // 1. Grid removal
    if (pos) {
      grid.removeEntity(entityId, pos.x, pos.y);
    }

    // 2. Roll loot table
    if (lootTable && pos) {
      for (const drop of lootTable.drops) {
        if (Math.random() < drop.chance) {
          const itemId = entityFactory.create(
            world,
            drop.template,
            componentRegistry,
            {
              position: { x: pos.x, y: pos.y }
            }
          );
          grid.addItem(itemId, pos.x, pos.y);
        }
      }
    }

    // 3. Emit death event
    eventBus.emit('ENTITY_DIED', { entityId, killerId });

    // 4. Destroy entity
    world.destroyEntity(entityId);
  };

  return {
    init() {
      eventBus.on('BUMP_ATTACK', resolveBumpAttack);
    },

    dispose() {
      eventBus.off('BUMP_ATTACK', resolveBumpAttack);
    }
  };
}

export type CombatSystem = ReturnType<typeof createCombatSystem>;
