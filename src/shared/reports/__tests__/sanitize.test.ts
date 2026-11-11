import { describe, it, expect } from 'vitest';
import {
  sanitizeText,
  sanitizeTitle,
  sanitizeDescription,
  sanitizeNote,
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
