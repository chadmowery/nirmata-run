'use client';

import React, { useState, useEffect, useRef } from 'react';
import { logger } from '@engine/utils/logger';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { reportableFetch } from '@client/reports';
import { ShellTemplate } from '@/game/shells/shared';
import { PanelCard, DottedSpecRow } from '../atomic';
import { ShellUpgradePanel } from './ShellUpgradePanel';
import { ItemTooltip } from './ItemTooltip';
import { ItemMetadata, resolveItemMetadata, SHELL_STAT_DEFINITIONS } from './item-metadata';
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

interface WireframeModel {
  vertices: number[][];
  edges: number[][];
  accentNodes?: number[];
}

const SHELL_MODELS: Record<string, WireframeModel> = {
  'vanguard-v1': {
    // Aggressive swept-wing tactical assault delta frame
    vertices: [
      [0, -1.8, 0.2], // 0: Forward sensory prow
      [-0.7, -0.6, 0.4], // 1: Cockpit left
      [0.7, -0.6, 0.4], // 2: Cockpit right
      [0, -0.5, -0.5], // 3: Dorsal spine top
      [-1.9, 0.6, -0.3], // 4: Wingtip left
      [1.9, 0.6, -0.3], // 5: Wingtip right
      [-0.9, 1.4, 0.3], // 6: Left main thruster
      [0.9, 1.4, 0.3], // 7: Right main thruster
      [0, 1.5, -0.2], // 8: Engine centerline
      [-1.2, 0.3, 0.1], // 9: Mid-wing leading edge left
      [1.2, 0.3, 0.1], // 10: Mid-wing leading edge right
      [0, -1.0, 0.1], // 11: Underbelly armor keel
    ],
    edges: [
      [0, 1],
      [0, 2],
      [1, 2],
      [0, 3],
      [1, 3],
      [2, 3],
      [1, 9],
      [9, 4],
      [2, 10],
      [10, 5],
      [4, 6],
      [5, 7],
      [6, 8],
      [7, 8],
      [3, 8],
      [9, 6],
      [10, 7],
      [0, 11],
      [11, 6],
      [11, 7],
      [1, 11],
      [2, 11],
    ],
    accentNodes: [0, 4, 5, 6, 7, 8],
  },
  'bastion-v1': {
    // Heavy hex-faceted armored walker carapace with blast shields & stabilizer outriggers
    vertices: [
      [-1.3, -1.3, -0.6],
      [1.3, -1.3, -0.6],
      [1.6, 0.5, -0.6],
      [-1.6, 0.5, -0.6], // 0-3: Back armor carapace
      [-1.5, -1.1, 0.7],
      [1.5, -1.1, 0.7],
      [1.7, 0.6, 0.7],
      [-1.7, 0.6, 0.7], // 4-7: Front heavy blast shield
      [0, -1.7, 0.3], // 8: Reinforced visor peak
      [-1.9, 1.5, 0.4], // 9: Left stabilizer outrigger
      [1.9, 1.5, 0.4], // 10: Right stabilizer outrigger
      [-0.9, 1.7, -0.5], // 11: Left rear anchor
      [0.9, 1.7, -0.5], // 12: Right rear anchor
      [0, 0.2, 0.9], // 13: Central reactor core
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0], // Back hull
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4], // Front shield
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7], // Struts
      [8, 4],
      [8, 5],
      [8, 0],
      [8, 1], // Visor crown
      [7, 9],
      [3, 11],
      [9, 11], // Left outrigger
      [6, 10],
      [2, 12],
      [10, 12], // Right outrigger
      [13, 4],
      [13, 5],
      [13, 6],
      [13, 7], // Core links
    ],
    accentNodes: [8, 9, 10, 11, 12, 13],
  },
  'ghost-v1': {
    // Crystalline faceted stealth needle with vertical spires & floating sensor satellites
    vertices: [
      [0, -2.1, 0], // 0: Apex stealth needle tip
      [-0.9, -0.6, -0.7], // 1: Upper facet left
      [0.9, -0.6, -0.7], // 2: Upper facet right
      [0, -0.7, 0.9], // 3: Forward stealth edge
      [-1.4, 0.6, 0.1], // 4: Mid flare left
      [1.4, 0.6, 0.1], // 5: Mid flare right
      [-0.5, 1.8, -0.4], // 6: Left sensor spire
      [0.5, 1.8, -0.4], // 7: Right sensor spire
      [0, 1.4, 0.5], // 8: Keel trailing edge
      // Floating satellite drone nodes
      [-1.7, -0.2, 0.4], // 9: Left floating drone
      [1.7, -0.2, 0.4], // 10: Right floating drone
    ],
    edges: [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [2, 3],
      [3, 1],
      [1, 4],
      [4, 6],
      [2, 5],
      [5, 7],
      [3, 8],
      [4, 8],
      [5, 8],
      [6, 7],
      [6, 8],
      [7, 8],
      // Drone links
      [4, 9],
      [9, 1],
      [5, 10],
      [10, 2],
    ],
    accentNodes: [0, 6, 7, 9, 10],
  },
};


