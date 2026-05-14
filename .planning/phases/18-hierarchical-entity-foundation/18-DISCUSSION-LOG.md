# Phase 18: Hierarchical Entity Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 18-Hierarchical Entity Foundation
**Areas discussed:** Entity Definition Structure, Slot Mutability, Lifecycle & Ownership, ECS Reference Implementation, Network Delta Serialization, Component Validation

---

## Entity Definition Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Nested JSON objects | Easier to read and author; factory flattens them into separate ECS entities and sets up relationships at runtime. (Recommended) | ✓ |
| Flat list with explicit ID references | More explicit, matches the underlying ECS memory layout, but much harder to author manually. | |
| You decide | Let Claude decide the best approach. | |

**User's choice:** Nested JSON objects
**Notes:** None

---

## Slot Mutability

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed by template | Simpler ECS logic. If a player wants more slots, they need to find a better item tier. (Recommended based on Weekly Challenge economy constraints) | |
| Dynamic at runtime | Supports item upgrade systems where players can add new slots to existing gear during a run. | ✓ |
| You decide | Let Claude decide the best approach. | |

**User's choice:** Dynamic at runtime
**Notes:** None

---

## Lifecycle & Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Cascading destruction | Standard database-like behavior. Destroying the parent destroys its installed children. Players must uninstall first to save them. | ✓ |
| Return to inventory | Player-friendly. Destroying a weapon automatically returns any installed software back to the player's run inventory. | |
| You decide | Let Claude decide based on ECS best practices. | |

**User's choice:** Cascading destruction
**Notes:** None

---

## ECS Reference Implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Parent-only tracking | Parent component tracks an array of child IDs (current slot pattern). Harder to ask a child "who is your parent?" | |
| Child-only tracking | Child component stores the Parent ID and Slot Index. Standard relational DB pattern, but harder to iterate a parent's children. | |
| Bi-directional tracking | Both store references. Easiest to query from either direction, but requires logic to keep them in sync. (Recommended for gameplay flexibility) | ✓ |
| You decide | Let Claude decide. | |

**User's choice:** Bi-directional tracking
**Notes:** None

---

## Network Delta Serialization

| Option | Description | Selected |
|--------|-------------|----------|
| Flat entities | The server sends updates for each entity independently in the delta. Requires no custom parsing logic for `json-diff-ts`. (Recommended) | ✓ |
| Deep nested serialization | The server nests child data inside the parent's payload, and the client reconstructs the hierarchy. Might be more complex. | |
| You decide | Let Claude decide. | |

**User's choice:** Flat entities
**Notes:** None

---

## Component Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Schema-based validation | Zod schemas on the slot component definitions explicitly define allowed child types/tags. (Recommended) | ✓ |
| Runtime logic in systems | The system responsible for moving items hardcodes the validation checks. | |
| You decide | Let Claude decide. | |

**User's choice:** Schema-based validation
**Notes:** None

---

## Claude's Discretion

None

## Deferred Ideas

None