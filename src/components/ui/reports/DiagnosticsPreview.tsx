'use client';

import React from 'react';
import type { ClientDiagnostics, RedactedCrashPreview } from '@/shared/reports/schemas';
import styles from './ReportsModal.module.css';

interface DiagnosticsPreviewProps {
  diagnostics?: ClientDiagnostics;
  preview?: RedactedCrashPreview;
  error?: { name: string; message: string; stack?: string };
}

export const DiagnosticsPreview: React.FC<DiagnosticsPreviewProps> = ({
  diagnostics,
  preview,
  error,
}) => {
  return (
    <details className={styles.previewBox}>
      <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: 'var(--c-accent, #d8ff00)' }}>
        ▶ DIAGNOSTIC TELEMETRY PREVIEW // 詳細情報
      </summary>
      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {preview && (
          <div>
            <div style={{ color: '#fff', fontWeight: 'bold' }}>Sealed Server Diagnostics:</div>
            <ul style={{ margin: '4px 0 0 16px', listStyleType: 'disc' }}>
              {preview.sealedManifest.map((item, idx) => (
                <li key={idx}>
                  {item.label} (~{item.approxBytes} B)
                </li>
              ))}
            </ul>
            <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
              * Server stack trace, seed, and full authoritative state will be attached.
            </div>
          </div>
        )}

        {error && (
          <div>
            <div style={{ color: 'var(--c-danger, #ff0055)', fontWeight: 'bold' }}>
              {error.name}: {error.message}
            </div>
            {error.stack && (
              <pre
                style={{
                  marginTop: '4px',
                  maxHeight: '100px',
                  overflowY: 'auto',
                  fontSize: '10px',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '4px',
                }}
              >
                {error.stack}
              </pre>
            )}
          </div>
        )}

        {diagnostics && (
          <div style={{ fontSize: '10px' }}>
            <div>
              <strong>Build:</strong> {diagnostics.build} · <strong>Route:</strong> {diagnostics.route}
            </div>
            <div>
              <strong>Viewport:</strong> {diagnostics.viewport.w}x{diagnostics.viewport.h}
            </div>
            <div>
              <strong>Status:</strong> {diagnostics.gameStatus}
              {diagnostics.floor !== undefined && ` · Floor ${diagnostics.floor}`}
              {diagnostics.turn !== undefined && ` · Turn ${diagnostics.turn}`}
            </div>
            <div>
              <strong>Recent Logs:</strong> {diagnostics.recentLogs.length} entries ·{' '}
              <strong>Recent Actions:</strong> {diagnostics.recentActions.length} entries
            </div>
          </div>
        )}
      </div>
    </details>
  );
};
