/**
 * Input sanitization and fence formatting for issue reports.
 * Hardens against prompt injection and formatting escapes in automated ticketing systems.
 * Pure TypeScript, zero external dependencies.
 */

// Bidi overrides (Trojan Source: LRE, RLE, PDF, LRO, RLO, LRI, RLI, FSI, PDI)
const BIDI_REGEX = /[\u202A-\u202E\u2066-\u2069]/g;

// Zero-width characters (ZWSP, ZWNJ, ZWJ, BOM)
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;

// Control characters (excluding \t, \n, \r)
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// HTML comments and tags (preserves single-letter uppercase generics like <T> and comparisons like a < b > c)
const HTML_COMMENTS_REGEX = /<!--[\s\S]*?-->/g;
const HTML_TAGS_REGEX = /<\/?(?:[a-z][a-z0-9:-]*|[A-Z][a-zA-Z0-9:-]+|[A-Z](?=\s)|![^>]*)(?:\s[^>]*)?\/?>/g;

// Markdown links and images
const MD_IMAGE_REGEX = /!\[([^\]]*)\]\([^)]*\)/g;
const MD_LINK_REGEX = /\[([^\]]+)\]\([^)]*\)/g;

// Mentions, GitHub issue/PR cross-references, and internal nr-* markers
const MENTION_REGEX = /@([a-zA-Z0-9_-]+)/g;
const ISSUE_REF_REGEX = /#([0-9]+)/g;
const NR_MARKER_REGEX = /\b(nr)-(fingerprint|ref|report|comment)\b/gi;

export interface SanitizeOptions {
  maxLength?: number;
  singleLine?: boolean;
}

/**
 * Sanitizes untrusted client/player input according to the untrusted-input contract.
 */
export function sanitizeText(input: string, options: SanitizeOptions = {}): string {
  if (!input) return '';

  // 1. Unicode NFC normalization
  let result = input.normalize('NFC');

  // 2. Strip bidi overrides and zero-width chars
  result = result.replace(BIDI_REGEX, '');
  result = result.replace(ZERO_WIDTH_REGEX, '');

  // 3. Handle whitespace and control chars
  if (options.singleLine) {
    // Replace all control characters and newlines with a single space
    // eslint-disable-next-line no-control-regex
    result = result.replace(/[\x00-\x1F\x7F\s]+/g, ' ').trim();
  } else {
    // Retain standard newlines/tabs, strip remaining control chars
    result = result.replace(CONTROL_CHARS_REGEX, '');
  }

  // 4 & 5. Remove HTML comments/tags and rewrite markdown images/links to plain text (loop to fixed point)
  let prev: string;
  let iterations = 0;
  do {
    prev = result;
    result = result.replace(HTML_COMMENTS_REGEX, '');
    result = result.replace(HTML_TAGS_REGEX, '');
    result = result.replace(MD_IMAGE_REGEX, '$1');
    result = result.replace(MD_LINK_REGEX, '$1');
    iterations++;
  } while (result !== prev && iterations < 10);

  // 6. Neutralize @mentions, #123 cross-references, and nr-* markers by inserting zero-width space
  result = result.replace(MENTION_REGEX, '@\u200B$1');
  result = result.replace(ISSUE_REF_REGEX, '#\u200B$1');
  result = result.replace(NR_MARKER_REGEX, '$1\u200B-$2');

  // 7. Enforce maximum length
  if (options.maxLength !== undefined && result.length > options.maxLength) {
    result = result.slice(0, options.maxLength);
  }

  return result;
}

export function sanitizeTitle(title: string, maxLength = 120): string {
  return sanitizeText(title, { singleLine: true, maxLength });
}

export function sanitizeDescription(desc: string, maxLength = 4000): string {
  return sanitizeText(desc, { singleLine: false, maxLength });
}

export function sanitizeNote(note: string, maxLength = 1000): string {
  return sanitizeText(note, { singleLine: false, maxLength });
}

