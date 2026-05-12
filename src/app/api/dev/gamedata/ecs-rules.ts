export interface EcsRule {
  id: string;
  message: string;
  validate: (components: Record<string, unknown>) => boolean;
}

export const ECS_RULES: EcsRule[] = [
  {
    id: 'enemy-requires-hostile-and-aistate',
    message: 'Enemy entities must have both "hostile" and "aiState" components.',
    validate: (components) => {
      const hasHostile = 'hostile' in components;
      const hasAiState = 'aiState' in components;
      if (hasHostile || hasAiState) return hasHostile && hasAiState;
      return true;
    },
  },
  {
    id: 'item-requires-pickup-effect',
    message: 'Item entities must have a "pickupEffect" component.',
    validate: (components) =>
      !('item' in components) || 'pickupEffect' in components,
  },
];

export function validateEcsRules(components: Record<string, unknown>): { valid: boolean; errors: { id: string; message: string }[] } {
  const errors = ECS_RULES.filter(rule => !rule.validate(components))
    .map(rule => ({ id: rule.id, message: rule.message }));
  return { valid: errors.length === 0, errors };
}
