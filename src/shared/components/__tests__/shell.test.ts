import { describe, it, expect } from 'vitest';
import { Shell } from '../shell';

describe('Shell Component', () => {
  it('should validate correct shell data', () => {
    const validData = {
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
      speed: 100,
      stability: 5,
      armor: 2,
      maxHealth: -5,
    };
    const result = Shell.schema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
