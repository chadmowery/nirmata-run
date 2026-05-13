# Phase 17: Add Design Tool for Authoring and Viewing Entities, Component Templates, and Gamedata - Research

**Researched:** 2026-05-07
**Domain:** Next.js dev route + file-system CRUD API + form-based data editor
**Confidence:** HIGH

## Summary

Phase 17 adds a developer-facing data authoring tool at `/dev/gamedata`. It is a Next.js page under a dev route using the App Router pattern already present in the project. The tool renders a VS Code-style sidebar tree + main editor panel and provides full CRUD over the five ECS data layers: entity templates, mixin definitions, spawn/loot tables, component schemas (reference/validation), and Shell archetypes. All five data layers already exist as JSON files on disk — the tool reads and writes those files directly via new API routes that follow the established `src/app/api/` pattern.

The one migration task in this phase is converting Shell archetype data from the per-file JSON templates at `src/game/shells/templates/*.json` into a consolidated format (or confirming per-file is the right target) and updating `src/game/shells/index.ts` to load from JSON dynamically rather than three hardcoded `import` statements. The shell templates are already JSON — the migration is about making `ShellRegistry` loading data-driven so the tool can write new shells without code changes.

The entire tool operates on the data layer only — no game engine imports, no runtime ECS, no PixiJS. Server-side API routes read/write files with `fs/promises`. Client-side React renders forms using the Zod schemas already defined per component as the source of truth for field types and defaults.

**Primary recommendation:** Implement the page as `src/app/dev/gamedata/page.tsx` (server component wrapper) with a `'use client'` child for interactive state. Each data type gets a dedicated API route under `src/app/api/dev/gamedata/[type]/route.ts`. Form fields are derived from Zod schema introspection — no external form library needed given the constrained, known-field domain. CSS Modules + existing design tokens, no new CSS dependencies.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Lives at `/dev/gamedata` — a dedicated Next.js page under a dev route. Not linked from the player UI. Accessible in any environment but intentionally ungated for development simplicity.
- **D-02:** Full editor with file writes. Changes are saved back to JSON files on disk via API routes (consistent with the existing `/api/admin/...` pattern). No read-only restriction.
- **D-03:** Tool covers all five data types: entity templates, mixin definitions, spawn/loot tables, component schemas (as a reference/validation layer), and Shell registry.
- **D-04:** Shell registry is migrated to JSON as part of this phase. The existing `shell-registry.ts` loader is updated to read from JSON instead of hardcoded TypeScript definitions. This enables full edit/save for Shells in the tool.
- **D-05:** Form-based editor — each component renders as a typed form with known fields, inline validation. No raw JSON editing mode. Structured and error-catching over power-user raw access.
- **D-06:** New template creation offers two starting points: blank template (add components one by one) OR clone an existing template (rename + modify from a copy).
- **D-07:** Save validation enforces schema + ECS consistency. Blocks save on: incorrect field types, missing required fields per component schema, and ECS rule violations (e.g., enemy entities require `hostile` + `aiState`, item entities require `pickupEffect`). Validation errors shown inline before save.
- **D-08:** Delete is supported with a confirmation dialog before removing the file from disk. Full CRUD.
- **D-09:** Sidebar tree + main panel layout. Left sidebar lists five top-level sections (Entity Templates, Mixins, Spawn Tables, Component Schemas, Shells) with expandable tree items. Right panel shows the selected item's editor or viewer. VS Code-style but themed with Vibrant Decay.
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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Standard Stack

### Core

| Library | Version (in package.json) | Purpose | Why Standard |
|---------|--------------------------|---------|--------------|
| Next.js | ^16.1.6 | App Router page + API routes | Already used — `src/app/` tree |
| React | ^19.2.4 | UI components | Project baseline |
| Zod | ^4.3.6 | Schema parsing and field-type derivation | All 36 components already use it |
| zustand | ^5.0.11 | Sidebar expand/collapse state, selected item state | Project baseline state manager |
| `fs/promises` (Node built-in) | — | File read/write in API route handlers | Same pattern as `FSProfileRepository` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.577.0 | Icons (chevron expand/collapse, edit, delete, save) | Already in deps — use instead of rolling SVG |
| CSS Modules | (Next.js built-in) | Scoped per-component styles | Same pattern as every existing UI component |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom form fields | react-hook-form | RHF adds ~13 kB for a dev tool; custom fields cover the constrained known-field domain without extra dep |
| Per-type API routes | Unified REST CRUD route | Unified route is cleaner but harder to type-check — per-type routes allow specific validation and file-path logic per data type |
| Per-file shell JSON (current) | Single `shells.json` array | Single file simpler for tool writes; per-file consistent with entity template pattern — keep per-file |

