# Phase 16: Visual Identity & Starter Loadouts - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Apply the "Vibrant Decay" visual theme consistently across all UI surfaces and in-game rendering. Implement Heat visualization tiers with discrete tier jumps affecting both the game world (PixiJS) and HUD (CSS). Add Kernel Panic visual escalation per tier. Enhance enemy visual identity with tier-colored neon particle emission and pixel scatter + text code leak on damage. Style the BSOD death screen. Create 3 starter loadout bundles (Vanguard, Operator, Ghost) as default equipment on Shells with reset capability. Ensure a complete end-to-end run is playable from Hub to dungeon to extraction and back.

</domain>

<decisions>
## Implementation Decisions

### Heat Visual Escalation
- **D-01:** Discrete tier jumps at each Heat threshold — clear visual shift when crossing a boundary. Player instantly recognizes danger zone transitions. Matches Kernel Panic's tier-based probability system.
- **D-02:** Match the spec exactly — 6 visual tiers as written in VIS-03/VIS-04:
  1. **Clean** (0-49 Heat): Clean cyan HUD, no effects
  2. **Jitter** (50-79 Heat): HUD jitter (CSS shake/offset on HUD elements)
  3. **Ghosting** (80-99 Heat): Sprite ghosting — pink pixel trail on player sprite (PixiJS)
  4. **Inversion** (100-119 Heat / Corruption Zone entry): Color inversion filter on game world (PixiJS ColorMatrixFilter)
  5. **Screen-tear** (120-159 Heat): Screen-tearing effect (PixiJS GlitchFilter on stage)
  6. **Grayscale** (160+ Heat): Grayscale world (PixiJS desaturation) + constant visual feedback
  Each tier adds to the previous — effects are cumulative.
- **D-03:** Effects apply to BOTH the game world (PixiJS stage filters) AND the HUD (React/CSS effects). PixiJS handles sprite ghosting, color inversion, screen-tear, grayscale. CSS handles HUD jitter, scanlines, text corruption. Total screen degradation at high Heat.
- **D-04:** When Heat drops below a tier threshold (via dissipation or Venting), visual effects snap off instantly. Immediate relief feedback — no lingering fade.

### Enemy Enhanced Visuals
- **D-05:** Neon bleed implemented as particle emission from sprite edges — small neon-colored particles emit continuously from enemy sprites. Requires a lightweight particle system for enemy entities.
- **D-06:** Neon particle color varies by enemy tier for instant visual tier identification:
  - Tier 1 (Corrupted Data — Null-Pointer, Buffer-Overflow): Cyan particles
  - Tier 2 (Static Horrors — Fragmenter, Logic-Leaker): Pink particles
  - Tier 3 (Logic Breakers — System_Admin, Seed_Eater): White/hot white particles
- **D-07:** Source code leak on damage uses pixel scatter + text combination — when an enemy takes damage, pixels scatter outward (extending the existing damage distortion) PLUS 1-2 text fragments (e.g., '0xFF', 'NULL', 'ERR', 'SEGFAULT') float upward and fade out over ~500ms. PixiJS Text objects for the floating text.

### Loadout Bundle UX
- **D-08:** Loadout bundles surfaced on the Hub's SHELL tab carousel. Each Shell card shows: Shell name (STRIKER-v1), loadout name (VANGUARD), a playstyle tag ("Aggressive Close-Quarters"), and a compact list of pre-loaded items (Phase_Shift.sh, Displacement_Venting.arc).
- **D-09:** Every Shell always comes pre-loaded with its default loadout bundle. Players start with equipment already equipped — no empty Shells. Players customize and swap items out via the LOADOUT tab.
- **D-10:** Three starter bundles:
  - **Vanguard**: STRIKER-v1 + Phase_Shift.sh + Displacement_Venting.arc (aggressive close-quarters "dance" combat)
  - **Operator**: BASTION-v1 + Neural_Spike.exe + Static_Siphon.arc (mid-range tactical "tank")
  - **Ghost**: SIGNAL-v1 + Extended_Sight.sys + Neural_Feedback.arc (recon and utility "scout")
- **D-11:** "RESTORE DEFAULT" action available on Shell cards — resets a Shell to its original starter loadout (moves current items back to Vault, equips the original bundle items). Allows experimentation with easy revert.

