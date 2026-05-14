<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** **Entity Definition Structure** — Hierarchical items will be authored as nested JSON objects. The EntityFactory will flatten them into separate ECS entities and set up relationships at runtime.
- **D-02:** **Slot Mutability** — The number of slots on an equipment entity is dynamic at runtime (supports future item upgrade systems).
- **D-03:** **Lifecycle & Ownership** — Cascading destruction. Destroying a parent entity automatically destroys its installed children.
- **D-04:** **ECS Reference** — Bi-directional tracking. Both the parent (arrays of child IDs) and children (parent ID) store references to each other to facilitate querying.
- **D-05:** **Network Delta Serialization** — Flat entities. The server sends updates for each entity independently in the delta, relying on standard `json-diff-ts` behavior without custom hierarchical parsing.
- **D-06:** **Component Validation** — Schema-based validation. Zod schemas on the slot component definitions explicitly define allowed child types/tags.

### Claude's Discretion
None.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EQP-02 | Equipment items are implemented as full ECS entities capable of hosting nested component slots. | Identifies `Parent` and `Children` component architecture, updates to `EntityFactory`, and ECS cascading delete. |
</phase_requirements>

# Phase 18: Hierarchical Entity Foundation - Research

**Researched:** 2026-05-14
**Domain:** Server-authoritative ECS, Entity Hierarchy, Zod Schemas
**Confidence:** HIGH

## Summary

This phase establishes the ECS data structures and factory patterns required to represent complex, multi-entity items (like a Weapon with Software installed). The core challenge is that our ECS is fundamentally flat, but we need to represent trees of entities for gameplay and inventory purposes.

To achieve this, we will introduce explicit `Parent` and `Children` relationship components to maintain the tree structure natively within the ECS. The `EntityFactory` will be updated to traverse `children` arrays defined in template JSON, stamping out the nested entities and automatically linking their IDs. `World.destroyEntity` will be modified to utilize the `Children` component for cascading destruction, and the item pickup system will be updated to ensure the entire entity graph is accounted for.

**Primary recommendation:** Implement `Parent` and `Children` generic components to maintain bidirectional relationships, ensuring that cascading deletes and queries work reliably without hardcoding specific slot array logic into the core engine.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | Type checking & Schema definitions | Project standard |
| Zod | 4.3.6 | Component validation | Project standard for ECS components |
| json-diff-ts | 4.10.0 | Network sync | Flattened ECS state diffs cleanly with this |

## Architecture Patterns

### Recommended Project Structure
```
src/shared/components/
├── parent.ts        # New: tracks parent entity ID and slot type
└── children.ts      # New: tracks array of child entity IDs for generic operations
```

### Pattern 1: Bidirectional ECS References
**What:** The generic approach to hierarchical entities in a flat ECS.
**When to use:** For equipment systems, UI trees, or physical attachments.
**Example:**
```typescript
// Child component
export const Parent = defineComponent('parent', z.object({
  entityId: z.number(),
  slotComponent: z.string().optional() // Optional: Which slot array this belongs to
}));

// Parent component (Generic tracker for cascading deletes)
export const Children = defineComponent('children', z.object({
  entityIds: z.array(z.number()).default([]),
}));
```

### Pattern 2: Cascading Destruction in World
**What:** Extending `World.destroyEntity` to automatically destroy children.
**When to use:** Enforcing D-03 (Cascading destruction) cleanly.
**Example:**
```typescript
// Inside World.destroyEntity
const childrenStore = this.stores.get('children');
if (childrenStore && childrenStore.has(id)) {
  const childrenData = childrenStore.get(id) as { entityIds: number[] };
  for (const childId of childrenData.entityIds) {
    this.destroyEntity(childId); // Recursive destruction
  }
}
```

### Anti-Patterns to Avoid
- **Anti-pattern:** Creating complex, deeply nested JSON objects inside a single component instead of multiple entities. This violates the server-sync model and prevents items from being targeted by other systems (e.g., status effects on a specific piece of software).
- **Anti-pattern:** Custom diffing logic for hierarchical items. Rely entirely on `json-diff-ts` handling the flat map of entities in `World`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State synchronization | Custom tree diffing | `json-diff-ts` over flat ECS maps | Our established pattern handles N independent entities much better than complex nested data structures. |

**Key insight:** By keeping the network layer totally ignorant of the hierarchy and letting it just sync entity components by ID, the system remains decoupled and highly performant.

## Common Pitfalls

### Pitfall 1: Dangling References on Entity Deletion
**What goes wrong:** A child entity is removed or destroyed, but its ID remains in the parent's `Children` component or `SoftwareSlots` array.
**Why it happens:** Manual destruction bypassing standard cleanup systems or bidirectional sync constraints.
**How to avoid:** Listeners or cleanup systems must explicitly remove destroyed child IDs from parent arrays, or items should be unequipped properly before deletion.
**Warning signs:** `json-diff-ts` sends state updates containing invalid `entityId` references, leading to client-side exceptions when trying to render missing children.

### Pitfall 2: Circular Hierarchies
**What goes wrong:** Item A is equipped to Item B, and Item B is equipped to Item A.
**Why it happens:** Missing cycle detection during equip actions or factory parsing.
**How to avoid:** The `EntityFactory` recursive builder must track depth or seen templates. Equipment systems must check that a target parent is not a child of the current entity.

## Code Examples

### Template Interface Update
```typescript
// src/engine/entity/types.ts
export interface RawTemplate {
  name: string;
  components?: Record<string, unknown>;
  mixins?: string[];
  overrides?: Record<string, Record<string, unknown>>;
  // NEW: Support for instantiating nested children
  children?: { 
    template: string; 
    slotComponent: string; 
    overrides?: Record<string, Record<string, unknown>>;
  }[];
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/engine/entity/factory.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EQP-02 | Hierarchical JSON instantiates parent & children | unit | `npx vitest run src/engine/entity/builder.test.ts` | ❌ Wave 0 |
| EQP-02 | Parent/Child components populated with IDs | unit | `npx vitest run src/engine/entity/builder.test.ts` | ❌ Wave 0 |
| EQP-02 | World.destroyEntity cascades to children | unit | `npx vitest run src/engine/ecs/world.test.ts` | ✅ Wave 0 |
| EQP-02 | Item pickup moves complex items to Inventory | unit | `npx vitest run src/game/systems/item-pickup.test.ts` | ✅ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run {changed_test_files}`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/engine/entity/builder.test.ts` — covers EQP-02 (Hierarchical instantiation logic)
- [ ] `src/shared/components/parent.ts` — new component file needed
- [ ] `src/shared/components/children.ts` — new component file needed

## Sources

### Primary (HIGH confidence)
- `src/engine/ecs/world.ts` - Verified component data structures and deletion lifecycle.
- `src/engine/entity/builder.ts` - Verified template parsing patterns.
- `src/shared/components/software-slots.ts` - Verified existing slot array pattern.
