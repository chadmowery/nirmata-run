# Enemy Hierarchy: The Glitched Bestiary

In the **Vibrant Decay** aesthetic, enemies are **system errors given form**—high-contrast silhouettes with neon bleeding, leaking source code and static when damaged.

Enemy spawning is governed by [`depth-distribution.json`](../../src/game/entities/templates/spawn-tables/depth-distribution.json) and resolved by [`AISystem`](../../src/game/systems/ai.ts), [`PackCoordinatorSystem`](../../src/game/systems/pack-coordinator.ts), [`DeadZoneSystem`](../../src/game/systems/dead-zone.ts), and [`TileCorruptionSystem`](../../src/game/systems/tile-corruption.ts).

---

## 1. Depth Spawn Distribution ([`depth-distribution.json`](../../src/game/entities/templates/spawn-tables/depth-distribution.json))

| Floor Band | Budget (`base` + `perFloor`) | Enemy Pool & Weights | Buffer-Overflow Pack Size |
| :--- | :--- | :--- | :---: |
| **Floors 1–4** | `8` + `2`/floor | `null-pointer` (`60`), `buffer-overflow` (`40`) | `1–3` |
| **Floors 5–9** | `15` + `3`/floor | `null-pointer` (`30`), `buffer-overflow` (`25`), `fragmenter` (`25`), `logic-leaker` (`20`) | `5–8` |
| **Floors 10–15** | `25` + `5`/floor | `null-pointer` (`15`), `buffer-overflow` (`15`), `fragmenter` (`25`), `logic-leaker` (`25`), `system-admin` (`10`), `seed-eater` (`10`) | `5–8` |

---

## 2. The Three Tiers of Corruption

### Tier 1: Corrupted Data (The Swarm)
Low-health, high-frequency entities that test basic positioning and action economy.

* **`Null-Pointer` (Stalker)** — [`null-pointer.json`](../../src/game/entities/templates/null-pointer.json)
  * **Stats**: HP `6` | Attack `3` | Defense `0` | Speed `120` (Fast) | Sight `8`
  * **Behavior (`ai.ts`)**: When within range `2–8` of the player, teleports (`TeleportIntent`) to an open tile directly behind the player relative to the player's last movement direction. Bump-attacks when adjacent.
  * *Design Note*: Intended to apply `HUD_GLITCH` (2 turns) on hit — tracked in [TRACKING.md](../TRACKING.md).

* **`Buffer-Overflow` (Swarmer)** — [`buffer-overflow.json`](../../src/game/entities/templates/buffer-overflow.json)
  * **Stats**: HP `3` | Attack `2` | Defense `0` | Speed `100` | Sight `6`
  * **Behavior (`pack-coordinator.ts` & `ai.ts`)**: Spawns in coordinated packs sharing a `PackMember` component. Non-leader members pathfind to surround the player's 4 cardinal tiles. When **3 or more** pack members are orthogonally adjacent to the player, they detonate simultaneously—dealing `8` environmental damage per detonating member (`DamageIntent`) and applying `MOVEMENT_SLOW` (duration `2` turns, magnitude `50`).
  * *Design Note*: Wiring `MOVEMENT_SLOW` into movement/energy cost calculation is tracked in [TRACKING.md](../TRACKING.md).

---

### Tier 2: Static Horrors (The Elites)
Mid-tier threats appearing from Floor 5 onward that manipulate terrain and ability availability, dropping Tier 2 Software and Blueprints.

* **`Fragmenter` (Heavy)** — [`fragmenter.json`](../../src/game/entities/templates/fragmenter.json)
  * **Stats**: HP `20` | Attack `8` | Defense `4` | Speed `60` (Slow) | Sight `6`
  * **Behavior (`ai.ts` & `dead-zone.ts`)**: Relentlessly advances toward the player. When orthogonally adjacent, performs a heavy melee slam (`AttackIntent`) and spawns `dead-zone` entities on all 4 cardinal tiles around itself (`remainingTurns: 6`, `damagePerTick: 2`).

* **`Logic-Leaker` (Ranged Kiter)** — [`logic-leaker.json`](../../src/game/entities/templates/logic-leaker.json)
  * **Stats**: HP `12` | Attack `5` | Defense `1` | Speed `100` | Sight `8`
  * **Behavior (`ai.ts`)**: Maintains distance—retreats if the player closes within `<= 2` tiles. At range `3–5` with clear line-of-sight, fires corrupted packets (`DamageIntent` for `5` neural damage) and applies `FIRMWARE_LOCK` (`3` turns), disabling the player's Firmware abilities.

---

### Tier 3: Logic Breakers (The Mini-Bosses)
Deep-dungeon reality breakers appearing on Floors 10–15.

* **`System_Admin` (The Invulnerable Stalker)** — [`system-admin.json`](../../src/game/entities/templates/system-admin.json)
  * **Stats**: Invulnerable (No `Health` component) | Speed `50` (Half player speed) | Sight `20`
  * **Behavior (`ai.ts` & `run-ender.ts`)**: Cannot be killed; only skips turns if affected by a `DISRUPT` status effect. Slowly stalks the player across the floor. If it ends a phase within 1 tile (including diagonals) of the player, `RunEnderSystem` terminates the run immediately (`FATAL: ADMIN_CONTACT`).

* **`Seed_Eater` (The World-Eater)** — [`seed-eater.json`](../../src/game/entities/templates/seed-eater.json)
  * **Stats**: HP `40` | Attack `7` | Defense `3` | Speed `70` | Sight `10`
  * **Behavior (`ai.ts` & `tile-corruption.ts`)**: Advances toward the player while `TileCorruptionSystem` (`Phase.POST_TURN`) mutates 2 tiles per turn in expanding Manhattan rings around the boss (flipping `floor` ↔ `wall` and displacing entities) and spawns 1 Tier 1 sub-process (`null-pointer` or `buffer-overflow`) every 3 turns.
