import { describe, it, expect } from 'vitest';
import { PortConfig } from '../port-config';

describe('PortConfig Component', () => {
  it('should validate correct port config', () => {
    const validData = {
      maxFirmware: 2,
      maxAugment: 1,
      maxSoftware: 2,
    };
    const result = PortConfig.schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should allow zero slots', () => {
    const validData = {
      maxFirmware: 0,
      maxAugment: 0,
      maxSoftware: 0,
    };
    const result = PortConfig.schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should fail on negative slots', () => {
    const invalidData = {
      maxFirmware: -1,
      maxAugment: 1,
      maxSoftware: 2,
    };
    const result = PortConfig.schema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should fail on non-integer values', () => {
    const invalidData = {
      maxFirmware: 2.5,
      maxAugment: 1,
      maxSoftware: 2,
    };
    const result = PortConfig.schema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
