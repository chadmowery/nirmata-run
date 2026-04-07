'use client';
import React from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import styles from './styles.module.css';
import { Cpu, Zap } from 'lucide-react';
import { dispatchUIAction } from '@/game/input/input-bridge';
import { GameAction } from '@/game/input/actions';

const HOTKEY_LABELS = ['[1]', '[2]', '[3]'];
const ABILITY_ACTIONS = [
  GameAction.USE_FIRMWARE_0,
  GameAction.USE_FIRMWARE_1,
  GameAction.USE_FIRMWARE_2
];

export const AbilityBar: React.FC = () => {
  const abilities = useStore(gameStore, (s) => s.abilities);
  const targetingActive = useStore(gameStore, (s) => s.targetingActive);
  const targetingSlotIndex = useStore(gameStore, (s) => s.targetingSlotIndex);

  return (
    <div className={styles.abilityBarContainer}>
      <div className={styles.abilityBarHeader}>
        <Cpu size={14} className="mr-1" /> ACTIVE_FIRMWARE
      </div>
      <div className={styles.abilitySlots}>
        {abilities.map((ability, index) => {
          const isActive = targetingActive && targetingSlotIndex === index;
          return (
            <button
              key={index}
              className={`${styles.abilitySlot} ${isActive ? styles.abilitySlotActive : ''} ${ability.name === 'Unknown' ? styles.abilitySlotEmpty : ''}`}
              onClick={() => dispatchUIAction(ABILITY_ACTIONS[index])}
              title={`${ability.name} (Range: ${ability.range}, Heat: ${ability.heatCost})`}
            >
              <div className={styles.abilityLabel}>
                <span className={styles.hotkeyPrefix}>{HOTKEY_LABELS[index]}</span>
                <span className={styles.abilityName}>{ability.name}</span>
              </div>
              <div className={styles.abilityStats}>
                 <span className={styles.abilityHeatCost}>
                   <Zap size={10} className="inline mr-1" />{ability.heatCost}
                 </span>
                 {ability.range > 0 && (
                   <span className={styles.abilityRange}>R:{ability.range}</span>
                 )}
              </div>
              {isActive && <div className={styles.targetingPulse} />}
            </button>
          );
        })}
        {/* Fill remaining slots if < 3 */}
        {Array.from({ length: 3 - abilities.length }).map((_, i) => (
          <div key={`empty-${i}`} className={`${styles.abilitySlot} ${styles.abilitySlotEmpty}`}>
             <div className={styles.abilityLabel}>
                <span className={styles.hotkeyPrefix}>{HOTKEY_LABELS[abilities.length + i]}</span>
                <span className={styles.abilityName}>[EMPTY]</span>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};