**Installation:** No new packages required. All dependencies (`next`, `react`, `zod`, `zustand`, `lucide-react`) are already present.

---

## Architecture Patterns

### Recommended Project Structure

```
src/app/dev/gamedata/
├── page.tsx                     # Server component: loads initial data, renders GamedataTool
├── GamedataTool.tsx             # 'use client' root: sidebar + panel layout, routing
├── Sidebar.tsx                  # Tree of 5 sections with expand/collapse
├── editors/
│   ├── EntityTemplateEditor.tsx # Form for RawTemplate with component add/remove
│   ├── MixinEditor.tsx          # Form for mixin JSON (subset of RawTemplate)
│   ├── SpawnTableEditor.tsx     # Editable rows for depth-band + weight table
│   ├── ComponentSchemaViewer.tsx# Read-only Zod schema introspection display
│   └── ShellEditor.tsx          # Form for ShellTemplate type
└── gamedata.module.css          # Sidebar + panel layout styles

src/app/api/dev/gamedata/
├── entities/route.ts            # GET list + POST create entity template file
├── entities/[name]/route.ts     # GET single + PUT update + DELETE entity template
├── mixins/route.ts              # GET list + POST create mixin file
├── mixins/[name]/route.ts       # GET single + PUT update + DELETE mixin
├── spawn-tables/route.ts        # GET list + POST create spawn table
├── spawn-tables/[name]/route.ts # GET single + PUT update + DELETE
├── shells/route.ts              # GET list + POST create shell template
└── shells/[name]/route.ts       # GET single + PUT update + DELETE
```

### Pattern 1: Next.js App Router — Server Component Initial Load

**What:** The page component (`page.tsx`) is a React Server Component that reads all template filenames from disk on the server and passes them as props to the client component. This avoids a client-side loading spinner on initial render.

**When to use:** Any page where the initial dataset is known at request time and doesn't need real-time updates.

```typescript
// src/app/dev/gamedata/page.tsx
import fs from 'fs/promises';
import path from 'path';
import { GamedataTool } from './GamedataTool';

const TEMPLATES_DIR = path.join(process.cwd(), 'src/game/entities/templates');

export default async function GamedataPage() {
  const files = await fs.readdir(TEMPLATES_DIR);
  const templateNames = files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
  return <GamedataTool initialTemplates={templateNames} />;
}
```

### Pattern 2: API Route for File Writes (follow `FSProfileRepository`)

**What:** API routes use `fs/promises` with atomic write (write to `.tmp` then rename) to avoid partial-file corruption on save.

```typescript
// src/app/api/dev/gamedata/entities/[name]/route.ts
import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

const DIR = path.join(process.cwd(), 'src/game/entities/templates');

export async function PUT(req: Request, { params }: { params: { name: string } }) {
  const body = await req.json();
  // Validate against RawTemplate shape before writing
  const filePath = path.join(DIR, `${params.name}.json`);
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(body, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: { name: string } }) {
  const filePath = path.join(DIR, `${params.name}.json`);
  await fs.unlink(filePath);
  return NextResponse.json({ success: true });
}
```

### Pattern 3: Zod Schema Introspection for Form Field Generation

**What:** Each component's Zod schema already describes every field's type, defaults, and constraints. Use `schema._def` (ZodObject shape) to enumerate fields and render appropriate `<input type="number">`, `<input type="text">`, `<input type="checkbox">`, or `<select>` elements.

**When to use:** `ComponentSchemaViewer` and the dynamic component-field section in `EntityTemplateEditor`.

```typescript
// Introspect a ZodObject to get field metadata
import { z } from 'zod';

function getFieldMeta(schema: z.ZodObject<any>) {
  return Object.entries(schema.shape).map(([key, fieldSchema]) => {
    const unwrapped = fieldSchema instanceof z.ZodOptional
      ? fieldSchema.unwrap()
      : fieldSchema instanceof z.ZodDefault
      ? fieldSchema._def.innerType
      : fieldSchema;
    
    const type = unwrapped instanceof z.ZodNumber ? 'number'
      : unwrapped instanceof z.ZodBoolean ? 'boolean'
      : unwrapped instanceof z.ZodEnum ? 'enum'
      : 'string';
    
    const defaultVal = fieldSchema instanceof z.ZodDefault
      ? fieldSchema._def.defaultValue()
      : undefined;
    
    return { key, type, defaultVal, enumValues: type === 'enum'
      ? unwrapped._def.values : undefined };
  });
}
```

