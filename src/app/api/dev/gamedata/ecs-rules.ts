export interface EcsRule {
  id: string;
  severity: 'error' | 'warn';
  message: string;
  validate: (components: Record<string, unknown>) => boolean;
}

export const RUNTIME_INTENT_OR_TAG_KEYS = new Set<string>([
  'moveIntent',
  'attackIntent',
  'ventIntent',
  'damageIntent',
  'descentIntent',
  'extractionIntent',
  'equipIntent',
  'unequipIntent',
  'teleportIntent',
  'applyStatusEffectIntent',
  'healIntent',
  'heatIntent',
  'burnSoftwareIntent',
  'firmwareIntent',
  'acting',
  'pickupIntent',
  'interactPropIntent',
  'movedThisTurn',
  'dying',
  'firmwareActivatedThisTurn',
  'dealtDamageThisTurn',
  'floorTransitioned',
  'propInteractedThisTurn',
  'shellUpdateTag',
  'parent',
  'children',
  'templateId',
]);

export const ECS_RULES: EcsRule[] = [
  {
    id: 'enemy-requires-hostile-and-aistate',
    severity: 'error',
    message: 'Enemy entities must have both "hostile" and "aiState" components.',
    validate: (components) => {
      const hasHostile = 'hostile' in components;
      const hasAiState = 'aiState' in components;
      if (hasHostile || hasAiState) return hasHostile && hasAiState;
      return true;
    },
  },
  {
    id: 'enemy-requires-combat-stats',
    severity: 'warn',
    message: 'Hostile entities should define "health", "attack", and "energy" components.',
    validate: (components) => {
      if (!('hostile' in components)) return true;
      return 'health' in components && 'attack' in components && 'energy' in components;
    },
  },
  {
    id: 'item-requires-handler-component',
    severity: 'error',
    message:
      'Item entities must define a handler component ("pickupEffect", "currencyItem", "equipmentDef", "softwareDef", "abilityDef", "augmentData", or item.type === "key").',
    validate: (components) => {
      if (!('item' in components)) return true;
      return (
        'pickupEffect' in components ||
        'currencyItem' in components ||
        'equipmentDef' in components ||
        'softwareDef' in components ||
        'abilityDef' in components ||
        'augmentData' in components ||
        (components.item as Record<string, unknown>)?.type === 'key'
      );
    },
  },
  {
    id: 'prop-lock-requires-prop',
    severity: 'error',
    message:
      'Entities with "securityLock", "corruptedNode", or "directionalProp" must define "prop".',
    validate: (components) => {
      const hasLockOrHazard =
        'securityLock' in components ||
        'corruptedNode' in components ||
        'directionalProp' in components;
      if (hasLockOrHazard) return 'prop' in components;
      return true;
    },
  },
  {
    id: 'no-runtime-intents-in-templates',
    severity: 'error',
    message:
      'Static templates must not contain runtime intent components, turn tags, or hierarchy pointers.',
    validate: (components) => {
      for (const key of Object.keys(components)) {
        if (RUNTIME_INTENT_OR_TAG_KEYS.has(key)) return false;
      }
      return true;
    },
  },
  {
    id: 'valid-sprite-key',
    severity: 'warn',
    message: 'Sprite component should specify a non-empty key.',
    validate: (components) => {
      if ('sprite' in components) {
        const sprite = components.sprite as { key?: unknown } | undefined;
        if (!sprite || typeof sprite.key !== 'string' || sprite.key.trim().length === 0) {
          return false;
        }
      }
      return true;
    },
  },
];

export function validateEcsRules(components: Record<string, unknown>): {
  valid: boolean;
  errors: { id: string; message: string; severity: 'error' }[];
  warnings: { id: string; message: string; severity: 'warn' }[];
} {
  const failed = ECS_RULES.filter((rule) => !rule.validate(components));
  const errors = failed
    .filter((r) => r.severity === 'error')
    .map((r) => ({ id: r.id, message: r.message, severity: 'error' as const }));
  const warnings = failed
    .filter((r) => r.severity === 'warn')
    .map((r) => ({ id: r.id, message: r.message, severity: 'warn' as const }));
  return { valid: errors.length === 0, errors, warnings };
}
