'use client';

import React, { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { GameState } from '@/game/states/types';
import {
  TaikokuPlacard,
  BarcodeLadder,
  BtnLever,
  DottedSpecRow,
} from './atomic';
import { useReportStore } from '@/client/reports/report-store';
import styles from './MainMenu.module.css';

export const MainMenu: React.FC = () => {
  const setGameStatus = useStore(gameStore, (s) => s.setGameStatus);
  const setActiveTab = useStore(gameStore, (s) => s.setActiveTab);
  const walletScrap = useStore(gameStore, (s) => s.walletScrap);
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);
  const setSystemSettingsModalVisible = useStore(
    gameStore,
    (s) => s.setSystemSettingsModalVisible,
  );
  const reportsAvailable = useReportStore((s) => s.status.available);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ESC key to toggle settings modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSystemSettingsModalVisible(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSystemSettingsModalVisible]);

  // Rotating Vector Wireframe Animation (Counter-rotating diamond + hexagon)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const render = () => {
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : 400;
      const h = 180;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);
      if (!isReduced) {
        angle += 0.015;
      }

      const cx = w / 2;
      const cy = h / 2;
      const radius = 55;

      // Outer Diamond Frame (Acid Lime)
      ctx.strokeStyle = 'rgba(216, 255, 0, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(216, 255, 0, 0.5)';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = angle + (i * Math.PI) / 2;
        const x = cx + Math.cos(a) * radius;
        const y = cy + Math.sin(a) * (radius * 0.7);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      // Inner Counter-Rotating Hexagon (Laser Cyan)
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
      ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const a2 = -angle * 1.5 + (j * Math.PI) / 3;
        const x2 = cx + Math.cos(a2) * (radius * 0.5);
        const y2 = cy + Math.sin(a2) * (radius * 0.35);
        if (j === 0) ctx.moveTo(x2, y2);
        else ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  const handleEnterDeck = () => {
    setActiveTab('shell');
    setGameStatus(GameState.Hub);
  };

  const handleDirectDeploy = () => {
    setGameStatus(GameState.Playing);
  };

  const handleLeaderboards = () => {
    setActiveTab('leaderboards');
    setGameStatus(GameState.Hub);
  };

  const fluxBalance = playerProfile?.wallet?.flux ?? 0;

  return (
    <div className="view-screen-centered">
      <div className={styles.menuConstruct}>
        {/* Top Banner Placard */}
        <TaikokuPlacard
          kanji="対空重工業"
          title="NIRMATA RUNNER // TAIKOKU VECTOR MANIFEST"
          stampText="合格 // LINK CERTIFIED"
          stampVariant="cyan"
          metaText="BUILD: v1.0.4-TK-VEC"
          style={{ marginBottom: 0, border: 'none', borderBottom: '3px solid #000000' }}
        />

        <div className={styles.menuMainGrid}>
          {/* Left Column: Barcode Ladder & Japanese Logistics Signaling */}
          <div className={styles.menuLeftLadder}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--c-text-dim)',
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              SPECIFICATION TK-8890
              <br />
              HEAVY VECTOR DYNAMICS
            </div>

            <BarcodeLadder code="TK-88902-C" color="var(--c-accent)" />

            <div
              style={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '0.2em',
                color: 'var(--c-accent-secondary)',
              }}
            >
              神経リンク同期完了 // NEURAL LINK READY
            </div>
          </div>

          {/* Center Column: Hero Title, Rotating Wireframe & Action Levers */}
          <div className={styles.menuCenterHero}>
            <div>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.15em',
                  color: 'var(--c-accent-secondary)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}
              >
                PERSISTENT SUITE // TURN-BASED EXTRACTION ROGUELIKE
              </div>
              <h1
                style={{
                  fontSize: '38px',
                  fontWeight: 900,
                  letterSpacing: '0.05em',
                  lineHeight: 1.1,
                  color: '#ffffff',
                }}
              >
                NIRMATA<span style={{ color: 'var(--c-accent)' }}>_RUNNER</span>
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--c-text-dim)', marginTop: '6px' }}>
                Modular 1px oscilloscope wireframe telemetry engineered with high-contrast
                constructivist shipping manifests.
              </p>
            </div>

            {/* Rotating Vector Wireframe Canvas */}
            <canvas ref={canvasRef} className={styles.menuHeroCanvas} />

            {/* Action Levers */}
            <div className={styles.menuActionStack}>
              <BtnLever onClick={handleEnterDeck} rightSlot="→">
                [01] ENTER NEURAL DECK [神経デッキ接続]
              </BtnLever>

              <BtnLever variant="cyan" onClick={handleDirectDeploy} rightSlot="TACTICAL">
                [02] DIRECT DEPLOY: TACTICAL HUD [即時出撃]
              </BtnLever>

              <BtnLever onClick={handleLeaderboards} rightSlot="TOP-50">
                [03] RECON LEADERBOARDS [戦績順位]
              </BtnLever>

              <BtnLever onClick={() => setSystemSettingsModalVisible(true)} rightSlot="ESC">
                [04] AUDIO & SETTINGS [音響設定]
              </BtnLever>

              {reportsAvailable && (
                <BtnLever onClick={() => useReportStore.getState().openManualReport()} rightSlot="F8">
                  [05] REPORT ISSUE [問題報告]
                </BtnLever>
              )}
            </div>
          </div>

          {/* Right Column: Telemetry Specs & Security Protocol */}
          <div className={styles.menuRightTelemetry}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 800,
                color: 'var(--c-accent)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                borderBottom: '1px solid var(--c-border)',
                paddingBottom: '4px',
              }}
            >
              HOST SYSTEM TELEMETRY
            </div>

            <DottedSpecRow label="KERNEL" value="VEC-OS 1.0.4" />
            <DottedSpecRow label="ACTIVE SEED" value="#TK-RUN-2026" />
            <DottedSpecRow
              label="FLUX BALANCE"
              value={`${fluxBalance.toLocaleString()} FLX`}
              valueColor="var(--c-accent-secondary)"
            />
            <DottedSpecRow
              label="SCRAP WALLET"
              value={`${walletScrap.toLocaleString()} CR`}
              valueColor="var(--c-scrap)"
            />
            <DottedSpecRow
              label="CHASSIS SYNC"
              value="99.4% [NOMINAL]"
              valueColor="var(--c-accent)"
            />

            <div className={styles.securityNotice}>
              <strong style={{ display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>
                SECURITY PROTOCOL // 警備指針
              </strong>
              Neural feed monitored under Taikoku Heavy Dynamics Defense Directive TK-09. Uncertified
              sub-level operations are subject to immediate core zeroing.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
