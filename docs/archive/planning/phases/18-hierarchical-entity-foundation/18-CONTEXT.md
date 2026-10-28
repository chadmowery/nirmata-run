# Phase 18: Hierarchical Entity Foundation - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Establishing the ECS infrastructure to support hierarchical entities — specifically allowing Equipment items (like Weapons/Armor) to exist as full ECS entities that can host their own component slots (like Software slots).

</domain>

<decisions>
## Implementation Decisions

### Entity Architecture
- **D-01:** **Entity Definition Structure** — Hierarchical items will be authored as nested JSON objects. The EntityFactory will flatten them into separate ECS entities and set up relationships at runtime.
- **D-02:** **Slot Mutability** — The number of slots on an equipment entity is dynamic at runtime (supports future item upgrade systems).
- **D-03:** **Lifecycle & Ownership** — Cascading destruction. Destroying a parent entity automatically destroys its installed children.

### Implementation Details
- **D-04:** **ECS Reference** — Bi-directional tracking. Both the parent (arrays of child IDs) and children (parent ID) store references to each other to facilitate querying.
- **D-05:** **Network Delta Serialization** — Flat entities. The server sends updates for each entity independently in the delta, relying on standard `json-diff-ts` behavior without custom hierarchical parsing.
- **D-06:** **Component Validation** — Schema-based validation. Zod schemas on the slot component definitions explicitly define allowed child types/tags.

### Claude's Discretion
None.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Defines EQP-02 (Equipment items as full ECS entities).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EntityFactory` (`src/engine/entity/factory.ts`): Currently creates entities from templates; can be extended to support nested JSON parsing.

### Established Patterns
- **Component Schemas:** Zod is used for all component definitions (`src/game/components.ts` / `@shared/components`).
- **Slot Pattern:** Existing components like `FirmwareSlots` and `AugmentSlots` use `equipped: number[]` to store entity IDs.

### Integration Points
- Updates required in `EntityFactory` to process nested children.
- Component registry/definitions to include bidirectional references.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 18-hierarchical-entity-foundation*
*Context gathered: 2026-05-13*