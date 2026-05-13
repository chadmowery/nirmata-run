# Phase 17: Add Design Tool for Authoring and Viewing Entities, Component Templates, and Gamedata - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Developer-facing web tool for authoring and viewing the ECS gamedata layer: entity templates (JSON), mixin definitions, spawn/loot tables, component schemas, and Shell registry. Lives at `/dev/gamedata` as a Next.js dev route. Supports full CRUD with file writes back to disk. Shells are migrated from TypeScript to JSON as part of this phase. Not a player-facing feature — zero game logic changes.

</domain>

<decisions>
## Implementation Decisions

### Tool Scope & Access
- **D-01:** Lives at `/dev/gamedata` — a dedicated Next.js page under a dev route. Not linked from the player UI. Accessible in any environment but intentionally ungated for development simplicity.
- **D-02:** Full editor with file writes. Changes are saved back to JSON files on disk via API routes (consistent with the existing `/api/admin/...` pattern). No read-only restriction.

### Data Coverage
- **D-03:** Tool covers all five data types: entity templates, mixin definitions, spawn/loot tables, component schemas (as a reference/validation layer), and Shell registry.
- **D-04:** Shell registry is migrated to JSON as part of this phase. The existing `shell-registry.ts` loader is updated to read from JSON instead of hardcoded TypeScript definitions. This enables full edit/save for Shells in the tool.

### Authoring Model
- **D-05:** Form-based editor — each component renders as a typed form with known fields, inline validation. No raw JSON editing mode. Structured and error-catching over power-user raw access.
- **D-06:** New template creation offers two starting points: blank template (add components one by one) OR clone an existing template (rename + modify from a copy).
- **D-07:** Save validation enforces schema + ECS consistency. Blocks save on: incorrect field types, missing required fields per component schema, and ECS rule violations (e.g., enemy entities require `hostile` + `aiState`, item entities require `pickupEffect`). Validation errors shown inline before save.
- **D-08:** Delete is supported with a confirmation dialog before removing the file from disk. Full CRUD.

### Navigation & Layout
- **D-09:** Sidebar tree + main panel layout. Left sidebar lists five top-level sections (Entity Templates, Mixins, Spawn Tables, Component Schemas, Shells) with expandable tree items. Right panel shows the selected item's editor or viewer. VS Code-style but themed with Vibrant Decay.

### Visual Style
- **D-10:** Vibrant Decay aesthetic — follows the neon cyan/pink on black palette from Phase 16. Monospace type, the established CSS design tokens from `globals.css`. Tool feels continuous with the game universe.

### Claude's Discretion
- API route design for file read/write (separate endpoints per data type vs. unified `/api/dev/gamedata` CRUD)
- Component schema derivation approach (reflect TypeScript types at build time vs. manually authored schema JSON)
- Form field component library approach (build custom form components vs. use react-hook-form or similar)
- Sidebar tree component implementation and expand/collapse state management
- Mixin reference display in entity editor (show resolved mixin fields inline vs. link to mixin entry)
- Shell JSON file location and naming convention (e.g., `src/game/shells/shells.json` vs. per-shell files)
- ECS consistency rule registry implementation (where rules are defined and validated)
- How spawn tables are rendered (inline drop-chance table with editable rows vs. raw JSON for now)
- Keyboard shortcuts for power users (save with Cmd+S, new template with Cmd+N, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ECS Architecture
- `src/engine/entity/registry.ts` — EntityRegistry: stores/retrieves templates by name
- `src/engine/entity/factory.ts` — EntityFactory: creates entities from templates with runtime overrides
- `src/engine/entity/builder.ts` — buildEntity + resolveMixins: how mixin composition works
- `src/shared/components/index.ts` — COMPONENTS_REGISTRY: all 36 registered component types

### Entity Template Data
- `src/game/entities/templates/` — All JSON entity templates (player, enemies, items, firmware, augments, software)
- `src/game/entities/templates/mixins/` — combatant.json, physical.json mixin definitions
- `src/game/entities/templates/spawn-tables/` — Spawn and loot table JSON files

### Shell Data (to be migrated)
- `src/game/shells/shell-registry.ts` — Current TypeScript shell definitions (STRIKER-v1, BASTION-v1, SIGNAL-v1). This file is the migration source — Phase 17 converts these to JSON.

### App Architecture
- `src/app/page.tsx` — Main game page; how GameState and UI are composed
- `src/app/api/admin/` — Existing admin API routes pattern to follow for new dev API routes

### Prior Phase Context
- `.planning/phases/16-visual-identity-starter-loadouts/16-CONTEXT.md` — Vibrant Decay CSS tokens, design decisions (D-01 palette, D-10 Shell card layout) that inform tool styling
- `.planning/phases/15-neural-deck-hub-ui/15-CONTEXT.md` — Established CSS module structure, component decomposition patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `globals.css` CSS design tokens: `--color-neon-cyan`, `--color-electric-pink`, `--color-black`, `--color-white` — apply directly to tool UI
- `src/app/api/admin/inspect/route.ts` — Existing API route for inspecting game state; reference for how admin routes are structured
- `src/engine/entity/registry.ts` `getAll()` — Returns all registered templates; can be called server-side to seed the tool's list endpoint

### Established Patterns
- JSON-first entity definitions: all entity data lives in `src/game/entities/templates/*.json` — tool reads/writes these files directly
- Component registry pattern: `COMPONENTS_REGISTRY` in `src/shared/components/index.ts` lists all valid component constructors and can drive schema derivation
- Next.js API routes under `src/app/api/` for server-side data operations — tool's file read/write API follows this pattern
- CSS Modules per component (`*.module.css`) for scoped styles — established by Hub UI

### Integration Points
- Tool reads template files from `src/game/entities/templates/` via server-side file system (Node.js `fs`)
- Tool's API routes will write back to those same files using `fs.writeFile` with JSON.stringify
- Shell migration: `src/game/shells/shell-registry.ts` loads TypeScript shell defs; after migration it loads from `src/game/shells/shells.json` (or equivalent)
- No game logic imports in the tool — tool operates on the data layer only, not the ECS runtime

</code_context>

<specifics>
## Specific Ideas

- No specific "I want it like X" references from discussion. Design is open to standard approaches within the stated parameters.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-add-design-tool-for-authoring-and-viewing-entities-component-templates-and-gamedata*
*Context gathered: 2026-05-07*
