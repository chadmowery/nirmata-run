# Features Research: Nirmata Runner v2.0

## Existing Features (already built in v1.0)

- ECS entity management, JSON templates, builder/factory/registry pipeline
- BSP dungeon generation with seeded RNG
- Turn-based game loop with state machine
- Cardinal movement with collision
- Basic combat (attack vs defense, health, death, loot drops)
- Enemy AI (idle/chase/attack states, A* pathfinding, FOV-aware)
- Item entities with walk-over pickup
- PixiJS rendering (tilemap, camera, FOV, movement/attack/death animations)
- Server-authoritative action pipeline
- React UI (HUD, message log, menus)

---

## Feature Categories for v2.0

### 1. Shell & Loadout System

**Table Stakes:**
- Multiple Shell archetypes with distinct base stats (Speed, Stability, Armor)
- Port configuration per Shell (determines how many Firmware/Augment/Software slots)
- Shell selection before each run
- Shell persistence (never lost on death)

**Differentiators:**
- Shell upgrading via Materials (increases base stats or adds Port slots)
- Shell availability rotation (certain Shells locked per week based on live conditions)
- Shell visual customization

**Complexity:** Medium — extends existing entity template system with new components
**Dependencies:** Must exist before Firmware/Augments/Software can be equipped

### 2. Firmware & Neural Heat

**Table Stakes:**
- Active abilities with Heat cost per use
- Heat bar (0-100 safe zone, 100+ Corruption Zone)
- Heat dissipation over turns
- Heat venting action (spend a turn to rapidly cool)
- Kernel Panic table (escalating negative effects above 100 Heat)
- At least 3 starter Firmware abilities (Phase_Shift, Neural_Spike, Extended_Sight)

**Differentiators:**
- Firmware discovered as dungeon loot (rare drops from Tier 2/3 enemies)
- Firmware as "Locked Files" requiring Flux to compile
- Heat threshold modifiers from equipment/augments

**Complexity:** High — new resource system, probability table, visual feedback pipeline
**Dependencies:** Shell system (Firmware equips to Shell ports); combat system (Heat affects combat flow)

### 3. Augment Synergy Engine

**Table Stakes:**
- Passive effects that trigger on specific Firmware actions
- Three trigger types: On Activation, On Target Hit, On Overclock
- At least 3 starter Augments matching the 3 starter loadouts
- Clear visual feedback when Augment triggers (geometric shape flash)

**Differentiators:**
- Augment stacking/interaction rules (can multiple augments trigger from one action?)
- Rare augments with compound triggers (IF X AND Y THEN Z)
- Augment discovery as deep-run loot

**Complexity:** High — interrupt-based event system, must integrate with Firmware and combat pipelines
**Dependencies:** Firmware system (augments react to Firmware actions)

### 4. Software System

**Table Stakes:**
- Consumable modifiers "Burned" onto equipment
- Lost on death, kept on extraction
- Software as common drops (high-frequency loot)
- At least 3 Software types (damage over time, reload speed, vampiric)

**Differentiators:**
- Software stacking rules (can you Burn multiple Software onto one item?)
- Software rarity tiers affecting magnitude
- Software crafting/purchasing at Neural Deck

**Complexity:** Low-Medium — extends item system with "modifier" component
**Dependencies:** Item system (Software attaches to items); extraction loop (lost vs kept logic)

### 5. Enemy Hierarchy (3 Tiers)

**Table Stakes:**
- Tier 1 (Corrupted Data): Low HP, pack behavior, simple mechanics
  - Null-Pointer: teleport flanker, HUD glitch on hit
  - Buffer-Overflow: swarm, surround, AOE detonation
- Tier 2 (Static Horrors): Medium HP, tactical behavior, Software drops
  - Fragmenter: ground slam creates damage zones
  - Logic-Leaker: ranged "Corrupted Packets," forces Firmware cooldown on hit
- Tier 3 (Logic Breakers): Mini-bosses, unique mechanics, appear near Anchors
  - System_Admin: unstoppable stalker, instant-kill on touch, can only be stunned
  - Seed_Eater: room-shifting, spawns sub-processes

**Differentiators:**
- Enemy "glitch" visual effects (flickering, static trails, dead pixels)
- Enemy-specific death effects (leak source code, static explosion)
- Tier 3 enemies that modify the dungeon layout during combat

