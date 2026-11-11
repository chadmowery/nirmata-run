/**
 * Zod schemas and TypeScript types for report requests and responses.
 * Pure TypeScript + Zod.
 */

import { z } from 'zod';
import type { ReportKind, CrashSource } from './labels';

export { type ReportKind, type CrashSource };

export const ReportKindSchema = z.enum(['BUG', 'FEATURE', 'FEEDBACK', 'OTHER', 'CRASH']);

export const CrashSourceSchema = z.enum([
  'SERVER_TURN',
  'SERVER_5XX',
  'CLIENT_ERROR',
  'CLIENT_REJECTION',
  'REACT_RENDER',
  'API_FAILURE',
]);

export const ClientLogEntrySchema = z.object({
  t: z.number(),
  level: z.string().max(20),
  cat: z.string().max(50).optional(),
  msg: z.string().max(500),
});
export type ClientLogEntry = z.infer<typeof ClientLogEntrySchema>;

export const ClientActionEntrySchema = z.object({
  t: z.number(),
  type: z.string().max(100),
});
export type ClientActionEntry = z.infer<typeof ClientActionEntrySchema>;

export const ClientDiagnosticsSchema = z.object({
  build: z.string().max(100),
  route: z.string().max(200),
  userAgent: z.string().max(500),
  viewport: z.object({
    w: z.number(),
    h: z.number(),
  }),
  gameStatus: z.string().max(100),
  mode: z.string().max(100).optional(),
  floor: z.number().int().optional(),
  turn: z.number().int().optional(),
  shellId: z.string().max(100).optional(),
  recentLogs: z.array(ClientLogEntrySchema).max(100),
  recentActions: z.array(ClientActionEntrySchema).max(25),
  recentMessages: z.array(z.string().max(500)).max(10),
});
export type ClientDiagnostics = z.infer<typeof ClientDiagnosticsSchema>;

export const ManualReportRequestSchema = z.object({
  kind: z.enum(['BUG', 'FEATURE', 'FEEDBACK', 'OTHER']),
  title: z.string().min(5).max(120),
  description: z.string().min(10).max(4000),
  includeDiagnostics: z.boolean(),
  sessionId: z.string().max(100).optional(),
  diagnostics: ClientDiagnosticsSchema.optional(),
});
export type ManualReportRequest = z.infer<typeof ManualReportRequestSchema>;

const ServerCrashApproveSchema = z.object({
  source: z.enum(['SERVER_TURN', 'SERVER_5XX']),
  draftId: z.string().min(1).max(100),
  sessionId: z.string().min(1).max(100),
  note: z.string().max(1000).optional(),
});

const ClientCrashApproveSchema = z.object({
  source: z.enum(['CLIENT_ERROR', 'CLIENT_REJECTION', 'REACT_RENDER', 'API_FAILURE']),
  sessionId: z.string().max(100).optional(),
  note: z.string().max(1000).optional(),
  error: z.object({
    name: z.string().max(200),
    message: z.string().max(2000),
    stack: z.string().max(16384).optional(),
    componentStack: z.string().max(16384).optional(),
  }),
  diagnostics: ClientDiagnosticsSchema,
  fingerprint: z.string().length(16),
});

export const CrashApproveRequestSchema = z.union([
  ServerCrashApproveSchema,
  ClientCrashApproveSchema,
]);
export type CrashApproveRequest = z.infer<typeof CrashApproveRequestSchema>;

export const SealedManifestItemSchema = z.object({
  label: z.string().max(100),
  approxBytes: z.number(),
});
export type SealedManifestItem = z.infer<typeof SealedManifestItemSchema>;

export const RedactedCrashPreviewSchema = z.object({
  errorName: z.string(),
  errorMessage: z.string(),
  actionType: z.string(),
  floor: z.number(),
  turn: z.number(),
  sealedManifest: z.array(SealedManifestItemSchema),
});
export type RedactedCrashPreview = z.infer<typeof RedactedCrashPreviewSchema>;

export const CrashDraftOfferSchema = z.object({
  draftId: z.string(),
  fingerprint: z.string(),
  preview: RedactedCrashPreviewSchema,
});
export type CrashDraftOffer = z.infer<typeof CrashDraftOfferSchema>;

export const ReportResultSchema = z.object({
  status: z.enum(['created', 'commented', 'queued', 'dry-run']),
  ref: z.string(),
});
export type ReportResult = z.infer<typeof ReportResultSchema>;

export const ReportsStatusSchema = z.object({
  available: z.boolean(),
  mode: z.enum(['live', 'dry-run', 'off']),
});
export type ReportsStatus = z.infer<typeof ReportsStatusSchema>;
