# Phase 16: Visual Identity & Starter Loadouts - Research

**Researched:** 2026-04-07
**Domain:** Visual effects systems (PixiJS filters, CSS animations), design token architecture, game loadout bundling
**Confidence:** HIGH

## Summary

Phase 16 applies the "Vibrant Decay" visual theme consistently across UI and rendering layers, implements discrete Heat tier visualization with cumulative effects, enhances enemy visuals with particle emission and damage effects, styles the BSOD death screen, and creates three starter loadout bundles (Vanguard, Operator, Ghost) pre-installed on Shells. The phase integrates existing PixiJS filter infrastructure (GlitchFilter, ColorMatrixFilter, RGBSplitFilter) for world-level effects and CSS keyframe animations for HUD-level effects. Loadout bundles associate Shells with default Firmware/Augment equipment via JSON configuration, surfaced on Hub UI Shell cards.

**Primary recommendation:** Extend the existing filter pipeline in `src/rendering/filters/` with Heat tier managers and particle emitters; use CSS custom properties and keyframe animations with `prefers-reduced-motion` support for HUD effects; define loadout bundles as JSON configurations linking Shell IDs to equipment template IDs; implement discrete tier jumps with cumulative effect stacking.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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
- **D-05:** Neon bleed implemented as particle emission from sprite edges — small neon-colored particles emit continuously from enemy sprites. Requires a lightweight particle system for enemy entities.
- **D-06:** Neon particle color varies by enemy tier for instant visual tier identification:
  - Tier 1 (Corrupted Data — Null-Pointer, Buffer-Overflow): Cyan particles
  - Tier 2 (Static Horrors — Fragmenter, Logic-Leaker): Pink particles
  - Tier 3 (Logic Breakers — System_Admin, Seed_Eater): White/hot white particles
