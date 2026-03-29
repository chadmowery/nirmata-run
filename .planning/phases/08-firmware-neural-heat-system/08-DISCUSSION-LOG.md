# Phase 8: Firmware & Neural Heat System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 08-firmware-neural-heat-system
**Areas discussed:** Heat accumulation & dissipation model, Firmware ability activation flow, Kernel Panic consequence resolution, Vent action economy

---

## Heat Accumulation & Dissipation Model

### Q1: When does dissipation happen in the turn cycle?

| Option | Description | Selected |
|--------|-------------|----------|
| Start of player turn | Player sees current Heat after dissipation, then decides whether to push further | ✓ |
| End of player turn | Player commits to an action at current Heat, then gets relief afterward | |
| You decide | Agent's discretion | |

**User's choice:** Start of player turn
**Notes:** Creates a clean "this is where I stand" moment before acting.

### Q2: What base dissipation rate per turn?

| Option | Description | Selected |
|--------|-------------|----------|
| 5 Heat/turn | ~8 turns to cool from Neural_Spike. Meaningful tension. | ✓ |
| 10 Heat/turn | Faster cooldown, more aggressive play | |
| Percentage-based (10% of current) | Exponential decay, more organic | |
| You decide | Agent's discretion | |

**User's choice:** 5 Heat/turn
**Notes:** None

### Q3: Should Shell stats modify Heat behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — Stability influences dissipation | Shell archetype trade-off, gives Stability combat role | ✓ |
| No — independent of Shell stats | Keep Heat self-contained | |
| You decide | Agent's discretion | |

**User's choice:** Yes — Stability stat influences dissipation rate
**Notes:** None

### Q4: Does Heat persist across floors, or reset?

| Option | Description | Selected |
|--------|-------------|----------|
| Persists | Carries over to next floor, strategic depth | ✓ |
| Resets per floor | Fresh tactical puzzle each floor | |
| You decide | Agent's discretion | |

**User's choice:** Persists
**Notes:** None

---

## Firmware Ability Activation Flow

### Q5: How does the player select and fire a Firmware ability?

| Option | Description | Selected |
|--------|-------------|----------|
| Indexed hotkey (1-3 keys) | Fast, keyboard-native, maps to FirmwareSlots indices | ✓ |
| Ability menu mode | Two-step: key to open menu, then select | |
| You decide | Agent's discretion | |

**User's choice:** Indexed hotkey
**Notes:** None

### Q6: How do targeted abilities work?

| Option | Description | Selected |
|--------|-------------|----------|
| Direction-based targeting | Arrow/WASD after hotkey, two-step | |
| Cursor/tile selection | Free-aim cursor moved to target tile | ✓ |
| Auto-target nearest enemy | Simplest but removes player agency | |
| You decide | Agent's discretion | |

**User's choice:** Cursor-based tile selection
**Notes:** Follow-up question asked about cursor input method.

### Q6b: How should the targeting cursor work?

| Option | Description | Selected |
|--------|-------------|----------|
| Grid cursor with keyboard movement | Arrow/WASD moves cursor, Enter/Space confirms, Escape cancels | |
| Mouse point-and-click | Hover and click to target | |
| Both keyboard cursor + mouse click | Support either input method | ✓ |
| You decide | Agent's discretion | |

**User's choice:** Both keyboard cursor + mouse click
**Notes:** Most flexible option, more implementation work.

### Q7: Does using Firmware consume the player's turn?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — full turn cost | Move OR Firmware, not both | ✓ |
| Free action + move | Firmware doesn't consume movement | |
| You decide | Agent's discretion | |

**User's choice:** Full turn cost
**Notes:** None

### Q8: How are Firmware abilities defined in data?

| Option | Description | Selected |
|--------|-------------|----------|
| JSON templates with AbilityDef component | Each Firmware is a JSON entity template | ✓ |
| Hardcoded ability functions | Each ability is a TypeScript function | |
| You decide | Agent's discretion | |