### Pattern 4: Shell Migration — Dynamic Import to Data-Driven

**What:** `src/game/shells/index.ts` currently does three hardcoded `import` statements. After migration, it reads all `*.json` files from `src/game/shells/templates/` at startup using `fs` (server-side) or a glob import (bundler). Since shells are already individual JSON files, the cleanest approach is to keep per-file JSON and make `index.ts` use a dynamic glob.

```typescript
// src/game/shells/index.ts (after migration)
// Option A: Next.js bundler glob (client + server safe)
const shellFiles = import.meta.glob('./templates/*.json', { eager: true });
const templates = Object.values(shellFiles) as ShellTemplate[];

export const globalShellRegistry = new ShellRegistry();
templates.forEach(t => globalShellRegistry.register(t));
```

Note: `import.meta.glob` is a Vite/bundler feature. Next.js App Router supports this in server components. Alternatively, use `require.context` or do a server-only `fs.readdir` in a server component. The API routes can handle adding new shell JSON files without touching `index.ts` if the glob pattern picks them up.

### Pattern 5: ECS Consistency Rules

**What:** A small rules registry object that the save endpoint checks after Zod validation passes. Rules are predicate functions over the resolved component set.

```typescript
// src/app/api/dev/gamedata/ecs-rules.ts
type Template = { components: Record<string, unknown> };

export const ECS_RULES = [
  {
    id: 'enemy-requires-hostile-and-aistate',
    message: 'Enemy entities must have both "hostile" and "aiState" components.',
    validate: (t: Template) => {
      const hasHostile = 'hostile' in t.components;
      const hasAiState = 'aiState' in t.components;
      // Only enforce if either is present (opt-in: if you add hostile, you need aiState)
      if (hasHostile || hasAiState) return hasHostile && hasAiState;
      return true;
    },
  },
  {
    id: 'item-requires-pickup-effect',
    message: 'Item entities must have a "pickupEffect" component.',
    validate: (t: Template) =>
      !('item' in t.components) || 'pickupEffect' in t.components,
  },
];
```

### Sidebar State with Zustand

**What:** A small zustand store tracks which of the five sections is expanded, which item is selected, and whether an editor is dirty (unsaved changes).

```typescript
// src/app/dev/gamedata/store.ts
import { create } from 'zustand';

type Section = 'entities' | 'mixins' | 'spawnTables' | 'componentSchemas' | 'shells';

interface GamedataStore {
  expandedSections: Set<Section>;
  selectedItem: { section: Section; name: string } | null;
  isDirty: boolean;
  toggleSection: (section: Section) => void;
  selectItem: (section: Section, name: string) => void;
  setDirty: (dirty: boolean) => void;
}
```

### Anti-Patterns to Avoid

- **Importing game engine modules in the tool**: The tool runs in a Next.js server/client context where PixiJS, event buses, and ECS world are not available. Keep all API routes and client components free of `@game/*` imports beyond data types. Only import from `@shared/components` for Zod schemas (pure TypeScript, no DOM/canvas deps).
- **Writing files from client components directly**: All file I/O must go through API routes. Never import `fs` in a `'use client'` module — Next.js will error.
- **No optimistic updates without rollback**: Given this is a dev-only tool (not player-facing), synchronous save-then-refresh is acceptable and simpler than optimistic UI.
- **Hardcoding component field lists**: Derive fields from Zod schemas. Adding a new component type should not require touching the editor UI.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation on save | Custom validator | Zod `schema.safeParse()` | Already defined per component; catches all type/range errors automatically |
| File system atomic writes | Custom write logic | `.tmp` + `fs.rename()` pattern (same as `FSProfileRepository`) | Prevents partial-write corruption if process killed mid-write |
| Icon set | Custom SVG icons | `lucide-react` (already in deps) | Chevron-right/down, trash, pencil, plus icons all available |
| State management | Custom React context | `zustand` (already in deps) | Project-standard; stores sidebar state and dirty flag |

**Key insight:** The Zod component schemas are the single source of truth for field types. Deriving form fields from them means zero maintenance when a component schema changes — the editor updates automatically.

---

## Runtime State Inventory