- **D-07:** Source code leak on damage uses pixel scatter + text combination — when an enemy takes damage, pixels scatter outward (extending the existing damage distortion) PLUS 1-2 text fragments (e.g., '0xFF', 'NULL', 'ERR', 'SEGFAULT') float upward and fade out over ~500ms. PixiJS Text objects for the floating text.
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIS-01 | Color palette uses #000000 (Black), #FFFFFF (White), #00F0FF (Neon Cyan for "Secure" actions), #FF0055 (Electric Pink for "Risk" actions) | CSS custom properties already defined in globals.css; semantic token mapping pattern established |
| VIS-02 | Typography uses large, condensed sans-serif headers (e.g., "ANCHOR_LINK_ESTABLISHED", "KERNEL_PANIC_DETECTED") | Typography tokens exist; CSS Modules pattern for component-scoped styles; system font fallback defined |
| VIS-03 | Heat visualization tiers: Low Heat = clean cyan HUD; High Heat = HUD jitter + sprite ghosting (pink pixel trail); Overclock = color inversion + screen-tearing | PixiJS ColorMatrixFilter for inversion, GlitchFilter for screen-tear; CSS keyframe animations for HUD jitter; sprite duplication pattern for ghosting |
| VIS-04 | Kernel Panic visual escalation: 101-120% HUD jitters + faint mechanical sounds; 121-140% color inversion + dead pixel trails; 141-160% heavy screen-tearing + red wireframe sprite; 161%+ constant feedback + grayscale world | Existing desaturation filter pipeline; cumulative filter stacking pattern; tier threshold manager needed |
| VIS-05 | Augment trigger feedback: high-contrast geometric shape (white triangle, orange square) flashes briefly center-screen on successful synergy | CSS animations with absolute positioning; conditional rendering pattern from StabilityBar; event listener in sync-bridge |
| VIS-06 | Death screen styled as a "BSOD" in signature Safety Orange, listing the "Reason for Failure" | BSODScreen.tsx and .module.css already exist; extend with additional glitch effects (scanlines, flicker animation) |
| VIS-07 | Stability Anchor "System Handshake" transition: game world desaturates to grayscale, HUD zooms to center, bold cyan/pink decision blocks appear | AnchorOverlay.tsx already implements this; applyGrayscaleToContainer() exists; CSS transform for zoom animation |
| VIS-08 | Enemy visual identity: high-contrast silhouettes with neon bleeding from joints/eyes, damage causes source code/static leaks, death triggers glitch dissolution effects | applyPersistentGlitch() per behavior type; applyDamageDistortion() extends with text fragments; particle emitter for neon bleed; death effects complete |
| LOAD-01 | Vanguard bundle: STRIKER-v1 Shell + Phase_Shift.sh + Displacement_Venting.arc — aggressive close-quarters "dance" combat playstyle | Shell template JSON + equipment template JSON exist; bundle config links Shell ID to equipment IDs |
| LOAD-02 | Operator bundle: BASTION-v1 Shell + Neural_Spike.exe + Static_Siphon.arc — mid-range tactical "tank" playstyle | Same pattern as LOAD-01 |
| LOAD-03 | Ghost bundle: SIGNAL-v1 Shell + Extended_Sight.sys + Neural_Feedback.arc — recon and utility "scout" playstyle | Same pattern as LOAD-01 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pixi.js | 8.17.0 | WebGL 2D rendering engine | Already integrated; filter system, sprite management, ticker for frame updates; PixiJS 8.x is current stable |
| pixi-filters | 6.1.5 | Pre-built visual effect filters (GlitchFilter, ColorMatrixFilter, RGBSplitFilter) | Provides GlitchFilter (screen-tear, static), ColorMatrixFilter (inversion, desaturation), RGBSplitFilter (chromatic aberration); already used in glitch-effects.ts and animations.ts |
| React | 19.2.4 | UI component library | Next.js app router; component-based UI; already used for all HUD/overlay components |
| Next.js | 16.1.6 | React framework | App router, client components, CSS Modules support, already established architecture |
| Zustand | 5.0.11 | State management | Vanilla store pattern for game state; already used in game/ui/store.ts for UI state sync |
| CSS Modules | (Next.js built-in) | Component-scoped styles | Prevents style collisions; already used in all .module.css files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @pixi/particle-emitter | (optional) | Particle system with behavior-based config | If custom particle emitters are too complex; provides pooling, behavior config, performance optimization; not currently installed |
| Vitest | 4.1.0 | Test framework | Unit tests for filter application logic, tier threshold calculation, bundle config validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pixi-filters GlitchFilter | Custom WebGL shader | More control over effect parameters but higher complexity; existing GlitchFilter is sufficient and performant |
| Custom particle system | @pixi/particle-emitter | Custom gives tighter control but requires more code; pixi-particle-emitter provides battle-tested pooling and performance |
| CSS-in-JS (styled-components, emotion) | CSS Modules | CSS-in-JS adds runtime overhead; CSS Modules are zero-runtime and already established in codebase |

**Installation:**
```bash
# pixi-filters is in package.json but not installed
npm install

# Optional: if custom particle system is too complex
npm install @pixi/particle-emitter
```

