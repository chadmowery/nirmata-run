# Phase 12: Multi-Floor Generation & Stability/Extraction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 12-multi-floor-generation-stability-extraction
**Areas discussed:** Floor transitions, Stability & drain, Anchor UX & UI, Depth content scaling, Run results screen, Floor transition feel, Scrap implementation scope, Death consequences

---

## Floor Transitions

### Floor transition architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Regenerate world | Destroy non-player entities, generate new Grid via BSP with floor-specific seed, place new entities. Player persists. Systems stay alive. | ✓ |
| Floor stack (keep visited) | Keep previously visited floors in memory. Bidirectional staircases. Enables backtracking. | |
| Floor cache (limited) | Cache last 2-3 floors, regenerate older ones. Some backtracking possible. | |

**User's choice:** Regenerate world
**Notes:** Simplest approach, aligns with existing architecture. No backtracking needed.

### Staircase interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Step-on auto-descend | Moving onto staircase immediately triggers transition. | |
| Step-on + confirm | Moving onto staircase prompts confirmation dialog. | ✓ |
| Explicit interact action | Stand on staircase and press interact key. | |

**User's choice:** Step-on + confirm
**Notes:** Prevents accidental descent.

### Staircase location

| Option | Description | Selected |
|--------|-------------|----------|
| Furthest room from spawn | Greatest distance from spawn room. Forces full exploration. | ✓ |
| Random non-spawn room | Any room except spawn. Less predictable. | |
| You decide | Claude picks. | |

**User's choice:** Furthest room from spawn

### Max floor depth

| Option | Description | Selected |
|--------|-------------|----------|
| 15 floors | Matches depth-distribution.json. | |
| Unlimited (soft cap) | No hard max, difficulty makes survival unlikely. | |
| Configurable in JSON | Max floor in config file, default 15. | ✓ |

**User's choice:** Configurable in JSON

---

## Stability & Drain

### Drain trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Per floor entered | Fixed chunk on each new floor. | |
| Per turn while on floor | Slow drain every turn. | |
| Both (floor + per-turn) | Big chunk on entry + slow bleed per turn. | ✓ |

**User's choice:** Both
**Notes:** Maximum extraction pressure.

### Escalation curve

| Option | Description | Selected |
|--------|-------------|----------|
| Linear increase | Both drains increase linearly with depth. Predictable, easy to tune. | ✓ |
| Exponential ramp | Dramatic acceleration on deep floors. | |
| You decide | Claude picks. | |

**User's choice:** Linear increase

### Zero stability consequence

| Option | Description | Selected |
|--------|-------------|----------|
| Instant death | Immediate run end with full death consequences. | |
| Grace period | 5-turn countdown. | |
| Degraded state | HP damage each turn until dead. Bleeding-out feel. | ✓ |

**User's choice:** Degraded state
**Notes:** Creates dramatic last-ditch extraction moments.

### Anchor refill amount

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed percentage | Refills fixed % (e.g., 50%) of max Stability. | ✓ |
| Full refill | Restores to 100%. | |
| Diminishing refill | 75% → 50% → 25%. Escalating scarcity. | |

**User's choice:** Fixed percentage

### Stability HUD visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible | Stability bar permanently on HUD. | ✓ |
| Visible below threshold | Hidden until below 50%. | |
| Floor-entry flash only | Brief display on floor transition. | |

**User's choice:** Always visible

### Descend currency cost

| Option | Description | Selected |
|--------|-------------|----------|
| Scrap (common currency) | Costs Raw Scrap. Creates spend tension. | ✓ |
| Free (no cost) | Risk IS the lower stability. | |
| Stub cost (Phase 13) | Placeholder, deduction stubbed. | |

**User's choice:** Scrap

### Degraded state visual feedback

**User's choice:** Both options — HUD corruption (scanlines, flicker, text corruption) AND screen desaturation (world loses color as stability drops).
**Notes:** User selected both options explicitly when presented.

### Stability start value

| Option | Description | Selected |
|--------|-------------|----------|
| 100% from floor 1 | Drains from the very first floor. | ✓ |
| Activates at floor 5 | Dormant until first Anchor. | |
| You decide | Claude picks. | |

**User's choice:** 100% from floor 1

---

## Anchor UX & UI

### Game-to-Anchor transition

| Option | Description | Selected |
|--------|-------------|----------|
| React overlay + game pause | Pause turn loop, grayscale PixiJS filter, React overlay on top. | ✓ |
| Full-screen React takeover | Separate React page, PixiJS hidden. | |
| In-game PixiJS UI | Render entirely in PixiJS. | |

**User's choice:** React overlay + game pause

### Inventory manifest detail

| Option | Description | Selected |
|--------|-------------|----------|
| Full item list | Scrollable list with names, rarity, slot info. | |
| Summary counts | Compact count summary. | |
| Categorized with details | Items grouped by category with expandable sections. | ✓ |

**User's choice:** Categorized with details

### Risk information on Descend

| Option | Description | Selected |
|--------|-------------|----------|
| Full risk breakdown | Next floor, estimated stability, enemy tier, Scrap cost. | ✓ |
| Minimal — just the cost | Only Scrap cost shown. | |
| You decide | Claude picks. | |

**User's choice:** Full risk breakdown

### System Handshake visual scope

| Option | Description | Selected |
|--------|-------------|----------|
| Functional first | Clean layout with basic cyan/pink. Full polish in Phase 16. | |
| Full visual fidelity | Complete visual spec in Phase 12. Ships looking final. | ✓ |
| Bare minimum | Plain HTML modal. All visual in Phase 16. | |

**User's choice:** Full visual fidelity
**Notes:** System Handshake is the signature UX moment — ships complete in Phase 12.