### Claude's Discretion
- Typography approach (web font vs system font, specific font choice if web font is used)
- Exact Heat tier threshold values (suggestions: 0/50/80/100/120/160 — tunable in config)
- PixiJS particle system implementation for neon bleed (lightweight emitter per enemy, pool management, performance budgeting)
- Text fragment pool for source code leak effect (string list, spawn position offsets, fade timing)
- Sprite ghosting implementation (duplicate sprite with offset + pink tint + lower alpha, or trail effect)
- Color inversion and screen-tear filter parameter tuning
- HUD jitter CSS animation keyframes and intensity
- BSOD enhanced styling beyond current implementation (additional glitch layers, scanlines)
- Shell card layout changes to accommodate loadout name + playstyle tag + item list
- RESTORE DEFAULT button placement and confirmation flow
- Loadout bundle JSON data structure (inline in Shell template vs separate bundle config)
- End-to-end integration polish priorities and edge case handling
- Augment trigger flash styling (VIS-05: geometric shapes — white triangle, orange square)
- Consistent theme application across all existing UI surfaces

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §Visual Identity — VIS-01 through VIS-08 define palette, typography, Heat visualization tiers, Kernel Panic escalation, Augment trigger flash, BSOD death screen, System Handshake transition, enemy visual identity
- `.planning/REQUIREMENTS.md` §Starter Loadouts — LOAD-01 through LOAD-03 define Vanguard, Operator, Ghost bundles with Shell/Firmware/Augment combinations and playstyle descriptions
- `.planning/ROADMAP.md` §Phase 16 — Success criteria, plan breakdown (16-01 through 16-04), dependencies

### Direct Dependencies (Prior Phases)
- `.planning/phases/15-neural-deck-hub-ui/15-CONTEXT.md` — Hub tab structure (D-01-D-08), Shell carousel on SHELL tab (D-09-D-13), LOADOUT tab drag-and-drop (D-14-D-18), INITIALIZE tab with Ritual (D-24-D-26), CSS design tokens in globals.css
- `.planning/phases/12-multi-floor-generation-stability-extraction/12-CONTEXT.md` — System Handshake UI at full visual fidelity (D-18), BSOD death screen (D-30-D-32), stability desaturation (D-12), floor transition glitch (D-07), depth band palette shifts (D-24)
- `.planning/phases/11-enemy-hierarchy/11-CONTEXT.md` — Per-type glitch filters (D-11), 6 unique death effects at full fidelity (D-12-D-13), per-behavior-type visual mapping
- `.planning/phases/08-firmware-neural-heat-system/08-CONTEXT.md` — Heat component data model (D-01-D-04), Kernel Panic tier probabilities (D-09-D-12), HeatComponent fields (current, maxSafe, baseDissipation)

### Architecture & Patterns
- `.planning/codebase/ARCHITECTURE.md` — Layer boundaries, data flow
- `.planning/codebase/STRUCTURE.md` — Directory layout, naming conventions
- `.planning/codebase/CONVENTIONS.md` — Code style, import organization

