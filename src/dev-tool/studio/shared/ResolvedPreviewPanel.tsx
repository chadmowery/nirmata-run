'use client';
import { useState } from 'react';
import styles from './telemetry.module.css';

interface Props {
  selectedItem: { section: string; name: string } | null;
  effectiveData: unknown;
  validationStatus?: {
    zodValid: boolean;
    ecsResult?: {
      valid: boolean;
      errors: { id: string; message: string }[];
      warnings: { id: string; message: string }[];
    };
    prefabResult?: {
      valid: boolean;
      errors: { id: string; message: string }[];
      warnings: { id: string; message: string }[];
    };
  };
}

export function ResolvedPreviewPanel({
  selectedItem,
  effectiveData,
  validationStatus,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const formattedJson = effectiveData ? JSON.stringify(effectiveData, null, 2) : '{}';

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (collapsed) {
    return (
      <div
        style={{
          width: '32px',
          height: '100%',
          background: 'var(--c-surface, #0a0e15)',
          borderLeft: '1px solid var(--c-border, #1c2638)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '12px',
          gap: '8px',
        }}
        onClick={() => setCollapsed(false)}
        title="Open Inspector Panel"
      >
        <span
          style={{
            writingMode: 'vertical-rl',
            fontFamily: 'var(--font-display, sans-serif)',
            fontSize: '11px',
            color: 'var(--c-accent-secondary, #00f0ff)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          TELEMETRY // INSPECTOR
        </span>
      </div>
    );
  }

  const ecs = validationStatus?.ecsResult;
  const prf = validationStatus?.prefabResult;

  return (
    <aside className={styles.telemetryPanel}>
      <div className={styles.panelHeader}>
        <span>TELEMETRY & INSPECTOR</span>
        <button
          className={styles.copyButton}
          onClick={() => setCollapsed(true)}
          title="Collapse Panel"
        >
          ▶
        </button>
      </div>

      {/* Validation Status Card */}
      <div className={styles.sectionCard}>
        <div className={styles.cardTitle}>
          <span>VALIDATION STATUS</span>
          {validationStatus ? (
            validationStatus.zodValid && (ecs?.valid ?? true) && (prf?.valid ?? true) ? (
              <span className={styles.badgeSuccess}>✓ PASS</span>
            ) : (
              <span className={styles.badgeDanger}>✕ ISSUES</span>
            )
          ) : (
            <span style={{ opacity: 0.5 }}>READY</span>
          )}
        </div>

        {ecs && (
          <div style={{ marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ opacity: 0.8 }}>ECS Consistency Rules:</span>
              <span className={ecs.valid ? styles.badgeSuccess : styles.badgeDanger}>
                {ecs.valid ? 'PASS' : `${ecs.errors.length} ERRORS`}
              </span>
            </div>
            {ecs.errors.map((e) => (
              <div key={e.id} style={{ color: 'var(--c-danger, #ff2a4b)', fontSize: '10px', marginTop: '2px' }}>
                • {e.message}
              </div>
            ))}
            {ecs.warnings.map((w) => (
              <div key={w.id} style={{ color: 'var(--c-warning, #ff6600)', fontSize: '10px', marginTop: '2px' }}>
                • {w.message}
              </div>
            ))}
          </div>
        )}

        {prf && (
          <div style={{ marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ opacity: 0.8 }}>Structural Invariants:</span>
              <span className={prf.valid ? styles.badgeSuccess : styles.badgeDanger}>
                {prf.valid ? 'PASS' : `${prf.errors.length} ERRORS`}
              </span>
            </div>
            {prf.errors.map((e) => (
              <div key={e.id} style={{ color: 'var(--c-danger, #ff2a4b)', fontSize: '10px', marginTop: '2px' }}>
                • [{e.id}] {e.message}
              </div>
            ))}
            {prf.warnings.map((w) => (
              <div key={w.id} style={{ color: 'var(--c-warning, #ff6600)', fontSize: '10px', marginTop: '2px' }}>
                • [{w.id}] {w.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Effective JSON Header */}
      <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--c-surface-header, #0c121c)' }}>
        <span style={{ fontSize: '10px', letterSpacing: '0.08em', color: 'var(--c-text-dim, #79889e)', textTransform: 'uppercase' }}>
          EFFECTIVE JSON ({selectedItem?.name || 'none'})
        </span>
        <button className={styles.copyButton} onClick={handleCopy}>
          {copied ? 'COPIED!' : 'COPY JSON'}
        </button>
      </div>

      {/* Formatted JSON Inspector */}
      <pre className={styles.jsonViewer}>
        <code>{formattedJson}</code>
      </pre>
    </aside>
  );
}
