# Roadmap: Nirmata Runner v2.0

## Overview

Build the Nirmata Runner game systems on top of the validated v1.0 engine foundation. Phases follow the critical dependency chain: equipment data model → ability/heat systems → combat augmentation → enemy diversity → world depth → economy → meta-game → UI → visual polish. Each phase delivers a coherent, testable gameplay capability. All mechanics are turn-based adaptations of the design documents.

## Phases

**Phase Numbering:**
- Continues from v1.0 (Phases 1-6). v2.0 starts at Phase 7.
- Integer phases (7, 8, 9): Planned milestone work
- Decimal phases (7.1, 7.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 7: Shell & Equipment Data Model** — Shell archetypes, Port configurations, Loadout component, equipment slot system, JSON entity templates for all 3 starter Shells
- [x] **Phase 8: Firmware & Neural Heat System** — Active abilities with Heat costs, Heat bar, dissipation/venting, Kernel Panic table, 3 starter Firmware abilities, turn-based adaptation
- [ ] **Phase 9: Status Effects & Augment Synergy** — Generic status effect system, Augment "Trigger & Payload" engine, 3 trigger types, 3 starter Augments, visual trigger feedback, stacking rules
- [ ] **Phase 10: Software System & Enhanced Combat** — Software consumable modifiers, Burn mechanic, rarity tiers, stacking rules, integration with combat damage pipeline, 3+ Software types
- [ ] **Phase 11: Enemy Hierarchy** — 3-tier enemy system (6 enemy types), unique AI behaviors per type, enemy-specific death effects, depth-based distribution, JSON entity templates
- [ ] **Phase 12: Multi-Floor Generation & Stability/Extraction** — Multi-floor dungeon descent, floor transitions, Stability bar, Stability Anchors, Extract/Descend decision, item loss/keep logic, System Handshake UI
- [ ] **Phase 13: Currency, Economy & Blueprint System** — 3-tier currency, wallet/transaction system, Blueprint discovery/compilation/installation, weekly reset with Legacy Code, server-validated economy
- [ ] **Phase 14: Stash, Vault & Run Modes** — Persistent Stash/Vault storage, 3 run modes (Simulation/Daily/Weekly), run-specific rules, seeded generation per mode, leaderboard, pre-run Ritual
- [ ] **Phase 15: Neural Deck Hub UI** — Between-run management interface, Shell inspection/selection, equipment management, Blueprint workshop, Stash/Vault UI, run mode launcher
- [ ] **Phase 16: Visual Identity & Starter Loadouts** — "Vibrant Decay" theme (palette, typography), Heat visualization tiers, Kernel Panic visual escalation, glitch effects pipeline, enemy visual identity, death screen BSOD, 3 starter loadout bundles, end-to-end integration polish

## Phase Details

### Phase 7: Shell & Equipment Data Model
**Goal**: Equipment system data backbone works end-to-end — Shells with stats, Ports, and Loadouts can be created, configured, and persisted
**Depends on**: v1.0 (ECS, entity templates, JSON composition pipeline)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06, SHELL-07
**Success Criteria** (what must be TRUE):
  1. Developer can create Shell entities from JSON templates with distinct base stats (Speed, Stability, Armor) and Port configurations (firmware/augment/software slot counts)
  2. LoadoutComponent associates a Shell with equipped Firmware, Augment, and Software entity references respecting Port slot limits
  3. Shell entities persist across run boundaries — death clears equipment but never destroys the Shell entity
  4. Shell upgrade transaction modifies base stats or adds Port slots, validated server-side
**Plans**: 3
**UI hint**: no

Plans:
- [x] 07-01: Shell Components & Entity Templates (ShellComponent, PortConfig, LoadoutComponent, 3 starter Shell JSON templates, Zod schemas)
- [x] 07-02: Equipment Slot System (equip/unequip logic, slot limit validation, server-side equipment state, Shell selection flow)
- [x] 07-03: Shell Persistence & Upgrades (Shell survives death, upgrade transactions via action pipeline, Shell rotation availability)

### Phase 8: Firmware & Neural Heat System
**Goal**: Players can use active abilities that cost Heat, risk Kernel Panics in the Corruption Zone, and manage Heat through dissipation and venting
**Depends on**: Phase 7 (Firmware equips to Shell ports)
**Requirements**: FIRM-01, FIRM-02, FIRM-03, FIRM-04, FIRM-05, FIRM-06, FIRM-07, FIRM-08, FIRM-09, FIRM-10, FIRM-11
**Success Criteria** (what must be TRUE):
  1. Player can activate a Firmware ability during their turn, paying its Heat cost; the ability effect resolves (movement, damage, reveal) within the turn pipeline
  2. Heat bar tracks from 0 upward; above 100 triggers Corruption Zone; each Firmware use above 100 rolls against the Kernel Panic table with tier-appropriate probability and effect
  3. Heat dissipates by a configurable amount each turn; player can spend a full turn to Vent, reducing Heat rapidly
  4. Three starter Firmware abilities work correctly: Phase_Shift (multi-tile dash), Neural_Spike (ranged damage), Extended_Sight (wall-penetrating vision at Heat/turn cost)
  5. Firmware drops from Tier 2/3 enemies as "Locked Files" — compilation via Flux is stubbed (full implementation in Phase 13)
**Plans**: 4
**UI hint**: no

Plans:
- [x] 08-01: HeatComponent & Heat System (Heat bar, accumulation, dissipation per turn, Vent action, HeatComponent on player entity)
- [x] 08-02: Firmware System & Ability Pipeline (FirmwareComponent, ability activation during turn, Heat cost deduction, integration with action pipeline)
- [x] 08-03: Kernel Panic System (overclock detection, probability rolls, 4-tier consequence table, status effect application)
- [x] 08-04: Starter Firmware Abilities (Phase_Shift.sh turn-based dash, Neural_Spike.exe ranged attack, Extended_Sight.sys toggle vision, JSON templates)

### Phase 9: Status Effects & Augment Synergy
**Goal**: Generic status effect system enables Augment triggers, Kernel Panic consequences, and enemy debuffs — Augments fire reliably with clear feedback
**Depends on**: Phase 8 (Augments react to Firmware actions and Heat state)
**Requirements**: AUG-01, AUG-02, AUG-03, AUG-04, AUG-05, AUG-06, AUG-07, AUG-08
**Success Criteria** (what must be TRUE):
  1. StatusEffectSystem applies, ticks, and removes named status effects (HUD_GLITCH, INPUT_LAG, FIRMWARE_LOCK, CRITICAL_REBOOT, etc.) with correct duration and magnitude
  2. AugmentSystem evaluates equipped Augments against Firmware events and fires matching payloads — On Activation, On Target Hit, and On Overclock triggers all function independently
  3. Multiple Augments can trigger from a single Firmware action if their conditions are independently met; compound-trigger Augments require all conditions
  4. Every Augment trigger produces a geometric flash and a descriptive message log entry (e.g., "Static_Siphon.arc TRIGGERED: +5 HP Shield")
  5. Augments are lost on death, kept on extraction — loss/keep logic is enforced server-side
**Plans**: 4
**UI hint**: no

Plans:
- [ ] 09-01: Status Effect System (StatusEffectsComponent, effect types, tick/expire/apply logic, event emission)
- [ ] 09-02: Augment Components & Trigger Engine (AugmentComponent, TriggerType enum, condition evaluation, payload dispatch)
- [ ] 09-03: Augment Integration & Stacking (multi-trigger resolution, compound triggers, Firmware event wiring, system ordering)
- [ ] 09-04: Starter Augments & Visual Feedback (3 starter Augment templates, geometric flash rendering, message log integration)

### Phase 10: Software System & Enhanced Combat
**Goal**: Software modifiers enhance combat with consumable effects — damage pipeline integrates Shell stats, Firmware, Augments, and Software modifiers
**Depends on**: Phase 9 (Software interacts with combat alongside Augments)
**Requirements**: SOFT-01, SOFT-02, SOFT-03, SOFT-04, SOFT-05, SOFT-06, SOFT-07
**Success Criteria** (what must be TRUE):
  1. Player can "Burn" Software onto equipment from their loadout; the modifier applies during combat calculations for the duration of the run
  2. Software is lost on death but kept on extraction — enforced by the server-side extraction pipeline
  3. At least 3 Software types function: Bleed.exe (DoT), Auto-Loader.msi (action speed bonus), Vampire.exe (heal on kill)
  4. Software rarity tiers scale the magnitude of the effect; multiple Software can stack on one item within Port slot limits
  5. Combat damage pipeline resolves in correct order: base attack → Software modifiers → Augment payloads → defense → final damage
**Plans**: 4
**UI hint**: no

Plans:
- [ ] 10-00-PLAN.md — Wave 0 test scaffolds (software.test.ts, combat.test.ts extension, pipeline.test.ts)
- [ ] 10-01-PLAN.md — Software components (SoftwareDef, BurnedSoftware, RarityTier), RunInventory registry, BURN_SOFTWARE action, death clearing
- [ ] 10-02-PLAN.md — Combat damage pipeline refactor (modifier list pattern), Bleed DoT, Auto-Loader action economy, Vampire heal-on-kill, rarity scaling
- [ ] 10-03-PLAN.md — 12 Software JSON entity templates (3 types x 4 rarities), template validation tests, loot table compatibility

### Phase 11: Enemy Hierarchy
**Goal**: Six distinct enemy types across 3 tiers with unique AI behaviors create varied tactical challenges per depth band
**Depends on**: Phase 9 (enemies apply status effects), Phase 10 (enemies drop Software)
**Requirements**: ENEMY-01, ENEMY-02, ENEMY-03, ENEMY-04, ENEMY-05, ENEMY-06, ENEMY-07, ENEMY-08, ENEMY-09, ENEMY-10, ENEMY-11
**Success Criteria** (what must be TRUE):
  1. Tier 1 Null-Pointer teleports to flank and applies HUD_GLITCH on hit; Tier 1 Buffer-Overflow travels in packs, surrounds, and detonates for AOE + slow
  2. Tier 2 Fragmenter creates persistent Dead Zone tiles on slam; Tier 2 Logic-Leaker fires at range and forces Firmware cooldown on hit
  3. Tier 3 System_Admin slowly stalks with no health bar (stun only), instant run-end on touch; Tier 3 Seed_Eater shifts room layout and spawns sub-processes
  4. Enemies display "glitch" visual identity (silhouettes, neon bleed, source code leak on damage, unique death effects)
  5. All 6 enemy types are defined in JSON entity templates with behavior configuration
**Plans**: 4
**UI hint**: no

Plans:
- [ ] 11-01: Tier 1 Enemies — Corrupted Data (Null-Pointer teleport flanker, Buffer-Overflow swarm + detonation, pack AI, slot-based positioning)
- [ ] 11-02: Tier 2 Enemies — Static Horrors (Fragmenter ground slam + Dead Zones, Logic-Leaker ranged kiting + Firmware cooldown effect)
- [ ] 11-03: Tier 3 Enemies — Logic Breakers (System_Admin invulnerable stalker AI, Seed_Eater room-shift + sub-process spawning)
- [ ] 11-04: Enemy Templates & Visual Effects (JSON templates for all 6 types, depth distribution config, glitch rendering, death effects)

### Phase 12: Multi-Floor Generation & Stability/Extraction
**Goal**: Player descends through multiple generated floors with escalating difficulty; Stability Anchors present the core extraction decision
**Depends on**: Phase 11 (enemy depth distribution), Phase 7 (equipment loss/keep logic)
**Requirements**: STAB-01, STAB-02, STAB-03, STAB-04, STAB-05, STAB-06, STAB-07, STAB-08, STAB-09, FLOOR-01, FLOOR-02, FLOOR-03, FLOOR-04, FLOOR-05, FLOOR-06, FLOOR-07
**Success Criteria** (what must be TRUE):
  1. Dungeon generates multiple sequential floors; each floor uses BSP with a seed derived from run seed + floor number; floor transitions work via staircase entities
  2. Reality Stability bar decreases per floor at an escalating rate; reaching zero ends the run with death consequences
  3. Stability Anchors appear every 5 floors; interacting pauses the game and presents the System Handshake extraction UI
  4. Extract transfers all unsecured items to Stash; Descend spends currency, refills Stability, breaks the Anchor, generates the next floor
  5. Depth-based content: Tier 1 floors 1-5, Tier 2 introduced 5-10, Tier 3 on 10-15; loot tables scale; environmental variety per band
**Plans**: 4
**UI hint**: yes

Plans:
- [ ] 12-01: Multi-Floor Generation (floor-specific seeded BSP, staircase entities, floor transition system, depth tracking)
- [ ] 12-02: Stability System (StabilityComponent, drain per floor, escalating rate, zero = run end, UI bar display)
- [ ] 12-03: Stability Anchor & Extraction Logic (Anchor entities, interaction trigger, Extract/Descend actions, item transfer/loss, server validation)
- [ ] 12-04: System Handshake UI & Depth Content (Anchor decision UI, inventory manifest, visual transition, depth-based enemy/loot/tile theming)

### Phase 13: Currency, Economy & Blueprint System
**Goal**: Three-tier currency system with Blueprint discovery, compilation, and weekly reset creates the between-run progression loop
**Depends on**: Phase 12 (extraction produces currency/items), Phase 8 (Firmware as Blueprint targets)
**Requirements**: ECON-01, ECON-02, ECON-03, ECON-04, ECON-05, ECON-06, BP-01, BP-02, BP-03, BP-04, BP-05, BP-06, BP-07
**Success Criteria** (what must be TRUE):
  1. WalletComponent tracks Scrap, Neural Blueprints, and Flux; all transactions are server-validated through the action pipeline
  2. Enemies drop currency per tier: Tier 1 = Scrap, Tier 2/3 = Blueprints + Flux; extraction multipliers apply; death pays 25% Scrap pity
  3. Blueprint discovery creates "Locked File" in inventory; compilation at Neural Deck costs Flux and adds to library; installation equips to Shell
  4. Weekly reset deletes uninstalled Blueprints; installed Firmware becomes Legacy Code with doubled Heat cost
  5. Winner's Item each week is a special Blueprint revealed globally
**Plans**: 4
**UI hint**: no

Plans:
- [ ] 13-01: Currency Components & Wallet (WalletComponent, 3-tier currency, earn/spend/transfer APIs, server validation)
- [ ] 13-02: Economy Pipeline & Drop Tables (enemy currency drops by tier, extraction multipliers, pity payout, faucet/sink balance)
- [ ] 13-03: Blueprint System (BlueprintLibrary, discovery as Locked File, Flux compilation, installation on Shell, Zod schemas)
- [ ] 13-04: Weekly Reset & Legacy Code (Format C: reset logic, Legacy Code Heat doubling, Version Patch system, Winner's Item stub, temporal scheduling)

### Phase 14: Stash, Vault & Run Modes
**Goal**: Persistent inventory and three distinct run modes create the weekly gameplay loop from practice through preparation to competition
**Depends on**: Phase 13 (economy feeds into Stash), Phase 12 (extraction populates Stash)
**Requirements**: STASH-01, STASH-02, STASH-03, STASH-04, RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06, RUN-07
**Success Criteria** (what must be TRUE):
  1. Stash persists between runs and sessions via server-side storage; extraction deposits items into Stash
  2. Vault (30 slots) protects items from Neural Simulation use; items move between Stash and Vault
  3. Three run modes selectable from Neural Deck, each with correct rules: Simulation (Virtual Shell, low stakes), Daily (shared seed, leaderboard), Weekly (one shot, full stakes, Shell Factory Reset on failure)
  4. Leaderboard stores and displays Daily/Weekly scores; scores factor in depth, kills, and loot extracted
  5. Weekly One-Shot includes pre-run Ritual where player moves best items from Stash/Vault into Active Shell
**Plans**: 4
**UI hint**: yes

Plans:
- [ ] 14-01: Stash & Vault Persistence (StashComponent, VaultComponent, server-side storage API, session persistence)
- [ ] 14-02: Run Mode Manager (RunModeManager, mode-specific rules, Virtual vs Physical Shell, risk/loss configs)
- [ ] 14-03: Seeded Runs & Leaderboard (weekly/daily seed derivation, leaderboard API, scoring formula, score submission)
- [ ] 14-04: Weekly Ritual & Run Launch (pre-run loadout ceremony, item transfer from Vault to Shell, run initialization per mode)

### Phase 15: Neural Deck Hub UI
**Goal**: Between-run management interface lets the player prepare, customize, and launch runs with full visibility into their equipment, economy, and options
**Depends on**: Phase 14 (run modes), Phase 13 (economy/blueprints), Phase 7 (Shell/equipment)
**Requirements**: HUB-01, HUB-02, HUB-03, HUB-04, HUB-05, HUB-06, HUB-07, HUB-08
**Success Criteria** (what must be TRUE):
  1. Neural Deck UI presents the player's Shell in a maintenance rack view with visible stats, Port configuration, and installed equipment
  2. Player can equip/unequip Firmware, Augments, and Software from Stash onto Shell, with Port slot limits enforced visually
  3. Blueprint workshop shows found Blueprints, compilation cost (Flux), and one-click compile action
  4. Run mode selector presents Simulation/Daily/Weekly with clear rule descriptions; launching a run transitions to the game state
  5. Hub uses "Vibrant Decay" aesthetic: black background, neon cyan/pink accents, condensed sans-serif typography, "Compile"/"Initialize" terminology
**Plans**: 4
**UI hint**: yes

Plans:
- [ ] 15-01: Hub Layout & Shell View (Neural Deck page structure, Shell maintenance rack, stats display, React components)
- [ ] 15-02: Equipment Management UI (Firmware/Augment/Software equip/unequip, drag or click, slot limit visualization, Stash browser)
- [ ] 15-03: Blueprint Workshop & Economy Display (Blueprint list, Flux cost, compile action, wallet display, transaction feedback)
- [ ] 15-04: Run Launcher & Stash/Vault Management (run mode selector, rule descriptions, Stash/Vault tab, item transfer, launch flow)

### Phase 16: Visual Identity & Starter Loadouts
**Goal**: "Vibrant Decay" visual theme is applied consistently; all starter loadouts are playable; end-to-end integration is polished
**Depends on**: All previous phases
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, VIS-06, VIS-07, VIS-08, LOAD-01, LOAD-02, LOAD-03
**Success Criteria** (what must be TRUE):
  1. Color palette (#000000, #FFFFFF, #00F0FF, #FF0055) and condensed sans-serif typography are applied consistently across all UI surfaces and in-game rendering
  2. Heat visualization tiers respond dynamically to HeatComponent state: clean → jitter → ghosting → inversion → screen-tear → grayscale
  3. Death screen displays a styled BSOD in Safety Orange with the failure reason; enemies render with glitch visual identity (silhouettes, neon bleed, static/code on damage)
  4. All 3 starter loadouts (Vanguard, Operator, Ghost) are selectable, playable, and exhibit distinct playstyles through their Shell/Firmware/Augment combinations
  5. A complete run is playable end-to-end: select loadout at Hub → enter dungeon → use Firmware/Augments → fight tiered enemies → reach Anchor → Extract/Descend → return to Hub with loot
**Plans**: 4
**UI hint**: yes

Plans:
- [ ] 16-01: Vibrant Decay Theme System (CSS design tokens, color palette, typography, component theming, dark mode foundation)
- [ ] 16-02: Heat & Kernel Panic Visual Effects (PixiJS filter chain, HUD jitter CSS, sprite ghosting, color inversion, screen-tear, grayscale)
- [ ] 16-03: Enemy Visuals & Death Screen (enemy glitch rendering, damage effects, death dissolution, BSOD death screen, Augment flash)
- [ ] 16-04: Starter Loadouts & End-to-End Polish (3 bundle JSON templates, loadout selection UI, full run integration test, edge case fixes)

## Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. Shell & Equipment Data Model | 3/3 | Completed | 2026-03-29 |
| 8. Firmware & Neural Heat System | 4/4 | Completed | 2026-03-29 |
| 9. Status Effects & Augment Synergy | 0/4 | Not started | - |
| 10. Software System & Enhanced Combat | 0/4 | Not started | - |
| 11. Enemy Hierarchy | 0/4 | Not started | - |
| 12. Multi-Floor Generation & Stability/Extraction | 0/4 | Not started | - |
| 13. Currency, Economy & Blueprint System | 0/4 | Not started | - |
| 14. Stash, Vault & Run Modes | 0/4 | Not started | - |
| 15. Neural Deck Hub UI | 0/4 | Not started | - |
| 16. Visual Identity & Starter Loadouts | 0/4 | Not started | - |

---
*Roadmap created: 2026-03-29*
*Last updated: 2026-03-30*