### Key Source Files
- `src/app/globals.css` — Existing Vibrant Decay palette tokens (--vibrant-cyan, --vibrant-pink, --safety-orange), typography tokens, spacing tokens, CRT overlay
- `src/rendering/filters/glitch-effects.ts` — Per-enemy-type glitch filters (applyPersistentGlitch), damage distortion (applyDamageDistortion)
- `src/rendering/filters/screen-effects.ts` — Desaturation filter, stability-based grayscale
- `src/rendering/filters/death-effects.ts` — Death effect pipeline
- `src/rendering/animations.ts` — 6 death animation types, queueTypedDeathAnimation()
- `src/rendering/render-system.ts` — PixiJS rendering, filter application
- `src/components/ui/BSODScreen.tsx` — Current BSOD implementation (Safety Orange, FATAL_EXCEPTION)
- `src/components/ui/StabilityBar.tsx` — HUD bar with 4 visual states
- `src/shared/components/heat.ts` — HeatComponent (current, maxSafe, baseDissipation, ventPercentage, isVenting)
- `src/game/systems/kernel-panic.ts` — 4-tier Kernel Panic system (probability + effect application)
- `src/game/shells/index.ts` — Shell registry, getAvailableShells()
- `src/game/shells/templates/striker-v1.json` — STRIKER Shell template
- `src/game/shells/templates/bastion-v1.json` — BASTION Shell template
- `src/game/shells/templates/signal-v1.json` — SIGNAL Shell template
- `src/game/entities/templates/phase-shift.json` — Phase_Shift.sh Firmware
- `src/game/entities/templates/neural-spike.json` — Neural_Spike.exe Firmware
- `src/game/entities/templates/extended-sight.json` — Extended_Sight.sys Firmware
- `src/game/entities/templates/displacement-venting.json` — Displacement_Venting.arc Augment
- `src/game/entities/templates/static-siphon.json` — Static_Siphon.arc Augment
- `src/game/entities/templates/neural-feedback.json` — Neural_Feedback.arc Augment

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **PixiJS filter pipeline**: GlitchFilter, RGBSplitFilter, ColorMatrixFilter already used for enemy effects and stability desaturation. Extend for Heat tier filters (inversion, screen-tear, grayscale).
- **applyPersistentGlitch()**: Per-behavior-type enemy glitch mapping. Extend with neon particle emission layer.
- **applyDamageDistortion()**: Heavy glitch on damage (200ms). Extend with pixel scatter + text fragments.
- **queueTypedDeathAnimation()**: Routes enemies to 6 death animation types. Already complete from Phase 11.
- **CSS design tokens**: Full Vibrant Decay palette, spacing, typography tokens in globals.css. CRT scanline overlay exists.
- **StabilityBar component**: Reference for Heat bar visual state implementation (4-state pattern with CSS class switching).
- **BSODScreen component**: Basic implementation to enhance with additional glitch effects.
- **Shell registry + templates**: All 3 starter Shells with stats and Port configs. Ready for loadout bundle association.
- **All Firmware/Augment templates**: 3 Firmware + 3 Augment JSON templates with full mechanics. Ready to bundle.

### Established Patterns
- PixiJS filter system for sprite-level and stage-level visual effects
- CSS Modules for component-scoped styles (.module.css)
- WeakMap tracking for filter lifecycle management (prevents memory leaks)
- JSON entity templates with mixin inheritance
- Zustand vanilla store with typed state interfaces and actions
- State-driven rendering via GameState enum + conditional rendering

### Integration Points
- `src/rendering/render-system.ts` — Add Heat tier filter management (apply/remove filters based on HeatComponent.current)
- `src/rendering/filters/` — New files or extensions for Heat visualization filters, neon particle emitter, source code text fragments
- `src/components/ui/` — HUD jitter CSS effects, Heat bar visual tier styling
- `src/game/shells/` — Loadout bundle definitions (Shell + default equipment mapping)
- `src/game/ui/store.ts` — Heat tier state for HUD CSS class switching
- `src/game/ui/sync-bridge.ts` — Sync Heat tier to UI state

</code_context>

<specifics>
## Specific Ideas

- Discrete tier jumps for Heat visualization create clear "oh no" moments — crossing from ghosting into inversion is an unmistakable signal that you're in the Corruption Zone. The player's screen literally inverts. Combined with Kernel Panic probability jumps at the same thresholds, it's a full sensory warning system.
- Tier-colored neon particles (cyan/pink/white) give instant depth-band information before the player even reads the enemy name. Cyan swarm approaching = Tier 1 fodder. Pink glow in a corridor = Tier 2 elite, be careful. White radiance = Tier 3, run or die.
- Pixel scatter + floating code text on enemy damage ("0xFF", "NULL", "SEGFAULT") reinforces that these aren't biological creatures — they're corrupted processes leaking data when struck. It's the game's version of blood splatter.
- Pre-loaded starter loadouts mean new players never see an empty Shell. They pick a playstyle identity (Vanguard/Operator/Ghost) and immediately have a functional build. The RESTORE DEFAULT button ensures experimentation is safe — you can always go back.
- The loadout name + playstyle tag on the Shell carousel card gives each Shell a personality beyond its stats. "VANGUARD — Aggressive Close-Quarters" tells you what this Shell is FOR, not just what numbers it has.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 16-visual-identity-starter-loadouts*
*Context gathered: 2026-04-07*