**Version verification:** Package.json versions checked 2026-04-07. PixiJS 8.17.0 released 2024. pixi-filters 6.1.5 is compatible with PixiJS 8.x per package compatibility matrix.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── rendering/
│   ├── filters/
│   │   ├── glitch-effects.ts         # Per-enemy glitch (exists)
│   │   ├── screen-effects.ts         # Desaturation, grayscale (exists)
│   │   ├── death-effects.ts          # Death animations (exists)
│   │   ├── heat-visual-effects.ts    # NEW: Heat tier filter manager
│   │   └── particle-emitters.ts      # NEW: Neon bleed, text fragments
│   └── render-system.ts              # Integrate Heat tier updates
├── components/
│   ├── ui/
│   │   ├── BSODScreen.tsx            # Enhance with glitch effects
│   │   ├── BSODScreen.module.css     # Add scanlines, flicker keyframes
│   │   ├── HeatBar.tsx               # NEW: Heat visualization component
│   │   ├── HeatBar.module.css        # NEW: Tier-based jitter animations
│   │   └── AugmentFlash.tsx          # NEW: Geometric shape flash
│   └── hub/                          # NEW: Hub UI components (out of scope for 16-01/02/03)
├── game/
│   ├── shells/
│   │   ├── loadout-bundles.ts        # NEW: Bundle definitions
│   │   └── templates/*.json          # Extend Shell templates with defaultBundle field
│   └── ui/
│       ├── store.ts                  # Add Heat tier state
│       └── sync-bridge.ts            # Sync Heat tier to UI
└── app/
    └── globals.css                   # Theme tokens (extend as needed)
```

### Pattern 1: Heat Tier Filter Management
**What:** Centralized manager that applies/removes PixiJS filters based on Heat tier thresholds. Discrete tier jumps with cumulative effect stacking.
**When to use:** Heat tier changes trigger filter updates in render-system.ts
**Example:**
```typescript
// Source: Existing pattern from screen-effects.ts + glitch-effects.ts
import { Container, ColorMatrixFilter } from 'pixi.js';
import { GlitchFilter } from 'pixi-filters';

interface HeatTierEffects {
  tier: number;
  threshold: number;
  filters: (() => Filter)[];
}

const HEAT_TIERS: HeatTierEffects[] = [
  { tier: 0, threshold: 0, filters: [] },
  { tier: 1, threshold: 50, filters: [] }, // CSS only (jitter)
  { tier: 2, threshold: 80, filters: [() => createGhostingFilter()] },
  { tier: 3, threshold: 100, filters: [() => createInversionFilter()] },
  { tier: 4, threshold: 120, filters: [() => createScreenTearFilter()] },
  { tier: 5, threshold: 160, filters: [() => createGrayscaleFilter()] },
];

export function applyHeatTierFilters(worldContainer: Container, heatValue: number): void {
  const activeTier = HEAT_TIERS.filter(t => heatValue >= t.threshold).pop();
  if (!activeTier) return;

  // Cumulative: apply all filters from tier 0 up to current tier
  const allFilters = HEAT_TIERS
    .filter(t => t.tier > 0 && t.tier <= activeTier.tier)
    .flatMap(t => t.filters.map(fn => fn()));

  worldContainer.filters = allFilters.length > 0 ? allFilters : null;
}
```

### Pattern 2: CSS Keyframe Animations with Accessibility
**What:** Use GPU-accelerated CSS properties (transform, opacity) for HUD jitter animations with `prefers-reduced-motion` fallback
**When to use:** Heat tier 1+ (jitter), Augment trigger flash
**Example:**
```css
/* Source: MDN CSS animations best practices */
@keyframes hud-jitter {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-1px, -1px); }
  50% { transform: translate(1px, 1px); }
  75% { transform: translate(-1px, 1px); }
}

.heat-tier-jitter {
  animation: hud-jitter 0.1s infinite;
}

@media (prefers-reduced-motion: reduce) {
  .heat-tier-jitter {
    animation: none;
  }
}
```

### Pattern 3: Particle Emitter Lifecycle
**What:** Attach particle emitters to enemy sprites on creation, update per frame, dispose on death
**When to use:** Enemy neon bleed (continuous), source code leak on damage (burst)
**Example:**
```typescript
// Source: PixiJS particle-emitter pattern
import { Sprite, Container } from 'pixi.js';

interface ParticleEmitter {
  update(deltaMs: number): void;
  destroy(): void;
}

// WeakMap tracking per existing pattern in glitch-effects.ts
const activeEmitters = new WeakMap<Sprite, ParticleEmitter>();

export function attachNeonEmitter(sprite: Sprite, color: string): void {
  const emitter = createSimpleParticleEmitter(sprite, color);
  activeEmitters.set(sprite, emitter);
}

export function updateEmitters(deltaMs: number): void {
  // Called from render-system ticker
}

