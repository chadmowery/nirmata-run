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
    const components = { hostile: {}, aiState: {} };
    const result = validateEcsRules(components);
    expect(result.valid).toBe(true);
  });
});