export const ShellTab: React.FC = () => {
  const [templates, setTemplates] = useState<ShellTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedShellIndex = useStore(gameStore, (s) => s.selectedShellIndex);
  const setSelectedShellIndex = useStore(gameStore, (s) => s.setSelectedShellIndex);
  const setShellTemplates = useStore(gameStore, (s) => s.setShellTemplates);
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);

  const [hoveredAbility, setHoveredAbility] = useState<{
    metadata: ItemMetadata;
    x: number;
    y: number;
  } | null>(null);

  const [hoveredStat, setHoveredStat] = useState<{
    label: string;
    info: (typeof SHELL_STAT_DEFINITIONS)[string];
    x: number;
    y: number;
  } | null>(null);

  const [isGlitching, setIsGlitching] = useState(false);
  const [rotReadout, setRotReadout] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRotating, setIsRotating] = useState(true);
  const rotRef = useRef({ rotX: 0.22, rotY: 0 });
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  const handleSelectShell = (index: number) => {
    setSelectedShellIndex(index);
    setIsGlitching(true);
    setTimeout(() => setIsGlitching(false), 240);
  };

  useEffect(() => {
    const fetchShells = async () => {
      try {
        const response = await reportableFetch('/api/shells');
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

  // 3D Rotating Vector Wireframe Canvas with Holographic FX
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let frameCount = 0;
    const isReduced =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    // Drifting phosphor sparkles
    const particles = Array.from({ length: 26 }, () => ({
      x: (Math.random() - 0.5) * 2.4,
      y: (Math.random() - 0.5) * 2.2,
      z: (Math.random() - 0.5) * 2.4,
      vy: 0.008 + Math.random() * 0.012,
      opacity: 0.3 + Math.random() * 0.7,
      isCyan: Math.random() > 0.5,
    }));

    const render = () => {
      frameCount++;
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : 400;
      const h = parent ? parent.clientHeight : 480;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      // Deep CRT phosphor void background
      ctx.fillStyle = '#020407';
      ctx.fillRect(0, 0, w, h);

      if (isRotating && !isReduced && !isDraggingRef.current) {
        rotRef.current.rotY += 0.014;
      }

      if (frameCount % 6 === 0) {
        const deg = Math.round((((rotRef.current.rotY * 180) / Math.PI) % 360 + 360) % 360);
        setRotReadout(deg);
      }

      const activeModelKey = templates[selectedShellIndex]?.id || 'vanguard-v1';
      const activeModel = SHELL_MODELS[activeModelKey] || SHELL_MODELS['vanguard-v1'];
      const vertices = activeModel.vertices;
      const edges = activeModel.edges;
      const accentNodes = new Set(activeModel.accentNodes || []);

      const scale = Math.min(w, h) * 0.22;
      const cx = w / 2;
      const cy = h * 0.42; // Position model in upper 60% of viewport, above cards dock
      const fov = 3.6;

      const project = (x: number, y: number, z: number) => {
        // Rotate Y
        const x1 = x * Math.cos(rotRef.current.rotY) - z * Math.sin(rotRef.current.rotY);
        const z1 = x * Math.sin(rotRef.current.rotY) + z * Math.cos(rotRef.current.rotY);
        // Rotate X
        const y2 = y * Math.cos(rotRef.current.rotX) - z1 * Math.sin(rotRef.current.rotX);
        const z2 = y * Math.sin(rotRef.current.rotX) + z1 * Math.cos(rotRef.current.rotX);

        const depth = fov / (fov + z2);
        return [cx + x1 * scale * depth, cy + y2 * scale * depth, depth];
      };

      // 1. Draw 3D Perspective Ground Plane & Rotating Radar Rings
      const groundY = 1.6;
      const radarRadii = [0.8, 1.4, 2.0];

      // Draw concentric radar circles
      radarRadii.forEach((r, rIdx) => {
        ctx.strokeStyle = rIdx === 2 ? 'rgba(0, 240, 255, 0.45)' : 'rgba(0, 240, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const steps = 36;
        for (let s = 0; s <= steps; s++) {
          const theta = (s / steps) * Math.PI * 2;
          const [px, py] = project(Math.cos(theta) * r, groundY, Math.sin(theta) * r);
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      });

      // Draw 24 radar tick marks on outer ring
      ctx.strokeStyle = 'rgba(216, 255, 0, 0.5)';
      ctx.lineWidth = 1;
      const ticks = 24;
      for (let t = 0; t < ticks; t++) {
        const theta = (t / ticks) * Math.PI * 2;
        const [x1, y1] = project(Math.cos(theta) * 1.9, groundY, Math.sin(theta) * 1.9);
        const [x2, y2] = project(Math.cos(theta) * 2.1, groundY, Math.sin(theta) * 2.1);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Draw rotating radar sweep line
      const sweepAngle = rotRef.current.rotY * 1.5;
      const [sweepX, sweepY] = project(Math.cos(sweepAngle) * 2.0, groundY, Math.sin(sweepAngle) * 2.0);
      const [groundCx, groundCy] = project(0, groundY, 0);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(groundCx, groundCy);
      ctx.lineTo(sweepX, sweepY);
      ctx.stroke();

      // 2. Draw Drifting Phosphor Sparkle Particles
      particles.forEach((p) => {
        p.y -= p.vy;
        if (p.y < -2.2) p.y = 1.8;
        const [px, py] = project(p.x, p.y, p.z);
        ctx.fillStyle = p.isCyan
          ? `rgba(0, 240, 255, ${p.opacity * 0.7})`
          : `rgba(216, 255, 0, ${p.opacity * 0.7})`;
        ctx.fillRect(px - 1, py - 1, 2, 2);
      });

      // 3. Project Model Vertices
      const projected = vertices.map((v) => project(v[0], v[1], v[2]));

      // 4. Draw Glowing Phosphor Vector Edges
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(0, 240, 255, 0.85)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      edges.forEach(([i, j]) => {
        if (projected[i] && projected[j]) {
          ctx.moveTo(projected[i][0], projected[i][1]);
          ctx.lineTo(projected[j][0], projected[j][1]);
        }
      });
      ctx.stroke();

      // 5. Draw Glowing Vertex Nodes
      projected.forEach(([px, py], idx) => {
        const isAccent = accentNodes.has(idx);
        ctx.fillStyle = isAccent ? '#d8ff00' : 'rgba(216, 255, 0, 0.85)';
        ctx.shadowColor = isAccent ? 'rgba(216, 255, 0, 0.95)' : 'rgba(216, 255, 0, 0.6)';
        ctx.shadowBlur = isAccent ? 8 : 4;
        const size = isAccent ? 5 : 3.5;
        ctx.fillRect(px - size / 2, py - size / 2, size, size);
      });
      ctx.shadowBlur = 0;

      // 6. Glitch Effect on Chassis Switch
      if (isGlitching) {
        const glitchY = Math.random() * h;
        const glitchH = 8 + Math.random() * 24;
        ctx.fillStyle = 'rgba(0, 240, 255, 0.18)';
        ctx.fillRect(0, glitchY, w, glitchH);
        ctx.fillStyle = 'rgba(255, 42, 75, 0.12)';
        ctx.fillRect(0, (glitchY + 12) % h, w, glitchH / 2);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isRotating, selectedShellIndex, templates, isGlitching]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    rotRef.current.rotY += dx * 0.012;
    rotRef.current.rotX = Math.max(-0.8, Math.min(0.8, rotRef.current.rotX + dy * 0.012));
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handleFocus = (metadata: ItemMetadata, e: React.FocusEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredAbility({
      metadata,
      x: rect.right,
      y: rect.top,
    });
  };

  if (loading) {
    return <div className={styles.loading}>DIAGNOSTICS_RUNNING // QUERYING SHELL REPOSITORY...</div>;
  }

  const activeShell = templates[selectedShellIndex] || templates[0];
  const meta = activeShell ? ARCHETYPE_INFO[activeShell.id] || { subtitle: 'Standard Operator', kanjiArchetype: '標準型' } : null;

  const starterLoadout = activeShell?.starterLoadout || [];
  const starterAbilities = starterLoadout.map((blueprintId) =>
    resolveItemMetadata({
      templateId: blueprintId,
      status: 'DEFAULT CHASSIS FIRMWARE',
      statusVariant: 'cyan',
    }),
  );

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
          {(() => {
            const shellUpgrades = playerProfile?.shellUpgrades?.[activeShell?.id ?? ''] || {
              speed: 0,
              armor: 0,
              stability: 0,
              additionalPorts: 0,
            };
            return [
              {
                label: 'BASE SPEED',
                value: `${(activeShell?.baseStats?.speed ?? 100) + shellUpgrades.speed * 5} T/SEC`,
                valueColor: shellUpgrades.speed > 0 ? 'var(--c-accent)' : undefined,
              },
              {
                label: 'ARMOR RATING',
                value: `${(activeShell?.baseStats?.armor ?? 0) + shellUpgrades.armor * 1} DMG RED`,
                valueColor: shellUpgrades.armor > 0 ? 'var(--c-accent)' : undefined,
              },
              {
                label: 'MAX HEALTH',
                value: `${activeShell?.baseStats?.maxHealth ?? 100} HP`,
                valueColor: 'var(--c-accent-secondary)',
              },
              {
                label: 'STABILITY RETENTION',
                value: `${(activeShell?.baseStats?.stability ?? 80) + shellUpgrades.stability * 10}%`,
                valueColor: shellUpgrades.stability > 0 ? 'var(--c-accent-secondary)' : 'var(--c-accent)',
              },
              {
                label: 'SOCKET PORTS',
                value: `FW:${(activeShell?.basePorts?.maxFirmware ?? 2) + shellUpgrades.additionalPorts} / AG:${(activeShell?.basePorts?.maxAugment ?? 2) + shellUpgrades.additionalPorts}`,
                valueColor: shellUpgrades.additionalPorts > 0 ? 'var(--c-accent)' : undefined,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{ cursor: 'pointer' }}
                onPointerEnter={(e) => {
                  const info = SHELL_STAT_DEFINITIONS[stat.label];
                  if (info) {
                    setHoveredStat({ label: stat.label, info, x: e.clientX, y: e.clientY });
                  }
                }}
                onPointerMove={(e) => {
                  if (hoveredStat?.label === stat.label) {
                    setHoveredStat((prev) =>
                      prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
                    );
                  }
                }}
                onPointerLeave={() => setHoveredStat(null)}
              >
                <DottedSpecRow label={stat.label} value={stat.value} valueColor={stat.valueColor} />
              </div>
            ));
          })()}
        </div>

        {/* Default / Starter Firmware Subsystem Suite */}
        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(0, 240, 255, 0.2)' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--c-accent)',
              fontWeight: 800,
              letterSpacing: '0.08em',
              marginBottom: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>DEFAULT FIRMWARE LOADOUT</span>
            <span style={{ color: 'var(--c-text-dim)', fontSize: '8px' }}>[初期装備]</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {starterAbilities.length === 0 ? (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  color: 'var(--c-text-muted)',
                  textAlign: 'center',
                  padding: '6px',
                }}
              >
                NO DEFAULT FIRMWARE // SOCKET FROM VAULT
              </div>
            ) : (
              starterAbilities.map((itemMeta, idx) => (
                <div
                  key={`${itemMeta.id}-${idx}`}
                  className={styles.defaultAbilityCard}
                  tabIndex={0}
                  onPointerEnter={(e) =>
                    setHoveredAbility({ metadata: itemMeta, x: e.clientX, y: e.clientY })
                  }
                  onPointerMove={(e) => {
                    if (hoveredAbility?.metadata.id === itemMeta.id) {
                      setHoveredAbility({ metadata: itemMeta, x: e.clientX, y: e.clientY });
                    }
                  }}
                  onPointerLeave={() => setHoveredAbility(null)}
                  onFocus={(e) => handleFocus(itemMeta, e)}
                  onBlur={() => setHoveredAbility(null)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        fontWeight: 900,
                        color: 'var(--c-accent)',
                      }}
                    >
                      [FW {idx + 1}]
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-header)',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#ffffff',
                      }}
                    >
                      {itemMeta.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={styles.abilityTag}>
                      {itemMeta.specs.find((s) => s.label.includes('HEAT'))?.value || '+HEAT'}
                    </span>
                    <span className={styles.abilityTag}>
                      {itemMeta.specs.find((s) => s.label.includes('RANGE') || s.label.includes('ENGAGEMENT'))
                        ?.value || 'TACTICAL'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </PanelCard>

      {/* Column 2: 1px Vector Wireframe Hologram View with Shell Cards */}
      <PanelCard title="1PX VECTOR WIREFRAME HOLOGRAM" badge="SCHEMATIC">
        <div className={styles.wireframeView}>
          <div className={styles.scanlinesOverlay} aria-hidden="true" />
          <div className="corner-mark tl">┌ TK-VEC ┐</div>
          <div className="corner-mark tr">┌ ROT: 3D ┐</div>
          <div className="corner-mark bl">└ CHASSIS: {activeShell?.name} ┘</div>
          <div className="corner-mark br">└ VEC-OS 1.0.4 ┘</div>

          {/* Hologram Telemetry & Viewport Controls Header */}
          <div className={styles.hologramHeader}>
            <div className={styles.telemetryGroup}>
              <div className={styles.telemetryTitle}>
                <span>● 1PX VECTOR WIREFRAME HOLOGRAM</span>
                <span style={{ color: 'var(--c-accent-secondary)', fontSize: '8px' }}>
                  [{activeShell?.id.toUpperCase()}]
                </span>
              </div>
              <div className={styles.telemetrySub}>
                AZIMUTH: {rotReadout}° // ELEVATION: 15° // PHOSPHOR: 00F0FF / D8FF00
              </div>
            </div>

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
                  rotRef.current = { rotX: 0.22, rotY: 0 };
                }}
              >
                RESET CAM
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            className={styles.wireframeCanvas}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onDoubleClick={() => {
              rotRef.current = { rotX: 0.22, rotY: 0 };
            }}
          />

          {/* Hologram Shell Cards Dock */}
          <div className={styles.hologramCardsDock}>
            <button
              type="button"
              className={styles.deckNavBtn}
              onClick={() => {
                const prevIdx = (selectedShellIndex - 1 + templates.length) % templates.length;
                handleSelectShell(prevIdx);
              }}
              aria-label="Previous Shell"
            >
              ◄
            </button>

            <div className={styles.deckCardsGrid}>
              {templates.map((shell, idx) => {
                const isSelected = idx === selectedShellIndex;
                const shellMeta = ARCHETYPE_INFO[shell.id] || {
                  subtitle: 'Standard Operator',
                  kanjiArchetype: '標準型',
                };
                return (
                  <div
                    key={shell.id}
                    className={`${styles.shellHoloCard} ${isSelected ? styles.activeCard : ''}`}
                    onClick={() => handleSelectShell(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleSelectShell(idx);
                    }}
                    aria-pressed={isSelected}
                  >
                    <div className={styles.cardTopRow}>
                      <span className={styles.cardShellTitle}>{shell.name.replace('-v1', '')}</span>
                      <span className={styles.cardKanjiBadge}>[{shellMeta.kanjiArchetype}]</span>
                    </div>

                    <div className={styles.cardSubtitle}>{shellMeta.subtitle}</div>

                    <div className={styles.cardMiniStats}>
                      <span className={styles.miniStatChip}>SPD {shell.baseStats?.speed ?? 100}</span>
                      <span className={styles.miniStatChip}>ARM {shell.baseStats?.armor ?? 0}</span>
                      <span className={styles.miniStatChip}>HP {shell.baseStats?.maxHealth ?? 100}</span>
                      <span className={styles.miniStatChip}>STAB {shell.baseStats?.stability ?? 80}%</span>
                    </div>

                    <div className={styles.cardBottomRow}>
                      {isSelected ? (
                        <span className={styles.statusActiveTag}>● ONLINE</span>
                      ) : (
                        <span className={styles.statusInactiveTag}>[SELECT]</span>
                      )}
                      <span className={styles.cardPortsTag}>
                        FW:{shell.basePorts?.maxFirmware ?? 2} / AG:{shell.basePorts?.maxAugment ?? 2}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className={styles.deckNavBtn}
              onClick={() => {
                const nextIdx = (selectedShellIndex + 1) % templates.length;
                handleSelectShell(nextIdx);
              }}
              aria-label="Next Shell"
            >
              ►
            </button>
          </div>
        </div>
      </PanelCard>

      {/* Column 3: Hardware Upgrade Dock */}
      <div>
        <ShellUpgradePanel />
      </div>

      {/* Hover Tooltip for Default Abilities */}
      {hoveredAbility && (
        <ItemTooltip
          metadata={hoveredAbility.metadata}
          position={{ x: hoveredAbility.x, y: hoveredAbility.y }}
          visible={true}
          onDismiss={() => setHoveredAbility(null)}
        />
      )}

      {/* Hover Tooltip for Shell Stats */}
      {hoveredStat && (
        <ItemTooltip
          metadata={{
            id: hoveredStat.label,
            name: hoveredStat.info.name,
            kanjiSub: hoveredStat.info.kanjiSub,
            type: 'firmware',
            typeLabel: hoveredStat.info.typeLabel,
            rarityTier: 'uncommon',
            rarityLabel: 'TELEMETRY // SPECIFICATION',
            description: hoveredStat.info.description,
            statusBadge: 'VERIFIED',
            statusVariant: 'cyan',
            specs: hoveredStat.info.specs,
            footerText: 'CHASSIS CORE METRIC // UPGRADEABLE IN HARDWARE DOCK',
          }}
          position={{ x: hoveredStat.x, y: hoveredStat.y }}
          visible={true}
          onDismiss={() => setHoveredStat(null)}
        />
      )}
    </div>
  );
};

export default ShellTab;
