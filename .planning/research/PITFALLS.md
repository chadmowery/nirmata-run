# Pitfalls Research: Nirmata Runner v2.0

## 1. Neural Heat System — The "Optimal Avoidance" Trap

**The Pitfall:** If Kernel Panic consequences are too harsh, players will never use abilities above 75 Heat. The entire overclock mechanic becomes theoretical — players find the "safe" rotation and never deviate.

**Warning Signs:**
- Playtesters avoid using abilities when Heat is above 50
- No one voluntarily enters the Corruption Zone
- "Optimal" play becomes "use ability, wait 3 turns, use ability"

**Prevention:**
- Make the Corruption Zone visually exciting and mechanically rewarding (damage boost, speed buff) before consequences kick in
- Ensure some encounters are designed to be unsolvable without overclocking
- Augments that specifically benefit from high Heat create positive incentive
- Kernel Panic effects should be recoverable (temporary debuffs, not permanent damage to run)

**Phase to address:** Firmware & Heat System phase — bake in "warmth bonuses" from the start

---

## 2. Augment Synergy — The "Invisible Effect" Problem

**The Pitfall:** If Augment triggers fire silently, players won't understand why they won or lost. They'll ignore the synergy system and just equip "highest stat" augments.

**Warning Signs:**
- Players can't explain what their Augments did during a run
- No one discusses "builds" or synergy combinations
- Augment selection becomes rote (always pick the same one)

**Prevention:**
- Every Augment trigger MUST have a clear visual + log feedback
- Geometric shape flash (from design doc) is good — make it informative, not just decorative
- Message log should say "Static_Siphon.arc TRIGGERED: +5% Shield (Neural_Spike hit 2 enemies)"
- Consider a post-run "Synergy Report" showing how many times each Augment fired

**Phase to address:** Augment System phase — visual feedback is not polish, it's core

---

## 3. Economy — The "Inflation Death Spiral"

**The Pitfall:** If Scrap drops are too generous relative to costs, players will have infinite Scrap by mid-week and shops become meaningless. Conversely, if too stingy, players feel punished.

**Warning Signs:**
- Players have 10x more Scrap than they can spend
- Or: players can't afford basic repairs after 3 failed runs
- Flux becomes the only currency that matters

**Prevention:**
- Every currency faucet must have a corresponding hard sink (permanently removed, not transferred)
- Scrap: earned on every run → spent on repairs, re-initialization, basic Software purchases
- Blueprints: rare drops → consumed on compilation (permanent sink)
- Flux: deep-run extraction only → spent on Shell upgrades, Blueprint compilation
- Implement server-side economy validation — clients cannot mint currency
- Start conservative (slightly stingy) and tune up — it's easier to increase rewards than to take them away

**Phase to address:** Currency & Economy phase — build with monitoring hooks from day one

---

## 4. Weekly Reset — The "Player Betrayal" Risk

**The Pitfall:** If the weekly reset feels like it erases player effort, players will quit. The "Legacy Code" degradation mechanic helps, but if communicated poorly, it reads as "your stuff got nerfed."

**Warning Signs:**
- Players complain about "losing everything" on Monday
- Engagement drops sharply after first weekly reset
- Players hoard and refuse to use good items (paralysis)

**Prevention:**
- Frame the reset as a positive event: "New Version Available" with new meta, winner's item reveal
- Legacy Code should still be usable — just incentivize finding new versions
- The pity mechanic (installed Firmware stays) must feel meaningful
- Visual ceremony for the reset — make it feel like an event, not a punishment
- Consider a "Legacy Score" that persists across weeks (lifetime achievement)

**Phase to address:** Blueprint & Weekly Reset phase — framing and UX are critical

---

## 5. Multi-Floor Generation — The "Monotonous Descent" Problem

**The Pitfall:** If every floor feels the same but harder, depth becomes tedious. Players will extract early because there's no compelling reason to go deeper beyond "bigger numbers."

**Warning Signs:**
- Players consistently extract at the first Anchor
- Deeper floors only differ in enemy HP/damage scaling
- No "wow moments" below floor 5

**Prevention:**
- Each depth tier should introduce new enemy types (Tier 1 on floors 1-5, Tier 2 on 5-10, Tier 3 on 10-15)
- Environmental variety (different tile themes, room shapes, hazard types per depth band)
- Loot tables that are strictly better at depth (Firmware ONLY drops below floor 5, rare Augments below floor 10)
- Unique room types that only appear at specific depths (treasure rooms, challenge rooms)

**Phase to address:** Multi-Floor Generation phase + Extraction Loop phase

---

