import { describe, it, expect } from 'vitest';
import { SpawnTableSchema, ShellTemplateSchema } from '../schemas';

describe('SpawnTableSchema', () => {
  it('should validate valid spawn table structure', () => {
    const validData = {
      tables: [
        {
          depthRange: { min: 1, max: 4 },
          enemiesPerRoom: { min: 1, max: 2 },
          templates: [{ name: 'test', weight: 50 }],
        },
      ],
    };
    expect(SpawnTableSchema.safeParse(validData).success).toBe(true);
  });
});

describe('ShellTemplateSchema', () => {
  it('accepts optional cardinal directionalSprites and defaultDirection', () => {
    const validShell = {
      id: 'bastion-v1',
      name: 'BASTION-v1',
      sprite: 'bastion-v1-south',
      defaultDirection: 'south',
      directionalSprites: {
        north: 'bastion-v1-north',
        east: 'bastion-v1-east',
        south: 'bastion-v1-south',
        west: 'bastion-v1-west',
      },
      baseStats: { speed: 80, stability: 10, armor: 3, maxHealth: 25 },
      basePorts: { maxFirmware: 1, maxAugment: 1, maxSoftware: 1 },
    };
    expect(ShellTemplateSchema.safeParse(validShell).success).toBe(true);
  });

  it('rejects invalid defaultDirection values', () => {
    const invalidShell = {
      id: 'bastion-v1',
      name: 'BASTION-v1',
      defaultDirection: 'northeast',
      baseStats: { speed: 80, stability: 10, armor: 3, maxHealth: 25 },
      basePorts: { maxFirmware: 1, maxAugment: 1, maxSoftware: 1 },
    };
    expect(ShellTemplateSchema.safeParse(invalidShell).success).toBe(false);
  });
});
