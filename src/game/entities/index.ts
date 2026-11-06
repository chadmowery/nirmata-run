import { EntityRegistry } from '../../engine/entity/registry';
import { RawTemplate } from '../../engine/entity/types';

import physical from './templates/mixins/physical.json';
import combatant from './templates/mixins/combatant.json';
import player from './templates/player.json';
import health_potion from './templates/health-potion.json';
import phase_shift from './templates/phase-shift.json';
import neural_spike from './templates/neural-spike.json';
import extended_sight from './templates/extended-sight.json';
import displacement_venting from './templates/displacement-venting.json';
import static_siphon from './templates/static-siphon.json';
import neural_feedback from './templates/neural-feedback.json';
import basic_strike from './templates/basic-strike.json';
import kinetic_link from './templates/kinetic-link.json';
import ghost_pulse from './templates/ghost-pulse.json';
import logic_jam from './templates/logic-jam.json';
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
import firmware_drop from './templates/firmware-drop.json';
import augment_drop from './templates/augment-drop.json';
import scrap from './templates/scrap.json';
import flux from './templates/flux.json';
import blueprint_locked from './templates/blueprint-locked.json';
import armor_v1 from './templates/armor-v1.json';
import armor_v2 from './templates/armor-v2.json';
import armor_v3 from './templates/armor-v3.json';
import rifle_v1 from './templates/rifle-v1.json';
import rifle_v2 from './templates/rifle-v2.json';
import rifle_v3 from './templates/rifle-v3.json';
import dead_zone from './templates/dead-zone.json';
import phased_overdrive from './templates/phased-overdrive.json';
import neural_recursion from './templates/neural-recursion.json';
import static_collapse from './templates/static-collapse.json';
import void_echo from './templates/void-echo.json';
import prop_workstation from './templates/prop-workstation.json';
import prop_locker from './templates/prop-locker.json';
import prop_biocabinet from './templates/prop-biocabinet.json';
import prop_safe_locked from './templates/prop-safe-locked.json';
import prop_vault_door from './templates/prop-vault-door.json';
import prop_cooling_vent from './templates/prop-cooling-vent.json';
import prop_dead_drop from './templates/prop-dead-drop.json';
import prop_stabilizer from './templates/prop-stabilizer.json';
import prop_subnet_console from './templates/prop-subnet-console.json';
import prop_crate_cover from './templates/prop-crate-cover.json';
import prop_cryo_vat from './templates/prop-cryo-vat.json';
import prop_capacitor_bank from './templates/prop-capacitor-bank.json';
import item_access_key from './templates/item-access-key.json';
import scavenger_siphon from './templates/scavenger-siphon.json';
import kinetic_breacher from './templates/kinetic-breacher.json';
import thermal_bypass from './templates/thermal-bypass.json';

// Directional prop templates (DIRECTIONAL-TILEMAPS.md §5.2)
import prop_workstation_n from './templates/prop-workstation-n.json';
import prop_workstation_e from './templates/prop-workstation-e.json';
import prop_workstation_s from './templates/prop-workstation-s.json';
import prop_workstation_w from './templates/prop-workstation-w.json';

import prop_locker_n from './templates/prop-locker-n.json';
import prop_locker_e from './templates/prop-locker-e.json';
import prop_locker_s from './templates/prop-locker-s.json';
import prop_locker_w from './templates/prop-locker-w.json';

import prop_biocabinet_n from './templates/prop-biocabinet-n.json';
import prop_biocabinet_e from './templates/prop-biocabinet-e.json';
import prop_biocabinet_s from './templates/prop-biocabinet-s.json';
import prop_biocabinet_w from './templates/prop-biocabinet-w.json';

import prop_vault_door_n from './templates/prop-vault-door-n.json';
import prop_vault_door_e from './templates/prop-vault-door-e.json';
import prop_vault_door_s from './templates/prop-vault-door-s.json';
import prop_vault_door_w from './templates/prop-vault-door-w.json';

import prop_crate_cover_h from './templates/prop-crate-cover-h.json';
import prop_crate_cover_v from './templates/prop-crate-cover-v.json';

/**
 * Registers all game entity templates and mixins.
 */
