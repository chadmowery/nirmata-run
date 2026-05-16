# Phase 21: Inventory & Item Tooltips - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 21-Inventory & Item Tooltips
**Areas discussed:** Inventory Layout, Interaction Model, Tooltip Density, Sorting & Filtering, Invalid Actions

---

## Inventory Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Center Overlay | Dims the game behind it, focused modal window. | ✓ |
| Side Panel | Slides in, game remains visible alongside it. | |
| Full Screen | Completely replaces the game view while open. | |

**User's choice:** Center Overlay

| Option | Description | Selected |
|--------|-------------|----------|
| Split View | Classic RPG style. Left side shows equipped gear, right side shows available items. | ✓ |
| Tabs | Toggle between views. Less cluttered but requires more clicks to equip. | |
| Integrated Grid | Equipment slots are fixed cells within the main grid. | |

**User's choice:** Split View

| Option | Description | Selected |
|--------|-------------|----------|
| Nested Indicators | Small visual indicators directly on the equipment card/icon. | ✓ |
| Detail Panel | Selecting equipment opens a dedicated pane for its software. | |
| Expandable Row | Clicking expands the equipment item in place to show slots. | |

**User's choice:** Nested Indicators

---

## Interaction Model

| Option | Description | Selected |
|--------|-------------|----------|
| Drag & Drop Only | Pure manual drag-and-drop only. | |
| Click Fallback | Double-click or right-click context menu to equip, alongside D&D. | ✓ |
| Select to Swap | Click item, then click destination slot. | |

**User's choice:** Drag & Drop Only and Click Fallback (Interpreted from "1 and 2")

| Option | Description | Selected |
|--------|-------------|----------|
| Warning Prompt | Confirmation dialog. Safe but slows down gameplay. | |
| Visual Indicator | UI shows cost while hovering/dragging. | |
| Immediate Action | Standard roguelike flow: it just happens and time advances. | ✓ |

**User's choice:** Immediate Action

---

## Tooltip Density

| Option | Description | Selected |
|--------|-------------|----------|
| All-in-one | Hovering shows everything immediately. Can become very large. | |
| Tiered (Alt to expand) | Hover shows basic stats; holding a key (e.g., 'Alt') expands it. | ✓ |
| Inspect Mode | Right-click or click to open a persistent detail pane. | |

**User's choice:** Tiered (Alt to expand)

| Option | Description | Selected |
|--------|-------------|----------|
| Follows Cursor | Tooltip moves with the mouse. Can obscure things. | |
| Anchored to Item | Appears predictably next to the hovered item. | ✓ |
| Fixed Panel | Always appears in a dedicated info panel area. | |

**User's choice:** Anchored to Item

---

## Sorting & Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-sorted | Inventory automatically sorts items by type and rarity. | |
| Manual Grid | Players can drag items to specific slots in the grid. | ✓ |
| Category Tabs | Separate tabs for different item categories. | |

**User's choice:** Manual Grid

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-place in first slot | Automatically fills the first empty cell from top-left. | ✓ |
| Require manual placement | Forces the player to open the inventory to place it. | |
| Overflow row | Picks up but goes to an overflow row if grid is full. | |

**User's choice:** Auto-place in first slot

---

## Invalid Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Snap-back + Log | The item snaps back, and a message appears in the combat log. | |
| Glitch Flash | The slot flashes red/glitches, snapping the item back. | |
| Prevent Highlight | The slot simply doesn't highlight as a valid drop target during the drag. | ✓ |

**User's choice:** Prevent Highlight

| Option | Description | Selected |
|--------|-------------|----------|
| Brief Toast/Tooltip | A quick red text pops up saying 'Invalid Target' or similar. | ✓ |
| Do Nothing | The action is simply ignored without explicit feedback. | |
| Combat Log Error | Message appears in the combat log. | |

**User's choice:** Brief Toast/Tooltip

## Claude's Discretion

Empty states (visuals for empty slots and empty inventory)

## Deferred Ideas

None