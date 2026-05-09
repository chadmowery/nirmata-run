# Phase 17: Add Design Tool — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 17-add-design-tool-for-authoring-and-viewing-entities-component-templates-and-gamedata
**Areas discussed:** Tool scope & access, Data coverage, Authoring vs. viewing, Visual style & navigation

---

## Tool Scope & Access

| Option | Description | Selected |
|--------|-------------|----------|
| Dev route only (/dev/gamedata) | Gated behind a dev-only Next.js route, not linked from player UI | ✓ |
| Separate app/page (/tools or /admin/gamedata) | Adjacent to existing /admin/... API routes | |
| Embedded in the player app | Accessible via GameState or overlay, dev keyboard shortcut | |

**User's choice:** Dev route only (`/dev/gamedata`)
**Notes:** Simple and safe — not linked from player UI.

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only viewer only | Displays gamedata but cannot edit | |
| Full editor with file writes | Create, edit, save templates back to JSON on disk via API routes | ✓ |
| Edit in memory + export | Edits in memory, provides download/copy button, no disk writes | |

**User's choice:** Full editor with file writes
**Notes:** Replaces manually editing JSON files.

---

## Data Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Entity templates (JSON) | ~36 template files in src/game/entities/templates/ | ✓ |
| Mixin definitions | combatant/physical mixins | ✓ |
| Spawn tables | Loot and spawn tables with drop rates | ✓ |
| Component schemas | Reference view of 36 component types for authoring validation | ✓ |

**User's choice:** All four selected (full coverage)

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only viewer for shells | Show shell stats/ports but don't allow editing | |
| Migrate shells to JSON, then edit | Convert shell definitions to JSON, enable full edit/save | ✓ |
| Edit via API — persist to DB or separate JSON | Separate data store, TypeScript registry loads from it | |

**User's choice:** Migrate shells to JSON, then edit
**Notes:** Shell-registry.ts to be refactored as part of this phase.

---

## Authoring vs. Viewing

| Option | Description | Selected |
|--------|-------------|----------|
| Form-based editor | Each component renders as typed form with inline validation | ✓ |
| Raw JSON editor | Monaco/textarea editing raw JSON directly | |
| Both — form with JSON preview | Form editor primary with live JSON preview pane | |

**User's choice:** Form-based editor (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Blank + pick components | Start empty, add components one by one | |
| Clone an existing template | Pick base, rename, modify | |
| Both options available | New template flow offers blank or clone-from | ✓ |

**User's choice:** Both options available

| Option | Description | Selected |
|--------|-------------|----------|
| Schema validation only | Validate field types, required fields present | |
| Schema + ECS consistency | Also validate ECS rules: hostile+aiState for enemies, pickupEffect for items, etc. | ✓ |
| Warn but always allow save | Show warnings but never hard-block | |

**User's choice:** Schema + ECS consistency

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — delete with confirmation | Full CRUD: confirmation dialog before file removal | ✓ |
| No — delete manually via file system | Create/edit only, no deletes from tool | |

**User's choice:** Yes — with confirmation dialog

---

## Visual Style & Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Vibrant Decay aesthetic | Neon cyan/pink on black, monospace type, established CSS tokens | ✓ |
| Neutral dev-tool feel | Plain dark theme, gray/white tones, VS Code-like | |
| Minimal — just functional | No aesthetic effort, Tailwind defaults | |

**User's choice:** Vibrant Decay aesthetic (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar tree + main panel | Left sidebar with expandable tree, right panel editor. VS Code-style themed. | ✓ |
| Category tabs + item cards grid | Top-level tabs, searchable grid of cards per category | |
| Single-page searchable list | Flat searchable list, filter by type | |

**User's choice:** Sidebar tree + main panel (recommended)

---

## Claude's Discretion

- API route design for file read/write
- Component schema derivation approach
- Form field component library
- Sidebar tree state management
- Shell JSON file location/naming convention
- ECS consistency rule registry implementation
- Spawn table rendering approach
- Keyboard shortcuts

## Deferred Ideas

None — discussion stayed within phase scope.
