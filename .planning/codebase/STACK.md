# Technology Stack

**Analysis Date:** 2024-05-24

## Languages

**Primary:**
- TypeScript `5.9.3` - Core application logic, Next.js routes, components (`src/**/*.ts`, `src/**/*.tsx`)

**Secondary:**
- JavaScript - Configuration files (e.g., `eslint.config.js`)

## Runtime

**Environment:**
- Node.js (Types `25.5.0`, `type: module`)

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- Next.js `16.1.6` - App routing and React framework
- React `19.2.4` - UI components
- PixiJS `8.17.0` - 2D WebGL rendering engine

**Testing:**
- Vitest `4.1.0` - Test runner (`vitest.config.ts`)
- jsdom `28.1.0` - DOM environment for tests

**Build/Dev:**
- TypeScript `5.9.3` - Type checking (`tsc`)
- ESLint `9.39.4` - Linting (`eslint.config.js`)
- Prettier `3.8.1` - Formatting (`.prettierrc`)

## Key Dependencies

**Critical:**
- `@pixi/tilemap` `5.0.2` - Tilemap rendering for PixiJS
- `rot-js` `2.2.1` - Roguelike toolkit (FOV, map generation, pathfinding)
- `zustand` `5.0.11` - State management
- `zod` `4.3.6` - Schema validation (used in API routes for validation)

**Infrastructure:**
- `json-diff-ts` `4.10.0` - State diffing (used for game tick deltas in `src/app/api/action/route.ts`)
- `lucide-react` `0.577.0` - UI icons

## Configuration

**Environment:**
- Not detected (No `.env` explicitly required or found in standard paths)
- Checks `process.env.NODE_ENV` in `src/engine/session/SessionManager.ts`

**Build:**
- `tsconfig.json` (TypeScript config with extensive path aliases like `@engine`, `@game`, etc.)
- `vitest.config.ts` (Vitest config)
- `eslint.config.js` (ESLint config)
- `.prettierrc` (Prettier config)

## Platform Requirements

**Development:**
- Node.js
- npm

**Production:**
- Next.js deployment target (Vercel or custom Node server)

---

*Stack analysis: 2024-05-24*
