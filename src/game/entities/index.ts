import { EntityRegistry } from '../../engine/entity/registry';
import { RawTemplate } from '../../engine/entity/types';

import physical from './templates/mixins/physical.json';
import combatant from './templates/mixins/combatant.json';
import player from './templates/player.json';
import goblin from './templates/goblin.json';
import health_potion from './templates/health-potion.json';
import phase_shift from './templates/phase-shift.json';
import neural_spike from './templates/neural-spike.json';
import extended_sight from './templates/extended-sight.json';
import displacement_venting from './templates/displacement-venting.json';
import static_siphon from './templates/static-siphon.json';
import neural_feedback from './templates/neural-feedback.json';

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
  registry.register(phase_shift as unknown as RawTemplate);
  registry.register(neural_spike as unknown as RawTemplate);
  registry.register(extended_sight as unknown as RawTemplate);
  registry.register(displacement_venting as unknown as RawTemplate);
  registry.register(static_siphon as unknown as RawTemplate);
  registry.register(neural_feedback as unknown as RawTemplate);
}
