import { describe, it, expect } from 'vitest';
import {
  sanitizeText,
  sanitizeTitle,
  sanitizeDescription,
  sanitizeNote,
  sanitizeStack,
  sanitizeLogMessage,
  truncateSessionId,
  createCodeFence,
} from '../sanitize';

describe('Reports Sanitizer', () => {
  it('strips Trojan Source bidi override characters', () => {
    // Unicode directional formatting: RLO (\u202E), LRO (\u202D), etc.
    const dangerous = 'hello \u202Ereversed\u202C world';
    const sanitized = sanitizeText(dangerous);
    expect(sanitized).toBe('hello reversed world');
  });

  it('strips zero-width characters before neutralization', () => {
    const input = 'hidden\u200Bzero\uFEFFwidth\u200Cchar';
    const sanitized = sanitizeText(input);
    expect(sanitized).toBe('hiddenzerowidthchar');
  });

  it('removes HTML comments and tags', () => {
    const input = 'Hello <!-- comment --><b>World</b> <script>alert(1)</script>';
    const sanitized = sanitizeText(input);
    expect(sanitized).toBe('Hello World alert(1)');
  });

  it('rewrites markdown links and images to plain text without URLs', () => {
    const input = 'Check out [this exploit](https://evil.com/payload) and ![image alt](https://evil.com/pic.png)';
    const sanitized = sanitizeText(input);
    expect(sanitized).toBe('Check out this exploit and image alt');
  });

  it('neutralizes @mentions to prevent user notifications on GitHub', () => {
    const input = 'Paging @chadmowery and @admin_user for help';
    const sanitized = sanitizeText(input);
    expect(sanitized).toBe('Paging @\u200Bchadmowery and @\u200Badmin_user for help');
  });

  it('neutralizes #123 issue cross-references to prevent noisy linking', () => {
    const input = 'Related to issue #42 and #9999';
    const sanitized = sanitizeText(input);
    expect(sanitized).toBe('Related to issue #\u200B42 and #\u200B9999');
  });

  it('collapses newlines and multiple spaces for singleLine titles', () => {
    const input = 'Multi\nline\r\n  title   with\ttabs';
    const sanitized = sanitizeTitle(input, 50);
    expect(sanitized).toBe('Multi line title with tabs');
  });

  it('enforces maximum character length', () => {
    const long = 'a'.repeat(200);
    expect(sanitizeTitle(long, 50).length).toBe(50);
    expect(sanitizeNote('b'.repeat(2000), 1000).length).toBe(1000);
  });

  it('preserves valid multiline formatting in descriptions and notes', () => {
    const input = 'Line 1\nLine 2\n\nLine 3 with\ttab';
    const sanitized = sanitizeDescription(input);
    expect(sanitized).toBe('Line 1\nLine 2\n\nLine 3 with\ttab');
  });

  it('strips nested HTML comments to a fixed point and is idempotent (L-2)', () => {
    const nested = '<!<!-- -->-- injected -->Hello [[text](https://x)](https://y)';
    const first = sanitizeText(nested);
    expect(first).not.toContain('<!--');
    expect(first).not.toContain('-->');
    expect(first).not.toContain('https://');
    expect(sanitizeText(first)).toBe(first);
  });

  it('preserves legitimate generic <T> and comparison syntax while stripping HTML tags (L-2)', () => {
    const input = 'Array<T> and Map<K, V> where x < 5 && y > 3 <b>bold</b>';
    const sanitized = sanitizeText(input);
    expect(sanitized).toBe('Array<T> and Map<K, V> where x < 5 && y > 3 bold');
  });

  it('strips zero-width chars in sanitizeStack and neutralizes nr-* search markers (L-2, L-14)', () => {
    const stack = 'at fn\u200B (app.js:1:1)\nnr-fingerprint: 0123456789abcdef';
    const sanitizedStack = sanitizeStack(stack);
    expect(sanitizedStack).not.toContain('\u200B (');
    expect(sanitizedStack).not.toContain('nr-fingerprint:');

    const note = 'Trying to steer nr-fingerprint: deadbeef12345678 and nr-ref: NR-1111';
    const sanitizedNote = sanitizeText(note);
    expect(sanitizedNote).not.toContain('nr-fingerprint:');
    expect(sanitizedNote).not.toContain('nr-ref:');
    expect(sanitizeText(sanitizedNote)).toBe(sanitizedNote);
  });

  it('redacts UUIDs, session key-value pairs, and known session tokens in sanitizeLogMessage (NH-1)', () => {
    const uuid = 'a1b2c3d4-e5f6-4789-abcd-1234567890ef';
    const customToken = 'sess_bearer_secret_987654';
    const log = `Server session initialized: ${uuid}; sessionId=${customToken}; other=${customToken}`;
    const sanitized = sanitizeLogMessage(log, 500, [customToken]);

    expect(sanitized).not.toContain(uuid);
    expect(sanitized).not.toContain(customToken);
    expect(sanitized).toContain('a1b2c3d4…');
    expect(sanitized).toContain('sess_bea…');
    expect(truncateSessionId(uuid)).toBe('a1b2c3d4…');
    expect(truncateSessionId(undefined)).toBe('none');
  });

  describe('createCodeFence', () => {
    it('creates standard 3-backtick fence when content has no backticks', () => {
      const code = 'console.log("hello");';
      const fenced = createCodeFence(code, 'ts');
      expect(fenced).toBe('```ts\nconsole.log("hello");\n```');
    });

    it('expands fence length when content contains backticks', () => {
      const code = '```json\n{"foo": "bar"}\n```';
      const fenced = createCodeFence(code, 'text');
      // If code contains 3 backticks, outer fence must be 4 backticks
      expect(fenced.startsWith('````text\n')).toBe(true);
      expect(fenced.endsWith('\n````')).toBe(true);
    });

    it('expands fence length dynamically for even longer backtick runs', () => {
      const code = '````markdown\nNested\n````';
      const fenced = createCodeFence(code);
      expect(fenced.startsWith('`````\n')).toBe(true);
      expect(fenced.endsWith('\n`````')).toBe(true);
    });
  });
});