> Phase 17 is not a rename/refactor phase — no runtime state items need migration. Shell templates are already JSON files and the registry load path is a code change only.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — entity templates are files in the repo, not DB records | — |
| Live service config | None — tool creates a new route, touches no existing service config | — |
| OS-registered state | None | — |
| Secrets/env vars | None | — |
| Build artifacts | None — no compiled outputs reference shell template paths by hardcoded count | — |

**Shell migration specifics:** `src/game/shells/index.ts` imports three shell JSON files by hardcoded path. After Phase 17, it must load all `*.json` from `src/game/shells/templates/` dynamically. This is a **code edit** only (update the loader); the JSON data files themselves are unchanged.

---

## Common Pitfalls

### Pitfall 1: `fs` imported in a Client Component

**What goes wrong:** Next.js throws a build error: `Module not found: Can't resolve 'fs'` in client bundles.
**Why it happens:** `'use client'` modules are bundled for the browser where Node.js built-ins don't exist.
**How to avoid:** All `fs/promises` calls must live in Server Components (`page.tsx`) or API route handlers. Never import `fs` in `GamedataTool.tsx` or any child component marked `'use client'`.
**Warning signs:** Build error mentioning `fs`, `path`, or `process.cwd` in a client module.

### Pitfall 2: Path Traversal in API Routes

**What goes wrong:** An API route that constructs a file path from user-supplied `name` parameter can be exploited to read/write arbitrary files (e.g., `name = "../../.env"`).
**Why it happens:** `path.join(DIR, name + '.json')` doesn't sanitize `..` segments.
**How to avoid:** Validate `name` parameter against `/^[a-z0-9-]+$/` before constructing the path, and verify the resolved path starts with the expected directory.
```typescript
const safeName = /^[a-z0-9-]+$/.test(params.name) ? params.name : null;
if (!safeName) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
const filePath = path.join(DIR, `${safeName}.json`);
if (!filePath.startsWith(DIR)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
```
**Warning signs:** Any API route writing `${params.name}.json` without validation.

### Pitfall 3: Shell Registry Dynamic Load Breaking Existing Tests

**What goes wrong:** Converting `src/game/shells/index.ts` from three static imports to `import.meta.glob` breaks existing unit tests that mock shell imports.
**Why it happens:** `import.meta.glob` is a bundler-specific API not available in Vitest's Node.js environment by default.
**How to avoid:** Configure Vitest to handle glob imports, or use a server-side `fs.readdir` approach only in the API route (not in `index.ts`), keeping `index.ts` static for tests. The tool's write API can add new JSON files that the static imports would pick up after a dev server restart — acceptable for a dev tool.
**Warning signs:** Vitest errors: `import.meta.glob is not a function`.

### Pitfall 4: Zod v4 Schema Introspection API Changes

**What goes wrong:** Code introspecting Zod schema shapes via `._def` or `.shape` breaks because Zod v4 changed internal APIs compared to v3.
**Why it happens:** The project uses `zod: ^4.3.6`. Zod v4 is a major version with breaking internal changes.
**How to avoid:** Use `schema.shape` (public API on `ZodObject`) rather than `._def.shape`. For union/enum introspection, use `schema._def.values` for `ZodEnum` and `schema.options` for `ZodUnion`. Test schema introspection utility against actual component schemas before building the full form renderer.
**Warning signs:** Runtime error `Cannot read properties of undefined (reading 'shape')`.

### Pitfall 5: Mixin Depth Loop in Component Schema Viewer

**What goes wrong:** Displaying "resolved" template fields (mixins applied) in the viewer triggers the `resolveMixins` function which may throw on circular references or depth exceeded if templates/mixins are malformed on disk.
**Why it happens:** The viewer would call `resolveMixins` server-side to show the "effective" component set.
**How to avoid:** Wrap any `resolveMixins` call in try/catch; display error inline rather than crashing the page. Alternatively, display the raw template JSON (components + mixin names) and let users navigate to the mixin entry separately.
**Warning signs:** Page 500 errors when an entity template has a malformed mixin reference.

### Pitfall 6: Stale List After Save

**What goes wrong:** After creating a new template file via POST, the sidebar tree still shows the old list because it was loaded as initial props from the server.
**Why it happens:** Server-component initial load runs once at request time; client-side mutations don't automatically invalidate it.
**How to avoid:** After any create/delete mutation, re-fetch the list from the API route (`GET /api/dev/gamedata/entities`) and update local React state. Use a simple `useState` + `useEffect` pattern — no SWR/React Query needed for a dev tool.