export function truncateSessionId(sessionId?: string | null): string {
  if (!sessionId) return 'none';
  return `${sessionId.slice(0, 8)}…`;
}

/**
 * Redacts known token values (when longer than 8 chars) to their 8-char truncated form.
 */
export function redactKnownTokens(
  input: string,
  knownTokens?: ReadonlyArray<string | null | undefined>,
): string {
  if (!input || !knownTokens || knownTokens.length === 0) return input;
  let result = input;
  for (const token of knownTokens) {
    if (token && token.length > 8) {
      const truncated = truncateSessionId(token);
      if (result.includes(token)) {
        result = result.split(token).join(truncated);
      }
    }
  }
  return result;
}

/**
 * Defense-in-depth redaction for session bearer tokens and UUIDs in log strings.
 */
export function redactSessionTokens(
  input: string,
  knownTokens?: ReadonlyArray<string | null | undefined>,
): string {
  if (!input) return '';
  let result = redactKnownTokens(input, knownTokens);

  // Redact UUID v1-v5 patterns (such as generated sessionId bearer tokens)
  result = result.replace(
    /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
    (match) => truncateSessionId(match),
  );

  // Redact explicit session / sessionId / session_id key-value pairs (e.g. sessionId=..., session: ..., "sessionId":"...")
  result = result.replace(
    /(\b"?session(?:_?id)?"?\s*[:=]\s*"?)([a-zA-Z0-9._-]{9,})/gi,
    (_match, prefix: string, token: string) => `${prefix}${truncateSessionId(token)}`,
  );

  // Redact whitespace-separated sessionId / session_id tokens (e.g. "sessionId abcdef123456")
  result = result.replace(
    /(\b"?session_?id"?\s+)([a-zA-Z0-9._-]{9,})/gi,
    (_match, prefix: string, token: string) => `${prefix}${truncateSessionId(token)}`,
  );

  return result;
}

export function sanitizeLogMessage(
  msg: string,
  maxLength = 500,
  knownTokens?: ReadonlyArray<string | null | undefined>,
): string {
  const redacted = redactSessionTokens(msg, knownTokens);
  return sanitizeText(redacted, { singleLine: true, maxLength });
}

/**
 * Sanitizes an error name to a safe identifier charset and bounded length.
 */
export function sanitizeErrorName(name: string, maxLength = 48): string {
  const cleaned = sanitizeText(name || '', { singleLine: true, maxLength })
    .replace(/[^a-zA-Z0-9_.$:-]/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned.slice(0, maxLength) || 'Error';
}

/**
 * Sanitizes untrusted inline table/backtick values so they cannot break out of
 * markdown inline code spans or table cells.
 */
export function sanitizeInlineValue(input: string, maxLength = 120): string {
  const cleaned = sanitizeText(input || '', { singleLine: true, maxLength })
    .replace(/`/g, "'")
    .replace(/\|/g, '/');
  return cleaned.slice(0, maxLength);
}

export function sanitizeStack(stack: string, maxLength = 16384): string {
  if (!stack) return '';
  let sanitized = stack
    .normalize('NFC')
    .replace(BIDI_REGEX, '')
    .replace(ZERO_WIDTH_REGEX, '')
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(NR_MARKER_REGEX, '$1\u200B-$2');
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  return sanitized;
}

/**
 * Creates a markdown code fence with backtick length max(3, longestBacktickRun + 1),
 * preventing nested backtick sequences in the content from prematurely closing the block.
 */
export function createCodeFence(content: string, lang = ''): string {
  const matches = content.match(/`+/g);
  let maxBackticks = 0;
  if (matches) {
    for (const match of matches) {
      if (match.length > maxBackticks) {
        maxBackticks = match.length;
      }
    }
  }

  const fenceLength = Math.max(3, maxBackticks + 1);
  const fence = '`'.repeat(fenceLength);
  const safeContent = content.endsWith('\n') ? content : `${content}\n`;
  return `${fence}${lang}\n${safeContent}${fence}`;
}
