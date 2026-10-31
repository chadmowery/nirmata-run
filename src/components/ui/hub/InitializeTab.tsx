'use client';

import React, { useEffect, useState } from 'react';
import { logger } from '@engine/utils/logger';
import { useStore } from 'zustand';
import { gameStore } from '@/game/ui/store';
import { RunMode } from '@/shared/run-mode';
import { RunModeCard } from './RunModeCard';
import { LeaderboardPanel } from './LeaderboardPanel';
import { PanelCard, BtnLever, DottedSpecRow, ItemIcon } from '../atomic';
import { ItemTooltip } from './ItemTooltip';
import { ItemMetadata, resolveItemMetadata } from './item-metadata';
import styles from './InitializeTab.module.css';

export const InitializeTab: React.FC = () => {
  const modeAvailability = useStore(gameStore, (s) => s.modeAvailability);
  const setModeAvailability = useStore(gameStore, (s) => s.setModeAvailability);
  const selectedRunMode = useStore(gameStore, (s) => s.selectedRunMode);
  const setSelectedRunMode = useStore(gameStore, (s) => s.setSelectedRunMode);
  const setRitualActive = useStore(gameStore, (s) => s.setRitualActive);
  const hasOverflow = useStore(gameStore, (s) => s.hasOverflow);
  const playerProfile = useStore(gameStore, (s) => s.playerProfile);
  const shellTemplates = useStore(gameStore, (s) => s.shellTemplates);
  const selectedShellIndex = useStore(gameStore, (s) => s.selectedShellIndex);

  useEffect(() => {
    const fetchAvailability = async () => {
      if (!playerProfile?.sessionId) return;
      try {
        const response = await fetch(
          `/api/run-mode/available?sessionId=${playerProfile.sessionId}`,
        );
        if (response.ok) {
          const data = await response.json();
          setModeAvailability(data.modes);
          if (!selectedRunMode && data.modes?.length > 0) {
            setSelectedRunMode(data.modes[0].mode);
          }
        }
      } catch (error) {
        logger.error('Failed to fetch mode availability:', 'UI', error);
      }
    };

    fetchAvailability();
  }, [playerProfile?.sessionId, selectedRunMode, setModeAvailability, setSelectedRunMode]);

  const handleLaunch = () => {
    if (selectedRunMode) {
      setRitualActive(true);
    }
  };

  const selectedModeData = modeAvailability?.find((m) => m.mode === selectedRunMode);
  const activeShell = shellTemplates[selectedShellIndex] || { name: 'VANGUARD-v1', id: 'vanguard-v1' };

  const [hoveredItem, setHoveredItem] = useState<{
    meta: ItemMetadata;
    x: number;
    y: number;
  } | null>(null);

  // Resolve active loadout manifest
  const installedOnCurrent =
    playerProfile?.installedItems.filter((i) => i.shellId === activeShell.id) || [];
  const installedFirmware = installedOnCurrent.filter((i) => i.type === 'firmware');
  const installedAugments = installedOnCurrent.filter((i) => i.type === 'augment');
  const installedSoftware = installedOnCurrent.filter((i) => i.type === 'software');
  const installedWeapons = installedOnCurrent.filter((i) => i.type === 'weapon');
  const installedArmor = installedOnCurrent.filter((i) => i.type === 'armor');
  const installedBackpack = installedOnCurrent.filter((i) => i.type === 'backpack');

  interface LoadoutEntry {
    id: string;
    templateId: string;
    type: 'firmware' | 'augment' | 'software' | 'weapon' | 'armor' | 'backpack';
    rarity: string;
    isDefault: boolean;
    slotLabel: string;
    socketedSoftware?: string[];
  }

  const effectiveFirmware: LoadoutEntry[] =
    installedFirmware.length > 0
      ? installedFirmware.map((i, idx) => ({
          id: `fw-${i.entityId}`,
          templateId: i.blueprintId,
          type: 'firmware',
          rarity: 'common',
          isDefault: false,
          slotLabel: `FIRMWARE [${idx + 1}]`,
          socketedSoftware: i.socketedSoftware,
        }))
      : (activeShell.starterLoadout || []).map((tId, idx) => ({
          id: `fw-default-${tId}`,
          templateId: tId,
          type: 'firmware',
          rarity: 'common',
          isDefault: true,
          slotLabel: `DEFAULT FW [${idx + 1}]`,
        }));

  const effectiveAugments: LoadoutEntry[] = installedAugments.map((i, idx) => ({
    id: `aug-${i.entityId}`,
    templateId: i.blueprintId,
    type: 'augment',
    rarity: 'uncommon',
    isDefault: false,
    slotLabel: `AUGMENT [${idx + 1}]`,
    socketedSoftware: i.socketedSoftware,
  }));

  const effectiveSoftware: LoadoutEntry[] = installedSoftware.map((i, idx) => ({
    id: `sw-${i.entityId}`,
    templateId: i.blueprintId,
    type: 'software',
    rarity: 'common',
    isDefault: false,
    slotLabel: `SOFTWARE [${idx + 1}]`,
    socketedSoftware: i.socketedSoftware,
  }));

  const effectiveWeapons: LoadoutEntry[] = installedWeapons.map((i) => ({
    id: `wp-${i.entityId}`,
    templateId: i.blueprintId,
    type: 'weapon',
    rarity: 'common',
    isDefault: false,
    slotLabel: 'PRIMARY WEAPON',
    socketedSoftware: i.socketedSoftware,
  }));

  const effectiveArmor: LoadoutEntry[] = installedArmor.map((i) => ({
    id: `ar-${i.entityId}`,
    templateId: i.blueprintId,
    type: 'armor',
    rarity: 'common',
    isDefault: false,
    slotLabel: 'TACTICAL ARMOR',
    socketedSoftware: i.socketedSoftware,
  }));

  const effectiveBackpack: LoadoutEntry[] = installedBackpack.map((i, idx) => ({
    id: `bp-${i.entityId}`,
    templateId: i.blueprintId,
    type: 'backpack',
    rarity: 'common',
    isDefault: false,
    slotLabel: `BACKPACK [${idx + 1}]`,
    socketedSoftware: i.socketedSoftware,
  }));

  const deploymentLoadout: LoadoutEntry[] = [
    ...effectiveFirmware,
    ...effectiveAugments,
    ...effectiveSoftware,
    ...effectiveWeapons,
    ...effectiveArmor,
    ...effectiveBackpack,
  ];

  const hasAtRiskItems = deploymentLoadout.some((i) => !i.isDefault);

  return (
    <div className={styles.initRoot}>
      {/* Top 3-Card Run Mode Grid */}
      <div className={styles.runModeGrid}>
        {modeAvailability?.map((mode) => (
          <RunModeCard
            key={mode.mode}
            availability={mode}
            selected={selectedRunMode === mode.mode}
            disabled={hasOverflow}
            onSelect={() => setSelectedRunMode(mode.mode)}
          />
        ))}

        {hasOverflow && (
          <div className={styles.overflowOverlay}>
            <div className={styles.overflowMessage}>
              ⚠️ 警告: VAULT OVERFLOW DETECTED // RESOLVE CARGO BAYS BEFORE DEPLOYMENT
            </div>
          </div>
        )}
      </div>

      {/* Selected Protocol Commitment Bar */}
      {selectedRunMode && selectedModeData && (
        <PanelCard
          title="DEPLOYMENT PROTOCOL COMMITMENT"
          badge={selectedRunMode.toUpperCase()}
        >
          <div className={styles.commitmentBar}>
            <div className={styles.commitmentInfo}>
              <div style={{ fontSize: '13px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase' }}>
                {selectedModeData.name} // AUTHORIZATION READY
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-dim)', maxWidth: '600px' }}>
                {selectedModeData.description}
              </div>

              <div style={{ display: 'flex', gap: '24px', marginTop: '8px', flexWrap: 'wrap' }}>
                <DottedSpecRow label="ACTIVE CHASSIS" value={activeShell.name} style={{ width: '220px' }} />
                <DottedSpecRow
                  label="CHASSIS FIRMWARE"
                  value={activeShell.starterLoadout?.join(', ') || 'DEFAULT SUBSYSTEM'}
                  style={{ width: '280px' }}
                />
                <DottedSpecRow label="REWARD MULTIPLIER" value={selectedRunMode === RunMode.WEEKLY ? '4.0x' : '1.0x'} style={{ width: '200px' }} />
              </div>
            </div>

            <BtnLever
              variant={selectedRunMode === RunMode.WEEKLY ? 'danger' : 'primary'}
              disabled={hasOverflow || !selectedModeData.available}
              onClick={handleLaunch}
              rightSlot="[発進確認] →"
            >
              COMMIT TO DEPLOYMENT RITUAL
            </BtnLever>
          </div>

          {/* Active Deployment Loadout Manifest Preview */}
          <div className={styles.loadoutSection}>
            <div className={styles.loadoutHeader}>
              <div className={styles.loadoutTitle}>
                <span>DEPLOYED HARDWARE MANIFEST</span>
                <span style={{ fontSize: '10px', color: 'var(--c-text-dim)' }}>
                  [{deploymentLoadout.length} SUBSYSTEMS MOUNTED]
                </span>
              </div>
              {hasAtRiskItems ? (
                <div className={styles.riskNotice}>
                  ⚠️ RISK NOTICE: UNSECURED HARDWARE FORFEITED ON TERMINATION
                </div>
              ) : (
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'var(--c-accent-secondary)',
                  }}
                >
                  SECURED BASELINE LOADOUT // SAFE RETRIEVAL
                </div>
              )}
            </div>

            {deploymentLoadout.length === 0 ? (
              <div className={styles.emptyLoadoutNote}>
                NO ADDITIONAL SUBSYSTEMS MOUNTED // CHASSIS BASELINE RUN
              </div>
            ) : (
              <div className={styles.loadoutGrid}>
                {deploymentLoadout.map((item) => {
                  const meta = resolveItemMetadata({
                    templateId: item.templateId,
                    type: item.type,
                    rarity: item.rarity,
                    socketedSoftware: item.socketedSoftware,
                    status: item.isDefault
                      ? 'CHASSIS DEFAULT // SAFE'
                      : 'CUSTOM LOADOUT // AT RISK ON LOSS',
                    statusVariant: item.isDefault ? 'cyan' : 'danger',
                  });

                  return (
                    <div
                      key={item.id}
                      className={`${styles.loadoutCard} ${
                        item.isDefault ? styles.loadoutCardDefault : styles.loadoutCardAtRisk
                      }`}
                      tabIndex={0}
                      onPointerEnter={(e) =>
                        setHoveredItem({ meta, x: e.clientX, y: e.clientY })
                      }
                      onPointerMove={(e) => {
                        if (hoveredItem?.meta.id === meta.id) {
                          setHoveredItem({ meta, x: e.clientX, y: e.clientY });
                        }
                      }}
                      onPointerLeave={() => setHoveredItem(null)}
                      onFocus={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredItem({ meta, x: rect.right + 10, y: rect.top });
                      }}
                      onBlur={() => setHoveredItem(null)}
                    >
                      <ItemIcon
                        templateId={item.templateId}
                        itemType={item.type}
                        rarityTier={meta.rarityTier}
                        size="sm"
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '8px',
                            fontFamily: 'var(--font-mono)',
                            color: item.isDefault
                              ? 'var(--c-accent-secondary)'
                              : 'var(--c-danger)',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                          }}
                        >
                          {item.slotLabel} {item.isDefault ? '• SAFE' : '• AT RISK'}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            color: '#ffffff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {meta.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PanelCard>
      )}

      {/* Embedded Mode Leaderboard if Daily or Weekly */}
      {selectedRunMode && selectedRunMode !== RunMode.SIMULATION && (
        <LeaderboardPanel mode={selectedRunMode} sessionId={playerProfile?.sessionId || ''} />
      )}

      {/* Interactive Item Tooltip on Hover */}
      {hoveredItem && (
        <ItemTooltip
          metadata={hoveredItem.meta}
          position={{ x: hoveredItem.x, y: hoveredItem.y }}
          visible={true}
        />
      )}
    </div>
  );
};
