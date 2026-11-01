'use client';

import React, { useEffect, useCallback } from 'react';
import { TaikokuPlacard } from './atomic';
import styles from './HotkeysModal.module.css';

interface HotkeysModalProps {
  onClose: () => void;
}

interface HotkeyItem {
  keys: string[];
  description: string;
}

interface HotkeyCategory {
  title: string;
  badge: string;
  items: HotkeyItem[];
}

const HOTKEY_CATEGORIES: HotkeyCategory[] = [
  {
    title: 'Locomotion & Melee Combat',
    badge: 'PHY-01',
    items: [
      { keys: ['W', 'A', 'S', 'D'], description: 'Step chassis 1 tile (N / W / S / E)' },
      { keys: ['↑', '←', '↓', '→'], description: 'Alternative cardinal locomotion' },
      { keys: ['BUMP ENEMY'], description: 'Execute melee strike into hostile' },
      { keys: ['SPACE', 'NUM 5'], description: 'Hold position / wait 1 turn cycle' },
    ],
  },
  {
    title: 'Firmware Subroutines & Aim',
    badge: 'FIRM-02',
    items: [
      { keys: ['1', '2', '3'], description: 'Activate equipped Firmware Subroutine slot' },
      { keys: ['WASD', 'ARROWS'], description: 'Steer targeting reticle when aiming' },
      { keys: ['ENTER', 'SPACE'], description: 'Confirm firing solution at reticle' },
      { keys: ['ESC'], description: 'Abort targeting / disengage reticle' },
    ],
  },
  {
    title: 'Chassis Vitals & Software',
    badge: 'CHAS-03',
    items: [
      { keys: ['V'], description: 'Vent accumulated Thermal Heat' },
      { keys: ['I'], description: 'Toggle Tactical Backpack & Software Sockets' },
      { keys: ['ESC'], description: 'Abort Mission / Pause Simulation Menu' },
    ],
  },
  {
    title: 'Environment & Exploration',
    badge: 'ENV-04',
    items: [
      { keys: ['E'], description: 'Engage Stability Anchor / Access Terminal' },
      { keys: ['BUMP'], description: 'Pry open crates, lockers & forensic nodes' },
      { keys: ['>', 'SHIFT + .'], description: 'Descend through Staircase to lower floor' },
    ],
  },
  {
    title: 'Tactical Sensor Camera',
    badge: 'CAM-05',
    items: [
      { keys: ['R-CLICK DRAG'], description: 'Free-pan sensor camera across sector' },
      { keys: ['M-CLICK DRAG'], description: 'Alternative free-pan sensor camera' },
      { keys: ['WHEEL SCROLL'], description: 'Tactical optical zoom in / out' },
      { keys: ['C'], description: 'Lock camera center back to player chassis' },
    ],
  },
  {
    title: 'Field Terminal & Manuals',
    badge: 'CMD-06',
    items: [
      { keys: ['`'], description: 'Toggle Cyber-Command Console (Backtick)' },
      { keys: ['/show-map'], description: 'Terminal command: reveal full sector map' },
      { keys: ['?', 'H'], description: 'Toggle this Operator Directives Manual' },
    ],
  },
];

export const HotkeysModal: React.FC<HotkeysModalProps> = ({ onClose }) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Operator Directives Manual"
      onClick={onClose}
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <TaikokuPlacard
          kanji="操作指令マニュアル"
          title="OPERATOR INPUT DIRECTIVES // FIELD PROTOCOLS"
          stampText="TACTICAL REF // SPEC-2026"
          stampVariant="cyan"
          onClose={onClose}
          closeLabel="✕ CLOSE [ESC / H]"
          style={{ marginBottom: 0, border: 'none', borderBottom: '3px solid #000000' }}
        />

        <div className={styles.grid}>
          {HOTKEY_CATEGORIES.map((category) => (
            <div key={category.badge} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>{category.title}</span>
                <span className={styles.cardBadge}>{category.badge}</span>
              </div>
              <div className={styles.rowList}>
                {category.items.map((item, idx) => (
                  <div key={idx} className={styles.row}>
                    <div className={styles.keyWrap}>
                      {item.keys.map((k, kIdx) => (
                        <React.Fragment key={kIdx}>
                          <kbd className={styles.keyBadge}>{k}</kbd>
                          {kIdx < item.keys.length - 1 && (
                            <span className={styles.keySeparator}>/</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <span className={styles.description}>{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerHint}>
            <span>OPERATOR HINT:</span>
            <span>PRESS [ESC] OR [H] AT ANY TIME TO RESUME REAL-TIME SIMULATION</span>
          </div>
          <div className={styles.footerHint}>
            <span>NIRMATA OS // REV 2.6.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotkeysModal;
