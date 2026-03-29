# Requirements: Nirmata Runner v2.0

**Defined:** 2026-03-29
**Core Value:** The Shell/Firmware/Augment/Software customization hierarchy combined with the Neural Heat risk system — every encounter is a resource management puzzle where players balance power output against overclock risk.

## v2.0 Requirements

Requirements for the Nirmata Runner core game systems. Each maps to roadmap phases.

### Shell & Loadout

- [ ] **SHELL-01**: Player can select from multiple Shell archetypes (Striker, Bastion, Signal) each with distinct base stats (Speed, Stability, Armor)
- [ ] **SHELL-02**: Each Shell defines a Port configuration that determines the number of Firmware, Augment, and Software slots available
- [ ] **SHELL-03**: Player can select their Shell before each run from the Neural Deck
- [ ] **SHELL-04**: Shells persist across death — never lost on a failed run
- [ ] **SHELL-05**: Player can upgrade Shell base stats and Port configurations by spending Materials/Flux
- [ ] **SHELL-06**: Certain Shells may be unavailable in specific weeks based on live rotation conditions
- [ ] **SHELL-07**: Shell data is defined in JSON entity templates using the existing builder/registry/factory pipeline

### Firmware & Neural Heat

- [ ] **FIRM-01**: Firmware are active abilities that the player can execute during their turn, each with a defined Heat cost
- [ ] **FIRM-02**: Player has a Neural Heat bar (0–100 safe zone) that accumulates Heat when Firmware is used
- [ ] **FIRM-03**: Using Firmware above 100 Heat enters the Corruption Zone, where each subsequent use triggers a Kernel Panic roll
- [ ] **FIRM-04**: Kernel Panic table has escalating tiers: 101-120% (15% chance, UI_GLITCH), 121-140% (30%, INPUT_LAG), 141-160% (50%, FIRMWARE_LOCK), 161%+ (75%, CRITICAL_REBOOT)
- [ ] **FIRM-05**: Heat dissipates passively at a configurable rate each turn
- [ ] **FIRM-06**: Player can spend a full turn to "Vent" Heat, rapidly reducing it but becoming vulnerable
- [ ] **FIRM-07**: Three starter Firmware abilities exist: Phase_Shift.sh (25 Heat, multi-tile dash ignoring collision), Neural_Spike.exe (40 Heat, high-damage ranged attack), Extended_Sight.sys (10 Heat/turn, reveals enemies through walls)
- [ ] **FIRM-08**: Firmware can be discovered as rare loot drops from Tier 2 and Tier 3 enemies during runs
- [ ] **FIRM-09**: Firmware drops are "Locked Files" that require Flux to compile at the Neural Deck before they can be equipped
- [ ] **FIRM-10**: Equipment and Augments can modify Heat thresholds (e.g., raise safe zone above 100, reduce Heat costs)
- [ ] **FIRM-11**: Firmware that is already installed on a Shell persists through the weekly reset but becomes "Legacy Code" with doubled Heat cost

### Augment Synergy

- [ ] **AUG-01**: Augments are passive effects that trigger automatically when specific Firmware conditions are met, following an IF [Trigger] THEN [Payload] pattern
- [ ] **AUG-02**: Three trigger types exist: On Activation (when any Firmware fires), On Target Hit (when Firmware damages an enemy), On Overclock (when Firmware is used above 100 Heat)
- [ ] **AUG-03**: Three starter Augments exist matching the starter loadouts: Displacement_Venting.arc (dash through enemy → vent 15 Heat), Static_Siphon.arc (kill with Neural_Spike → 5 HP shield), Neural_Feedback.arc (kill during Extended_Sight → +25% next attack)
- [ ] **AUG-04**: Every Augment trigger produces a clear visual flash (high-contrast geometric shape) and a descriptive message log entry showing what triggered and the result
- [ ] **AUG-05**: Augment stacking rules are defined — multiple Augments can trigger from a single Firmware action if their conditions are independently met
- [ ] **AUG-06**: Rare compound-trigger Augments exist that require multiple conditions (e.g., IF Firmware hits AND Heat > 80 THEN bonus effect)
- [ ] **AUG-07**: Augments can be discovered as loot drops in deep runs (floor 10+), and like Firmware, require compilation
- [ ] **AUG-08**: Augments are lost on death but kept on successful extraction

### Software

