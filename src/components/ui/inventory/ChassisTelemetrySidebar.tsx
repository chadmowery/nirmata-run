'use client';

import React, { useState } from 'react';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import {
  Shell,
  Defense,
  Health,
  AugmentSlots,
  AugmentData,
  EquipmentSlots,
  SoftwareSlots,
  SoftwareDef,
  Children,
  TemplateId,
  Item,
} from '@shared/components';
import type { ComponentDef } from '@engine/ecs/types';
import { DottedSpecRow } from '../atomic';
import { ItemTooltip } from '../hub/ItemTooltip';
import {
  ItemMetadata,
  SHELL_STAT_DEFINITIONS,
  getAbilityMetadata,
  getShellMetadata,
  getSoftwareModificationInfo,
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
  const norm = (rawName || '').toLowerCase().trim();
  const store = gameStore.getState();
  const fallbackId =
    store.launchConfig?.shellId ||
    store.shellTemplates[store.selectedShellIndex]?.id ||
    'vanguard-v1';

  // If rawName is missing, none, or generic "default shell", use fallback
  const resolvedId = (!norm || norm.includes('default') || norm === 'none') ? fallbackId : norm;

  for (const [key, meta] of Object.entries(ARCHETYPE_MAP)) {
    if (resolvedId.includes(key.replace('-v1', '')) || resolvedId.includes(key)) {
      return { id: key, name: key.toUpperCase(), ...meta };
    }
  }

  return {
    id: resolvedId,
    name: resolvedId.toUpperCase(),
    subtitle: 'Tactical Operative Unit',
    kanjiArchetype: '戦術型',
    classLabel: 'TACTICAL OPERATOR',
  };
}

import { getActiveGameContext } from '@/game/setup';