---

## Code Examples

Verified patterns from the existing codebase:

### Atomic File Write (from `FSProfileRepository`)

```typescript
// src/app/persistence/fs-profile-repository.ts — established pattern
const tempPath = `${filePath}.tmp`;
await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
await fs.rename(tempPath, filePath);
```

### Zod Schema Definition (from `src/shared/components/health.ts`)

```typescript
export const Health = defineComponent('health', z.object({
  current: z.number().int().min(0),
  max: z.number().int().positive(),
  isAlive: z.boolean().default(true),
}));
```

### API Route Pattern (from `src/app/api/admin/grant/route.ts`)

```typescript
export async function POST(req: Request) {
  const body = await req.json();
  const result = SomeSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid request', details: result.error }, { status: 400 });
  }
  // ... do work
  return NextResponse.json({ success: true });
}
```

### CSS Module + Design Tokens (from `src/components/ui/styles.module.css`)

```css
/* Uses CSS custom properties from globals.css */
.terminalPanel {
  background: var(--panel-bg);
  border: 2px solid var(--border-color);
  box-shadow: 0 0 15px rgba(0, 255, 65, 0.2);
}
```

### Vibrant Decay Tokens Available in `globals.css`

| Token | Value | Semantic Use |
|-------|-------|-------------|
| `--vibrant-cyan` | `#00F0FF` | Secure/save actions, sidebar section headers |
| `--vibrant-pink` | `#FF0055` | Danger/delete actions, validation errors |
| `--safety-orange` | `#FF9500` | Warnings |
| `--black` | `#000000` | Background |
| `--white` | `#FFFFFF` | Primary text |
| `--font-body` | `"Arial Narrow"` | Labels, form fields |
| `--space-xs/sm/md/lg/xl` | 4/8/16/24/32px | Layout spacing |

### Entity Template JSON Schema (established format)

```json
{
  "name": "null-pointer",
  "mixins": ["physical", "combatant"],
  "components": {
    "actor": { "isPlayer": false },
    "energy": { "current": 0, "speed": 120, "threshold": 1000 },
    "sprite": { "key": "enemy_null_pointer" },
    "hostile": {},
    "aiState": { "behavior": "idle", "sightRadius": 8, "behaviorType": "null_pointer" }
  },
  "overrides": {
    "health": { "current": 6, "max": 6 },
    "attack": { "power": 3 }
  }
}
```

### Shell Template JSON Schema (established format, from `striker-v1.json`)

