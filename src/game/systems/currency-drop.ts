import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { ComponentRegistry } from '@engine/entity/types';
import { GameEvents } from '../events/types';
import { LootTable, Position, Actor } from '@shared/components';
import economyRaw from '../entities/templates/economy.json';
import { EconomyConfig, BlueprintDropConfig, DropRateConfig } from '@shared/economy-types';

const economy = economyRaw as unknown as EconomyConfig;

/**
 * System that handles currency drops when entities die.
 */
export function createCurrencyDropSystem(
  world: World<GameEvents>,
  grid: Grid,
  eventBus: EventBus<GameEvents>,
  entityFactory: EntityFactory,
  componentRegistry: ComponentRegistry
) {
  const init = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    eventBus.on('ENTITY_DIED', ({ entityId, killerId }) => {
      const actor = world.getComponent(entityId, Actor);
      const pos = world.getComponent(entityId, Position);
      const lootTable = world.getComponent(entityId, LootTable);

      // Skip if no position or if it's the player
      if (!pos || (actor && actor.isPlayer)) {
        return;
      }

      const tier = lootTable?.tier ?? 1;
      const tierKey = `tier${tier}` as keyof typeof economy.currencyDrops.scrap;

      // 1. Roll for Scrap
      const scrapConfig = economy.currencyDrops.scrap[tierKey];
      if (scrapConfig && Math.random() <= scrapConfig.chance) {
        const amount = Math.floor(Math.random() * (scrapConfig.max - scrapConfig.min + 1)) + scrapConfig.min;
        spawnCurrency(world, 'scrap', amount, pos.x, pos.y);
      }

      // 2. Roll for Flux
      const fluxConfig = economy.currencyDrops.flux[tierKey] as DropRateConfig | undefined;
      if (fluxConfig && Math.random() <= fluxConfig.chance) {
        const amount = Math.floor(Math.random() * (fluxConfig.max - fluxConfig.min + 1)) + fluxConfig.min;
        spawnCurrency(world, 'flux', amount, pos.x, pos.y);
      }

      // 3. Roll for Blueprint
      const blueprintConfig = economy.currencyDrops.blueprint[tierKey] as BlueprintDropConfig | undefined;
      if (blueprintConfig && Math.random() <= blueprintConfig.chance) {
        // Select a random blueprint from a pool
        // Using hardcoded pool of existing firmware/augment template names as per plan
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

        spawnCurrency(world, 'blueprint', 1, pos.x, pos.y, { blueprintId, blueprintType });
      }
    });
  };

  const spawnCurrency = (
    world: World<GameEvents>,
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
    });
  };

  return {
    init
  };
}