- [ ] **SOFT-01**: Software are consumable modifiers that can be "Burned" onto equipment, providing stat bonuses or special effects for one run
- [ ] **SOFT-02**: Software is lost on death but kept on successful extraction
- [ ] **SOFT-03**: Software drops are common (high-frequency loot) from all enemy tiers
- [ ] **SOFT-04**: At least 3 Software types exist at launch: Bleed.exe (damage over time on physical attacks), Auto-Loader.msi (reduces action cooldown), Vampire.exe (heal on kill)
- [ ] **SOFT-05**: Multiple Software can be stacked on a single item if the Shell has sufficient Software port slots
- [ ] **SOFT-06**: Software comes in rarity tiers that affect the magnitude of the modifier
- [ ] **SOFT-07**: Software can be purchased with Scrap at the Neural Deck or found during runs

### Enemy Hierarchy

- [ ] **ENEMY-01**: Enemies are visually "glitched" — high-contrast silhouettes with neon bleeding, flickering, and static trails
- [ ] **ENEMY-02**: When enemies take damage, they leak source code fragments or static instead of blood
- [ ] **ENEMY-03**: Tier 1 "Corrupted Data" — Null-Pointer: spindly four-legged stalker that teleports short distances, tries to flank the player, and on hit glitches the player's HUD for 2 turns
- [ ] **ENEMY-04**: Tier 1 "Corrupted Data" — Buffer-Overflow: floating pulsating spheres that travel in packs of 5-8, surround the player, and detonate for AOE damage + movement slow
- [ ] **ENEMY-05**: Tier 2 "Static Horrors" — Fragmenter: massive blocky humanoid that slams the ground creating "Dead Zone" tiles that deal damage over time to anyone standing on them
- [ ] **ENEMY-06**: Tier 2 "Static Horrors" — Logic-Leaker: floating torso that fires homing "Corrupted Packets" at range and forces one of the player's Firmware into cooldown on hit
- [ ] **ENEMY-07**: Tier 3 "Logic Breakers" — System_Admin: tall faceless stalker that slowly walks toward the player; cannot be killed, only stunned; instant run-end on touch
- [ ] **ENEMY-08**: Tier 3 "Logic Breakers" — Seed_Eater: ceiling-mounted eye that shifts room layout while the player is in it, spawning Tier 1 sub-processes while walls and floors rearrange
- [ ] **ENEMY-09**: Enemy types are distributed by depth: Tier 1 on floors 1-5, Tier 2 introduced on floors 5-10, Tier 3 appears on floors 10-15 and near Stability Anchors
- [ ] **ENEMY-10**: Each enemy type has unique death effects matching the "glitch" aesthetic (static explosion, code fragment scatter, pixel dissolution)
- [ ] **ENEMY-11**: Enemy data (stats, behavior, loot tables) is defined in JSON entity templates

### Stability & Extraction

- [ ] **STAB-01**: Player has a Reality Stability bar that decreases as they descend deeper into the dungeon
- [ ] **STAB-02**: Stability Anchors appear at fixed depth intervals (every 5 floors) as interactive objects in the game world
- [ ] **STAB-03**: Interacting with a Stability Anchor pauses the game and presents the extraction decision UI ("System Handshake")
- [ ] **STAB-04**: Extract option (DE-REZZ & EXTRACT): ends the run, all unsecured Firmware/Augments/Software/Materials transfer to the player's Stash at 100% success rate
- [ ] **STAB-05**: Descend option (STABILIZE & DESCEND): spends currency to refill Stability by a fixed percentage, the Anchor breaks, the player must reach the next Anchor to extract
- [ ] **STAB-06**: If the player dies or Stability reaches zero, they lose all equipped Firmware, Augments, and Software; they return to the Neural Deck with just their Shell and 25% of collected Scrap as pity currency
- [ ] **STAB-07**: The Stability Anchor UI displays: current floor and stability percentage, a scrollable inventory manifest of all unsecured items, and the two decision options with clear risk information
- [ ] **STAB-08**: The Stability Anchor UI uses the "System Handshake" visual style: world desaturates to grayscale, HUD zooms to center, bold typography, cyan/pink color blocks
- [ ] **STAB-09**: Stability drain rate increases with floor depth, creating escalating pressure

### Multi-Floor Dungeon

- [ ] **FLOOR-01**: Dungeon consists of multiple sequential floors that the player descends through
- [ ] **FLOOR-02**: Each floor is independently generated using the existing BSP algorithm with a floor-specific seed derived from the run seed + floor number
- [ ] **FLOOR-03**: Floor transitions occur when the player reaches a staircase entity and chooses to descend
- [ ] **FLOOR-04**: Enemy composition and difficulty scales with floor depth (more enemies, higher-tier enemies, tougher stats)
- [ ] **FLOOR-05**: Loot tables improve with depth — Firmware only drops below floor 5, rare Augments below floor 10
- [ ] **FLOOR-06**: Environmental variety per depth band (different tile themes, room layouts, and hazard types)
- [ ] **FLOOR-07**: Unique room types appear at specific depths (treasure rooms, challenge rooms, Anchor rooms)