**User's choice:** JSON templates
**Notes:** Consistent with project composability constraint.

---

## Kernel Panic Consequence Resolution

### Q9: How should Kernel Panic effects be represented in Phase 8?

| Option | Description | Selected |
|--------|-------------|----------|
| Lightweight status effect stub | Minimal StatusEffects component, Phase 9 extends it | ✓ |
| Simple flags on HeatState component | Boolean/counter fields, Phase 9 migrates | |
| You decide | Agent's discretion | |

**User's choice:** Lightweight status effect stub
**Notes:** Forward-compatible with Phase 9.

### Q10: When does a Kernel Panic roll happen relative to the ability effect?

| Option | Description | Selected |
|--------|-------------|----------|
| After ability resolves | Firmware fires first, then penalty | ✓ |
| Before ability resolves | Roll first, may cancel ability | |
| You decide | Agent's discretion | |

**User's choice:** After ability resolves
**Notes:** "It worked, but at what cost?"

### Q11: What should CRITICAL_REBOOT do mechanically?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip next N turns + forced Heat vent to 0 | Stunned, enemies get free attacks, Heat resets | ✓ |
| Instant forced extraction/death | Maximum punishment | |
| Disable all Firmware for N turns + heavy damage | Can still move/attack | |
| You decide | Agent's discretion | |

**User's choice:** Skip next N turns + forced Heat vent to 0
**Notes:** Devastating but self-correcting. Prevents infinite overclock stacking.

### Q12: Should Kernel Panic probability be pure random or influenced?

| Option | Description | Selected |
|--------|-------------|----------|
| Pure random against tier table | Simple, predictable, fair | |
| Modified by Shell stats or equipment | Stability reduces roll chance | ✓ |
| You decide | Agent's discretion | |

**User's choice:** Modified by Shell stats or equipment
**Notes:** Pairs with Stability influencing dissipation rate — Stability becomes THE defensive stat against Heat risk.

---

## Vent Action Economy

### Q13: How much Heat does Venting remove?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed large amount (50 Heat) | Predictable, easy to reason about | |
| Percentage-based (50% of current Heat) | More useful when very hot | ✓ |
| Full reset to 0 | Maximum relief, trivializes management | |
| You decide | Agent's discretion | |

**User's choice:** Percentage-based (50% of current Heat)
**Notes:** Creates sweet spot where Venting at peak Heat gives maximum value.

### Q14: Does Venting have any drawback beyond turn cost?

| Option | Description | Selected |
|--------|-------------|----------|
| Vulnerability flag — reduced defense until next turn | Tactical positioning decision | ✓ |
| No extra drawback — turn cost is enough | Simpler | |
| You decide | Agent's discretion | |

**User's choice:** Vulnerability flag
**Notes:** Don't Vent when enemies are adjacent.

### Q15: Can Venting be interrupted or cancelled?

| Option | Description | Selected |
|--------|-------------|----------|
| No — Vent always succeeds | Risk is in the decision, not the execution | ✓ |
| Enemies can interrupt Vent | High risk/high reward | |
| You decide | Agent's discretion | |

**User's choice:** Vent always succeeds
**Notes:** None

### Q16: Should there be a Vent cooldown?

| Option | Description | Selected |
|--------|-------------|----------|
| No cooldown | Turn cost is natural gating | ✓ |
| N-turn cooldown | Prevents "Vent spam" | |
| You decide | Agent's discretion | |

**User's choice:** No cooldown
**Notes:** None

---

## Agent's Discretion

- Exact Zod schema shapes for HeatComponent, AbilityDef, and StatusEffects
- Cursor rendering implementation
- Exact Stability-to-dissipation and Stability-to-Kernel-Panic-chance formulas
- CRITICAL_REBOOT stun duration (2-3 turns recommended)
- Targeting mode state management approach
- Vulnerability flag implementation during Vent

## Deferred Ideas

None — discussion stayed within phase scope.
