import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { ComponentRegistry } from '@engine/entity/types';
import { Phase } from '@engine/ecs/types';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from '../events/types';
import { LootTable, Position, Actor, Dying } from '@shared/components';
import economyRaw from '../entities/templates/economy.json';
import { EconomyConfig, BlueprintDropConfig, DropRateConfig } from '@shared/economy-types';
import { logger } from '@/shared/utils/logger';

const economy = economyRaw as unknown as EconomyConfig;


/**
 * System that handles currency and equipment drops when entities die.
 * Also handles authoritative "On Kill" software effects.
 */
export function createRewardDropSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  entityFactory: EntityFactory,
  componentRegistry: ComponentRegistry
) {
  const update = (w: World<T>) => {
    const dyingEntities = w.query(Dying);
    for (const entityId of dyingEntities) {
      const actor = w.getComponent(entityId, Actor);
      const pos = w.getComponent(entityId, Position);
      const lootTable = w.getComponent(entityId, LootTable);


      // Drop logic: Skip if no position or if it's the player
      if (!pos || (actor && actor.isPlayer)) {
        continue;
      }

      // 1. Roll for Equipment (LootTable)
      if (lootTable) {
        for (const drop of lootTable.drops) {
          if (Math.random() < drop.chance) {
            const itemId = entityFactory.create(
              w,
              drop.template,
              componentRegistry,
              { position: { x: pos.x, y: pos.y } }
            );
            grid.addItem(itemId, pos.x, pos.y);
            // Equipment is added as an item on the grid
          }
        }
      }

      // 2. Roll for Currency (Economy based)
      const tier = lootTable?.tier ?? 1;
      const tierKey = `tier${tier}` as keyof typeof economy.currencyDrops.scrap;

      // Roll for Scrap
      const scrapConfig = economy.currencyDrops.scrap[tierKey];
      if (scrapConfig && Math.random() <= scrapConfig.chance) {
        const amount = Math.floor(Math.random() * (scrapConfig.max - scrapConfig.min + 1)) + scrapConfig.min;
        spawnCurrency(w, 'scrap', amount, pos.x, pos.y);
        logger.info(`[RewardDropSystem] Dropped scrap: ${amount}`);
      }

      // Roll for Flux
      const fluxConfig = economy.currencyDrops.flux[tierKey] as DropRateConfig | undefined;
      if (fluxConfig && Math.random() <= fluxConfig.chance) {
        const amount = Math.floor(Math.random() * (fluxConfig.max - fluxConfig.min + 1)) + fluxConfig.min;
        spawnCurrency(w, 'flux', amount, pos.x, pos.y);
        logger.info(`[RewardDropSystem] Dropped flux: ${amount}`);
      }

      // Roll for Blueprint
      const blueprintConfig = economy.currencyDrops.blueprint[tierKey] as BlueprintDropConfig | undefined;
      if (blueprintConfig && Math.random() <= 1.0) { // blueprintConfig.chance) {
        const blueprintPool = [
          'Phase_Shift.sh',
          'Neural_Spike.exe',
          'Extended_Sight.sys',
          'Displacement_Venting.arc',
          'Static_Siphon.arc',
          'Neural_Feedback.arc'
        ];
        const blueprintId = blueprintPool[Math.floor(Math.random() * blueprintPool.length)];
        const blueprintType = blueprintId.endsWith('.arc') ? 'augment' : 'firmware';

        spawnCurrency(w, 'blueprint', 1, pos.x, pos.y, { blueprintId, blueprintType });
        logger.info(`[RewardDropSystem] Dropped blueprint: ${blueprintId}`);
      }
    }
  };

  const init = () => {
    world.registerSystem(Phase.CLEANUP, update);
  };

  const dispose = () => {
    world.unregisterSystem(Phase.CLEANUP, update);
  };

  const spawnCurrency = (
    world: World<T>,
    type: 'scrap' | 'flux' | 'blueprint',
    amount: number,
    x: number,
    y: number,
    meta?: { blueprintId: string; blueprintType: 'firmware' | 'augment' }
  ) => {
    const templateName = type === 'blueprint' ? 'blueprint-locked' : type;

    const overrides: Record<string, Record<string, unknown>> = {
      position: { x, y },
      currencyItem: { currencyType: type, amount }
    };

    if (type === 'blueprint' && meta) {
      overrides.currencyItem.blueprintId = meta.blueprintId;
      overrides.currencyItem.blueprintType = meta.blueprintType;
      overrides.item = { name: `Locked: ${meta.blueprintId}` };
    }

    const currencyId = entityFactory.create(world, templateName, componentRegistry, overrides);
    grid.addEntity(currencyId, x, y);

    eventBus.emit('CURRENCY_DROPPED', {
      entityId: currencyId,
      currencyType: type,
      amount,
      x,
      y,
      blueprintId: meta?.blueprintId
    } as unknown as T['CURRENCY_DROPPED']);
  };

  return {
    init
  };
}

export type RewardDropSystem<T extends GameplayEvents = GameEvents> = ReturnType<typeof createRewardDropSystem<T>>;