### Anchor placement

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated Anchor room | Unique room type, no enemies, safe haven. | |
| Entity in normal room | Interactable entity in a random room. Enemies present. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Entity in normal room
**Notes:** More tense — player must deal with enemies.

### Anchor interaction with enemies

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — risky interact | Can use Anchor with enemies present. Game pauses during decision. | ✓ |
| Room must be cleared | Anchor only activates when no enemies in room. | |
| You decide | Claude picks. | |

**User's choice:** Risky interact

### Post-Descend Anchor state

| Option | Description | Selected |
|--------|-------------|----------|
| Anchor breaks | Per STAB-05. Cannot re-use. | ✓ |
| Anchor persists | Stays usable (moot with regenerate-on-descent). | |
| You decide | Claude picks. | |

**User's choice:** Anchor breaks

### Extract transition

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate end + results | Instant transition to results screen. | |
| Brief animation then results | Short de-rezz effect (1-2 sec) before results. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Brief animation then results

---

## Depth Content Scaling

### Environmental variety

| Option | Description | Selected |
|--------|-------------|----------|
| Palette shifts | Color palette changes per band via PixiJS filters. | |
| Different tile variants | Distinct tileset per band. | |
| Structural differences | BSP parameters change per depth. | |
| Palette + structural | Both palette shifts AND BSP parameter changes. | ✓ |

**User's choice:** Palette + structural

### Special room types

| Option | Description | Selected |
|--------|-------------|----------|
| Treasure rooms | High-value loot, no enemies. | ✓ |
| Challenge rooms | Dense enemies, locked exit, bonus loot. | ✓ |
| Hazard rooms | Damaging/restricting terrain. | ✓ |
| Anchor rooms (floor 5/10/15) | Guaranteed Anchor placement on Anchor floors. | ✓ |

**User's choice:** All four types
**Notes:** multiSelect — all options selected.

### Loot scaling

| Option | Description | Selected |
|--------|-------------|----------|
| JSON depth-gated tables | Same pattern as depth-distribution.json. Firmware below floor 5, rare Augments below 10. | ✓ |
| Flat scaling multiplier | Same table, depth multiplier on rarity. | |
| You decide | Claude picks. | |

**User's choice:** JSON depth-gated tables

### Floor descent requirement

| Option | Description | Selected |
|--------|-------------|----------|
| Voluntary descent only | Staircase available from start. No quota. | ✓ |
| Kill quota | Kill N% of enemies to unlock stairs. | |
| Explore quota | Visit N% of rooms to unlock stairs. | |

**User's choice:** Voluntary descent only

### Depth HUD display

| Option | Description | Selected |
|--------|-------------|----------|
| Floor number always visible | Floor + depth band label on HUD. | ✓ |
| Floor number only | Just the number. | |
| You decide | Claude picks. | |

**User's choice:** Floor number always visible

---

## Run Results Screen

### Results screen content

| Option | Description | Selected |
|--------|-------------|----------|
| Extraction manifest | Items kept. | ✓ |
| Run stats | Floors, kills, turns, peak Heat, Firmware activations. | ✓ |
| Cause of end | How the run ended with specific details. | ✓ |
| Score breakdown | Numeric score with component breakdown. | ✓ |

**User's choice:** All four
**Notes:** multiSelect — all options selected.

### Extraction vs death visual tone

| Option | Description | Selected |
|--------|-------------|----------|
| Different visual tone | Extraction: cyan/success. Death: BSOD/Safety Orange. | ✓ |
| Same screen both cases | Identical layout. | |
| You decide | Claude picks. | |

**User's choice:** Different visual tone

---

## Floor Transition Feel

### Transition visual

| Option | Description | Selected |
|--------|-------------|----------|
| Quick glitch fade | Glitch (200ms) → fade to black with scanlines (200ms) → generate → fade in (200ms) → floor number flash. | ✓ |
| Staircase animation | Camera follows player down. | |
| Instant swap | No transition. | |
| Loading screen | Full screen with floor info. | |

**User's choice:** Quick glitch fade

---

## Scrap Implementation Scope

### Currency infrastructure

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal Scrap component | Simple ScrapComponent { amount: number }. Enemies drop, Anchor deducts. Phase 13 replaces with WalletComponent. | ✓ |
| Forward-compatible wallet stub | WalletComponent with all 3 slots, only Scrap implemented. | |
| No currency | Descend is free. Phase 13 adds cost. | |

**User's choice:** Minimal Scrap component

---

## Death Consequences

### Death flow

| Option | Description | Selected |
|--------|-------------|----------|
| Death → BSOD → Results | Death animation → BSOD (2-3 sec) → results (death variant) → REINITIALIZE button. | ✓ |
| Death → Results only | Skip BSOD, straight to results. | |
| You decide | Claude picks. | |

**User's choice:** Death → BSOD → Results

### BSOD reason specificity

| Option | Description | Selected |
|--------|-------------|----------|
| Context-specific | Each death source maps to unique error message. | ✓ |
| Generic message | Same message regardless of cause. | |
| You decide | Claude picks. | |

**User's choice:** Context-specific

### Post-run destination

| Option | Description | Selected |
|--------|-------------|----------|
| Main menu / new run | REINITIALIZE returns to current game entry point. Phase 15 redirects to Neural Deck Hub. | ✓ |
| Auto-restart same mode | Auto-start new run. | |
| You decide | Claude picks. | |

**User's choice:** Main menu / new run

---

## Claude's Discretion

- Exact stability drain values, BSP parameters per band, Scrap amounts, score formula weights
- Palette shift implementation approach, special room spawn probabilities
- De-rezz animation details, BSOD layout, confirmation dialog style
- Staircase/Anchor tile appearance, floor number flash animation

## Deferred Ideas

None — discussion stayed within phase scope.
