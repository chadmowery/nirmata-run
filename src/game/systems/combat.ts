import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { EntityId } from '@engine/ecs/types';
import { Attack, Defense, LootTable, Health, Position, Actor, Heat } from '@shared/components';

import { GameplayEvents } from '@shared/events/types';

import { ComponentRegistry } from '@engine/entity/types';

/**
 * Combat system that resolves damage and handles entity death.
 */
export function createCombatSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  entityFactory: EntityFactory,
  componentRegistry: ComponentRegistry,
  options: { skipLoot?: boolean } = {}
) {
  const resolveBumpAttack = (payload: T['BUMP_ATTACK']) => {
    const { attackerId, defenderId } = payload;

    const attackerAttack = world.getComponent(attackerId, Attack);
    const defenderHealth = world.getComponent(defenderId, Health);
    const defenderDefense = world.getComponent(defenderId, Defense);

    if (!attackerAttack || !defenderHealth) {
      return;
    }

    const armor = defenderDefense?.armor ?? 0;
    const defenderHeat = world.getComponent(defenderId, Heat);
    const effectiveArmor = defenderHeat?.isVenting ? 0 : armor;
    const damage = Math.max(1, attackerAttack.power - effectiveArmor);

    defenderHealth.current = Math.max(0, defenderHealth.current - damage);

    eventBus.emit('DAMAGE_DEALT', {
      attackerId,
      defenderId,
      amount: damage,
    });

    // Emit UI message
    const attackerActor = world.getComponent(attackerId, Actor);
    const defenderActor = world.getComponent(defenderId, Actor);
    const attackerName = attackerActor?.isPlayer ? 'You' : 'The enemy';
    const defenderName = defenderActor?.isPlayer ? 'you' : 'the enemy';
    
    eventBus.emit('MESSAGE_EMITTED', {
      text: `${attackerName} hit ${defenderName} for ${damage} damage.`,
      type: 'combat'
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
    if (!options.skipLoot && lootTable && pos) {
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

    const actor = world.getComponent(entityId, Actor);
    const name = actor?.isPlayer ? 'You' : 'The enemy';
    eventBus.emit('MESSAGE_EMITTED', {
      text: `${name} died!`,
      type: 'combat'
    });

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
