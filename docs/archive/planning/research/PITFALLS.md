# Domain Pitfalls: Nirmata Runner

**Project:** Nirmata Runner — Extraction Roguelike
**Milestone:** v2.1 Equipment & Inventory System
**Researched:** 2026-04-05
**Overall confidence:** HIGH

## Critical Pitfalls (v2.1 New Features)

Mistakes that cause rewrites or major state desyncs in the Equipment/Inventory system.

### 1. The "Delta Bloat" Performance Trap
**What goes wrong:** In a server-authoritative ECS, every item in the inventory is often treated as an entity. If a player has 30 items, and each item has 5 components (`Name`, `Description`, `Stats`, `Type`, `Rarity`), moving a single item triggers a state delta that includes data for all entities in the world.
**Why it happens:** `json-diff-ts` (the current stack's differ) compares the entire `World` state.
**Consequences:** Massive JSON payloads on every turn, causing lag in browser rendering and high bandwidth usage.
**Prevention:** 
- Store items as "Data Objects" inside a single `InventoryComponent` on the Player entity rather than separate Entities.
- Only promote an item to a "Full Entity" when it is dropped on the floor (needs a `Position` and `Sprite`).
**Detection:** Monitor the size of the `state-delta` in the Network tab; if it exceeds 50KB for a simple movement, you have bloat.

### 2. Software "Orphan Effects"
**What goes wrong:** Software provides a temporary ability or buff (e.g., "Shield for 3 turns"). If the player uninstalls the Software while the effect is active, the system responsible for cleaning up the effect might lose its reference to the source.
**Why it happens:** Lack of "Owner" tracking or improper cleanup logic during the "Uninstall" action.
**Consequences:** Permanent buffs/shields that never expire, breaking game balance.
**Prevention:** 
- Implement an "Effect Registry" that tracks the `EntityID` of the source.
- Prevent uninstallation of Software that has active, non-expired effects.
- Validation: The "Uninstall" action must be a server-validated intent, not just a UI change.

### 3. Inventory-Movement Race Conditions
**What goes wrong:** Player picks up an item and immediately moves. On the client, the item is in the inventory. On the server, the "Move" happened first, and the "Pick Up" fails because the player is now too far from the item.
**Why it happens:** Optimistic client updates and out-of-order execution of intents.
**Consequences:** "Ghost items" in UI that disappear or cause an "Illegal State" error during the next server reconciliation.
**Prevention:** 
- Use "Action Sequencing": Client must wait for the "Pick Up" ACK before allowing "Move", OR the server must process the "Pick Up" at the position where the player *was* when they sent the intent.
- Strictly validate item distance on both Client and Server.

### 4. Recursive Stat Dependency (The Calculation Loop)
**What goes wrong:** Shell gives +10 HP. Armor gives +20% HP. Augment gives +5 HP based on Armor. Software gives +10% total HP.
**Why it happens:** No clear hierarchy for stat modifiers (Additive vs Multiplicative).
**Consequences:** Client and Server calculate different final HP (e.g., `(10 + 5) * 1.2` vs `(10 * 1.2) + 5`), leading to "Dead but Alive" state desyncs.
**Prevention:** 
- Implement a **Standard Stat Pipeline**: 
  1. `Base Stats` (Shell)
  2. `Flat Additives` (Augments, Firmware)
  3. `Percent Multipliers` (Armor, Software)
  4. `Final Total`.
- Share this logic in `@shared/logic/stats.ts` to ensure bit-perfect parity.

---

## Moderate Pitfalls

### 1. Drop Table Dilution
**What goes wrong:** Adding Weapons, Armor, and Augments reduces the chance of finding "Healing" or "Heat Venting" items.
**Prevention:** Use "Slot-Based" loot generation. Instead of one big list, roll for "Category" first (50% Consumable, 30% Equipment, 20% Software).

### 2. UI-ECS Desync (The "Double Item" Bug)
**What goes wrong:** React UI (Zustand) updates to show an item equipped, but the ECS `World` hasn't applied the server delta yet.
**Prevention:** The UI must be a **reactive projection** of the ECS `World` state. Never store "Item Position" in Zustand if it's already in the ECS.

---

## Technical Pitfalls (Existing v2.0 Context)

### 1. Neural Heat "Safe Rotation" Trap
**What goes wrong:** Players avoid abilities above 75 Heat, making the "Overclock" mechanic irrelevant.
**Prevention:** Create "Warmth Bonuses" — abilities that deal *more* damage or have shorter cooldowns when Heat is high, incentivizing risky play.

### 2. Augment Synergy "Invisible Effects"
**What goes wrong:** Synergies fire (e.g., "On Crit, vent 5 Heat") but the player doesn't see it.
**Prevention:** Every trigger must have a visual "Handshake" effect or a clear log entry.

### 3. Weekly Reset "Progress Betrayal"
**What goes wrong:** Players feel punished by the reset.
**Prevention:** Frame the reset as a "System Update" that provides new blueprints. Use the "Legacy Code" mechanic to allow some carry-over.

---

## Phase-Specific Warnings (v2.1)

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Inventory UI** | Drag-and-drop desync | Block world movement while Inventory is open (or use strict sequence IDs). |
| **Drop Tables** | Entity ID exhaustion | Pool item entities or use a "Loot Manager" to clean up old drops. |
| **Software Install** | Neural Memory leaks | Strictly validate Software "Size" vs "Memory Capacity" on every turn. |
| **Equipment Stats** | Multiplier stacking | Cap all multipliers at a "Saturation Point" to prevent exponential power creep. |

## Sources

- [RoguelikeDev: Inventory System Patterns](https://reddit.com/r/roguelikedev) (Community Wisdom)
- [GDC: Server-Authoritative Gameplay in Action Games](https://www.youtube.com/watch?v=W3aieHjyNvw) (Architecture Reference)
- [ECS FAQ: Storing Items as Entities vs Components](https://github.com/SanderMertens/ecs-faq) (Technical Reference)
