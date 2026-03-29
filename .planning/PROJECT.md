# Nirmata Runner — Extraction Roguelike

## What This Is

A web-based turn-based extraction roguelike set in a Sci-Fi "Vibrant Decay" universe (Marathon (2026) aesthetic). Built on a server-authoritative ECS engine with PixiJS rendering, React/TypeScript UI, and Next.js. The core innovation is the "One Shot" Weekly Challenge — players get exactly one life per week to compete on a public seed. Everything else (Neural Simulations, Daily Runs, the economy) serves as preparation for that one definitive moment.

## Core Value

The Shell/Firmware/Augment/Software customization hierarchy combined with the Neural Heat risk system — every encounter is a resource management puzzle where players balance power output against overclock risk, creating high-skill-ceiling tactical depth within a turn-based extraction loop.

## Current Milestone: v2.0 Nirmata Runner — Core Game Systems

**Goal:** Transform the engine tech demo into a fully playable extraction roguelike with the complete customization hierarchy, Neural Heat combat mechanics, tiered enemy system, Stability Anchor extraction loop, run economy, and "Vibrant Decay" visual identity.

**Target features:**
- Shell System — Archetypes with base stats and Port configurations
- Firmware & Neural Heat — Active abilities with Heat costs and overclock risk
- Augment Synergy Engine — Passive "Trigger & Payload" system
- Software System — Consumable item modifiers, lost on death
- Enemy Hierarchy — 3-tier: Corrupted Data, Static Horrors, Logic Breakers
- Stability & Extraction — Reality Stability bar, Stability Anchor decision points
- Run Types — Neural Simulation, Daily Challenge, Weekly One-Shot
- Neural Deck Hub — Between-run management UI
- Currency Ecosystem — Raw Scrap, Neural Blueprints, Flux
- Blueprint System — Find → Compile → Install → Weekly Reset
- Vault & Weekly Prep — Protected inventory for Weekly Challenge
- Visual Identity — "Vibrant Decay" neon aesthetic, glitch effects, System Handshake UI
- Starter Loadouts — Vanguard, Operator, Ghost bundles

## Requirements

### Validated

- ✓ Custom lightweight ECS with JSON-composable entities — v1.0
- ✓ BSP-tree dungeon generation (configurable/swappable algorithm) — v1.0
- ✓ Classic turn-based game loop via state machine pattern — v1.0
- ✓ PixiJS tile-based rendering with camera centered on player — v1.0
- ✓ Server-authoritative action validation — v1.0
- ✓ Optimistic client simulation with server reconciliation — v1.0
- ✓ Entity composition via builder patterns, factories, registries — v1.0
- ✓ Clean separation: engine logic vs. game logic, data, UI, utilities — v1.0
- ✓ Lightweight UI state management reflecting game state — v1.0
- ✓ Tech demo: 60-second playable dungeon — v1.0

### Active

- [ ] Shell system with archetypes, base stats, and Port configurations
- [ ] Firmware active abilities with Neural Heat cost mechanic
- [ ] Kernel Panic overclock risk table (escalating consequences above 100 Heat)
- [ ] Heat venting and dissipation mechanics (turn-based)
- [ ] Augment "Trigger & Payload" synergy engine (On Activation, On Target Hit, On Overclock)
- [ ] Software consumable modifiers (Burn onto equipment, lost on death)
- [ ] 3-tier enemy hierarchy: Corrupted Data (swarm), Static Horrors (elites), Logic Breakers (mini-bosses)
- [ ] Enemy-specific behaviors and mechanics per tier
- [ ] Reality Stability bar (drops as player goes deeper)
- [ ] Stability Anchor interaction and decision UX (Extract vs Descend)
- [ ] Multi-floor dungeon with increasing depth/difficulty
- [ ] Neural Simulation runs (unlimited, low-stakes, Virtual Shells)
- [ ] Daily Challenge runs (cumulative leaderboard scoring)
- [ ] Weekly One-Shot run (the "real" run with full stakes)
- [ ] Neural Deck hub (between-run management interface)
- [ ] 3-tier currency system (Raw Scrap, Neural Blueprints, Flux)
- [ ] Blueprint discovery, compilation, and installation cycle
- [ ] Weekly blueprint reset with Legacy Code degradation
- [ ] Vault system (protected inventory for Weekly Challenge)
- [ ] "Vibrant Decay" visual identity (neon cyan/electric pink palette, glitch effects)
- [ ] System Handshake UI transitions at Stability Anchors
- [ ] Kernel Panic visual escalation (HUD jitter, color inversion, screen-tearing)
- [ ] Starter loadout bundles (Vanguard, Operator, Ghost)
- [ ] Death screen as "BSOD" in signature style

