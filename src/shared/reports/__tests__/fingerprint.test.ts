import { describe, it, expect } from 'vitest';
import {
  sha256Hex,
  normalizeMessage,
  normalizeStackFrame,
  extractTopStackFrames,
  computeCrashFingerprint,
} from '../fingerprint';

describe('Reports Fingerprinting', () => {
  it('computes correct standard SHA-256 hex hashes', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  describe('normalizeMessage', () => {
    it('normalizes UUIDs and hex addresses', () => {
      const msg = 'Failed for entity 12345678-1234-1234-1234-123456789abc at memory 0x7ffd9820';
      const normalized = normalizeMessage(msg);
      expect(normalized).toBe('Failed for entity <uuid> at memory <hex>');
    });

    it('normalizes entity and session IDs and numbers', () => {
      const msg = 'Entity 42 failed in turn 103 for session user-abc-123';
      const normalized = normalizeMessage(msg);
      expect(normalized).toBe('entity <id> failed in turn <num> for session <id>');
    });
  });

  describe('normalizeStackFrame', () => {
    it('normalizes V8 stack frame with function and path', () => {
      const line = '    at processTurn (/Users/dev/project/src/game/TurnManager.ts:142:15)';
      expect(normalizeStackFrame(line)).toBe('processTurn@TurnManager.ts');
    });

    it('normalizes V8 stack frame without function name', () => {
      const line = '    at http://localhost:3000/_next/static/chunks/app/page.js:20:10';
      expect(normalizeStackFrame(line)).toBe('anonymous@page.js');
    });

    it('normalizes Firefox / Safari stack frame', () => {
      const line = 'renderCombat@http://localhost:3000/src/game/CombatSystem.ts:88:12';
      expect(normalizeStackFrame(line)).toBe('renderCombat@CombatSystem.ts');
    });

    it('strips bundler chunk hashes and query params', () => {
      const line = '    at onClick (http://localhost:3000/_next/static/chunks/main-app-a1b2c3d4e5f6.js?ts=123:5:9)';
      expect(normalizeStackFrame(line)).toBe('onClick@main-app.js');
    });
  });

  describe('computeCrashFingerprint', () => {
    const stack1 = `Error: Cannot read properties of undefined
    at CombatSystem.execute (/src/game/CombatSystem.ts:100:15)
    at TurnManager.step (/src/game/TurnManager.ts:250:10)
    at runAction (/src/server/action/route.ts:50:5)`;

    const stack2WithDifferentLines = `Error: Cannot read properties of undefined
    at CombatSystem.execute (/src/game/CombatSystem.ts:105:22)
    at TurnManager.step (/src/game/TurnManager.ts:258:14)
    at runAction (/src/server/action/route.ts:55:8)`;

    it('produces identical 16-hex fingerprint despite line number shifts', () => {
      const fp1 = computeCrashFingerprint(
        'SERVER_TURN',
        'TypeError',
        'Cannot read properties of undefined (reading count 42)',
        stack1
      );
      const fp2 = computeCrashFingerprint(
        'SERVER_TURN',
        'TypeError',
        'Cannot read properties of undefined (reading count 99)',
        stack2WithDifferentLines
      );

      expect(fp1.length).toBe(16);
      expect(fp2.length).toBe(16);
      expect(fp1).toBe(fp2);
    });

    it('produces different fingerprints for different error names or sources', () => {
      const fpServer = computeCrashFingerprint('SERVER_TURN', 'TypeError', 'fail', stack1);
      const fpClient = computeCrashFingerprint('CLIENT_ERROR', 'TypeError', 'fail', stack1);
      const fpOther = computeCrashFingerprint('SERVER_TURN', 'RangeError', 'fail', stack1);

      expect(fpServer).not.toBe(fpClient);
      expect(fpServer).not.toBe(fpOther);
    });
  });
});
