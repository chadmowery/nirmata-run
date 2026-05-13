# Phase 11: Enemy Hierarchy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 11-enemy-hierarchy
**Areas discussed:** AI behavior architecture, Death effects & damage feedback, Depth-based spawning, Tier 3 special mechanics

---

## AI Behavior Architecture

### Per-type behavior structure

| Option | Description | Selected |
|--------|-------------|----------|
| Behavior key dispatch | Add behaviorType field to AIState. AI system dispatches to per-type handler functions. JSON-configurable, single system. | ✓ |
| Separate AI systems per type | Distinct systems per enemy type. More isolated but more boilerplate. | |
| Behavior tree library | Formal behavior tree with selector/sequence/decorator nodes. Most flexible but heaviest. | |

**User's choice:** Behavior key dispatch (Recommended)
**Notes:** None

### Pack behavior (Buffer-Overflow)

| Option | Description | Selected |
|--------|-------------|----------|
| Shared pack ID | PackMember component with packId. Leader coordinates, followers surround. Proximity-triggered detonation. | ✓ |
| Emergent swarming | No explicit pack tracking. Swarming emerges from independent pathfinding. | |
| Formation slots | Formal N/S/E/W formation system. More predictable but complex. | |

**User's choice:** Shared pack ID (Recommended)
**Notes:** None

### Null-Pointer teleport

| Option | Description | Selected |
|--------|-------------|----------|
| Instant reposition | Disappear and appear behind player in same turn. Simple position update + visual flicker. | ✓ |
| Two-phase blink | Turn 1: vanish. Turn 2: appear and attack. Gives player reaction time but adds state. | |

**User's choice:** Instant reposition (Recommended)
**Notes:** None

### Ranged AI (Logic-Leaker)

| Option | Description | Selected |
|--------|-------------|----------|
| Range threshold in handler | Check distance, fire if in range + LOS, kite if too close. Uses existing FOV. | ✓ |
| Preferred distance config | Generic preferredDistance field on AIState. Reusable pattern. | |
| You decide | Claude's discretion. | |

**User's choice:** Range threshold in handler (Recommended)
**Notes:** None

### Firmware cooldown on Logic-Leaker hit

| Option | Description | Selected |
|--------|-------------|----------|
| Status effect approach | Apply FIRMWARE_LOCK status effect via Phase 9 system to random Firmware for N turns. | ✓ |
| Direct cooldown field | Add cooldownTurns to FirmwareSlots entries directly. | |
| You decide | Claude's discretion. | |

**User's choice:** Status effect approach (Recommended)
**Notes:** None

### Dead Zone duration (Fragmenter)

| Option | Description | Selected |
|--------|-------------|----------|
| Time-limited | Persist for N turns (5-8), then fade. Configurable in JSON. | ✓ |
| Permanent until room exit | Last until player leaves room. More punishing, simpler. | |
| You decide | Claude's discretion. | |

**User's choice:** Time-limited (Recommended)
**Notes:** None

### Enemy speed variation

| Option | Description | Selected |
|--------|-------------|----------|
| Per-type fixed speed | Fixed energy speed in JSON template per type. Simple, predictable, tunable. | ✓ |
| Speed range per type | Min/max speed range, random at spawn. More variety but harder to balance. | |
| You decide | Claude's discretion. | |

**User's choice:** Per-type fixed speed (Recommended)
**Notes:** None

---

## Death Effects & Damage Feedback

### Damage feedback visuals

| Option | Description | Selected |
|--------|-------------|----------|
| Sprite flash + particles | White flash + code character particle burst. Lightweight. | |
| Sprite distortion | Horizontal tear/displacement + scanline effect for 200ms. Shader/filter work. | ✓ |

**User's choice:** Sprite distortion
**Notes:** User chose the more thematic option over the simpler one.

### Death effect granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Per-type unique | Each of 6 types gets its own death effect. Matches ENEMY-10. | ✓ |
| Per-tier themed | 3 effects (one per tier). Simpler. | |
| You decide | Claude's discretion. | |

**User's choice:** Per-type unique (Recommended)
**Notes:** None

### Death effect implementation timing

| Option | Description | Selected |
|--------|-------------|----------|
| Data + placeholder FX in Phase 11 | Define in JSON, basic version. Phase 16 polishes. | |
| Full effects in Phase 11 | All 6 unique effects with full visual fidelity now. | ✓ |
| Data only, no FX | Define field only, defer all visuals to Phase 16. | |

**User's choice:** Full effects in Phase 11
**Notes:** User wants enemies visually complete when Phase 11 ends, not deferred to Phase 16.

---

## Depth-Based Spawning

### Distribution configuration

| Option | Description | Selected |
|--------|-------------|----------|
| JSON spawn table | Config file maps depth ranges to weighted template lists. Tunable without code. | ✓ |
| Hardcoded tiers in placement | if/else logic in entity-placement.ts. Simpler but harder to tune. | |
| You decide | Claude's discretion. | |

