# Research Summary: Nirmata Runner v2.0

## Executive Summary

Adding Nirmata Runner's game systems to the existing engine requires **11 major feature groups** built on top of validated v1.0 infrastructure. The critical dependency chain runs: **Shell data model → Firmware/Heat → Augments → Status Effects → Enemy Hierarchy → Multi-Floor Generation → Stability/Extraction → Economy → Blueprint Cycle → Run Modes → Hub UI → Visual Polish**. No new external libraries are required — the existing stack (PixiJS, React, Next.js, rot-js, Zustand, Zod) handles all needs with targeted extensions (PixiJS filters for visual effects, API routes for persistence).

---

## Stack Additions

| Addition | Purpose | Risk |
|----------|---------|------|
| Status effect system (in-house) | Neural Heat consequences, enemy debuffs, Kernel Panic effects | Low — pure ECS components |
| Server-side JSON persistence | Stash, Vault, Blueprint library, currency between runs | Low — extends existing API pattern |
| Enhanced seeded generation | Weekly/Daily global seeds, multi-floor dungeons | Low — extends rot-js Alea PRNG |
| PixiJS filter pipeline | Glitch effects, CRT overlay, heat visualization | Medium — custom shaders need testing |
| Leaderboard API | Daily/Weekly scoring and ranking | Low — simple sorted storage |
| Temporal scheduling | Weekly reset, Legacy Code degradation | Medium — needs reliable timing |

**What NOT to add:** No database (JSON persistence sufficient), no WebSockets (turn-based HTTP is fine), no physics engine, no animation library (PixiJS handles it), no state machine library (custom FSM works).

---

## Feature Table Stakes

### Must-ship (game doesn't work without these):
1. **Shell archetypes** with base stats and Port configurations
2. **Firmware abilities** with Heat costs (at least 3 starter abilities)
3. **Neural Heat bar** (0-100 safe, 100+ Corruption Zone)
4. **Kernel Panic table** (escalating consequences above 100 Heat)
5. **Augment triggers** with visual feedback (at least 3 starters)
6. **Software consumable modifiers** (burn, use, lose on death)
7. **All 6 enemy types** across 3 tiers with unique behaviors
8. **Reality Stability bar** with drain mechanics
9. **Stability Anchors** with Extract/Descend decision
10. **Multi-floor dungeon** generation
11. **3 run modes** (Simulation, Daily, Weekly)
12. **3-tier currency** (Scrap, Blueprints, Flux)
13. **Blueprint discovery → compilation → installation cycle**
14. **Weekly reset** with Legacy Code degradation
15. **Neural Deck hub** for between-run management
16. **"Vibrant Decay" visual theme** (palette, typography, effects)

### Can-defer (nice-to-have for v2.0):
- Shell visual customization
- Shell availability rotation per week
- Software stacking rules
- Dynamic pricing
- Winner's Item system
- Post-run Synergy Report
- 3D Shell visualization in Neural Deck

---

## Watch Out For

### Critical Risks (from Pitfalls research):

1. **🔴 Optimal Avoidance:** Players never overclock if Kernel Panic is too punishing → build "warmth bonuses" in Corruption Zone
2. **🔴 Invisible Augments:** Synergy triggers without clear feedback → visual flash + message log is mandatory, not polish
3. **🔴 Weekly Reset Betrayal:** Reset feels like punishment → frame as event, Legacy Code must be usable
4. **🟡 Economy Inflation:** Scrap accumulates with no sink → every faucet needs a hard sink
5. **🟡 Consumable Hoarding:** Software never used on practice runs → make drops generous in Simulation mode
6. **🟡 Turn-Based Adaptation:** Real-time concepts (dash, homing, toggles) must be explicitly reframed in turn-based terms
7. **🟡 Monotonous Descent:** Deeper floors must introduce new enemy types and mechanics, not just stat scaling
8. **🟠 Component Explosion:** 20+ new components could make ECS unwieldy → compound components, clear system ordering
9. **🟠 Flow Breaker UI:** Stability Anchor transition must be snappy (< 2 seconds), offer skip for experienced players
10. **🟠 Unfair System_Admin:** Instant-kill stalker needs heavy foreshadowing and multiple escape options

### Architectural Safeguards:
- All economy mutations must go through server-validated action pipeline
- Status effects must be ECS components (not special-cased logic)
- Every new system must follow single-responsibility principle
- Engine/game boundary must hold — new game systems go in `src/game/`
- Event tier classification (from AGENTS.md) must be followed for all new events

---

## Recommended Build Order

```
Phase 1: Shell & Equipment Data Model
Phase 2: Firmware & Neural Heat System
Phase 3: Status Effects & Augment Synergy
Phase 4: Software System & Enhanced Combat
Phase 5: Enemy Hierarchy (3 Tiers)
Phase 6: Multi-Floor Generation & Stability/Extraction
Phase 7: Currency, Economy & Blueprint System
Phase 8: Run Modes & Leaderboard
Phase 9: Neural Deck Hub UI
Phase 10: Visual Identity & Glitch Effects
Phase 11: Starter Loadouts & Integration Polish
```

This order follows the critical dependency chain: data models first, systems that consume them second, meta-game last.

---
*Research synthesized: 2026-03-29*
