---
phase: 01-ecs-core-data-foundation
plan: 01-01
type: discovery
topic: Project scaffolding tooling versions and compatibility
---

# Plan 01-01 Discovery: Tooling Versions & Compatibility

## Summary

The RESEARCH.md specified library versions from initial project setup that are now outdated. Two major version bumps have occurred since research was conducted: **ESLint 10.0.3** (plan specifies ^9) and **Zod 4.3.6** (plan specifies ^3.x). Both upgrades are well-supported by the ecosystem and recommended for new projects. TypeScript, Vitest, Prettier, and eslint-plugin-import-x are all current and compatible.

All plugins needed for Plan 01-01 (`eslint-plugin-import-x`, `typescript-eslint`) explicitly declare ESLint 10 support in their peer dependencies. Zod 4's core APIs (`z.object()`, `z.string()`, `z.number()`, `z.array()`, `z.infer`, `z.parse()`, `z.safeParse()`) are backwards-compatible for our entity validation use case, with major performance and `tsc` efficiency improvements.

**Both ESLint 9 and 10 are actively maintained** (ESLint 9.39.4 released March 6, 2026), so staying on ^9 is viable but unnecessary for a greenfield project.

## Primary Recommendation

**Upgrade to ESLint ^10 and Zod ^4 for Plan 01-01.** Both are stable releases with full ecosystem support. Starting a greenfield project on the previous major version when all plugins already support the current version creates unnecessary upgrade debt.

Specific install command changes:

```bash
# RESEARCH.md specified:
npm install zod
npm install -D typescript@^5.9 vitest@^4.1 eslint@^9 eslint-plugin-import-x prettier@^3

# Updated:
npm install zod@^4
npm install -D typescript@^5.9 vitest@^4.1 eslint@^10 eslint-plugin-import-x prettier@^3
```

No changes needed to `eslint.config.js` flat config structure, `no-restricted-paths` configuration, vitest setup, or TypeScript config.

## Alternatives Considered

### Stay on ESLint ^9

- Still actively maintained (9.39.4 released 2026-03-06)
- All plugins support both ^9 and ^10
- **Why not:** ESLint 10 removes dead eslintrc code (cleaner), adds built-in types for Espree/ESLint Scope, and is the recommended path for new projects. No benefit to starting on old major.

### Stay on Zod ^3

- Stable, widely used, well-documented
- **Why not:** Zod 4 is 14x faster string parsing, 6.5x faster object parsing, 100x fewer tsc instantiations, 2x smaller bundle. For an ECS with many component schemas validated at entity assembly time, performance matters. Core APIs we use are compatible.

## Key Findings

### ESLint 10 (released 2026-02-06)

- **Source:** ESLint blog, npm peerDependencies
- **Breaking changes that DON'T affect us:** Removed eslintrc (we use flat config), removed deprecated `context` methods (we don't write custom rules), JSX references (no JSX in engine)
- **Breaking change that DOES affect us:** New config lookup algorithm — ESLint 10 starts config lookup from each linted file's directory, not CWD. For a single `eslint.config.js` at project root, behavior is identical.
- **Node.js requirement:** ^20.19.0 || ^22.13.0 || >=24
- `eslint-plugin-import-x@4.16.2` peer dep: `eslint: ^8.57.0 || ^9.0.0 || ^10.0.0` ✅
- `typescript-eslint@8.57.0` peer dep: `eslint: ^8.57.0 || ^9.0.0 || ^10.0.0` ✅
- `@typescript-eslint/parser@8.57.0` peer dep: same as above ✅
- Flat config with `import-x/no-restricted-paths` works identically in ESLint 10

### Zod 4 (stable release)

- **Source:** zod.dev/v4, zod.dev/v4/changelog
- **Core APIs unchanged for our use case:**
  - `z.object()`, `z.string()`, `z.number()`, `z.boolean()`, `z.array()` — same ✅
  - `z.infer<typeof schema>` — same ✅
  - `z.parse()` and `z.safeParse()` — same ✅
  - `z.optional()`, `z.enum()` — same ✅
