import { describe, it, expect } from 'vitest';
import { Shell } from '../shell';

describe('Shell Component', () => {
  it('should validate correct shell data', () => {
    const validData = {
      archetypeId: 'test-shell',
      speed: 100,
      stability: 5,
      armor: 2,
      maxHealth: 20,
    };
    const result = Shell.schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should fail on negative speed', () => {
    const invalidData = {
      archetypeId: 'test-shell',
      speed: -10,
      stability: 5,
      armor: 2,
      maxHealth: 20,
    };
    const result = Shell.schema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should fail on zero speed', () => {
    const invalidData = {
      archetypeId: 'test-shell',
      speed: 0,
      stability: 5,
      armor: 2,
      maxHealth: 20,
    };
    const result = Shell.schema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should allow zero stability and armor', () => {
    const validData = {
      archetypeId: 'test-shell',
      speed: 100,
      stability: 0,
      armor: 0,
      maxHealth: 20,
    };
    const result = Shell.schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should fail on negative health', () => {
    const invalidData = {
      archetypeId: 'test-shell',
      speed: 100,
      stability: 5,
      armor: 2,
      maxHealth: -5,
    };
    const result = Shell.schema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