**Complexity:** High — unique behaviors per enemy type, new AI states, visual effects
**Dependencies:** AI system (new behavior states); combat system (new damage types); rendering (glitch effects)

### 6. Stability & Extraction Loop

**Table Stakes:**
- Reality Stability bar (secondary resource, drops as player descends)
- Stability Anchors at fixed depth intervals (every 5 floors)
- Extract option: end run, keep all loot
- Descend option: spend currency to refill Stability, continue deeper, Anchor breaks
- Death or Stability=0: lose Firmware/Augments/Software, keep Shell, get pity Scrap

**Differentiators:**
- System Handshake UI with inventory manifest and risk visualization
- Dynamic Stability drain rate based on floor difficulty
- "Pressure" mechanics (Tier 3 enemies appearing near Anchors)

**Complexity:** Medium-High — multi-floor progression, extraction state management, win/loss conditions
**Dependencies:** Dungeon generation (multi-floor); currency system; item loss/keep logic

### 7. Run Types & Modes

**Table Stakes:**
- Neural Simulation (unlimited, uses Virtual Shells, low stakes)
- The Daily Run (daily seed, cumulative leaderboard)
- The Weekly One-Shot (weekly seed, highest stakes, single attempt)

**Differentiators:**
- Run-type-specific rules (what's at risk, what scoring applies)
- Leaderboard display with top runners
- "The Ritual" pre-run loadout ceremony for Weekly

**Complexity:** Medium — run mode selection, seed management, scoring logic
**Dependencies:** Shell system (Virtual vs Physical); leaderboard storage; seeded generation

### 8. Neural Deck (Hub/Between-Run UI)

**Table Stakes:**
- Shell inspection/selection
- Firmware/Augment/Software management
- Stash inventory view
- Blueprint compilation workshop
- Run mode selection and launch

**Differentiators:**
- 2D/3D Shell visualization in maintenance rack
- "Infected" aesthetic evolving based on dungeon data
- Server room ambient effects

**Complexity:** Medium — primarily UI/UX work, React components, Zustand stores
**Dependencies:** All equipment systems; currency system; blueprint system

### 9. Currency & Economy

**Table Stakes:**
- Raw Scrap (common, basic purchases)
- Neural Blueprints (rare, unlock Firmware compilation)
- Flux (premium earned, Shell upgrades and Blueprint compilation)
- Pity payout on death (25% Scrap)

**Differentiators:**
- Dynamic pricing based on weekly meta
- Currency conversion rates

**Complexity:** Medium — currency components, transaction validation, server-side economy
**Dependencies:** Server authority (all transactions must be server-validated)

### 10. Blueprint & Weekly Reset Cycle

**Table Stakes:**
- Blueprint discovery in dungeon
- Compilation at Neural Deck (spend Flux)
- Installation on Shell
- Weekly "Format C:" reset
- Legacy Code degradation (installed Firmware stays but Heat cost doubles)

**Differentiators:**
- "Version Patch" system (v1.0 → v1.1 blueprints)
- Winner's Item reveal each Monday

**Complexity:** Medium — temporal game state, scheduled resets, degradation logic
**Dependencies:** Firmware system; economy; server-side scheduling

### 11. Visual Identity ("Vibrant Decay")

**Table Stakes:**
- Neon Cyan (#00F0FF) / Electric Pink (#FF0055) / Black (#000000) palette
- Bold condensed sans-serif typography
- Kernel Panic visual escalation (HUD jitter → color inversion → screen-tearing → grayscale)
- Death screen as styled BSOD
- Augment trigger flash (geometric shapes)

**Differentiators:**
- Post-processing glitch shaders
- Enemy "graphical artifact" rendering
- System Handshake transition at Stability Anchors (world desaturates, HUD zooms)

**Complexity:** Medium-High — shader work, CSS animation, themed component library
**Dependencies:** PixiJS filter pipeline; React themed components

---

## Anti-Features (deliberately NOT building)

| Feature | Reason |
|---------|--------|
| PvP / multiplayer extraction | Single-player focus; server authority is for anti-cheat |
| Paid currency / microtransactions | Flux is earned in-game only |
| Real-time combat / aiming | Turn-based core; no twitch mechanics |
| Friend-list / social features | Not relevant to core loop |
| Achievement / trophy system | Distracting from core extraction tension |
| Procedural narrative / quest system | Focus is on mechanical depth, not story |

---
*Research completed: 2026-03-29*
