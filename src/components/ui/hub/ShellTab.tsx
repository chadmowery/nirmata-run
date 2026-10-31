'use client';

import React, { useState, useEffect, useRef } from 'react';
import { logger } from '@engine/utils/logger';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { ShellTemplate } from '@/game/shells/shared';
import { PanelCard, DottedSpecRow } from '../atomic';
import { ShellUpgradePanel } from './ShellUpgradePanel';
import styles from './ShellTab.module.css';

interface ArchetypeMeta {
  subtitle: string;
  kanjiArchetype: string;
}

const ARCHETYPE_INFO: Record<string, ArchetypeMeta> = {
  'vanguard-v1': { subtitle: 'Skirmisher Assault Unit', kanjiArchetype: '突撃型' },
  'bastion-v1': { subtitle: 'Heavy Armored Enforcer', kanjiArchetype: '重装型' },
  'ghost-v1': { subtitle: 'Recon Infiltrator Unit', kanjiArchetype: '潜入型' },
};

export const ShellTab: React.FC = () => {
  const [templates, setTemplates] = useState<ShellTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedShellIndex = useStore(gameStore, (s) => s.selectedShellIndex);
  const setSelectedShellIndex = useStore(gameStore, (s) => s.setSelectedShellIndex);
  const setShellTemplates = useStore(gameStore, (s) => s.setShellTemplates);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRotating, setIsRotating] = useState(true);
  const rotRef = useRef({ rotX: 0.2, rotY: 0 });

  useEffect(() => {
    const fetchShells = async () => {
      try {
        const response = await fetch('/api/shells');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data.templates);
          setShellTemplates(data.templates);
        }
      } catch (error) {
        logger.error('Failed to fetch shells:', 'UI', error);
      } finally {
        setLoading(false);
      }
    };
    fetchShells();
  }, [setShellTemplates]);

  // 3D Rotating Vector Wireframe Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 3D Polyhedron Vertices for Chassis Hologram
    const vertices = [
      [-1, -1.2, -1], [1, -1.2, -1], [1, 1.2, -1], [-1, 1.2, -1],
      [-1, -1.2, 1], [1, -1.2, 1], [1, 1.2, 1], [-1, 1.2, 1],
      [0, -1.8, 0], [0, 1.8, 0], // Pylons
    ];

    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
      [8, 0], [8, 1], [8, 4], [8, 5],
      [9, 2], [9, 3], [9, 6], [9, 7],
    ];

    const render = () => {
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : 400;
      const h = parent ? parent.clientHeight : 380;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.fillStyle = '#030508';
      ctx.fillRect(0, 0, w, h);

      if (isRotating && !isReduced) {
        rotRef.current.rotY += 0.015;
      }

      const scale = Math.min(w, h) * 0.26;
      const cx = w / 2;
      const cy = h / 2;

      const projected = vertices.map((v) => {
        // Rotate Y
        const x1 = v[0] * Math.cos(rotRef.current.rotY) - v[2] * Math.sin(rotRef.current.rotY);
        const z1 = v[0] * Math.sin(rotRef.current.rotY) + v[2] * Math.cos(rotRef.current.rotY);
        // Rotate X
        const y2 = v[1] * Math.cos(rotRef.current.rotX) - z1 * Math.sin(rotRef.current.rotX);
        const z2 = v[1] * Math.sin(rotRef.current.rotX) + z1 * Math.cos(rotRef.current.rotX);

        const fov = 3.5;
        const depth = fov / (fov + z2);
        return [cx + x1 * scale * depth, cy + y2 * scale * depth];
      });

      // Draw Cyan Edges
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      edges.forEach(([i, j]) => {
        ctx.moveTo(projected[i][0], projected[i][1]);
        ctx.lineTo(projected[j][0], projected[j][1]);
      });
      ctx.stroke();

      // Draw Acid Chartreuse Nodes
      ctx.fillStyle = '#d8ff00';
      ctx.shadowColor = 'rgba(216, 255, 0, 0.9)';
      ctx.shadowBlur = 6;
      projected.forEach(([px, py]) => {
        ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
      });
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isRotating]);

  if (loading) {
    return <div className={styles.loading}>DIAGNOSTICS_RUNNING // QUERYING SHELL REPOSITORY...</div>;
  }

  const activeShell = templates[selectedShellIndex] || templates[0];
  const meta = activeShell ? ARCHETYPE_INFO[activeShell.id] || { subtitle: 'Standard Operator', kanjiArchetype: '標準型' } : null;

  return (
    <div className="three-col-grid">
      {/* Column 1: Chassis Specifications */}
      <PanelCard title="CHASSIS SPECIFICATIONS" badge={activeShell?.name || 'VANGUARD'}>
        <div className={styles.shellSelectorGroup}>
          {templates.map((shell, idx) => (
            <button
              key={shell.id}
              type="button"
              className={`${styles.shellPillBtn} ${idx === selectedShellIndex ? styles.active : ''}`}
              onClick={() => setSelectedShellIndex(idx)}
            >
              {shell.name.replace('-v1', '')}
            </button>
          ))}
        </div>

        {meta && (
          <div
            style={{
              padding: '6px 8px',
              background: '#0c121c',
              border: '1px solid var(--c-border)',
              marginBottom: '12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--c-accent-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{meta.subtitle}</span>
            <span style={{ color: 'var(--c-accent)', fontWeight: 800 }}>[{meta.kanjiArchetype}]</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <DottedSpecRow label="BASE SPEED" value={`${activeShell?.baseStats?.speed ?? 100} T/SEC`} />
          <DottedSpecRow label="ARMOR RATING" value={`${activeShell?.baseStats?.armor ?? 0} DMG RED`} />
          <DottedSpecRow
            label="MAX HEALTH"
            value={`${activeShell?.baseStats?.maxHealth ?? 100} HP`}
            valueColor="var(--c-accent-secondary)"
          />
          <DottedSpecRow
            label="STABILITY RETENTION"
            value={`${activeShell?.baseStats?.stability ?? 80}%`}
            valueColor="var(--c-accent)"
          />
          <DottedSpecRow
            label="SOCKET PORTS"
            value={`FW:${activeShell?.basePorts?.maxFirmware ?? 2} / AG:${activeShell?.basePorts?.maxAugment ?? 2}`}
          />
        </div>
      </PanelCard>

      {/* Column 2: 1px Vector Wireframe Hologram View */}
      <PanelCard title="1PX VECTOR WIREFRAME HOLOGRAM" badge="SCHEMATIC">
        <div className={styles.wireframeView}>
          <div className="corner-mark tl">┌ TK-VEC ┐</div>
          <div className="corner-mark tr">┌ ROT: 3D ┐</div>
          <div className="corner-mark bl">└ CHASSIS: {activeShell?.name} ┘</div>
          <div className="corner-mark br">└ VEC-OS ┘</div>

          <canvas ref={canvasRef} className={styles.wireframeCanvas} />

          <div className={styles.wireframeControls}>
            <button
              type="button"
              className="tool-btn"
              onClick={() => setIsRotating((prev) => !prev)}
            >
              {isRotating ? 'PAUSE ROT' : 'RESUME ROT'}
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => {
                rotRef.current = { rotX: 0.2, rotY: 0 };
              }}
            >
              RESET CAM
            </button>
          </div>
        </div>
      </PanelCard>

      {/* Column 3: Hardware Upgrade Dock */}
      <div>
        <ShellUpgradePanel />
      </div>
    </div>
  );
};
