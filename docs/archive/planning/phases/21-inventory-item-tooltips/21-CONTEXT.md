# Phase 21: Inventory & Item Tooltips - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

In-run inventory management screen for equipping Weapons, Armor, and Software, moving items via drag-and-drop, and viewing item tooltips.

</domain>

<decisions>
## Implementation Decisions

### Inventory Layout
- **D-01:** The inventory will be presented as a Center Overlay (dims the game behind it, maintains 'Vibrant Decay' aesthetic).
- **D-02:** Inside the overlay, the layout is a Split View (Left: Shell equipment, Right: Backpack grid).
- **D-03:** Software slots will be presented as Nested Indicators (small visual indicators directly on the equipment icon).

### Interaction Model
- **D-04:** The system will support both manual Drag & Drop AND a click-based fallback (e.g., double-click/right-click) for accessibility.
- **D-05:** Swapping items costs 1 turn. This will happen via Immediate Action (standard roguelike flow: it just happens and time advances) without a confirmation prompt.

### Tooltip Density
- **D-06:** Tooltips will use a Tiered approach (Hover shows basic stats; holding a key like 'Alt' expands it to show software/deep stats).
- **D-07:** The tooltip position will be Anchored to the Item being hovered, appearing predictably next to it.

### Sorting & Filtering
- **D-08:** The backpack will use a Manual Grid where players can drag items to specific slots.
- **D-09:** When picking up new loot from the ground, it will automatically fill the first empty cell from the top-left in the manual grid.

### Invalid Actions
- **D-10:** For drag-and-drop, invalid targets will Prevent Highlight (the slot simply won't highlight as a valid drop target).
- **D-11:** For click fallback actions, attempting an invalid action will show a Brief Toast/Tooltip (e.g., 'Invalid Target').

### Claude's Discretion
Empty states (visuals for empty slots and empty inventory) were discussed but left for Claude to implement fitting the 'Vibrant Decay' aesthetic.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` — Core requirements UI-01, UI-02, UI-03.
- `.planning/PROJECT.md` — Visual constraints ('Vibrant Decay' aesthetic) and Turn-based core loop constraints.

### Codebase Organization
- `.planning/codebase/STRUCTURE.md` — UI organization and existing HUD structures.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Store: `src/game/ui/store.ts` for managing UI state.
- Components: Existing HUD components in `src/components/ui/` can serve as reference for the 'Vibrant Decay' aesthetic (e.g., `HUDOverlay.tsx`, `styles.module.css`).

### Established Patterns
- Manual implementation required for Drag & Drop and Tooltips (no external libraries like `dnd-kit` or `radix-ui/tooltip`).
- Equipment swaps must hook into the Turn Manager to cost 1 turn.

### Integration Points
- The inventory toggle should integrate with the `HUDOverlay.tsx` or main game page.

</code_context>

<specifics>
## Specific Ideas

No specific references beyond the established 'Vibrant Decay' style.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 21-inventory-item-tooltips*
*Context gathered: 2026-05-16*