### Run Modes

- [ ] **RUN-01**: Neural Simulation mode: unlimited runs using "Virtual Shells" — low stakes, full loot drops, used for practice and stash building
- [ ] **RUN-02**: Daily Challenge mode: all players share the same daily seed, cumulative high-score leaderboard, moderate stakes
- [ ] **RUN-03**: Weekly One-Shot mode: all players share the same weekly seed, one attempt per week, full stakes — Firmware/Augments/Software lost on death, Shell Factory Reset on failure
- [ ] **RUN-04**: Run mode selection happens at the Neural Deck before starting a run
- [ ] **RUN-05**: Each run mode has distinct rules for what equipment is at risk, how scoring works, and which Shell type (Virtual vs Physical) is used
- [ ] **RUN-06**: Virtual Shells in Neural Simulation mode are temporary copies — equipment attached to them doesn't come from the player's real Stash
- [ ] **RUN-07**: The Weekly One-Shot includes a pre-run "Ritual" step where the player moves their best items from Stash/Vault into their Active Shell

### Currency & Economy

- [ ] **ECON-01**: Raw Scrap is the common currency: dropped by all enemies, used for basic repairs, re-initialization, and purchasing standard Software
- [ ] **ECON-02**: Neural Blueprints are rare drops from Tier 2/3 enemies that unlock the ability to compile specific Firmware or Augments
- [ ] **ECON-03**: Flux is the premium earned currency: extracted from deep runs or special events, used for Shell upgrades and Blueprint compilation
- [ ] **ECON-04**: On death, the player receives 25% of collected Scrap as a pity payout; all other unsecured currency is lost
- [ ] **ECON-05**: All economy transactions are server-validated through the existing action pipeline — clients cannot mint or duplicate currency
- [ ] **ECON-06**: Every currency faucet has a corresponding hard sink to prevent inflation (Scrap → repairs/purchases, Blueprints → compilation, Flux → upgrades)

### Blueprint & Weekly Reset

- [ ] **BP-01**: Blueprints are found as "Locked File" drops in the dungeon representing a specific Firmware or Augment
- [ ] **BP-02**: At the Neural Deck, players spend Flux to "Compile" a Blueprint, adding it to their library for the week
- [ ] **BP-03**: Compiled Firmware/Augments can be installed on a Shell from the library
- [ ] **BP-04**: Weekly reset ("Format C:") occurs every Monday: all uninstalled and library Blueprints are deleted
- [ ] **BP-05**: Firmware already installed on a Shell survives the reset but becomes "Legacy Code" with doubled Heat cost
- [ ] **BP-06**: The weekly reset introduces a new global seed and a new "Version Patch" — Legacy Code is 50% less effective than current-version blueprints
- [ ] **BP-07**: Each Monday reveals a new "Winner's Item" — a special Blueprint discovered during the previous week's top run

### Stash & Vault

- [ ] **STASH-01**: The Stash is the player's persistent inventory for extracted items (Firmware, Augments, Software, Materials)
- [ ] **STASH-02**: The Vault is a small protected sub-inventory (e.g., 30 slots) — items placed here cannot be used in Neural Simulations, only in Daily/Weekly runs
- [ ] **STASH-03**: Items in the Vault are "Locked" for competitive runs to prevent practice-mode consumption
- [ ] **STASH-04**: Server-side persistence ensures Stash/Vault state survives between sessions

### Neural Deck (Hub UI)

- [ ] **HUB-01**: The Neural Deck is the between-run management interface presenting the player's Shell in a "maintenance rack" view
- [ ] **HUB-02**: Hub provides Shell inspection and selection — view stats, Port configs, and currently installed equipment
- [ ] **HUB-03**: Hub provides Firmware/Augment/Software management — equip, unequip, and review items from Stash
- [ ] **HUB-04**: Hub provides the Blueprint compilation workshop — view found Blueprints, spend Flux to compile
- [ ] **HUB-05**: Hub provides Stash and Vault management — move items between Stash, Vault, and Shell
- [ ] **HUB-06**: Hub provides run mode selection and launch — choose Neural Simulation, Daily, or Weekly and start the run
- [ ] **HUB-07**: Hub uses "Compile" and "Initialize" terminology instead of "Craft" and "Shop" to maintain the Sci-Fi aesthetic
- [ ] **HUB-08**: Hub ambience: minimalist, server-room aesthetic with clean typography and the "Vibrant Decay" color palette

