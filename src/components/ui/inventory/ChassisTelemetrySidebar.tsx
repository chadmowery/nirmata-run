'use client';

import React, { useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { Shell, Defense, Health } from '@shared/components';
import type { ComponentDef } from '@engine/ecs/types';
import { DottedSpecRow } from '../atomic';
import { ItemTooltip } from '../hub/ItemTooltip';
import {
  ItemMetadata,
  SHELL_STAT_DEFINITIONS,
  getAbilityMetadata,
  getShellMetadata,
} from '../hub/item-metadata';
import styles from './ChassisTelemetrySidebar.module.css';

interface GameContext {
  playerId: number;
  world: {
    getComponent: <T>(entityId: number, component: ComponentDef<T>) => T | undefined;
    hasComponent: (entityId: number, component: ComponentDef<unknown>) => boolean;
  };
}

interface ArchetypeMeta {
  id: string;
  name: string;
  subtitle: string;
  kanjiArchetype: string;
  classLabel: string;
}

const ARCHETYPE_MAP: Record<string, { subtitle: string; kanjiArchetype: string; classLabel: string }> = {
  'vanguard-v1': {
    subtitle: 'Skirmisher Assault Unit',
    kanjiArchetype: '突撃型',
    classLabel: 'HIGH MOBILITY',
  },
  'bastion-v1': {
    subtitle: 'Heavy Armored Enforcer',
    kanjiArchetype: '重装型',
    classLabel: 'HEAVY DEFENSE',
  },
  'ghost-v1': {
    subtitle: 'Recon Infiltrator Unit',
    kanjiArchetype: '潜入型',
    classLabel: 'STEALTH RECON',
  },
};

function resolveArchetype(rawName?: string): ArchetypeMeta {
  const norm = (rawName || 'vanguard-v1').toLowerCase();
  for (const [key, meta] of Object.entries(ARCHETYPE_MAP)) {
    if (norm.includes(key.replace('-v1', '')) || norm.includes(key)) {
      return { id: key, name: key.toUpperCase(), ...meta };
    }
  }
  return {
    id: 'vanguard-v1',
    name: rawName ? rawName.toUpperCase() : 'VANGUARD-v1',
    subtitle: 'Skirmisher Assault Unit',
    kanjiArchetype: '突撃型',
    classLabel: 'TACTICAL OPERATOR',
  };
}

export const ChassisTelemetrySidebar: React.FC = () => {
  const player = useStore(gameStore, (s) => s.player);
  const abilities = useStore(gameStore, (s) => s.abilities);
  const stability = useStore(gameStore, (s) => s.stability);

  const [hoveredTooltip, setHoveredTooltip] = useState<{
    metadata: ItemMetadata;
    x: number;
    y: number;
  } | null>(null);

  // Read current stats from gameContext world if present, otherwise fallback to store
  const gameContext = (typeof window !== 'undefined'
    ? (window as unknown as { gameContext?: GameContext }).gameContext
    : undefined);

  const shellComp = gameContext?.world.getComponent(gameContext.playerId, Shell);
  const defenseComp = gameContext?.world.getComponent(gameContext.playerId, Defense);
  const healthComp = gameContext?.world.getComponent(gameContext.playerId, Health);

  const archetype = resolveArchetype(shellComp?.archetypeId || player.shellName);

  const speed = shellComp?.speed ?? (archetype.id === 'bastion-v1' ? 80 : archetype.id === 'ghost-v1' ? 100 : 120);
  const armor = (defenseComp?.armor ?? shellComp?.armor) ?? (archetype.id === 'bastion-v1' ? 3 : archetype.id === 'ghost-v1' ? 1 : 2);
  const hp = player.hp || (healthComp?.current ?? 20);
  const maxHp = player.maxHp || (healthComp?.max ?? 20);
  const heat = player.heat ?? 0;
  const maxHeat = player.maxHeat ?? 100;

  const statItems = [
    { label: 'BASE SPEED', value: `${speed} T/SEC` },
    { label: 'ARMOR RATING', value: `${armor} DMG RED` },
    {
      label: 'MAX HEALTH',
      value: `${hp} / ${maxHp} HP`,
      valueColor: 'var(--c-accent-secondary, #d8ff00)',
    },
    {
      label: 'REALITY STABILITY',
      value: `${stability}%`,
      valueColor: 'var(--c-accent, #00f0ff)',
    },
    {
      label: 'CORE HEAT',
      value: `${heat} / ${maxHeat} H`,
      valueColor: heat > 50 ? 'var(--c-warning, #f59e0b)' : undefined,
    },
  ];

  return (
    <aside className={styles.sidebarContainer} aria-label="Chassis Telemetry Sidebar">
      {/* 1. CHASSIS OVERVIEW & SCHEMATIC */}
      <div>
        <div className={styles.sectionHeader}>
          <span>CHASSIS TELEMETRY</span>
          <span className={styles.kanjiDim}>[素体情報]</span>
        </div>

        <div
          className={styles.shellCard}
          tabIndex={0}
          role="button"
          aria-label={`View telemetry for ${archetype.name}`}
          onPointerEnter={(e) =>
            setHoveredTooltip({
              metadata: getShellMetadata(archetype.id, { speed, armor, health: maxHp, stability }),
              x: e.clientX,
              y: e.clientY,
            })
          }
          onPointerMove={(e) =>
            setHoveredTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))
          }
          onPointerLeave={() => setHoveredTooltip(null)}
          onFocus={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setHoveredTooltip({
              metadata: getShellMetadata(archetype.id, { speed, armor, health: maxHp, stability }),
              x: rect.right + 12,
              y: rect.top,
            });
          }}
          onBlur={() => setHoveredTooltip(null)}
        >
          <div className={`${styles.cornerMark} ${styles.tl}`}>+</div>
          <div className={`${styles.cornerMark} ${styles.tr}`}>+</div>
          <div className={`${styles.cornerMark} ${styles.bl}`}>+</div>
          <div className={`${styles.cornerMark} ${styles.br}`}>+</div>

          <div className={styles.shellHeader}>
            <span className={styles.shellName}>{archetype.name}</span>
            <span className={styles.kanjiBadge}>{archetype.kanjiArchetype}</span>
          </div>
          <div className={styles.shellSubtitle}>{archetype.subtitle}</div>

          <div className={styles.schematicBox}>
            <span>● TK-VEC // {archetype.classLabel}</span>
            <span style={{ fontSize: '7px', opacity: 0.8 }}>[HOVER: SPECS]</span>
          </div>
        </div>
      </div>

      {/* 2. CHASSIS SUBSYSTEM METRICS */}
      <div>
        <div className={styles.sectionHeader}>
          <span>SUBSYSTEM METRICS</span>
          <span className={styles.kanjiDim}>[計測値]</span>
        </div>

        <div className={styles.statsList}>
          {statItems.map((stat) => (
            <div
              key={stat.label}
              className={styles.statRowWrapper}
              tabIndex={0}
              role="button"
              aria-label={`Inspect ${stat.label}`}
              onPointerEnter={(e) => {
                const def = SHELL_STAT_DEFINITIONS[stat.label];
                if (def) {
                  setHoveredTooltip({
                    metadata: {
                      id: stat.label,
                      name: def.name,
                      kanjiSub: def.kanjiSub,
                      type: 'firmware',
                      typeLabel: def.typeLabel,
                      rarityTier: 'uncommon',
                      rarityLabel: 'TELEMETRY // SPECIFICATION',
                      description: def.description,
                      statusBadge: 'VERIFIED',
                      statusVariant: 'cyan',
                      specs: def.specs,
                      footerText: 'CHASSIS CORE METRIC // TACTICAL TELEMETRY',
                    },
                    x: e.clientX,
                    y: e.clientY,
                  });
                }
              }}
              onPointerMove={(e) =>
                setHoveredTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))
              }
              onPointerLeave={() => setHoveredTooltip(null)}
              onFocus={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const def = SHELL_STAT_DEFINITIONS[stat.label];
                if (def) {
                  setHoveredTooltip({
                    metadata: {
                      id: stat.label,
                      name: def.name,
                      kanjiSub: def.kanjiSub,
                      type: 'firmware',
                      typeLabel: def.typeLabel,
                      rarityTier: 'uncommon',
                      rarityLabel: 'TELEMETRY // SPECIFICATION',
                      description: def.description,
                      statusBadge: 'VERIFIED',
                      statusVariant: 'cyan',
                      specs: def.specs,
                      footerText: 'CHASSIS CORE METRIC // TACTICAL TELEMETRY',
                    },
                    x: rect.right + 12,
                    y: rect.top,
                  });
                }
              }}
              onBlur={() => setHoveredTooltip(null)}
            >
              <DottedSpecRow label={stat.label} value={stat.value} valueColor={stat.valueColor} />
            </div>
          ))}
        </div>
      </div>

      {/* 3. ACTIVE FIRMWARE SUBROUTINES */}
      <div>
        <div className={styles.sectionHeader}>
          <span>ACTIVE FIRMWARE</span>
          <span className={styles.kanjiDim}>[戦術機能]</span>
        </div>

        <div className={styles.abilitiesList}>
          {abilities.map((ability, idx) => (
            <div
              key={`${ability.name}-${idx}`}
              className={styles.abilityCard}
              tabIndex={0}
              role="button"
              aria-label={`Firmware ${idx + 1}: ${ability.name}`}
              onPointerEnter={(e) =>
                setHoveredTooltip({
                  metadata: getAbilityMetadata(ability),
                  x: e.clientX,
                  y: e.clientY,
                })
              }
              onPointerMove={(e) =>
                setHoveredTooltip((prev) =>
                  prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
                )
              }
              onPointerLeave={() => setHoveredTooltip(null)}
              onFocus={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setHoveredTooltip({
                  metadata: getAbilityMetadata(ability),
                  x: rect.right + 12,
                  y: rect.top,
                });
              }}
              onBlur={() => setHoveredTooltip(null)}
            >
              <div className={styles.abilityLeft}>
                <span className={styles.hotkeyTag}>[{idx + 1}]</span>
                <span className={styles.abilityName}>{ability.name}</span>
              </div>
              <div className={styles.abilityMetaTags}>
                {ability.heatCost > 0 && (
                  <span className={styles.heatTag}>+{ability.heatCost}H</span>
                )}
                {ability.range > 0 && <span className={styles.rangeTag}>R:{ability.range}</span>}
              </div>
            </div>
          ))}

          {Array.from({ length: Math.max(0, 3 - abilities.length) }).map((_, i) => {
            const idx = abilities.length + i;
            return (
              <div key={`empty-${i}`} className={styles.abilityCardEmpty}>
                <div className={styles.abilityLeft}>
                  <span style={{ fontSize: '9px', opacity: 0.6 }}>[{idx + 1}]</span>
                  <span style={{ fontSize: '9px' }}>[PORT EMPTY]</span>
                </div>
                <span style={{ fontSize: '8px', opacity: 0.5 }}>OFFLINE</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. OPERATIONAL STATES & MODIFIERS */}
      <div>
        <div className={styles.sectionHeader}>
          <span>OPERATIONAL STATES</span>
          <span className={styles.kanjiDim}>[稼働状態]</span>
        </div>

        <div
          className={styles.statesContainer}
          tabIndex={0}
          role="button"
          aria-label="Inspect active chassis operational states"
          onPointerEnter={(e) => {
            const def = SHELL_STAT_DEFINITIONS['OPERATIONAL STATES'];
            setHoveredTooltip({
              metadata: {
                id: 'OPERATIONAL STATES',
                name: def.name,
                kanjiSub: def.kanjiSub,
                type: 'firmware',
                typeLabel: def.typeLabel,
                rarityTier: 'uncommon',
                rarityLabel: 'TELEMETRY // SPECIFICATION',
                description: def.description,
                statusBadge: player.statuses?.length ? 'ACTIVE MODS' : 'NOMINAL',
                statusVariant: player.statuses?.length ? 'amber' : 'cyan',
                specs: [
                  ...def.specs,
                  {
                    label: 'ACTIVE STATUSES',
                    value: player.statuses?.length ? player.statuses.join(', ') : 'NONE // OPTIMAL',
                    color: player.statuses?.length ? 'var(--c-warning, #f59e0b)' : 'var(--c-accent, #00f0ff)',
                  },
                ],
                footerText: 'CHASSIS NEURAL TELEMETRY LINK',
              },
              x: e.clientX,
              y: e.clientY,
            });
          }}
          onPointerMove={(e) =>
            setHoveredTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))
          }
          onPointerLeave={() => setHoveredTooltip(null)}
          onFocus={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const def = SHELL_STAT_DEFINITIONS['OPERATIONAL STATES'];
            setHoveredTooltip({
              metadata: {
                id: 'OPERATIONAL STATES',
                name: def.name,
                kanjiSub: def.kanjiSub,
                type: 'firmware',
                typeLabel: def.typeLabel,
                rarityTier: 'uncommon',
                rarityLabel: 'TELEMETRY // SPECIFICATION',
                description: def.description,
                statusBadge: player.statuses?.length ? 'ACTIVE MODS' : 'NOMINAL',
                statusVariant: player.statuses?.length ? 'amber' : 'cyan',
                specs: def.specs,
                footerText: 'CHASSIS NEURAL TELEMETRY LINK',
              },
              x: rect.right + 12,
              y: rect.top,
            });
          }}
          onBlur={() => setHoveredTooltip(null)}
        >
          {player.statuses && player.statuses.length > 0 ? (
            player.statuses.map((status, idx) => (
              <span key={idx} className={styles.activeStatusTag}>
                {status}
              </span>
            ))
          ) : (
            <div className={styles.nominalState}>
              <span>●</span>
              <span>NOMINAL // ALL SYSTEMS OPTIMAL</span>
            </div>
          )}
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredTooltip && (
        <ItemTooltip
          metadata={hoveredTooltip.metadata}
          position={{ x: hoveredTooltip.x, y: hoveredTooltip.y }}
          visible={true}
          onDismiss={() => setHoveredTooltip(null)}
        />
      )}
    </aside>
  );
};