export const ChassisTelemetrySidebar: React.FC = () => {
  const player = useStore(gameStore, (s) => s.player);
  const abilities = useStore(gameStore, (s) => s.abilities);
  const stability = useStore(gameStore, (s) => s.stability);
  const scrap = useStore(gameStore, (s) => s.scrap);
  const flux = useStore(gameStore, (s) => s.flux);
  const blueprintCount = useStore(gameStore, (s) => s.blueprintCount);
  const nanites = useStore(gameStore, (s) => s.nanites);
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);
  const optimisticWeapon = useStore(gameStore, (s) => s.optimisticWeapon);
  const optimisticArmor = useStore(gameStore, (s) => s.optimisticArmor);
  const inventoryRevision = useStore(gameStore, (s) => s.inventoryRevision);
  void inventoryRevision;

  const [hoveredTooltip, setHoveredTooltip] = useState<{
    metadata: ItemMetadata;
    x: number;
    y: number;
  } | null>(null);

  // Read current stats and components from gameContext world if present
  const gameContext = (getActiveGameContext() as unknown as GameContext | null) || (typeof window !== 'undefined'
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
      valueColor: 'var(--c-accent, #d8ff00)',
    },
    {
      label: 'REALITY STABILITY',
      value: `${stability}%`,
      valueColor: 'var(--c-accent-secondary, #00f0ff)',
    },
    {
      label: 'CORE HEAT',
      value: `${heat} / ${maxHeat} H`,
      valueColor: heat > 50 ? 'var(--c-warning, #f59e0b)' : undefined,
    },
    {
      label: 'SCRAP SALVAGE',
      value: `${scrap.toLocaleString()} CR`,
      valueColor: 'var(--c-scrap, #f59e0b)',
    },
    {
      label: 'FLUX ENERGY',
      value: `${flux.toLocaleString()} FX`,
      valueColor: 'var(--c-accent-secondary, #00f0ff)',
    },
    {
      label: 'LOCKED FILES',
      value: `${blueprintCount} BP`,
      valueColor: 'var(--c-accent, #d8ff00)',
    },
    ...(nanites > 0
      ? [
          {
            label: 'NANITE CORES',
            value: `${nanites.toLocaleString()} NT`,
            valueColor: 'var(--c-nanites, #10b981)',
          },
        ]
      : []),
  ];

  // 1. Resolve Installed Augments
  interface AugmentDisplay {
    id: string;
    name: string;
    trigger: string;
    effect: string;
    description: string;
  }
  const installedAugments: AugmentDisplay[] = [];

  if (gameContext) {
    const agSlots = gameContext.world.getComponent(gameContext.playerId, AugmentSlots);
    if (agSlots?.equipped) {
      for (const agId of agSlots.equipped) {
        const agData = gameContext.world.getComponent(agId, AugmentData);
        const itemComp = gameContext.world.getComponent(agId, Item);
        const tmpl = gameContext.world.getComponent(agId, TemplateId);
        if (agData) {
          const triggerType = agData.trigger?.type ? agData.trigger.type.replace(/_/g, ' ') : 'PASSIVE';
          let effectDesc = itemComp?.description || '';
          if (agData.payloads && agData.payloads.length > 0) {
            effectDesc = agData.payloads
              .map((p) => {
                if (p.type === 'SHIELD') return `+${p.magnitude} Barrier (${p.statusEffectDuration || 2}T)`;
                if (p.type === 'VENT_HEAT') return `-${p.magnitude} Core Heat`;
                return `${p.type}: ${p.magnitude}`;
              })
              .join(', ');
          }
          installedAugments.push({
            id: tmpl?.id || agData.name,
            name: agData.name,
            trigger: triggerType,
            effect: effectDesc,
            description: itemComp?.description || effectDesc,
          });
        }
      }
    }
  }

  // Fallback to profile installedItems if ECS is still initializing
  if (installedAugments.length === 0 && !gameContext?.world && playerProfile) {
    const profileAugments = playerProfile.installedItems.filter(
      (i) => i.type === 'augment' && (i.shellId === archetype.id || !i.shellId),
    );
    for (const pa of profileAugments) {
      const info = getSoftwareModificationInfo(pa.blueprintId);
      installedAugments.push({
        id: pa.blueprintId,
        name: pa.blueprintId.toUpperCase(),
        trigger: 'PASSIVE SYNERGY',
        effect: info.effect || 'Enhances chassis neuro-pathways during operations.',
        description: info.description,
      });
    }
  }

  // 2. Resolve Active Software Socketed on Weapon and Armor
  const eqSlots = gameContext?.world.getComponent(gameContext.playerId, EquipmentSlots);
  const activeWeaponId = optimisticWeapon !== undefined ? optimisticWeapon : eqSlots?.weapon;
  const activeArmorId = optimisticArmor !== undefined ? optimisticArmor : eqSlots?.armor;

  interface SoftwareDisplay {
    slot: 'weapon' | 'armor' | 'chassis';
    softwareName: string;
    effect: string;
  }
  const installedSoftware: SoftwareDisplay[] = [];

  const resolveGearSoftware = (gearId: number | null | undefined, slot: 'weapon' | 'armor') => {
    if (!gameContext || !gearId) return null;
    const children = gameContext.world.getComponent(gearId, Children);
    if (children && children.entityIds && children.entityIds.length > 0) {
      for (const childId of children.entityIds) {
        const sw = gameContext.world.getComponent(childId, SoftwareDef);
        const tmpl = gameContext.world.getComponent(childId, TemplateId);
        const itemComp = gameContext.world.getComponent(childId, Item);
        if (sw || tmpl || itemComp) {
          const info = getSoftwareModificationInfo(tmpl?.id || sw?.type || '');
          return {
            slot,
            softwareName: sw?.name || itemComp?.name || info.name || tmpl?.id || 'Software Mod',
            effect: info.effect || sw?.description || '',
          };
        }
      }
    }
    const directSw = gameContext.world.getComponent(gearId, SoftwareDef);
    if (directSw) {
      const info = getSoftwareModificationInfo(directSw.type);
      return { slot, softwareName: directSw.name, effect: info.effect };
    }
    return null;
  };

  const weaponSw = resolveGearSoftware(activeWeaponId, 'weapon');
  const armorSw = resolveGearSoftware(activeArmorId, 'armor');
  if (weaponSw) installedSoftware.push(weaponSw);
  if (armorSw) installedSoftware.push(armorSw);

  // Read direct chassis SoftwareSlots
  if (gameContext) {
    const swSlots = gameContext.world.getComponent(gameContext.playerId, SoftwareSlots);
    if (swSlots?.equipped) {
      for (const swId of swSlots.equipped) {
        const swDef = gameContext.world.getComponent(swId, SoftwareDef);
        const tmpl = gameContext.world.getComponent(swId, TemplateId);
        if (swDef) {
          const info = getSoftwareModificationInfo(tmpl?.id || swDef.type);
          installedSoftware.push({ slot: 'chassis', softwareName: swDef.name, effect: info.effect });
        }
      }
    }
  }

  // Fallback to profile installed software if empty and ECS not initialized
  if (installedSoftware.length === 0 && !gameContext?.world && playerProfile) {
    const profileSoftware = playerProfile.installedItems.filter(
      (i) => i.type === 'software' && (i.shellId === archetype.id || !i.shellId),
    );
    for (const ps of profileSoftware) {
      const info = getSoftwareModificationInfo(ps.blueprintId);
      installedSoftware.push({
        slot: 'chassis',
        softwareName: ps.blueprintId.toUpperCase(),
        effect: info.effect || 'Loaded tactical software module.',
      });
    }
  }

  return (
    <aside
      className={styles.sidebarContainer}
      aria-label="Chassis Telemetry Sidebar"
      style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}
    >
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
          <span>ACTIVE FIRMWARE (FW)</span>
          <span className={styles.kanjiDim}>[戦術機能]</span>
        </div>

        <div className={styles.abilitiesList}>
          {abilities.map((ability, idx) => {
            const meta = getAbilityMetadata(ability);
            return (
              <div
                key={`${ability.name}-${idx}`}
                className={styles.abilityCard}
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: '3px' }}
                tabIndex={0}
                role="button"
                aria-label={`Firmware ${idx + 1}: ${ability.name}`}
                onPointerEnter={(e) =>
                  setHoveredTooltip({
                    metadata: meta,
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
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                <div style={{ fontSize: '8px', color: 'var(--c-text-dim)', lineHeight: 1.2 }}>
                  ⚡ {meta.description || 'Active tactical ability subroutine.'}
                </div>
              </div>
            );
          })}

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

      {/* 4. PASSIVE NEURO-AUGMENTS */}
      <div>
        <div className={styles.sectionHeader}>
          <span>NEURO-AUGMENTS (AG)</span>
          <span className={styles.kanjiDim}>[拡張機構]</span>
        </div>

        <div className={styles.abilitiesList}>
          {installedAugments.map((ag, idx) => (
            <div
              key={`${ag.id}-${idx}`}
              className={styles.abilityCard}
              style={{ flexDirection: 'column', alignItems: 'stretch', gap: '3px' }}
              tabIndex={0}
              role="button"
              aria-label={`Augment: ${ag.name}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className={styles.abilityLeft}>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--c-accent-secondary)' }}>
                    [AG]
                  </span>
                  <span className={styles.abilityName}>{ag.name}</span>
                </div>
                <span
                  style={{
                    fontSize: '8px',
                    fontWeight: 700,
                    color: 'var(--c-accent-secondary)',
                    background: 'rgba(0, 240, 255, 0.1)',
                    border: '1px solid rgba(0, 240, 255, 0.3)',
                    padding: '1px 4px',
                  }}
                >
                  {ag.trigger}
                </span>
              </div>
              <div style={{ fontSize: '8px', color: 'var(--c-accent-secondary)', lineHeight: 1.2 }}>
                ⚡ {ag.effect}
              </div>
            </div>
          ))}

          {installedAugments.length === 0 && (
            <div className={styles.abilityCardEmpty}>
              <div className={styles.abilityLeft}>
                <span style={{ fontSize: '9px', opacity: 0.6 }}>[AG]</span>
                <span style={{ fontSize: '9px' }}>NO AUGMENTS INSTALLED</span>
              </div>
              <span style={{ fontSize: '8px', opacity: 0.5 }}>OFFLINE</span>
            </div>
          )}
        </div>
      </div>

      {/* 5. LOADED SOFTWARE SUBROUTINES */}
      <div>
        <div className={styles.sectionHeader}>
          <span>LOADED SOFTWARE (SW)</span>
          <span className={styles.kanjiDim}>[論理機能]</span>
        </div>

        <div className={styles.abilitiesList}>
          {installedSoftware.map((sw, idx) => (
            <div
              key={`${sw.slot}-${idx}`}
              className={styles.abilityCard}
              style={{ flexDirection: 'column', alignItems: 'stretch', gap: '3px' }}
              tabIndex={0}
              role="button"
              aria-label={`Software on ${sw.slot}: ${sw.softwareName}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className={styles.abilityLeft}>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--c-accent)' }}>
                    [{sw.slot.toUpperCase()}]
                  </span>
                  <span className={styles.abilityName}>{sw.softwareName}</span>
                </div>
                <span
                  style={{
                    fontSize: '8px',
                    fontWeight: 700,
                    color: 'var(--c-accent)',
                    background: 'rgba(216, 255, 0, 0.1)',
                    border: '1px solid rgba(216, 255, 0, 0.3)',
                    padding: '1px 4px',
                  }}
                >
                  ACTIVE MOD
                </span>
              </div>
              <div style={{ fontSize: '8px', color: 'var(--c-accent-secondary)', lineHeight: 1.2 }}>
                ⚡ {sw.effect}
              </div>
            </div>
          ))}

          {installedSoftware.length === 0 && (
            <div className={styles.abilityCardEmpty}>
              <div className={styles.abilityLeft}>
                <span style={{ fontSize: '9px', opacity: 0.6 }}>[SW]</span>
                <span style={{ fontSize: '9px' }}>NO SOFTWARE LOADED ON GEAR</span>
              </div>
              <span style={{ fontSize: '8px', opacity: 0.5 }}>UNSOCKETED</span>
            </div>
          )}
        </div>
      </div>

      {/* 6. OPERATIONAL STATES & MODIFIERS */}
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
                    color: player.statuses?.length ? 'var(--c-warning, #f59e0b)' : 'var(--c-accent-secondary, #00f0ff)',
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