export function cleanupEmitter(sprite: Sprite): void {
  const emitter = activeEmitters.get(sprite);
  if (emitter) {
    emitter.destroy();
    activeEmitters.delete(sprite);
  }
}
```

### Pattern 4: Loadout Bundle Configuration
**What:** JSON configuration linking Shell IDs to default equipment template IDs
**When to use:** Shell initialization, RESTORE DEFAULT action
**Example:**
```typescript
// Source: Existing entity template pattern
interface LoadoutBundle {
  shellId: string;
  bundleName: string;
  playstyleTag: string;
  firmware: string[];
  augments: string[];
  software: string[];
}

const STARTER_BUNDLES: LoadoutBundle[] = [
  {
    shellId: 'striker-v1',
    bundleName: 'VANGUARD',
    playstyleTag: 'Aggressive Close-Quarters',
    firmware: ['phase-shift'],
    augments: ['displacement-venting'],
    software: [],
  },
  // ... Operator, Ghost
];

export function getDefaultBundle(shellId: string): LoadoutBundle | undefined {
  return STARTER_BUNDLES.find(b => b.shellId === shellId);
}
```

### Anti-Patterns to Avoid
- **Animating layout properties:** Never animate `width`, `height`, `margin`, `font-size` — use `transform: scale()` or `opacity` for performance
- **Filter memory leaks:** Always dispose filters when removing; use WeakMap tracking pattern from glitch-effects.ts
- **Uncontrolled particle spawn:** Particle emitters without pooling or max limits cause performance degradation; always set maxParticles and reuse instances
- **Forgotten accessibility:** Always provide `prefers-reduced-motion` fallback for animations; reference BSODScreen.tsx pattern
- **State-driven rendering without memoization:** Re-creating filter instances on every render causes performance issues; cache filter instances per tier

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Complex particle systems | Custom particle pooling, lifecycle, behavior interpolation | @pixi/particle-emitter (optional) or simple custom emitter with max pool | Particle systems have edge cases: pooling, behavior curves, alpha/scale interpolation over lifetime, max particle limits, spatial hashing for culling. Custom implementation risks memory leaks or frame drops. |
| WebGL shader effects | Custom fragment shaders for glitch, inversion, desaturation | pixi-filters (GlitchFilter, ColorMatrixFilter, RGBSplitFilter) | pixi-filters are battle-tested, GPU-optimized, and handle PixiJS version compatibility. Custom shaders require WebGL expertise and cross-browser testing. |
| State management between game/UI | Custom event emitters or global variables | Zustand vanilla store + sync-bridge pattern | Established pattern in codebase; prevents race conditions; single source of truth; already handles Heat state, player stats, overlays. |
| CSS design tokens | Hardcoded hex values throughout codebase | CSS custom properties in globals.css | Centralized theme management; dark mode support; easier refactoring; already established with Vibrant Decay palette. |

**Key insight:** Visual effects systems are deceptively complex — filter lifecycle management, particle pooling, animation performance, accessibility — all have hidden edge cases. Leverage existing infrastructure (PixiJS filters, CSS Modules, Zustand) and extend incrementally rather than rewriting.

## Common Pitfalls

### Pitfall 1: Filter Memory Leaks
**What goes wrong:** Filters attached to sprites are not disposed when sprites are destroyed, causing GPU memory leaks and eventual crashes.
**Why it happens:** PixiJS filters hold GPU resources (textures, shaders); JavaScript garbage collection doesn't free GPU memory automatically.
**How to avoid:** Use WeakMap tracking pattern from glitch-effects.ts; call `filter.destroy()` in cleanup functions; never attach filters without paired disposal.
**Warning signs:** Increasing memory usage over time, frame rate degradation after many entity spawns/deaths, GPU memory warnings in browser dev tools.

### Pitfall 2: Animation Performance Regression
**What goes wrong:** Animating layout properties (`font-size`, `width`, `height`) causes reflow/repaint on every frame, dropping frame rate to < 30 FPS.
**Why it happens:** Browser layout engine recalculates entire layout tree when box model properties change; animations run 60+ times per second.
**How to avoid:** Only animate `transform`, `opacity`, `scale`, `rotate` (GPU-accelerated); use `will-change` hint for anticipated animations; test with 10+ simultaneous animations.
**Warning signs:** Frame drops during HUD animations, layout thrashing in browser profiler, jittery movement.

### Pitfall 3: Particle Emitter Runaway Spawn
**What goes wrong:** Particle emitters spawn unlimited particles, causing exponential memory growth and frame rate collapse.
**Why it happens:** No maxParticles limit, or particles not culled when off-screen, or emitter not destroyed with parent sprite.
**How to avoid:** Always set maxParticles (10-20 for neon bleed per enemy), pool and reuse particle sprites, destroy emitters in sprite cleanup, cull particles outside viewport.
**Warning signs:** Gradual frame rate drop over time, thousands of sprites in PixiJS inspector, memory growth proportional to combat duration.

### Pitfall 4: Cumulative Filter Stacking Order
**What goes wrong:** Filter effects don't stack correctly — later filters override earlier ones, or effects are applied in wrong order causing visual bugs.
**Why it happens:** PixiJS applies filters in array order; some filters (like desaturation) are sensitive to input color space; filter instances reused across tiers cause state pollution.
**How to avoid:** Create new filter instances per tier application; apply filters in consistent order (ghosting → inversion → screen-tear → grayscale); test tier transitions (50→80→100→120→160 and reverse).
**Warning signs:** Inversion filter not visible when screen-tear is active, grayscale not desaturating, ghosting disappearing at high Heat.

### Pitfall 5: Reduced Motion Accessibility Ignored
**What goes wrong:** Users with vestibular disorders experience nausea/disorientation from HUD jitter, screen-tear, flicker animations.
**Why it happens:** `prefers-reduced-motion` media query not applied; developers forget accessibility is a requirement, not optional.
**How to avoid:** Wrap all keyframe animations in `@media (prefers-reduced-motion: no-preference)` or set `animation: none` in `reduce` query; test with macOS System Preferences → Accessibility → Display → Reduce Motion enabled.
**Warning signs:** User complaints, accessibility audit failures, animations that cannot be disabled.

### Pitfall 6: Discrete Tier Jumps Missed
**What goes wrong:** Heat tier transitions fade/interpolate between states instead of snapping instantly, diluting the "oh no" moment feedback.
**Why it happens:** Misunderstanding requirement D-04 (instant snap off), or adding CSS transition properties to tier classes.
**How to avoid:** No CSS `transition` on tier-specific classes; Heat tier calculation uses integer boundaries (>= 50, >= 80, etc.); test crossing thresholds in both directions.
**Warning signs:** Blurry transition between tiers, lingering effects after Heat drops below threshold.

## Code Examples

Verified patterns from existing codebase:

### Filter Lifecycle with WeakMap Tracking
```typescript
// Source: src/rendering/filters/glitch-effects.ts lines 91-158
const activeDamageFilters = new WeakMap<Sprite, { filter: GlitchFilter; timeoutId: ReturnType<typeof setTimeout> }>();