### Visual Identity

- [ ] **VIS-01**: Color palette uses #000000 (Black), #FFFFFF (White), #00F0FF (Neon Cyan for "Secure" actions), #FF0055 (Electric Pink for "Risk" actions)
- [ ] **VIS-02**: Typography uses large, condensed sans-serif headers (e.g., "ANCHOR_LINK_ESTABLISHED", "KERNEL_PANIC_DETECTED")
- [ ] **VIS-03**: Heat visualization tiers: Low Heat = clean cyan HUD; High Heat = HUD jitter + sprite ghosting (pink pixel trail); Overclock = color inversion + screen-tearing
- [ ] **VIS-04**: Kernel Panic visual escalation: 101-120% HUD jitters + faint mechanical sounds; 121-140% color inversion + dead pixel trails; 141-160% heavy screen-tearing + red wireframe sprite; 161%+ constant feedback + grayscale world
- [ ] **VIS-05**: Augment trigger feedback: high-contrast geometric shape (white triangle, orange square) flashes briefly center-screen on successful synergy
- [ ] **VIS-06**: Death screen styled as a "BSOD" in signature Safety Orange, listing the "Reason for Failure" (e.g., FATAL_EXCEPTION: KERNEL_PANIC_DURING_COMBAT)
- [ ] **VIS-07**: Stability Anchor "System Handshake" transition: game world desaturates to grayscale, HUD zooms to center, bold cyan/pink decision blocks appear
- [ ] **VIS-08**: Enemy visual identity: high-contrast silhouettes with neon bleeding from joints/eyes, damage causes source code/static leaks, death triggers glitch dissolution effects

### Starter Loadouts

- [ ] **LOAD-01**: Vanguard bundle: STRIKER-v1 Shell (High Speed, Low Armor, 1 Augment Port) + Phase_Shift.sh + Displacement_Venting.arc — aggressive close-quarters "dance" combat playstyle
- [ ] **LOAD-02**: Operator bundle: BASTION-v1 Shell (Low Speed, High Armor, 1 Augment Port) + Neural_Spike.exe + Static_Siphon.arc — mid-range tactical "tank" playstyle
- [ ] **LOAD-03**: Ghost bundle: SIGNAL-v1 Shell (Balanced Stats, 2 Augment Ports) + Extended_Sight.sys + Neural_Feedback.arc — recon and utility "scout" playstyle

---

## Future Requirements (v3+)

Deferred. Not in current roadmap.