### Out of Scope

- Multiplayer — server validation is for anti-cheat in single-player context
- Mobile / touch input — desktop web only
- Reusable engine package — engine is an architectural boundary, not a distributable library
- Audio system — visual proof of concept first (potential v3)
- Real-time combat — all mechanics are turn-based
- Paid currency / microtransactions — "Flux" is earned in-game only
- Modding API / plugin system — JSON entity definitions provide sufficient extensibility

## Context

- **Rendering:** PixiJS handles tile-based rendering, particle effects, spritesheets. Camera centered on the player.
- **Turn model:** Classic roguelike — nothing moves until the player acts. Neural Heat venting occurs during turn processing.
- **Client-server flow:** Player input → optimistic client update → server validates → authoritative state pushed → reconcile.
- **ECS philosophy:** Entities are IDs, components are plain data objects, systems are functions. All entity definitions in JSON.
- **Customization hierarchy:** Shell (body/archetype) → Firmware (active abilities) → Augments (passive synergies) → Software (consumable tweaks). Each layer interacts upward.
- **Heat system:** Abilities cost Heat. Above 100 Heat = Corruption Zone with escalating Kernel Panic risk. Heat dissipates over turns or by spending turns venting.
- **Extraction loop:** Go deeper for better loot → Stability drops → reach Anchor → decide: extract safely or stabilize and continue. Death = lose Firmware/Augments/Software, keep Shell.
- **Economy:** Scavenge (daily runs) → Compile (workshop) → Burn (customize loadout) → Risk (weekly one-shot). Weekly reset prevents power creep.

## Constraints

- **Stack**: PixiJS + React + TypeScript + Next.js — non-negotiable
- **Architecture**: Engine and game logic must be fully separated at the module level
- **Validation**: All player actions round-trip through server before becoming authoritative
- **Composability**: Every entity type definable in JSON, no hardcoded entity classes
- **Turn-based**: All combat and movement is discrete turn-based, no real-time elements
- **Economy balance**: Weekly reset cycle must prevent power creep while respecting player investment

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Custom lightweight ECS over existing library | JSON composability + builder pattern requirements; need full control | Validated — v1.0 |
| BSP trees for initial dungeon gen | Simple, well-understood, produces reasonable layouts; other algorithms pluggable | Validated — v1.0 |
| Server-authoritative with optimistic client | Anti-cheat without sacrificing responsiveness | Validated — v1.0 |
| Next.js as backend | Unifies the stack; API routes handle validation | Validated — v1.0 |
| Turn-based (classic roguelike) | Simplifies state sync — discrete transitions easier to validate. All "real-time" design doc language adapted to turns. | Validated — v1.0 |
| Neural Heat over traditional cooldowns | Aligns with Sci-Fi "overclocking" theme; creates risk/reward depth; every ability use is a resource decision | — Pending |
| Augments as "Interrupts" not passive stats | "Trigger & Payload" creates emergent synergies and high skill ceiling | — Pending |
| Weekly blueprint reset | Prevents power creep, forces meta-shifts, keeps scavenge loop relevant | — Pending |
| 3-tier currency (Scrap/Blueprints/Flux) | Prevents inflation in web-based economy; each currency has clear role | — Pending |
| "Vibrant Decay" visual identity | High-contrast neon over dark; differentiates from muddy horror roguelikes | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-29 after milestone v2.0 initialization*
