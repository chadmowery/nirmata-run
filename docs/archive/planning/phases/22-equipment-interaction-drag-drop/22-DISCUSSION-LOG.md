# Phase 22: Equipment Interaction (Drag & Drop) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 22-Equipment Interaction (Drag & Drop)
**Areas discussed:** Drag & Drop Tech, Software Installation UX, Optimistic UI during Drag, Click Fallback Target

---

## Drag & Drop Tech

| Option | Description | Selected |
|--------|-------------|----------|
| HTML5 Drag & Drop API | Standard web approach, handles ghost images automatically. | ✓ |
| Custom Pointer Events | More control over visuals, better for complex custom logic. (Recommended) | |

**User's choice:** HTML5 Drag & Drop API
**Notes:** None

---

## Software Installation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Drop onto the parent equipment slot | Auto-assigns to the first available child slot. Larger target. | |
| Drop onto specific nested software indicator | More precise, but requires hitting a smaller drop target. | |
| Either works | Drop on parent auto-assigns, drop on indicator assigns specifically. (Recommended) | ✓ |

**User's choice:** Either works
**Notes:** Uninstallation UX was also discussed.

## Uninstall UX

| Option | Description | Selected |
|--------|-------------|----------|
| Drag indicator to backpack | Drag the small indicator off the weapon back to the inventory grid. | |
| Right-click/Double-click | Simple click interaction to pop it back to the grid. | |
| Support both | Provides both visual drag and fast-action fallback. (Recommended) | ✓ |

**User's choice:** Support both
**Notes:** None

---

## Optimistic UI during Drag

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic update | UI updates instantly, rolls back if server rejects. Matches movement logic. (Recommended) | ✓ |
| Server-first | UI waits for server delta before moving the item visually. Safer but might feel sluggish. | |

**User's choice:** Optimistic update
**Notes:** None

---

## Click Fallback Target

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-equip to first valid slot | Fills the first valid slot found (e.g., Weapon 1 before Weapon 2). Fast. (Recommended) | |
| Prompt user to select slot | Pauses and asks the user which slot they want. Slower but precise. | |
| Only works if unambiguous target | Only works if there's one clear choice; otherwise does nothing. | ✓ |

**User's choice:** Only works if unambiguous target
**Notes:** None

---

## Claude's Discretion

- Exact visual feedback for the HTML5 drag ghost image.
- Specific implementation of the optimistic rollback state handling within the Zustand store.

## Deferred Ideas

None
