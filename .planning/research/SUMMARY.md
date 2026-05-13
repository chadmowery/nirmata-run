# Research Summary: Equipment & Inventory System (v2.1)

**Project:** Nirmata Runner — Extraction Roguelike
**Milestone:** v2.1 Equipment System
**Status:** Synthesis Complete
**Date:** 2024-05-15

## Executive Summary

The v2.1 Milestone transitions Nirmata Runner from a "stub" software system to a fully realized **Hierarchical Equipment Model**. The research confirms that the best approach for a server-authoritative extraction roguelike is to treat major equipment (Weapons, Armor) as first-class ECS entities capable of hosting their own sub-entities (Software). This architecture preserves the "Vibrant Decay" aesthetic of modular, ephemeral gear while ensuring state consistency across the Next.js/React/PixiJS stack.

The core innovation remains the intersection of the **Neural Heat** risk system and equipment management. Research suggests that inventory management should not just be a menu but a tactical layer, with turn-costs for swapping gear and high-heat penalties for high-power loadouts. The primary technical risk is "Delta Bloat"—ensuring that the increase in entity count for items doesn't degrade performance of the `json-diff-ts` state synchronization.

## Key Findings

### From STACK.md (Technology)
*   **Core Stack (Unchanged):** Next.js 16.1.6, React 19.2.4, PixiJS 8.17.0, and `rot-js` 2.2.1.
*   **Inventory UI Enhancements:** Recommended use of `@dnd-kit/core` for drag-and-drop inventory management and `@radix-ui/react-tooltip` for detailed, accessible item stat overlays.
*   **State Management:** `immer` is added to handle complex, nested immutable updates for the hierarchical inventory state within the existing Zustand stores.
*   **Rationale:** These libraries minimize boilerplate while maintaining the strict "Vibrant Decay" custom styling requirements.

### From FEATURES.md (Capabilities)
*   **Table Stakes:** Slot-based equipment (Weapon, Armor, Firmware, Augments) and in-run inventory capacity limits are essential for the extraction loop.
*   **Differentiators:** Neural Heat costs for gear and "Turn-Cost Inventory Management" (swapping gear costs a turn) add tactical depth.
*   **Anti-Features:** Explicitly avoid "Inventory Tetris" and "Infinite Stash" to maintain the focus on high-stakes extraction.
*   **MVP Priority:** Focus on basic slot-mapping and item drop tables before attempting complex Trigger/Payload augment synergies.

### From ARCHITECTURE.md (Patterns)
*   **Hierarchical Entity Model:** Items are full entities. The Player entity references equipped items, and items reference installed Software entities (nested slots).
*   **Intent Queuing:** All inventory actions (Equip, Install, Drop) must be processed via discrete ECS `Intent` components to maintain server authority.
*   **Dynamic Stat Pipeline:** Combat stats should be computed on-the-fly (Shell + Gear + Software) rather than mutating the Player's base component, preventing desync.

### From PITFALLS.md (Risks)
*   **Delta Bloat:** Syncing many item entities can spike network traffic. *Mitigation:* Consider data-only records for unequipped items; promote to full entities only when dropped.
*   **Recursive Stat Dependency:** Inconsistent calculation of additive vs. multiplicative buffs. *Mitigation:* Implement a standardized `shared/logic/stats.ts` pipeline.
*   **Orphan Effects:** Unstalling software while it has active buffs. *Mitigation:* Implement an "Effect Registry" with owner tracking.

## Implications for Roadmap

### Suggested Phase Structure

1.  **Refactor: Generalized Inventory** — Update `RunInventory` to support generic item types (`weapon`, `armor`, `software`) and refactor `ItemPickupSystem`.
    *   *Rationale:* Establishes the foundation for all future item types.
2.  **Implementation: Hierarchical Equipment** — Create `WeaponDef`/`ArmorDef` components and move `SoftwareSlots` onto item entities.
    *   *Rationale:* Core architectural shift required for modular equipment.
3.  **Engine: Dynamic Stat Pipeline** — Update `CombatSystem` and `resolveDamage` to source values from the equipment hierarchy.
    *   *Rationale:* Ensures gear actually impacts gameplay; must avoid permanent stat mutation.
4.  **Balance: Updated Drop Tables** — Integrate Weapons/Armor into the 3-tier enemy hierarchy using `rot-js` RNG.
    *   *Rationale:* Connects the new systems to the core gameplay loop.
5.  **UI: Inventory Management Screen** — Build the React interface using `@dnd-kit` and `@radix-ui`.
    *   *Rationale:* Final Polish and user accessibility; depends on all underlying systems being stable.

### Research Flags
*   **Needs Research Phase:** The "Trigger & Payload" augment system (Phase 11-12) requires a dedicated research phase to define the event-bus interrupt patterns.
*   **Standard Patterns:** The basic Slot-based equipment and Inventory UI (Phase 1-2) follow well-documented patterns and can skip deep research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Libraries are modern and well-supported; minimal risk. |
| Features | HIGH | Well-aligned with "Extraction Roguelike" genre expectations. |
| Architecture | HIGH | Hierarchical ECS is a standard solution for modular systems. |
| Pitfalls | MEDIUM | Performance of state-diffing with nested entities needs active monitoring. |

### Gaps to Address
*   **Network Performance:** We need to verify the threshold where `json-diff-ts` performance degrades with entity count.
*   **Save/Persistence:** The research focused on run-time state; the serialization of the hierarchical entity tree for "between-run" storage needs refinement.

## Sources
*   `.planning/research/STACK.md`
*   `.planning/research/FEATURES.md`
*   `.planning/research/ARCHITECTURE.md`
*   `.planning/research/PITFALLS.md`
*   `PROJECT.md` (Core Mandates)
*   ECS FAQ (Technical Patterns)
