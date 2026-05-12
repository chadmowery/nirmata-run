import { describe, it, expect } from 'vitest';
import { SpawnTableSchema } from '../schemas';

describe('SpawnTableSchema', () => {
  it('should validate valid spawn table structure', () => {
    const validData = {
      tables: [{
        depthRange: { min: 1, max: 4 },
        enemiesPerRoom: { min: 1, max: 2 },
        templates: [{ name: 'test', weight: 50 }]
      }]
    };
    expect(SpawnTableSchema.safeParse(validData).success).toBe(true);
  });
});
