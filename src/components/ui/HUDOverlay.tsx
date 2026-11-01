'use client';

import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { PlayerHUD } from './PlayerHUD';
import { MessageLog } from './MessageLog';
import { NearbyEntities } from './NearbyEntities';
import { AbilityBar } from './AbilityBar';
import EventTimelinePanel from './EventTimelinePanel';
import { InventoryOverlay } from './inventory/InventoryOverlay';
import { HotkeysModal } from './HotkeysModal';
import { BtnLever } from './atomic';
import styles from './styles.module.css';

export const HUDOverlay: React.FC = () => {
  const heatTier = useStore(gameStore, (s) => s.heatTier);
  const inventoryVisible = useStore(gameStore, (s) => s.inventoryVisible);
  const toggleInventory = () => gameStore.getState().toggleInventory();
  const hotkeysModalVisible = useStore(gameStore, (s) => s.hotkeysModalVisible);
  const toggleHotkeysModal = () => gameStore.getState().toggleHotkeysModal();

  const selectedRunMode = useStore(gameStore, (s) => s.selectedRunMode);
  const currentFloor = useStore(gameStore, (s) => s.currentFloor);
  const depthBand = useStore(gameStore, (s) => s.depthBand);
  const stats = useStore(gameStore, (s) => s.stats);
  const scrap = useStore(gameStore, (s) => s.scrap);
  const flux = useStore(gameStore, (s) => s.flux);
  const blueprintCount = useStore(gameStore, (s) => s.blueprintCount);
  const nanites = useStore(gameStore, (s) => s.nanites);
  const stability = useStore(gameStore, (s) => s.stability);
  const maxStability = useStore(gameStore, (s) => s.maxStability);

  const stabilityPercent = maxStability > 0 ? (stability / maxStability) * 100 : 0;
  const floorStr = String(currentFloor).padStart(2, '0');

  // Map tier number to CSS module class name
  const tierClassMap: Record<number, string> = {
    0: styles.heatTierClean,
    1: styles.heatTierJitter,
    2: styles.heatTierGhosting,
    3: styles.heatTierInversion,
    4: styles.heatTierScreenTear,
    5: styles.heatTierGrayscale,
  };

  const tierClass = tierClassMap[heatTier] ?? styles.heatTierClean;

  return (
    <div className={`${styles.hudConstruct} ${tierClass}`}>
      {/* ====================================================================
          ROW 1: TOP HUD TELEMETRY RIBBON (54px)
          ==================================================================== */}
      <header className={styles.hudRibbon}>
        <div className={styles.hudMetaChips}>
          <div className={styles.hudChip}>
            <span className={styles.hudChipLabel}>PROTOCOL</span>
            <span className={styles.hudChipVal}>
              {selectedRunMode ? selectedRunMode.toUpperCase() : 'STANDARD_SIM'}
            </span>
          </div>

          <div className={styles.hudChip}>
            <span className={styles.hudChipLabel}>DEPTH // SEED</span>
            <span className={styles.hudChipVal} style={{ color: 'var(--c-accent-secondary)' }}>
              FLOOR {floorStr} // {depthBand}
            </span>
          </div>

          <div className={styles.hudChip}>
            <span className={styles.hudChipLabel}>CHRONO // TURN</span>
            <span className={styles.hudChipVal}>
              T-{String(stats.turns || 0).padStart(4, '0')}
            </span>
          </div>

          <div className={styles.hudChip}>
            <span className={styles.hudChipLabel}>SCRAP RECOVERED</span>
            <span className={styles.hudChipVal} style={{ color: 'var(--c-scrap, #f59e0b)' }}>
              {scrap.toLocaleString()} CR
            </span>
          </div>

          <div className={styles.hudChip}>
            <span className={styles.hudChipLabel}>FLUX MATRIX</span>
            <span className={styles.hudChipVal} style={{ color: 'var(--c-accent, #00f0ff)' }}>
              {flux.toLocaleString()} FX
            </span>
          </div>

          <div className={styles.hudChip}>
            <span className={styles.hudChipLabel}>LOCKED FILES</span>
            <span className={styles.hudChipVal} style={{ color: 'var(--c-accent-secondary, #d8ff00)' }}>
              {blueprintCount} BP
            </span>
          </div>
        </div>

        {/* Reality Stability Progress Track */}
        <div className={styles.stabilityGaugeWrap}>
          <div className={styles.stabilityLabel}>
            REALITY STABILITY: {stabilityPercent.toFixed(1)}% [
            {stabilityPercent > 30 ? 'STABLE' : 'DEGRADED'}]
          </div>
          <div className={styles.stabilityTrack}>
            <div
              className={styles.stabilityFill}
              style={{ width: `${Math.min(100, Math.max(0, stabilityPercent))}%` }}
            />
          </div>
        </div>
      </header>

      {/* ====================================================================
          ROW 2: 3-COLUMN WORKSTATION (Left Diagnostics / Center Bay / Right Log)
          ==================================================================== */}
      <div className={styles.hudMainGrid}>
        {/* Left Column: Chassis Diagnostics */}
        <PlayerHUD />

        {/* Center Column: Tactical Viewport Bay framing the Canvas */}
        <div className={styles.tacticalViewportBay}>
          <div className="corner-mark tl">┌ TK-VEC ┐</div>
          <div className="corner-mark tr">┌ FOV 88° ┐</div>
          <div className="corner-mark bl">└ POS: TACTICAL ┘</div>
          <div className="corner-mark br">└ VEC-OS ┘</div>

          <div className={styles.viewportStatusTag}>
            1PX OSCILLOSCOPE TACTICAL SCANNER // REAL-TIME
          </div>

          <div className={styles.viewportControlsHint}>
            <span>[WASD / ARROWS] Move</span>
            <span>[SPACE] Wait Turn</span>
            <span>[1-3] Subroutine</span>
            <span>[I] Inventory</span>
            <span>[E] Terminal</span>
            <span>[?] Controls</span>
          </div>
        </div>

        {/* Right Column: Hostiles Radar & Combat Telemetry */}
        <div className={styles.hudColRight}>
          <NearbyEntities />
          <MessageLog />
          <EventTimelinePanel />
        </div>
      </div>

      {/* ====================================================================
          ROW 3: BOTTOM DOCK LEVERS BAR (68px)
          ==================================================================== */}
      <footer className={styles.hudBottomBar}>
        <AbilityBar />

        <div style={{ display: 'flex', gap: '8px' }}>
          <BtnLever variant="cyan" onClick={toggleHotkeysModal} rightSlot="[?]">
            CONTROLS GUIDE
          </BtnLever>
          <BtnLever variant="primary" onClick={toggleInventory} rightSlot="[I]">
            TACTICAL INVENTORY
          </BtnLever>
        </div>
      </footer>

      {/* Modal Overlays */}
      {inventoryVisible && <InventoryOverlay onClose={toggleInventory} />}
      {hotkeysModalVisible && <HotkeysModal onClose={toggleHotkeysModal} />}
    </div>
  );
};

export default HUDOverlay;
