import { describe, it, expect } from 'vitest';
import { RunInventoryItemSchema } from '../run-inventory';

describe('RunInventoryItemSchema', () => {
  it('should validate correctly with gridIndex', () => {
    const item = {
      entityId: 1,
      templateId: 'test-item',
      rarityTier: 'common',
      pickedUpAtFloor: 1,
      pickedUpAtTimestamp: 1234567890,
      gridIndex: 0,
    };
    const result = RunInventoryItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('should validate correctly without gridIndex', () => {
    const item = {
      entityId: 1,
      templateId: 'test-item',
      rarityTier: 'common',
      pickedUpAtFloor: 1,
      pickedUpAtTimestamp: 1234567890,
    };
    const result = RunInventoryItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('should provide default values for pickedUpAtFloor and pickedUpAtTimestamp when omitted', () => {
    const item = {
      entityId: 1,
      templateId: 'test-item',
      rarityTier: 'common',
    };
    const result = RunInventoryItemSchema.safeParse(item);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pickedUpAtFloor).toBe(1);
      expect(result.data.pickedUpAtTimestamp).toBeGreaterThan(0);
    }
  });
});