- **Breaking changes relevant to our use case:**
  - `z.record(valueSchema)` single-arg dropped → must use `z.record(keySchema, valueSchema)` (affects component maps if we use `z.record`)
  - `.default()` now short-circuits (returns default without parsing) — subtle but different from v3
  - `z.object()` applies defaults inside optional fields — `{ a: z.string().default("x").optional() }` parsed from `{}` gives `{ a: "x" }` in v4 vs `{}` in v3
  - `message` param deprecated → use `error` param (still supported but deprecated)
- **Performance benefits:**
  - 14x faster string parsing
  - 6.5x faster object parsing
  - 100x reduction in tsc instantiations (critical for projects with many schemas)
  - 2x core bundle size reduction
- **New features useful for entity templates:**
  - `z.toJSONSchema()` — first-party JSON Schema conversion from Zod schemas
  - Recursive objects without type casting
  - `z.int()` — numeric format for integer validation
  - `z.prettifyError()` — built-in error formatting

### TypeScript 5.9.3

- **Source:** npm registry
- Current latest stable. Plan specifies `^5.9`. No changes needed. ✅

### Vitest 4.1.0

- **Source:** npm registry
- Current latest stable. Plan specifies `^4.1`. No changes needed.
- Peer dep on `vite@^6.0.0 || ^7.0.0 || ^8.0.0-0` — no vite needed for pure TS testing. ✅

### Prettier 3.8.1

- **Source:** npm registry
- Current latest stable. Plan specifies `^3`. No changes needed. ✅

### eslint-plugin-import-x 4.16.2

- **Source:** npm registry
- Supports ESLint 10. `no-restricted-paths` rule available and documented. ✅

## Impact on Plan 01-01

| Item | RESEARCH.md | Updated | Change Required |
|------|-------------|---------|-----------------|
| TypeScript | ^5.9 | ^5.9 (5.9.3) | None |
| Vitest | ^4.1 | ^4.1 (4.1.0) | None |
| ESLint | ^9 | **^10 (10.0.3)** | Update install command |
| eslint-plugin-import-x | latest | 4.16.2 | None |
| Prettier | ^3 | ^3 (3.8.1) | None |
| Zod | ^3.x | **^4 (4.3.6)** | Update install command |
| typescript-eslint | — | 8.57.0 | None (compatible) |

### Plan 01-01 Task Changes

**Task 1 — install command update:**
```bash
# Step 2: Install production deps
npm install zod@^4        # was: npm install zod

# Step 3: Install dev deps  
npm install -D typescript@^5.9 vitest@^4.1 eslint@^10 eslint-plugin-import-x prettier@^3
#                                          ^^^^^^^^^ was: eslint@^9
```

**Task 2 — no changes needed.** ESLint flat config, `import-x/no-restricted-paths`, and `@typescript-eslint/parser` all work with ESLint 10 with the same configuration syntax.

## Metadata

<metadata>
<confidence level="high">
All version information verified directly from npm registry (live queries). ESLint 10 breaking changes verified from official ESLint blog release post. Zod 4 migration guide verified from official zod.dev/v4/changelog. Plugin peer dependencies confirmed via `npm view` commands. No claims based on training data alone.
</confidence>

<sources>
- npm registry: `npm view [package] version` and `npm view [package] peerDependencies` (live, 2026-03-13)
- ESLint v10.0.0 release: https://eslint.org/blog/2026/02/eslint-v10.0.0-released/
- Zod 4 release notes: https://zod.dev/v4
- Zod 4 migration guide: https://zod.dev/v4/changelog
</sources>

<open_questions>
- None — all scope questions answered with authoritative sources.
</open_questions>

<validation_checkpoints>
- None needed — confidence is HIGH.
</validation_checkpoints>
</metadata>