## 6. Enemy Tier 3 (Logic Breakers) — The "Unfair Death" Effect

**The Pitfall:** The System_Admin (instant-kill stalker) is a brilliant design concept, but if players can't see it coming or can't react, it creates frustration rather than tension.

**Warning Signs:**
- Players complain about "unfair" deaths to System_Admin
- Players reload/restart when they hear the System_Admin spawn
- The mechanic feels like a "gotcha" rather than a pressure valve

**Prevention:**
- Heavy foreshadowing: visual/audio cues rooms before the System_Admin appears
- Give players multiple escape options (Phase_Shift through it, stun items, environmental traps)
- System_Admin movement should be SLOW and predictable — the terror is inevitability, not speed
- Never spawn System_Admin without an escape route available
- Consider making it attracted to high Heat (reward for playing safe, extra threat for overclockers)

**Phase to address:** Enemy Hierarchy phase — test System_Admin extensively in isolation

---

## 7. Software "Burn" System — The "Consumable Hoarding" Problem

**The Pitfall:** If Software is consumable and lost on death, players will hoard it and never use it on practice runs. The entire system becomes irrelevant except for Weekly.

**Warning Signs:**
- Players only equip Software on Weekly runs
- Software inventory grows unchecked in stash
- Daily runs feel "naked" and less fun

**Prevention:**
- Make Software common enough that players don't fear using it
- Neural Simulation drops should be generous with Software
- Consider "Virtual Software" for Simulation runs (copies that only work in practice mode)
- Weekly Vault system should have limited slots — forces players to choose which Software to protect

**Phase to address:** Software System phase + Run Modes phase (different rules per mode)

---

## 8. ECS Component Explosion — The Architectural Creep

**The Pitfall:** Adding Shell, Firmware, Augment, Software, Heat, Stability, Wallet, Stash, Vault, Blueprint, StatusEffect, EnemyTier, Swarm, Boss, SpecialAttack, etc. can make the component system unwieldy. Queries become complex, system ordering becomes fragile.

**Warning Signs:**
- Entities have 15+ components
- Systems need to query 5+ component types
- Adding a new system requires touching 3+ existing systems
- Performance degrades due to component lookup overhead

**Prevention:**
- Group related data into compound components (LoadoutComponent contains all equipment references)
- Use the event bus for cross-system communication instead of component queries
- Document system execution order explicitly
- Systems should follow single-responsibility: HeatSystem ONLY manages heat, not combat effects
- Regular architecture audits to check engine/game boundary is maintained

**Phase to address:** Every phase — enforce in code review

---

## 9. Stability Anchor UI — The "Flow Breaker" Risk

**The Pitfall:** If the Stability Anchor transition takes too long or is too jarring, it breaks the game's flow. The "System Handshake" animation concept is cool but could become tedious by floor 10.

**Warning Signs:**
- Players skip through the Anchor UI as fast as possible
- The transition animation feels like a loading screen
- Players find the forced pause frustrating in practice runs

**Prevention:**
- Keep the transition under 2 seconds (visual flair should be snappy)
- Make the inventory manifest genuinely useful — show what you'd lose vs. keep
- Add a "quick extract" keybind for experienced players (skip animation)
- Different behavior per run mode: faster/simpler in Neural Simulations, full ceremony in Weekly

**Phase to address:** Stability & Extraction phase — playtest the transition aggressively

---

## 10. Turn-Based Adaptation — The "Real-Time Envy" Problem

**The Pitfall:** The design docs describe real-time concepts (dash, teleport, homing projectiles, toggle abilities, "slippery" movement). If adapted poorly to turn-based, they'll feel clunky or meaningless.

**Warning Signs:**
- Phase_Shift "dash" is just "move to tile" with animation
- "Homing" projectiles are just guaranteed-hit ranged attacks
- Toggle abilities (Extended_Sight) drain Heat "per second" which doesn't map to turns
- Status effects with "3 seconds" duration need to be "3 turns" — but is that balanced?

**Prevention:**
- Reframe each mechanic in turn-based terms explicitly during implementation:
  - Phase_Shift: move up to 3 tiles, ignore collision, costs Heat
  - Neural_Spike: ranged attack, line-of-sight, high damage, costs Heat
  - Extended_Sight: costs Heat PER TURN while active (toggle on/off as free action)
  - "Homing" → "guided" (can curve around a single corner)
  - "Slippery" movement → input lag: player's next move goes in the PREVIOUS direction first
- Playtest every real-time concept's turn-based adaptation in isolation before combining

**Phase to address:** Firmware phase (abilities) + Enemy Hierarchy phase (enemy abilities)

---
*Research completed: 2026-03-29*
