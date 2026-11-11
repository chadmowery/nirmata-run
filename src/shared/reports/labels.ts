/**
 * Report kind definitions, label mapping, and constants.
 * Pure TypeScript, zero external dependencies.
 */

export type ReportKind = 'BUG' | 'FEATURE' | 'FEEDBACK' | 'OTHER' | 'CRASH';

export type CrashSource =
  | 'SERVER_TURN'
  | 'SERVER_5XX'
  | 'CLIENT_ERROR'
  | 'CLIENT_REJECTION'
  | 'REACT_RENDER'
  | 'API_FAILURE';

/** Labels applied to every report issue filed in-game. */
export const BASE_LABELS = ['ai-ready', 'source:in-game'] as const;

/** Canonical label names for report kinds. */
export const KIND_LABELS: Record<ReportKind, string> = {
  CRASH: 'crash',
  BUG: 'bug',
  FEATURE: 'enhancement',
  FEEDBACK: 'feedback',
  OTHER: 'feedback', // Assumption A1: 'OTHER' maps to 'feedback'
};

/** All labels that must exist in the GitHub repository. */
export const ALL_REPORT_LABELS = [
  'ai-ready',
  'source:in-game',
  'crash',
  'bug',
  'enhancement',
  'feedback',
] as const;

/** Title prefixes for each report kind. */
export const TITLE_PREFIXES: Record<ReportKind, string> = {
  CRASH: '[Crash]',
  BUG: '[Bug]',
  FEATURE: '[Feature]',
  FEEDBACK: '[Feedback]',
  OTHER: '[Feedback]',
};

/**
 * Returns the full array of labels to apply to an issue for a given report kind.
 */
export function getLabelsForKind(kind: ReportKind): string[] {
  return [...BASE_LABELS, KIND_LABELS[kind]];
}

/**
 * Returns the title prefix for a given report kind.
 */
export function getTitlePrefixForKind(kind: ReportKind): string {
  return TITLE_PREFIXES[kind];
}
