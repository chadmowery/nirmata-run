import { describe, it, expect } from 'vitest';
import { validateEcsRules } from '../ecs-rules';

describe('ECS consistency rules', () => {
  it('should invalidate enemy without aiState', () => {
    const components = { hostile: {} };
    const result = validateEcsRules(components);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].id).toBe('enemy-requires-hostile-and-aistate');
  });

  it('should validate complete enemy', () => {
    const components = { hostile: {}, aiState: {}, health: {}, attack: {}, energy: {} };
    const result = validateEcsRules(components);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should emit warning for hostile enemy missing combat stats', () => {
    const components = { hostile: {}, aiState: {} };
    const result = validateEcsRules(components);
    expect(result.valid).toBe(true); // Warning does not block validity
    expect(result.warnings.some((w) => w.id === 'enemy-requires-combat-stats')).toBe(true);
  });

  it('should validate items with various handler components', () => {
    expect(validateEcsRules({ item: {}, pickupEffect: {} }).valid).toBe(true);
    expect(validateEcsRules({ item: {}, equipmentDef: {} }).valid).toBe(true);
    expect(validateEcsRules({ item: {}, softwareDef: {} }).valid).toBe(true);
    expect(validateEcsRules({ item: {}, currencyItem: {} }).valid).toBe(true);
    expect(validateEcsRules({ item: {}, abilityDef: {} }).valid).toBe(true);
    expect(validateEcsRules({ item: {}, augmentData: {} }).valid).toBe(true);
    expect(validateEcsRules({ item: { type: 'key' } }).valid).toBe(true);
  });

  it('should invalidate item without any handler component', () => {
    const result = validateEcsRules({ item: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.id === 'item-requires-handler-component')).toBe(true);
  });

  it('should require prop component when securityLock or directionalProp is present', () => {
    const invalidLock = validateEcsRules({ securityLock: {} });
    expect(invalidLock.valid).toBe(false);
    expect(invalidLock.errors.some((e) => e.id === 'prop-lock-requires-prop')).toBe(true);

    const validLock = validateEcsRules({ prop: {}, securityLock: {} });
    expect(validLock.valid).toBe(true);
  });

  it('should validate invulnerable hazard entity with aiState without requiring hostile', () => {
    const adminComponents = { invulnerable: {}, aiState: {}, health: {} };
    const result = validateEcsRules(adminComponents);
    expect(result.errors.some((e) => e.id === 'enemy-requires-hostile-and-aistate')).toBe(false);
  });

  it('should reject runtime intents and tags in static templates', () => {
    const withMoveIntent = validateEcsRules({ moveIntent: {} });
    expect(withMoveIntent.valid).toBe(false);
    expect(withMoveIntent.errors.some((e) => e.id === 'no-runtime-intents-in-templates')).toBe(true);

    const withDying = validateEcsRules({ dying: {} });
    expect(withDying.valid).toBe(false);
    expect(withDying.errors.some((e) => e.id === 'no-runtime-intents-in-templates')).toBe(true);

    const withSpawnEntityIntent = validateEcsRules({ spawnEntityIntent: {} });
    expect(withSpawnEntityIntent.valid).toBe(false);
    expect(withSpawnEntityIntent.errors.some((e) => e.id === 'no-runtime-intents-in-templates')).toBe(true);

    const withAlertIntent = validateEcsRules({ alertIntent: {} });
    expect(withAlertIntent.valid).toBe(false);
    expect(withAlertIntent.errors.some((e) => e.id === 'no-runtime-intents-in-templates')).toBe(true);
  });
});