- **V3-01**: PvP extraction mode (multiplayer)
- **V3-02**: Audio system (bit-crushed enemy sounds, server room ambience, GPU fan failing SFX)
- **V3-03**: Social features (friend list, spectating, run replays)
- **V3-04**: Community-created content (custom seeds, challenge modes)
- **V3-05**: Mobile / touch input support
- **V3-06**: Achievement / trophy system
- **V3-07**: Seasonal themes and limited-time events
- **V3-08**: Advanced procedural generation (WFC, cellular automata)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multiplayer / PvP | Single-player focus; server authority is for anti-cheat only |
| Mobile / touch input | Desktop web only |
| Paid currency / microtransactions | Flux is earned in-game only — never purchasable |
| Real-time combat | All mechanics are turn-based; design doc "real-time" language is adapted |
| Procedural narrative / quest system | Focus on mechanical depth, not story |
| Audio system | Visual-first approach; audio deferred to v3 |
| Modding API / plugin system | JSON entity definitions provide sufficient extensibility |
| Save/load mid-run | Runs are atomic; no mid-run persistence |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | Phase 7 | Pending |
| SHELL-02 | Phase 7 | Pending |
| SHELL-03 | Phase 7 | Pending |
| SHELL-04 | Phase 7 | Pending |
| SHELL-05 | Phase 7 | Pending |
| SHELL-06 | Phase 7 | Pending |
| SHELL-07 | Phase 7 | Pending |
| FIRM-01 | Phase 8 | Pending |
| FIRM-02 | Phase 8 | Pending |
| FIRM-03 | Phase 8 | Pending |
| FIRM-04 | Phase 8 | Pending |
| FIRM-05 | Phase 8 | Pending |
| FIRM-06 | Phase 8 | Pending |
| FIRM-07 | Phase 8 | Pending |
| FIRM-08 | Phase 8 | Pending |
| FIRM-09 | Phase 8 | Pending |
| FIRM-10 | Phase 8 | Pending |
| FIRM-11 | Phase 8 | Pending |
| AUG-01 | Phase 9 | Pending |
| AUG-02 | Phase 9 | Pending |
| AUG-03 | Phase 9 | Pending |
| AUG-04 | Phase 9 | Pending |
| AUG-05 | Phase 9 | Pending |
| AUG-06 | Phase 9 | Pending |
| AUG-07 | Phase 9 | Pending |
| AUG-08 | Phase 9 | Pending |
| SOFT-01 | Phase 10 | Pending |
| SOFT-02 | Phase 10 | Pending |
| SOFT-03 | Phase 10 | Pending |
| SOFT-04 | Phase 10 | Pending |
| SOFT-05 | Phase 10 | Pending |
| SOFT-06 | Phase 10 | Pending |
| SOFT-07 | Phase 10 | Pending |
| ENEMY-01 | Phase 11 | Pending |
| ENEMY-02 | Phase 11 | Pending |
| ENEMY-03 | Phase 11 | Pending |
| ENEMY-04 | Phase 11 | Pending |
| ENEMY-05 | Phase 11 | Pending |
| ENEMY-06 | Phase 11 | Pending |
| ENEMY-07 | Phase 11 | Pending |
| ENEMY-08 | Phase 11 | Pending |
| ENEMY-09 | Phase 11 | Pending |
| ENEMY-10 | Phase 11 | Pending |
| ENEMY-11 | Phase 11 | Pending |
| STAB-01 | Phase 12 | Pending |
| STAB-02 | Phase 12 | Pending |
| STAB-03 | Phase 12 | Pending |
| STAB-04 | Phase 12 | Pending |
| STAB-05 | Phase 12 | Pending |
| STAB-06 | Phase 12 | Pending |
| STAB-07 | Phase 12 | Pending |
| STAB-08 | Phase 12 | Pending |
| STAB-09 | Phase 12 | Pending |
| FLOOR-01 | Phase 12 | Pending |
| FLOOR-02 | Phase 12 | Pending |
| FLOOR-03 | Phase 12 | Pending |
| FLOOR-04 | Phase 12 | Pending |
| FLOOR-05 | Phase 12 | Pending |
| FLOOR-06 | Phase 12 | Pending |
| FLOOR-07 | Phase 12 | Pending |
| ECON-01 | Phase 13 | Pending |
| ECON-02 | Phase 13 | Pending |
| ECON-03 | Phase 13 | Pending |
| ECON-04 | Phase 13 | Pending |
| ECON-05 | Phase 13 | Pending |
| ECON-06 | Phase 13 | Pending |
| BP-01 | Phase 13 | Pending |
| BP-02 | Phase 13 | Pending |
| BP-03 | Phase 13 | Pending |
| BP-04 | Phase 13 | Pending |
| BP-05 | Phase 13 | Pending |
| BP-06 | Phase 13 | Pending |
| BP-07 | Phase 13 | Pending |
| STASH-01 | Phase 14 | Pending |
| STASH-02 | Phase 14 | Pending |
| STASH-03 | Phase 14 | Pending |
| STASH-04 | Phase 14 | Pending |
| RUN-01 | Phase 14 | Pending |
| RUN-02 | Phase 14 | Pending |
| RUN-03 | Phase 14 | Pending |
| RUN-04 | Phase 14 | Pending |
| RUN-05 | Phase 14 | Pending |
| RUN-06 | Phase 14 | Pending |
| RUN-07 | Phase 14 | Pending |
| HUB-01 | Phase 15 | Pending |
| HUB-02 | Phase 15 | Pending |
| HUB-03 | Phase 15 | Pending |
| HUB-04 | Phase 15 | Pending |
| HUB-05 | Phase 15 | Pending |
| HUB-06 | Phase 15 | Pending |
| HUB-07 | Phase 15 | Pending |
| HUB-08 | Phase 15 | Pending |
| VIS-01 | Phase 16 | Pending |
| VIS-02 | Phase 16 | Pending |
| VIS-03 | Phase 16 | Pending |
| VIS-04 | Phase 16 | Pending |
| VIS-05 | Phase 16 | Pending |
| VIS-06 | Phase 16 | Pending |
| VIS-07 | Phase 16 | Pending |
| VIS-08 | Phase 16 | Pending |
| LOAD-01 | Phase 16 | Pending |
| LOAD-02 | Phase 16 | Pending |
| LOAD-03 | Phase 16 | Pending |

**Coverage:**
- v2.0 requirements: 83 total
- Mapped to phases: 83
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 — traceability updated with phase mappings*
