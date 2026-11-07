# Dev Tool Layer (`src/dev-tool/`) — Architectural Rules & Guidelines

The Dev Tool layer houses the developer-facing content authoring environment (Gamedata Studio), room prefab workstation, AST builders, and in-engine diagnostic terminal.

## 1. Import Boundaries & Production Quarantine
- **Allowed Imports**: `@engine/*`, `@shared/*`, `@server/*` (for schema introspection and template formats), `@rendering/*` (for prefab sprite rendering), `@dev-tool/*`.
- **CRITICAL QUARANTINE MANDATE**:
  - Code in `src/dev-tool/` must **never** be bundled into production client or production server execution paths.
  - Next.js middleware and route handlers strictly reject all dev and admin endpoints (`/dev/*`, `/api/dev/*`, `/api/admin/*`, `/api/debug/*`) when `process.env.NODE_ENV === 'production'`.
  - In-game diagnostics (`DevTerminal`, `EventTimelinePanel`, `DebugAPI`) are dynamically imported in development mode only.

## 2. Core Architectural Mandates
1. **Gamedata Studio Architecture (`src/dev-tool/studio/`)**:
   - Follows the canonical 3-column construct:
     - **Left Column**: Entity / Mixin / Prefab / Shell sidebar with search, archetype filtering, and quick creation.
     - **Center Column**: Interactive visual editor with real-time autotile preview, directional controls, and schema validation.
     - **Right Column**: Resolved JSON Inspector displaying live merged component state.
   - Built with Taikoku design tokens, amber unsaved-changes indicators, and `Cmd+S` shortcuts.
2. **Prefab Workstation & Validation**:
   - Room prefabs enforce footprint bounds (8–24 tiles per axis) and ensure exterior portals align to room perimeters.
   - Component additions run through `ecs-rules.ts` to prevent invalid component combinations (e.g., adding `Item` to a `Hostile` entity).
3. **Safe Filesystem I/O**:
   - File read/write operations must sanitize names with `sanitizeName()` to prevent path traversal outside designated template directories.
   - Templates are validated against canonical Zod schemas before being saved to disk.
4. **Diagnostic Terminal (`src/dev-tool/terminal/`)**:
   - `DevTerminal` provides in-game commands (`/grant-all`, `/heat`, `/panic`, `/hp`, `/stability`, `/descend`, `/show-map`).
   - Toggled via the backtick (`` ` ``) key without interfering with gameplay keymaps.

## 3. Related Documentation
- [`GAMEDATA-DESIGN-TOOL.md`](file:///Users/chadmowery/personal/dev/dungeon-runner/nirmata-run/docs/design/GAMEDATA-DESIGN-TOOL.md) — Comprehensive functional and technical specification for Gamedata Studio.
