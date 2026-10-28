# Technology Stack

**Project:** Nirmata Runner (v2.1 Equipment System Milestone)
**Researched:** 2024-05-15

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 16.1.6 | App routing & React framework | (Existing) Unifies the stack, API routes handle validation |
| React | 19.2.4 | UI components | (Existing) Required by constraints |
| PixiJS | 8.17.0 | 2D WebGL rendering | (Existing) Required by constraints |

### Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| N/A | N/A | No new database | Game uses server-authoritative state via API route round-trips, no DB changes required for this milestone |

### Infrastructure
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| N/A | N/A | No new infrastructure | Leverages existing Next.js backend and Vercel/Node deployment |

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@dnd-kit/core` | 6.3.1 | Drag and Drop functionality | Use for the in-run inventory management screen to handle dragging items between slots/grid. |
| `@radix-ui/react-tooltip` | 1.2.8 | Headless UI Tooltips | Use for robust, accessible tooltips on inventory items, weapons, and augments to show stats and effects. |
| `immer` | 11.1.8 | Immutable state updates | Use in conjunction with Zustand for complex nested object updates (e.g., deep inventory trees, equipment slots). |
| `rot-js` | 2.2.1 | Loot Generation | (Existing) Use `RNG.getWeightedValue()` for updated enemy drop tables instead of adding a new RNG library. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Drag and Drop | `@dnd-kit/core` | `react-beautiful-dnd` | `react-beautiful-dnd` is deprecated and not officially supported for React 18/19. `@dnd-kit` is modern and modular. |
| Tooltips | `@radix-ui/react-tooltip` | `@floating-ui/react` | Floating UI requires more boilerplate to setup basic tooltips. Radix provides headless accessible components out of the box which fits the "Vibrant Decay" custom styling requirement. |
| State Mgmt | `immer` | native spread operator | Deeply nested inventory and equipment state updates become highly error-prone and unreadable with pure native spread syntax. |
| Loot Generation | Native `rot-js` | Custom loot table library | `rot-js` is already in the stack and has `RNG.getWeightedValue()`, completely satisfying the requirement without adding package bloat. |

## Installation

```bash
# Core
npm install @dnd-kit/core @dnd-kit/utilities @radix-ui/react-tooltip immer

# Dev dependencies
# No new dev dependencies required
```

## Sources

- NPM registry (verified versions 6.3.1 for @dnd-kit/core, 1.2.8 for @radix-ui/react-tooltip, 11.1.8 for immer)
- rot-js Official Documentation (verified `RNG.getWeightedValue()`)