export function applyDamageDistortion(sprite: Sprite, duration: number = 200): void {
  if (!sprite || sprite.destroyed) return;

  const existing = activeDamageFilters.get(sprite);
  if (existing) {
    clearTimeout(existing.timeoutId);
    existing.timeoutId = setTimeout(() => {
      cleanupDamageFilter(sprite);
    }, duration);
    return;
  }

  const damageGlitch = new GlitchFilter({ slices: 10, offset: 30, direction: 0 });
  const currentFilters = Array.isArray(sprite.filters) ? [...sprite.filters] : sprite.filters ? [sprite.filters] : [];
  sprite.filters = [...currentFilters, damageGlitch];

  const timeoutId = setTimeout(() => {
    cleanupDamageFilter(sprite);
  }, duration);

  activeDamageFilters.set(sprite, { filter: damageGlitch, timeoutId });
}

function cleanupDamageFilter(sprite: Sprite): void {
  const state = activeDamageFilters.get(sprite);
  if (!state || sprite.destroyed) {
    activeDamageFilters.delete(sprite);
    return;
  }

  const filters = sprite.filters;
  if (!filters) {
    activeDamageFilters.delete(sprite);
    return;
  }

  const filtersArray = Array.isArray(filters) ? filters : [filters];
  const targetFilter = state.filter as unknown as Filter;
  const newFilters = (filtersArray as Filter[]).filter((f) => f !== targetFilter);
  sprite.filters = newFilters.length > 0 ? newFilters : null;

  activeDamageFilters.delete(sprite);
}
```

### Conditional CSS Class Application Based on State
```typescript
// Source: src/components/ui/StabilityBar.tsx lines 7-18
export const StabilityBar: React.FC = () => {
  const stability = useStore(gameStore, (s) => s.stability);
  const maxStability = useStore(gameStore, (s) => s.maxStability);
  const percent = maxStability > 0 ? (stability / maxStability) * 100 : 0;

  const getBarClass = () => {
    if (stability === 0) return styles.stabilityDegraded;
    if (percent <= 10) return styles.stabilityCritical;
    if (percent <= 30) return styles.stabilityWarning;
    return styles.stabilitySafe;
  };

  return (
    <div className={styles.stabilityContainer}>
      <div className={styles.stabilityLabel}>REALITY_STABILITY: {Math.round(percent)}%</div>
      <div className={styles.stabilityBarTrack}>
        <div className={`${styles.stabilityBarFill} ${getBarClass()}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};
```

### Desaturation Filter with Cached Instance
```typescript
// Source: src/rendering/filters/screen-effects.ts lines 1-23
import { ColorMatrixFilter, Container } from 'pixi.js';

let _grayscaleFilter: ColorMatrixFilter | null = null;

export function createDesaturationFilter(): ColorMatrixFilter {
  const filter = new ColorMatrixFilter();
  filter.desaturate();
  return filter;
}

export function applyGrayscaleToContainer(container: Container): void {
  if (!_grayscaleFilter) {
    _grayscaleFilter = createDesaturationFilter();
  }
  container.filters = [_grayscaleFilter];
}

export function removeFiltersFromContainer(container: Container): void {
  container.filters = null;
}
```

### CSS Animation with Accessibility
```css
/* Source: src/components/ui/BSODScreen.module.css lines 31-38 */
@keyframes bsodFade {
  from { opacity: 1; }
  to { opacity: 0; }
}

.fadeOut {
  animation: bsodFade 300ms ease-in forwards;
}

/* Pattern extended with prefers-reduced-motion from MDN research */
@media (prefers-reduced-motion: reduce) {
  .fadeOut {
    animation: none;
    opacity: 0;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pixi-particles package | @pixi/particle-emitter | PixiJS v6+ (2021) | Renamed package with TypeScript support, ES6 output, behavior-based config |
| Inline style objects in React | CSS Modules | Next.js default (2020+) | Component-scoped styles, zero-runtime overhead, better performance |
| Manual HUD state sync | Zustand vanilla store + sync-bridge | Established in Phase 8 (project-specific) | Single source of truth, prevents race conditions, typed state |
| ColorMatrixFilter constructor chaining | ColorMatrixFilter with method calls | PixiJS 8.x | Cleaner API: `filter.desaturate()` vs constructor params |

**Deprecated/outdated:**
- `pixi-particles`: Renamed to `@pixi/particle-emitter` in PixiJS v6+
- Direct DOM manipulation for HUD updates: Use React state + Zustand sync
- `will-change: transform` on all elements: Only use for anticipated animations (overuse hurts performance)

## Open Questions

1. **Particle emitter implementation complexity**
   - What we know: Simple burst emitters (source code leak) can be custom-built with PixiJS.Text pooling; continuous emitters (neon bleed) need lifecycle management
   - What's unclear: Whether @pixi/particle-emitter overhead is justified for ~3-10 enemies on screen simultaneously, or if custom implementation with maxParticles=20 is sufficient
   - Recommendation: Start with custom simple emitter using WeakMap tracking pattern; refactor to @pixi/particle-emitter if complexity grows or performance degrades

2. **Heat tier threshold configuration location**
   - What we know: Thresholds are 0/50/80/100/120/160 per user constraints; needs to be shared between rendering (filter application) and UI (HUD jitter)
   - What's unclear: Whether to define in globals.css as CSS custom properties, in a TypeScript config file, or in both with single source of truth
   - Recommendation: Define in TypeScript config (e.g., `src/game/config/heat-tiers.ts`) and export both for PixiJS and for CSS (via inline style or data attributes)

3. **Sprite ghosting implementation approach**
   - What we know: Pink pixel trail on player sprite at Heat tier 2 (80-99 Heat)
   - What's unclear: Duplicate sprite with offset + pink tint (more control, higher memory) vs trail shader effect (complex, GPU-dependent)
   - Recommendation: Duplicate sprite approach — create secondary sprite with RGBSplitFilter pink tint, offset by 2-3 pixels, alpha 0.5, follows player position with 100ms delay; simpler implementation, predictable performance

4. **BSOD enhancement specifics**
   - What we know: Current BSOD has Safety Orange background, FATAL_EXCEPTION title, reason text; needs enhancement with glitch effects
   - What's unclear: Which glitch effects are compatible with Safety Orange background (scanlines, flicker, static overlay)
   - Recommendation: Add CSS scanline overlay (repeating-linear-gradient), optional flicker animation (visibility toggle), and subtle transform: skew() on title — all respecting prefers-reduced-motion

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, test, dev server | ✓ | v20.10.0 | — |
| npm | Package management | ✓ | 10.2.3 | — |
| pixi.js | Rendering engine | ✓ | 8.17.0 (package.json) | — |
| pixi-filters | Visual effects | ✗ | 6.1.5 (package.json, not installed) | Must install before implementation |
| Vitest | Unit tests | ✓ | 4.1.0 | — |

**Missing dependencies with no fallback:**
- pixi-filters package (in package.json but not in node_modules) — must run `npm install` before implementation begins

**Missing dependencies with fallback:**
- @pixi/particle-emitter (not in package.json) — fallback is custom particle system using PixiJS primitives; install only if custom implementation proves too complex

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIS-01 | Color palette applied via CSS custom properties | unit | `npm test -- src/app/globals.css.test.ts -x` | ❌ Wave 0 |
| VIS-02 | Typography tokens used consistently | unit | `npm test -- src/components/ui/__tests__/typography.test.ts -x` | ❌ Wave 0 |
| VIS-03 | Heat tier filter application | unit | `npm test -- src/rendering/filters/__tests__/heat-visual-effects.test.ts -x` | ❌ Wave 0 |
| VIS-04 | Cumulative filter stacking per tier | unit | `npm test -- src/rendering/filters/__tests__/heat-visual-effects.test.ts -x` | ❌ Wave 0 |
| VIS-05 | Augment flash rendering | unit | `npm test -- src/components/ui/__tests__/AugmentFlash.test.tsx -x` | ❌ Wave 0 |
| VIS-06 | BSOD screen enhancement | unit | `npm test -- src/components/ui/__tests__/BSODScreen.test.tsx -x` | ❌ Wave 0 |
| VIS-07 | System Handshake grayscale transition | unit | `npm test -- src/components/ui/__tests__/AnchorOverlay.test.tsx -x` | ❌ Wave 0 |
| VIS-08 | Neon particle emitter lifecycle | unit | `npm test -- src/rendering/filters/__tests__/particle-emitters.test.ts -x` | ❌ Wave 0 |
| LOAD-01 | Vanguard bundle config loads correctly | unit | `npm test -- src/game/shells/__tests__/loadout-bundles.test.ts -x` | ❌ Wave 0 |
| LOAD-02 | Operator bundle config loads correctly | unit | `npm test -- src/game/shells/__tests__/loadout-bundles.test.ts -x` | ❌ Wave 0 |
| LOAD-03 | Ghost bundle config loads correctly | unit | `npm test -- src/game/shells/__tests__/loadout-bundles.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- {affected files} -x` (< 30 seconds)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual visual verification before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/rendering/filters/__tests__/heat-visual-effects.test.ts` — covers VIS-03, VIS-04 (tier threshold calculation, cumulative filter stacking)
- [ ] `src/rendering/filters/__tests__/particle-emitters.test.ts` — covers VIS-08 (emitter lifecycle, maxParticles enforcement, cleanup)
- [ ] `src/components/ui/__tests__/AugmentFlash.test.tsx` — covers VIS-05 (flash rendering, animation trigger)
- [ ] `src/components/ui/__tests__/BSODScreen.test.tsx` — covers VIS-06 (glitch effects, prefers-reduced-motion)
- [ ] `src/game/shells/__tests__/loadout-bundles.test.ts` — covers LOAD-01, LOAD-02, LOAD-03 (bundle config validation, equipment resolution)
- [ ] Framework install: Already installed (Vitest 4.1.0)

## Sources

### Primary (HIGH confidence)
- Existing codebase: src/rendering/filters/glitch-effects.ts, screen-effects.ts, death-effects.ts (filter lifecycle patterns, WeakMap tracking, PixiJS 8.x API usage)
- Existing codebase: src/components/ui/StabilityBar.tsx, BSODScreen.tsx, AnchorOverlay.tsx (React component patterns, CSS Modules, Zustand store usage)
- Existing codebase: src/game/shells/templates/*.json, src/game/entities/templates/*.json (JSON entity template structure, component schema)
- Package.json: PixiJS 8.17.0, pixi-filters 6.1.5, React 19.2.4, Next.js 16.1.6, Zustand 5.0.11, Vitest 4.1.0 (verified versions)
- Phase 16 CONTEXT.md: User decisions D-01 through D-11 (locked constraints)
- REQUIREMENTS.md: VIS-01 through VIS-08, LOAD-01 through LOAD-03 (phase requirements)

### Secondary (MEDIUM confidence)
- GitHub pixi-filters repository (WebFetch): Filter catalog (GlitchFilter, ColorMatrixFilter, RGBSplitFilter, KawaseBlurFilter), performance considerations, selective filter application, modular imports
- GitHub @pixi/particle-emitter repository (WebFetch): Behavior-based configuration, particle pooling, maxParticles parameter, update loop pattern, TypeScript support
- MDN CSS Animations (WebFetch): Keyframe animation best practices, GPU-accelerated properties (transform, opacity), prefers-reduced-motion accessibility, performance optimization (avoid layout properties)
- React documentation (WebFetch): Conditional rendering patterns (ternary, logical AND, variable assignment), multi-tier state visualization, refactoring into data objects
- W3C Design Tokens Community Group (WebFetch): Naming flexibility, semantic vs primitive tokens, theming and multi-brand support, single-source management

### Tertiary (LOW confidence)
- None — all claims verified with authoritative sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Versions verified from package.json, existing imports in codebase confirm PixiJS 8.x and pixi-filters 6.x usage
- Architecture: HIGH - Patterns extracted from existing codebase (glitch-effects.ts, screen-effects.ts, StabilityBar.tsx), no hypothetical recommendations
- Pitfalls: HIGH - Filter memory leaks, animation performance, particle spawn, cumulative stacking are known PixiJS/browser issues documented in MDN and PixiJS forums
- Particle systems: MEDIUM - @pixi/particle-emitter features verified from official repo, but custom vs library tradeoff depends on implementation complexity (flagged as Open Question)
- Heat tier thresholds config location: MEDIUM - Pattern established in codebase for other config (entity templates use JSON), but Heat tier thresholds could live in multiple places (flagged as Open Question)

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (30 days) — PixiJS and React ecosystems are stable; design token and animation patterns are mature; no fast-moving dependencies

---

*Phase: 16-visual-identity-starter-loadouts*
*Research completed: 2026-04-07*
