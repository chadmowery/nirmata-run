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
import staircase from './templates/staircase.json';
import anchor from './templates/anchor.json';
import null_pointer from './templates/null-pointer.json';
import buffer_overflow from './templates/buffer-overflow.json';
import fragmenter from './templates/fragmenter.json';
import logic_leaker from './templates/logic-leaker.json';
import system_admin from './templates/system-admin.json';
import seed_eater from './templates/seed-eater.json';
import auto_loader_v0 from './templates/auto-loader-v0.json';
import auto_loader_v1 from './templates/auto-loader-v1.json';
import auto_loader_v2 from './templates/auto-loader-v2.json';
import auto_loader_v3 from './templates/auto-loader-v3.json';
import bleed_v0 from './templates/bleed-v0.json';
import bleed_v1 from './templates/bleed-v1.json';
import bleed_v2 from './templates/bleed-v2.json';
import bleed_v3 from './templates/bleed-v3.json';
import vampire_v0 from './templates/vampire-v0.json';
import vampire_v1 from './templates/vampire-v1.json';
import vampire_v2 from './templates/vampire-v2.json';
import vampire_v3 from './templates/vampire-v3.json';

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
  registry.register(staircase as unknown as RawTemplate);
  registry.register(anchor as unknown as RawTemplate);
  registry.register(null_pointer as unknown as RawTemplate);
  registry.register(buffer_overflow as unknown as RawTemplate);
  registry.register(fragmenter as unknown as RawTemplate);
  registry.register(logic_leaker as unknown as RawTemplate);
  registry.register(system_admin as unknown as RawTemplate);
  registry.register(seed_eater as unknown as RawTemplate);
  registry.register(auto_loader_v0 as unknown as RawTemplate);
  registry.register(auto_loader_v1 as unknown as RawTemplate);
  registry.register(auto_loader_v2 as unknown as RawTemplate);
  registry.register(auto_loader_v3 as unknown as RawTemplate);
  registry.register(bleed_v0 as unknown as RawTemplate);
  registry.register(bleed_v1 as unknown as RawTemplate);
  registry.register(bleed_v2 as unknown as RawTemplate);
  registry.register(bleed_v3 as unknown as RawTemplate);
  registry.register(vampire_v0 as unknown as RawTemplate);
  registry.register(vampire_v1 as unknown as RawTemplate);
  registry.register(vampire_v2 as unknown as RawTemplate);
  registry.register(vampire_v3 as unknown as RawTemplate);
}
