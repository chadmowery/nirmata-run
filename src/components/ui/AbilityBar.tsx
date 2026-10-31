'use client';

import React, { useState } from 'react';
import { useStore } from 'zustand';
import { gameStore, AbilityData } from '@/game/ui/store';
import { dispatchUIAction } from '@/game/input/input-bridge';
import { GameAction } from '@/game/input/actions';
import { ItemTooltip } from './hub/ItemTooltip';
import { ItemMetadata, ItemSpec, resolveItemMetadata } from './hub/item-metadata';
import styles from './styles.module.css';

const HOTKEY_LABELS = ['[1]', '[2]', '[3]', '[4]'];
const ABILITY_ACTIONS = [
  GameAction.USE_FIRMWARE_0,
  GameAction.USE_FIRMWARE_1,
  GameAction.USE_FIRMWARE_2,
];

function getAbilityMetadata(ability: AbilityData): ItemMetadata {
  const tmplKey = (
    ability.templateId ||
    ability.name.toLowerCase().replace(/\.exe$/i, '').replace(/_/g, '-')
  ).toLowerCase();

  // Try resolving from KNOWN_TEMPLATES first
  const existingMeta = resolveItemMetadata({ templateId: tmplKey, type: 'firmware' });
  if (
    existingMeta &&
    existingMeta.description &&
    !existingMeta.description.startsWith('Hardware item retrieved')
  ) {
    return existingMeta;
  }

  // Construct detailed fallback description and specs from AbilityDef data
  let desc = `Active tactical firmware subroutine [${ability.name}]. `;
  const specs: ItemSpec[] = [
    { label: 'THERMAL INJECTION', value: `+${ability.heatCost} HEAT`, color: 'var(--c-warning)' },
    {
      label: 'ENGAGEMENT RANGE',
      value: ability.range > 0 ? `${ability.range} TILES` : 'SELF / MELEE',
      color: 'var(--c-accent)',
    },
  ];

  if (ability.effectType === 'dash' || ability.effectType === 'dash_attack') {
    desc += `Executes a high-velocity dash (${ability.dashDistance || ability.range || 3} tiles) directly to the target location.`;
    specs.push({
      label: 'DASH DISTANCE',
      value: `${ability.dashDistance || ability.range || 3} TILES`,
    });
  } else if (ability.effectType === 'ranged_attack') {
    desc += `Fires a targeted neural spike delivering ${ability.damageAmount || 10} damage at up to ${ability.range} tiles range.`;
    specs.push({
      label: 'BASE DISRUPTION',
      value: `${ability.damageAmount || 10} DAMAGE`,
      color: 'var(--c-danger)',
    });
  } else if (ability.effectType === 'melee_attack') {
    desc += `Delivers a heavy close-quarters hydraulic strike delivering ${ability.damageAmount || 8} impact damage.`;
    specs.push({
      label: 'BASE DISRUPTION',
      value: `${ability.damageAmount || 8} DAMAGE`,
      color: 'var(--c-danger)',
    });
  } else if (ability.effectType === 'toggle_vision' || ability.effectType === 'vision_pulse') {
    desc += `Overclocks optical sensors to reveal hidden threats and map terrain (${ability.visionRadius || 8} tiles radius).`;
    specs.push({ label: 'SENSOR RADIUS', value: `${ability.visionRadius || 8} TILES` });
  } else if (ability.effectType === 'stun') {
    desc += `Overloads enemy logic bus with recursive memory cycles, stunning target entity.`;
    specs.push({ label: 'STATUS EFFECT', value: 'STUN // 1 TURN', color: 'var(--c-danger)' });
  } else {
    desc += `Executes tactical subroutine protocol (${ability.effectType}).`;
  }

  return {
    id: tmplKey,
    name: ability.name,
    kanjiSub: '基本機能 // ACTIVE FIRMWARE',
    type: 'firmware',
    typeLabel: 'TACTICAL FIRMWARE // ACTIVE PROGRAM',
    rarityTier: 'common',
    rarityLabel: 'COMMON // STANDARD',
    description: desc,
    statusBadge: 'ONLINE',
    statusVariant: 'cyan',
    specs,
    footerText: 'PRESS [HOTKEY] OR CLICK LEVER TO EXECUTE PROTOCOL',
  };
}

export const AbilityBar: React.FC = () => {
  const abilities = useStore(gameStore, (s) => s.abilities);
  const targetingActive = useStore(gameStore, (s) => s.targetingActive);
  const targetingSlotIndex = useStore(gameStore, (s) => s.targetingSlotIndex);
  const [hoveredAbility, setHoveredAbility] = useState<{
    metadata: ItemMetadata;
    x: number;
    y: number;
  } | null>(null);

  return (
    <div className={styles.abilitySlotsGroup}>
      {abilities.map((ability, index) => {
        const isActive = targetingActive && targetingSlotIndex === index;
        const isEmpty = ability.name === 'Unknown' || !ability.name;

        return (
          <button
            key={index}
            type="button"
            className={`${styles.abilityLever} ${isActive ? styles.abilityLeverActive : ''} ${isEmpty ? styles.abilityLeverEmpty : ''}`}
            onClick={() => {
              if (index < ABILITY_ACTIONS.length && !isEmpty) {
                dispatchUIAction(ABILITY_ACTIONS[index]);
              }
            }}
            onPointerEnter={(e) => {
              if (!isEmpty) {
                setHoveredAbility({
                  metadata: getAbilityMetadata(ability),
                  x: e.clientX,
                  y: e.clientY,
                });
              }
            }}
            onPointerMove={(e) => {
              if (hoveredAbility && !isEmpty) {
                setHoveredAbility({
                  metadata: hoveredAbility.metadata,
                  x: e.clientX,
                  y: e.clientY,
                });
              }
            }}
            onPointerLeave={() => setHoveredAbility(null)}
            title={`${ability.name} (Range: ${ability.range}, Heat: ${ability.heatCost})`}
            disabled={isEmpty}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--c-accent)', fontWeight: 900 }}>
                {HOTKEY_LABELS[index] || `[${index + 1}]`}
              </span>
              <span>{ability.name || '[EMPTY]'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {ability.heatCost > 0 && (
                <span className={styles.abilityHeatTag}>+{ability.heatCost}H</span>
              )}
              {ability.range > 0 && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    color: 'var(--c-accent-secondary)',
                  }}
                >
                  R:{ability.range}
                </span>
              )}
            </div>
          </button>
        );
      })}

      {Array.from({ length: Math.max(0, 3 - abilities.length) }).map((_, i) => {
        const idx = abilities.length + i;
        return (
          <div key={`empty-${i}`} className={`${styles.abilityLever} ${styles.abilityLeverEmpty}`}>
            <span style={{ color: 'var(--c-text-muted)' }}>
              {HOTKEY_LABELS[idx] || `[${idx + 1}]`}
            </span>
            <span style={{ color: 'var(--c-text-muted)' }}>[PORT EMPTY]</span>
            <span />
          </div>
        );
      })}

      {hoveredAbility && (
        <ItemTooltip
          metadata={hoveredAbility.metadata}
          position={{ x: hoveredAbility.x, y: hoveredAbility.y }}
          visible={true}
          onDismiss={() => setHoveredAbility(null)}
        />
      )}
    </div>
  );
};

export default AbilityBar;
