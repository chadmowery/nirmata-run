# Project Health Check Report: ECS, Events, and Client-Server Architecture

**Date:** April 5, 2026
**Subject:** Deep Project Review / Health Check

## 1. Use of `any` Types
The project contains several high-impact usages of `any` that compromise type safety and maintainability.

### High Impact / Critical Concerns
*   **`src/shared/types.ts` (`SerializedWorldSchema`):** The component stores are defined as `z.record(z.string(), z.record(z.string(), z.any()))`. 
    *   **Impact:** When the world state is synchronized from the server, component data is not validated. This makes it impossible for the client to guarantee that received data matches the expected `ComponentDef` schema at runtime.
*   **`src/shared/reconciliation.ts`:** Uses `any` to cast serialized events before re-emitting them on the `EventBus`.
    *   **Impact:** If server and client event definitions drift, the client may receive events with malformed payloads, leading to silent failures in visual/UI systems or runtime crashes in event handlers.

### Moderate Impact Concerns
*   **JSON Configuration Access:** Files like `src/game/systems/currency-drop.ts`, `shop-rotation.ts`, and `run-mode-config.ts` frequently cast imported JSON (like `economy.json`) to `any`.
    *   **Impact:** The code is fragile. If the JSON structure changes, these systems will fail at runtime instead of at compile time.
*   **`src/shared/utils/logger.ts`:** Uses `any[]` for logging arguments. This is standard and low-risk.

---

## 2. ECS & Event System Maintainability
The current usage is functional but shows signs of "architecture drift" that will hinder scaling.

### Architectural Redundancy
*   **Duplicate Turn Handlers:** `TurnManager` handlers (player/enemy action logic) are defined in `src/game/engine-factory.ts` but then overwritten in `src/game/setup.ts`. This duplication is a source of bugs where one logic path might be updated while the other is forgotten.
*   **World State Reset:** The `World.loadSerializableState` method resets the entire entity and component store. This prevents incremental updates and is highly inefficient for large worlds.

### Inconsistent Action Processing
*   Actions are currently processed in three places using different patterns:
    1.  **Client-side prediction:** Systems are called directly in `handlePlayerInput`.
    2.  **Server API:** A `switch` statement in `route.ts` manually triggers system methods or emits events.
    3.  **Engine Internal:** `TurnManager` handlers define what happens when a turn advances.
*   **Recommendation:** Consolidate this into a unified `ActionProcessor` that can be shared between the client (for prediction) and server (for authority).

---

## 3. Client/Server Prediction Health
The current implementation is better described as **"Server Overwrite"** rather than **"Prediction/Reconciliation."**

*   **How it works:** The client runs systems locally to provide immediate feedback. When the server response arrives, the **entire** local world state is deleted and replaced with the server's version.
*   **Is it healthy?** 
    *   For a turn-based game, this is the most robust approach to "Truth." 
    *   However, it is extremely inefficient. Sending the full world (all entities, all components) every turn will eventually cause lag and hit payload size limits.
*   **Recommendation:** Move to a **State Patching** model. The server should only send changes to entities the client already knows about, and the client should apply these as patches instead of a full wipe.

---

## 4. Hard Split / Anti-Cheat Feasibility
The project is currently in a **weak position** regarding anti-cheat and data security.

*   **The Problem:** The server currently serializes and sends the **entire world** to the client every turn. Any user can "sniff" the network response or inspect the local ECS state to find every enemy, loot item, and exit on the map, regardless of the Fog of War.
*   **Feasibility of a Hard Split:**
    *   **High Difficulty:** A hard split requires a server-side visibility system (FOV) that filters the `SerializedWorld` before sending it. 
    *   **Blocker:** `World.loadSerializableState` (as mentioned in section 2) wipes the world. If the server only sends "visible" entities, the client will delete all "non-visible" entities (including the player's memory of past rooms).
*   **Path Forward:** You must implement a visibility-aware serialization layer that only includes entities in the player's FOV (or marked as "known") and update the `World` to support partial state merges.

---

## 5. Immediate High-Value Recommendations

1.  **Strict Component Synchronization:**
    *   Create a mapping of component keys to their Zod schemas.
    *   Update `SerializedWorldSchema` to validate its contents using these schemas during synchronization.
2.  **Unified Action Processor:**
    *   Move the logic for "what a MOVE action does" out of the API and TurnManager handlers into a single `ActionProcessor` class.
3.  **Implement `World.patchState`:**
    *   Create a method that updates existing entities and adds new ones without clearing the entire store. This is the prerequisite for both efficiency and anti-cheat.
4.  **Server-Side Visibility Filtering:**
    *   Add a step in the `POST /api/action` route that uses the `FovAwareness` system to strip data from the response payload before it leaves the server.
5.  **Clean up `engine-factory.ts` vs `setup.ts`:**
    *   Remove redundant handler definitions. `createEngineInstance` should provide the "default" behavior, and `setup.ts` should only add client-specific bridges (like UI syncing).