export function registerGameTemplates(registry: EntityRegistry): void {
  // Register mixins first (optional, but good practice)
  registry.register(physical as unknown as RawTemplate);
  registry.register(combatant as unknown as RawTemplate);

  // Register templates
  registry.register(player as unknown as RawTemplate);
  registry.register(health_potion as unknown as RawTemplate);
  registry.register(phase_shift as unknown as RawTemplate);
  registry.register(neural_spike as unknown as RawTemplate);
  registry.register(extended_sight as unknown as RawTemplate);
  registry.register(displacement_venting as unknown as RawTemplate);
  registry.register(static_siphon as unknown as RawTemplate);
  registry.register(neural_feedback as unknown as RawTemplate);
  registry.register(basic_strike as unknown as RawTemplate);
  registry.register(kinetic_link as unknown as RawTemplate);
  registry.register(ghost_pulse as unknown as RawTemplate);
  registry.register(logic_jam as unknown as RawTemplate);
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
  registry.register(firmware_drop as unknown as RawTemplate);
  registry.register(augment_drop as unknown as RawTemplate);
  registry.register(scrap as unknown as RawTemplate);
  registry.register(flux as unknown as RawTemplate);
  registry.register(blueprint_locked as unknown as RawTemplate);
  registry.register(armor_v1 as unknown as RawTemplate);
  registry.register(armor_v2 as unknown as RawTemplate);
  registry.register(armor_v3 as unknown as RawTemplate);
  registry.register(rifle_v1 as unknown as RawTemplate);
  registry.register(rifle_v2 as unknown as RawTemplate);
  registry.register(rifle_v3 as unknown as RawTemplate);
  registry.register(dead_zone as unknown as RawTemplate);
  registry.register(phased_overdrive as unknown as RawTemplate);
  registry.register({ ...(phased_overdrive as unknown as RawTemplate), name: 'PHASED_OVERDRIVE' });
  registry.register(neural_recursion as unknown as RawTemplate);
  registry.register({ ...(neural_recursion as unknown as RawTemplate), name: 'NEURAL_RECURSION' });
  registry.register(static_collapse as unknown as RawTemplate);
  registry.register({ ...(static_collapse as unknown as RawTemplate), name: 'STATIC_COLLAPSE' });
  registry.register(void_echo as unknown as RawTemplate);
  registry.register({ ...(void_echo as unknown as RawTemplate), name: 'VOID_ECHO' });
  registry.register(prop_workstation as unknown as RawTemplate);
  registry.register(prop_locker as unknown as RawTemplate);
  registry.register(prop_biocabinet as unknown as RawTemplate);
  registry.register(prop_safe_locked as unknown as RawTemplate);
  registry.register(prop_vault_door as unknown as RawTemplate);
  registry.register(prop_cooling_vent as unknown as RawTemplate);
  registry.register(prop_dead_drop as unknown as RawTemplate);
  registry.register(prop_stabilizer as unknown as RawTemplate);
  registry.register(prop_subnet_console as unknown as RawTemplate);
  registry.register(prop_crate_cover as unknown as RawTemplate);
  registry.register(prop_cryo_vat as unknown as RawTemplate);
  registry.register(prop_capacitor_bank as unknown as RawTemplate);
  registry.register(item_access_key as unknown as RawTemplate);
  registry.register(scavenger_siphon as unknown as RawTemplate);
  registry.register(kinetic_breacher as unknown as RawTemplate);
  registry.register(thermal_bypass as unknown as RawTemplate);

  // Directional props
  registry.register(prop_workstation_n as unknown as RawTemplate);
  registry.register(prop_workstation_e as unknown as RawTemplate);
  registry.register(prop_workstation_s as unknown as RawTemplate);
  registry.register(prop_workstation_w as unknown as RawTemplate);

  registry.register(prop_locker_n as unknown as RawTemplate);
  registry.register(prop_locker_e as unknown as RawTemplate);
  registry.register(prop_locker_s as unknown as RawTemplate);
  registry.register(prop_locker_w as unknown as RawTemplate);

  registry.register(prop_biocabinet_n as unknown as RawTemplate);
  registry.register(prop_biocabinet_e as unknown as RawTemplate);
  registry.register(prop_biocabinet_s as unknown as RawTemplate);
  registry.register(prop_biocabinet_w as unknown as RawTemplate);

  registry.register(prop_vault_door_n as unknown as RawTemplate);
  registry.register(prop_vault_door_e as unknown as RawTemplate);
  registry.register(prop_vault_door_s as unknown as RawTemplate);
  registry.register(prop_vault_door_w as unknown as RawTemplate);

  registry.register(prop_crate_cover_h as unknown as RawTemplate);
  registry.register(prop_crate_cover_v as unknown as RawTemplate);
}
