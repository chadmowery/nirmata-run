import { describe, it, expect } from 'vitest';
import { DebugAPI } from '../debug-api';

describe('DebugAPI re-export test', () => {
  it('re-exports DebugAPI correctly from @dev-tool/debug/debug-api', () => {
    expect(DebugAPI).toBeDefined();
  });
});