**User's choice:** JSON spawn table (Recommended)
**Notes:** None

### Pack spawning rules

| Option | Description | Selected |
|--------|-------------|----------|
| Same room only | Pack members always spawn in the same room. Guarantees encounter. | ✓ |
| Adjacent room spread | Pack spans 2-3 rooms. Creates ambushes but adds complexity. | |
| You decide | Claude's discretion. | |

**User's choice:** Same room only (Recommended)
**Notes:** None

### Room density scaling

| Option | Description | Selected |
|--------|-------------|----------|
| Scale with depth | Enemy count range increases per depth band. Escalating pressure. | ✓ |
| Fixed count, harder types | 1-3 always. Difficulty from type only. | |
| You decide | Claude's discretion. | |

**User's choice:** Scale with depth (Recommended)
**Notes:** None

---

## Tier 3 Special Mechanics

### System_Admin invulnerability

| Option | Description | Selected |
|--------|-------------|----------|
| No Health component | No Health at all. Stun via special disrupt interaction. No health bar. | ✓ |
| Infinite health + stun flag | HP 999999, hidden bar. Damage applies but never kills. | |
| You decide | Claude's discretion. | |

**User's choice:** No Health component (Recommended)
**Notes:** None

### System_Admin run-end trigger direction

| Option | Description | Selected |
|--------|-------------|----------|
| Either direction | Both System_Admin bump and player bump trigger run-end. Maximally punishing. | ✓ |
| System_Admin bump only | Only triggers on System_Admin's turn. Player bump is blocked. | |
| You decide | Claude's discretion. | |

**User's choice:** Either direction (Recommended)
**Notes:** None

### System_Admin stalking pace

| Option | Description | Selected |
|--------|-------------|----------|
| Low energy speed | Energy speed 30-40 vs player 100. Turns every 2-3 player turns. Uses existing energy system. | ✓ |
| Move every N turns | Custom stalkerCooldown field. Normal speed but skips turns. | |
| You decide | Claude's discretion. | |

**User's choice:** Low energy speed (Recommended)
**Notes:** None

### System_Admin floor warning

| Option | Description | Selected |
|--------|-------------|----------|
| Ambient HUD warning | Persistent indicator when on floor ('ADMIN_PROCESS_DETECTED'). Builds tension. | ✓ |
| No warning | Silent. Discovered via FOV only. Maximum surprise. | |
| You decide | Claude's discretion. | |

**User's choice:** Ambient HUD warning (Recommended)
**Notes:** None

### Seed_Eater room manipulation

| Option | Description | Selected |
|--------|-------------|----------|
| Wall rearrangement in room | Periodic BSP re-gen scoped to room bounds. | |
| Tile corruption spread | Corrupts individual tiles in a spreading pattern. Simpler, still creates chaos. | ✓ |
| Stub for Phase 12 | Sub-process spawning only, defer room manipulation. | |

**User's choice:** Tile corruption spread
**Notes:** User chose the middle-ground option — spatial chaos without full room regeneration.

### Corruption-entity interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Push entities out | Corrupted tile pushes entity to nearest walkable tile. Prevents softlocks. | ✓ |
| Damage + push | Corruption deals damage AND pushes. More dangerous. | |
| You decide | Claude's discretion. | |

**User's choice:** Push entities out (Recommended)
**Notes:** None

### Seed_Eater sub-processes

| Option | Description | Selected |
|--------|-------------|----------|
| Full Tier 1 entities | Actual Null-Pointer/Buffer-Overflow from templates. Full AI, drops, behavior. | ✓ |
| Lightweight minions | Simplified entities, no loot, chase-only AI. Prevents loot farming. | |
| You decide | Claude's discretion. | |

**User's choice:** Full Tier 1 entities (Recommended)
**Notes:** None

### Seed_Eater killability

| Option | Description | Selected |
|--------|-------------|----------|
| Killable with high HP | Mini-boss tier HP. Killing stops corruption and spawning. High-value loot. | ✓ |
| Invulnerable like System_Admin | Can't be killed, only escaped. Both Tier 3 are unkillable. | |
| You decide | Claude's discretion. | |

**User's choice:** Killable with high HP (Recommended)
**Notes:** None

---

## Claude's Discretion

- Exact stat values for all 6 enemy types
- Exact teleport range and tile selection for Null-Pointer
- Buffer-Overflow detonation damage and slow duration
- Dead Zone DoT values and tick frequency
- Logic-Leaker attack range, damage, FIRMWARE_LOCK duration
- System_Admin stun mechanics
- Seed_Eater corruption rate, spawn frequency, HP pool
- Sprite distortion filter implementation
- Spawn table weight values
- Energy speed exact values

## Deferred Ideas

None — discussion stayed within phase scope.