```json
{
  "id": "striker-v1",
  "name": "STRIKER-v1",
  "baseStats": { "speed": 120, "stability": 5, "armor": 1, "maxHealth": 15 },
  "basePorts": { "maxFirmware": 2, "maxAugment": 1, "maxSoftware": 2 },
  "upgrades": []
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded shell imports in `index.ts` | (This phase) dynamic load from `templates/*.json` | Phase 17 | Tool can create/delete shell files without code changes |
| No authoring tool — direct file editing in IDE | `/dev/gamedata` form-based editor | Phase 17 | Faster iteration, inline validation before save |

**Deprecated/outdated in this phase:**
- `src/game/shells/index.ts` static triple-import pattern: replaced by dynamic loader (or kept static + tool writes files that take effect on dev restart).

---

## Data Coverage Map

All five data types the tool must cover, with their file locations and structures:

| Section | Files | Root Dir | Format | TypeScript Type |
|---------|-------|----------|--------|-----------------|
| Entity Templates | `*.json` (35 files) | `src/game/entities/templates/` | `RawTemplate` | `src/engine/entity/types.ts` |
| Mixins | `combatant.json`, `physical.json`, `depth-distribution.json` | `src/game/entities/templates/mixins/` | `RawTemplate` (subset) | same |
| Spawn Tables | `depth-distribution.json` | `src/game/entities/templates/spawn-tables/` | Custom `{ tables: [...] }` | no TypeScript type — define in phase |
| Component Schemas | 36 `*.ts` files | `src/shared/components/` | Zod `ZodObject` | `ComponentDef<T>` |
| Shells | `striker-v1.json`, `bastion-v1.json`, `signal-v1.json` | `src/game/shells/templates/` | `ShellTemplate` | `src/game/shells/types.ts` |

**Component Schemas section is read-only**: The 36 component schemas are TypeScript source files with Zod definitions. The tool renders them as a reference (field names, types, defaults, constraints) — not editable, since they define runtime ECS behavior. Editing them is a code change, not a data change.

---

## Open Questions

1. **Shell migration: static imports vs. dynamic glob**
   - What we know: `index.ts` currently has three static imports; all three are JSON files already.
   - What's unclear: Whether `import.meta.glob` will work in Vitest without additional config, and whether shell templates are needed at both build time and runtime.
   - Recommendation: Keep `index.ts` with static imports for test stability. The API write routes create new files in `src/game/shells/templates/`. New shells appear in the tool immediately (list from `fs.readdir`), and take effect in the game after dev server restart. Minimal risk for a dev tool.

2. **Spawn table TypeScript type**
   - What we know: `depth-distribution.json` has a well-defined structure with `tables[]`, `depthRange`, `enemiesPerRoom`, and `templates[]` with weights. No TypeScript type exists for this format.
   - What's unclear: Whether there are other spawn table files besides `depth-distribution.json`.
   - Recommendation: Define a `SpawnTable` Zod schema in the API route during this phase. Use it for validation and form field generation.

3. **ECS consistency rules scope**
   - What we know: D-07 specifies at least two rules: enemy requires `hostile` + `aiState`; item requires `pickupEffect`.
   - What's unclear: Full list of ECS rules to enforce.
   - Recommendation: Implement the two known rules. Define a `ECS_RULES` array that can be extended. Document as "rules are not exhaustive — add as needed during data authoring."

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase uses only Node.js built-ins and packages already in the project).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |
| Environment | jsdom |

### Phase Requirements to Test Map

| Behavior | Test Type | Automated Command | Notes |
|----------|-----------|-------------------|-------|
| Entity template JSON validates against `RawTemplate` schema | unit | `vitest run src/app/api/dev/gamedata/__tests__/entities.test.ts` | Wave 0 gap |
| Shell template JSON validates against `ShellTemplate` schema | unit | `vitest run src/game/shells/__tests__` | Partial coverage exists |
| ECS consistency rules fire correctly | unit | `vitest run src/app/api/dev/gamedata/__tests__/ecs-rules.test.ts` | Wave 0 gap |
| Spawn table Zod schema validates `depth-distribution.json` | unit | `vitest run src/app/api/dev/gamedata/__tests__/spawn-tables.test.ts` | Wave 0 gap |
| API route `PUT` saves valid template and `GET` reads it back | integration | Manual (requires fs/Next.js) | Manual-only: API routes need a running Next.js server |
| Atomic write: `.tmp` + rename pattern on save | manual | Manual | Confirmed by code inspection of `FSProfileRepository` |

### Sampling Rate

- **Per task commit:** `npm run test` (vitest run, all unit tests)
- **Per wave merge:** `npm run test && npm run typecheck`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/app/api/dev/gamedata/__tests__/entities.test.ts` — covers entity template CRUD validation
- [ ] `src/app/api/dev/gamedata/__tests__/ecs-rules.test.ts` — covers ECS consistency rule predicates
- [ ] `src/app/api/dev/gamedata/__tests__/spawn-tables.test.ts` — covers spawn table Zod schema definition and validation of `depth-distribution.json`

---

## Sources

### Primary (HIGH confidence)

- Codebase direct reads: `src/engine/entity/`, `src/shared/components/`, `src/game/shells/`, `src/game/entities/templates/`, `src/app/api/admin/`, `src/app/persistence/fs-profile-repository.ts`, `vitest.config.ts`, `package.json`, `tsconfig.json`, `src/app/globals.css` — all file contents verified by direct read.
- `17-CONTEXT.md` — User decisions, canonical refs, code context extracted directly.

### Secondary (MEDIUM confidence)

- Next.js App Router file-system access pattern: `fs/promises` in server components and API routes — standard Next.js behavior, confirmed by `FSProfileRepository` pattern in codebase.
- Zod v4 `.shape` API for `ZodObject`: standard public API, should be stable across v4 minor versions.

### Tertiary (LOW confidence)

- `import.meta.glob` availability in Next.js 16: Vite-origin API; Next.js has adopted it for some cases but Vitest compatibility requires verification. Flagged as an open question — recommending static imports as fallback.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in `package.json`, no new installs needed
- Architecture: HIGH — all patterns derived from existing codebase reads
- Pitfalls: HIGH for known ones (fs in client, path traversal, stale list); MEDIUM for Zod v4 introspection API (internal API shape may vary)
- Data coverage: HIGH — all five data layers verified by direct file inspection

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (stable stack)
