# Phase 16: Visual Identity & Starter Loadouts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 16-visual-identity-starter-loadouts
**Areas discussed:** Heat visual escalation, Enemy enhanced visuals, Loadout bundle UX

---

## Heat Visual Escalation

### Escalation mode

| Option | Description | Selected |
|--------|-------------|----------|
| Discrete tier jumps | Clear visual shift at each Heat threshold. Matches Kernel Panic tier system. More dramatic. | ✓ |
| Smooth interpolation | Effects blend continuously as Heat rises. More immersive but harder to read exact danger level. | |
| Hybrid | Smooth within tiers, discrete jump between tiers. | |

**User's choice:** Discrete tier jumps (Recommended)
**Notes:** None

### Tier mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Match the spec exactly | 6 tiers as written in VIS-03/VIS-04: clean, jitter, ghosting, inversion, screen-tear, grayscale. Each adds to previous. | ✓ |
| Compress to 4 tiers | Align with Kernel Panic's 4 probability tiers. Simpler, maps 1:1 to gameplay consequence tiers. | |
| You decide | Let Claude choose tier mapping based on filter pipeline and Kernel Panic thresholds. | |

**User's choice:** Match the spec exactly
**Notes:** None

### Effect scope

| Option | Description | Selected |
|--------|-------------|----------|
| Both world + HUD | PixiJS filters on game world + CSS effects on HUD. Total immersion — whole screen degrades. | ✓ |
| World only | All effects are PixiJS filters. HUD stays clean and readable. | |
| HUD only | CSS effects on HUD overlay. Game world stays clean. | |

**User's choice:** Both world + HUD (Recommended)
**Notes:** None

### Cool-down behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Snap off instantly | Immediate relief when Heat drops. Clear 'I'm safe now' feedback. Simple to implement. | ✓ |
| Brief fade-out (~500ms) | Effects linger and smoothly fade. More polished feel, avoids jarring pop. | |
| You decide | Let Claude pick whatever feels best during implementation. | |

**User's choice:** Snap off instantly
**Notes:** None

---

## Enemy Enhanced Visuals

### Neon bleed implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Colored outline glow | PixiJS OutlineFilter creates colored aura. Simple, performant, highly visible. | |
| Particle emission from sprite | Small neon-colored particles emit from sprite edges continuously. More organic 'bleeding' feel. | ✓ |
| Sprite tint + bloom | Tint + bloom post-processing. Simpler but less 'bleed' and more 'glow.' | |
| You decide | Let Claude pick based on existing pipeline and 32x32 sprite scale. | |

**User's choice:** Particle emission from sprite
**Notes:** Requires a new lightweight particle system for enemy entities.

### Source code leak on damage

| Option | Description | Selected |
|--------|-------------|----------|
| Floating text fragments | 2-3 text strings float upward from enemy and fade out over ~500ms. Light, readable, thematic. | |
| Pixel scatter + text | Pixels scatter outward + 1-2 text fragments float up. Combines existing damage distortion with code fragments. | ✓ |
| Static/noise burst | Brief burst of TV static overlay (~300ms). No text — just visual noise. Simpler. | |
| You decide | Let Claude choose based on rendering pipeline. | |

**User's choice:** Pixel scatter + text
**Notes:** None

### Neon particle color

| Option | Description | Selected |
|--------|-------------|----------|
| Tier-based color | T1: cyan, T2: pink, T3: white/hot white. Instant visual tier identification. | ✓ |
| Single cyan for all | All enemies bleed cyan. Consistent brand, simpler. Tier identity from glitch filters and sprites. | |
| You decide | Let Claude pick based on visual contrast. | |

**User's choice:** Tier-based color (Recommended)
**Notes:** None

---

## Loadout Bundle UX

### Selection location

| Option | Description | Selected |
|--------|-------------|----------|
| First-run onboarding only | New players see loadout selection on first session only. After that, Hub tabs. | |
| Hub's INITIALIZE tab | Bundles as quick-select presets on run launcher. Available every run. | |
| Hub's SHELL tab | Bundle presets on Shell carousel. Each Shell shows starter loadout as one-click option. | ✓ |
| Separate Loadout Presets screen | Dedicated screen for managing loadout presets. | |

**User's choice:** Hub's SHELL tab
**Notes:** User specified that Shells should always come pre-loaded with their default loadout by default. Players customize and swap items out later. Not just a first-run experience — Shells inherently have their loadout.

### Visual identity per bundle

| Option | Description | Selected |
|--------|-------------|----------|
| Name + playstyle tag + equipped list | Shell card shows: Shell name, loadout name (VANGUARD), playstyle tag, compact item list. | ✓ |
| Minimal — just Shell stats | Shell carousel unchanged from Phase 15. Bundles are data-only, not a UI concept. | |
| You decide | Let Claude determine based on existing carousel design. | |

**User's choice:** Name + playstyle tag + equipped list
**Notes:** None

### Reset to default

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — reset button on Shell card | RESTORE DEFAULT action returns Shell to starter loadout. Moves current items to Vault. | ✓ |
| No — one-way customization | Once items swapped, default loadout is gone. Simpler, encourages commitment. | |
| You decide | Let Claude determine based on Vault/equipment flow. | |

**User's choice:** Yes — reset button on Shell card
**Notes:** None

---

## Claude's Discretion

- Typography approach (web font vs system font, specific font choice)
- Exact Heat tier threshold values
- Particle system implementation details for neon bleed
- Text fragment pool for source code leak effect
- BSOD enhanced styling
- Shell card layout changes for loadout info
- RESTORE DEFAULT button UX details
- Loadout bundle data structure
- End-to-end integration polish priorities
- Augment trigger flash styling (VIS-05)

## Deferred Ideas

None — discussion stayed within phase scope.
