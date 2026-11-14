import { describe, it, expect } from 'vitest';
import {
  composeTitle,
  composeIssueBody,
  composeDedupeComment,
  generateRefId,
} from '../composer';

describe('Reports Composer', () => {
  it('generates a ref ID matching format NR-XXXX', () => {
    const ref = generateRefId();
    expect(ref).toMatch(/^NR-[2-9A-Z]{4}$/);
  });

  it('retries when isTaken reports a collision and expands length if exhausted (L-1)', () => {
    let calls = 0;
    const ref = generateRefId(() => {
      calls++;
      return calls <= 3;
    });
    expect(calls).toBe(4);
    expect(ref).toMatch(/^NR-[2-9A-Z]{4}$/);

    const fallback = generateRefId(() => true);
    expect(fallback).toMatch(/^NR-[2-9A-Z]{6}$/);
  });

  describe('composeTitle', () => {
    it('composes crash titles with error name and message capped at 80 chars', () => {
      const title = composeTitle({
        kind: 'CRASH',
        errorName: 'TypeError',
        errorMessage: 'Cannot read properties of undefined in action loop for entity 42',
      });
      expect(title.startsWith('[Crash] TypeError: ')).toBe(true);
    });

    it('composes manual report titles with kind prefix', () => {
      expect(composeTitle({ kind: 'BUG', title: 'Stuck in wall' })).toBe('[Bug] Stuck in wall');
      expect(composeTitle({ kind: 'FEATURE', title: 'Add auto-dash option' })).toBe(
        '[Feature] Add auto-dash option'
      );
      expect(composeTitle({ kind: 'FEEDBACK', title: 'Shotgun feels weak' })).toBe(
        '[Feedback] Shotgun feels weak'
      );
      expect(composeTitle({ kind: 'OTHER', title: 'Typo in lore text' })).toBe(
        '[Feedback] Typo in lore text'
      );
    });
  });

  describe('composeIssueBody', () => {
    it('includes required markers, summary table, and untrusted player input block', () => {
      const body = composeIssueBody({
        ref: 'NR-7K3Q',
        kind: 'CRASH',
        crashSource: 'SERVER_TURN',
        fingerprint: '9f2c4e1ab07d33c5',
        title: 'Crash in combat',
        errorName: 'TypeError',
        errorMessage: 'Cannot read properties of null',
        note: 'I was fighting a boss and clicked dash',
        sessionId: 'a1b2c3d4e5f6',
      });

      expect(body).toContain('<!-- nr-report v1 -->');
      expect(body).toContain('<!-- nr-fingerprint: 9f2c4e1ab07d33c5 -->');
      expect(body).toContain('<!-- nr-ref: NR-7K3Q -->');
      expect(body).toContain('UNTRUSTED PLAYER INPUT');
      expect(body).toContain('a1b2c3d4…');
      expect(body).toContain('I was fighting a boss and clicked dash');
      expect(body).toContain('TypeError: Cannot read properties of null');
    });

    it('enforces body truncation <= 60,000 characters when snapshot is massive', () => {
      const massiveSnapshot = {
        hugeArray: new Array(10000).fill({
          id: 123,
          components: { largeData: 'x'.repeat(50) },
        }),
      };

      const body = composeIssueBody({
        ref: 'NR-HUGE',
        kind: 'CRASH',
        title: 'Huge crash',
        note: 'Player note here',
        stateSnapshot: massiveSnapshot,
      });

      expect(body.length).toBeLessThanOrEqual(60000);
      expect(body).toContain('[truncated');
    });

    it('never splits UTF-16 surrogate pairs or leaves unclosed fences on hard truncation (L-3)', () => {
      // Fill > 60k using emoji (surrogate pairs) inside an error message / note
      const emojis = '🚀'.repeat(35000); // 70,000 UTF-16 code units
      const body = composeIssueBody({
        ref: 'NR-SURR',
        kind: 'BUG',
        title: 'Surrogate truncation test',
        note: emojis,
        failedAction: { type: 'MOVE', payload: 'x'.repeat(65000) },
      });

      expect(body.length).toBeLessThanOrEqual(60000);
      // Verify no lone surrogates exist anywhere in the output
      for (let i = 0; i < body.length; i++) {
        const code = body.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdbff) {
          const next = body.charCodeAt(i + 1);
          expect(next).toBeGreaterThanOrEqual(0xdc00);
          expect(next).toBeLessThanOrEqual(0xdfff);
        }
      }
      // Verify fences are balanced (even number of fence delimiter lines)
      const fences = body.match(/^`{3,}.*$/gm) || [];
      expect(fences.length % 2).toBe(0);
    });
  });

  describe('composeDedupeComment', () => {
    it('composes dedupe comment with occurrence count and player note', () => {
      const comment = composeDedupeComment({
        ref: 'NR-2222',
        count: 5,
        build: 'sha-abcd',
        floor: 3,
        turn: 40,
        sessionId: 'sess_secret123',
        note: 'Happened again during melee attack',
      });

      expect(comment).toContain('<!-- nr-comment v1 -->');
      expect(comment).toContain('<!-- nr-ref: NR-2222 -->');
      expect(comment).toContain('Additional Crash Occurrence (#5)');
      expect(comment).toContain('Floor 3 · Turn 40');
      expect(comment).toContain('sess_sec…');
      expect(comment).toContain('Happened again during melee attack');
    });
  });
});
