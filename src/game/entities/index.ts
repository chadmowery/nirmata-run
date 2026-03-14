import { EntityRegistry } from '../../engine/entity/registry';
import { RawTemplate } from '../../engine/entity/types';

import physical from './templates/mixins/physical.json';
import combatant from './templates/mixins/combatant.json';
import player from './templates/player.json';
import goblin from './templates/goblin.json';
import health_potion from './templates/health-potion.json';

/**
 * Registers all game entity templates and mixins.
 */
export function registerGameTemplates(registry: EntityRegistry): void {
  // Register mixins first (optional, but good practice)
  registry.register(physical as unknown as RawTemplate);
  registry.register(combatant as unknown as RawTemplate);

  // Register templates
  registry.register(player as unknown as RawTemplate);
  registry.register(goblin as unknown as RawTemplate);
  registry.register(health_potion as unknown as RawTemplate);
}
