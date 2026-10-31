import React, { useState, useEffect } from 'react';
import { EquipmentDef, SoftwareDef, Item, Children, TemplateId, RarityTier } from '@shared/components';
import type { ComponentDef } from '@engine/ecs/types';
import { getSoftwareModificationInfo } from '../hub/item-metadata';

interface GameContext {
  world: {
    getComponent: <T>(entityId: number, component: ComponentDef<T>) => T | undefined;
    hasComponent: (entityId: number, component: ComponentDef<unknown>) => boolean;
  };
}

interface InRunItemTooltipProps {
  entityId: number;
  position?: { x: number; y: number };
}

export const InRunItemTooltip: React.FC<InRunItemTooltipProps> = ({ entityId, position }) => {
  const [showDeepStats, setShowDeepStats] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setShowDeepStats(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setShowDeepStats(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Access world from window.gameContext (mocked/available at runtime)
  const world = (window as unknown as { gameContext?: GameContext }).gameContext?.world;
  if (!world) return null;

  const equipment = world.getComponent(entityId, EquipmentDef);
  const software = world.getComponent(entityId, SoftwareDef);
  const itemComponent = world.getComponent(entityId, Item);
  const template = world.getComponent(entityId, TemplateId);
  const rarity = world.getComponent(entityId, RarityTier);

  if (!equipment && !software && !itemComponent) return null;

  const itemName = equipment?.name || software?.name || itemComponent?.name || 'Unknown Item';
  const tier = rarity?.tier || 'common';

  // Check for socketed software on equipment via Children or direct SoftwareDef
  const socketedSoftwareList: Array<{ name: string; effect: string; targetSlot: string }> = [];
  if (equipment) {
    const children = world.getComponent(entityId, Children);
    if (children) {
      for (const childId of children.entityIds) {
        const cSw = world.getComponent(childId, SoftwareDef);
        const cTmpl = world.getComponent(childId, TemplateId);
        if (cSw) {
          const info = getSoftwareModificationInfo(cTmpl?.id || cSw.type);
          socketedSoftwareList.push({
            name: cSw.name,
            effect: info.effect,
            targetSlot: cSw.targetSlot,
          });
        }
      }
    }
    if (socketedSoftwareList.length === 0) {
      const directSw = world.getComponent(entityId, SoftwareDef);
      if (directSw) {
        const info = getSoftwareModificationInfo(directSw.type);
        socketedSoftwareList.push({
          name: directSw.name,
          effect: info.effect,
          targetSlot: directSw.targetSlot,
        });
      }
    }
  }

  // If this item is pure software itself, get its canonical effect
  const softwareSelfInfo = software
    ? getSoftwareModificationInfo(template?.id || software.type)
    : null;

  const stylePosition: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${Math.min(position.x + 16, typeof window !== 'undefined' ? window.innerWidth - 300 : 800)}px`,
        top: `${Math.min(position.y + 16, typeof window !== 'undefined' ? window.innerHeight - 240 : 600)}px`,
      }
    : {
        position: 'fixed',
        right: '16px',
        bottom: '16px',
      };

  return (
    <div
      className="inventory-tooltip"
      style={{
        ...stylePosition,
        zIndex: 99999,
        background: 'rgba(7, 10, 16, 0.98)',
        border: '1px solid #00f0ff',
        boxShadow: '0 0 20px rgba(0, 0, 0, 0.9), 0 0 10px rgba(0, 240, 255, 0.25)',
        padding: '10px 14px',
        minWidth: '240px',
        maxWidth: '300px',
        pointerEvents: 'none',
        fontFamily: 'var(--font-mono, monospace)',
        color: '#ffffff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(0, 240, 255, 0.3)', paddingBottom: '6px', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '8px', color: '#00ff9d', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {equipment ? `TACTICAL ${equipment.slotType.toUpperCase()}` : software ? 'KERNEL SUBROUTINE' : 'INVENTORY ASSET'}
          </div>
          <div style={{ fontWeight: 800, fontSize: '13px', textTransform: 'uppercase', color: '#ffffff', marginTop: '2px' }}>
            {itemName}
          </div>
        </div>
        <div style={{ fontSize: '8px', padding: '2px 6px', background: 'rgba(0, 240, 255, 0.1)', border: '1px solid #00f0ff', color: '#00f0ff', fontWeight: 'bold' }}>
          {tier.toUpperCase()}
        </div>
      </div>

      {/* Loaded Software on Equipment */}
      {socketedSoftwareList.length > 0 && (
        <div style={{ background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.25)', borderLeft: '3px solid #00ff9d', padding: '6px 8px', marginBottom: '8px' }}>
          <div style={{ fontSize: '8px', color: '#00ff9d', fontWeight: 800, letterSpacing: '0.06em', marginBottom: '4px' }}>
            LOADED SOFTWARE SUBROUTINE // MODIFIERS:
          </div>
          {socketedSoftwareList.map((sw, idx) => (
            <div key={idx} style={{ marginTop: idx > 0 ? '4px' : 0 }}>
              <div style={{ fontSize: '10px', color: '#ffffff', fontWeight: 700 }}>
                ⚡ {sw.name.toUpperCase()}
              </div>
              <div style={{ fontSize: '9px', color: '#00ff9d', marginTop: '2px', lineHeight: 1.3 }}>
                MOD EFFECT: {sw.effect}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pure Software Subroutine details */}
      {softwareSelfInfo && software && (
        <div style={{ background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.25)', borderLeft: '3px solid #00f0ff', padding: '6px 8px', marginBottom: '8px' }}>
          <div style={{ fontSize: '8px', color: '#00f0ff', fontWeight: 800, letterSpacing: '0.06em', marginBottom: '2px' }}>
            SOCKET TARGET: {software.targetSlot.toUpperCase()} BAY
          </div>
          <div style={{ fontSize: '9px', color: '#00ff9d', marginTop: '3px', lineHeight: 1.3 }}>
            SUBROUTINE EFFECT: {softwareSelfInfo.effect}
          </div>
          {software.description && (
            <div style={{ fontSize: '8px', color: '#8899aa', marginTop: '4px', lineHeight: 1.3 }}>
              {software.description}
            </div>
          )}
        </div>
      )}

      {showDeepStats && (
        <div style={{ fontSize: '9px', color: '#8899aa', borderTop: '1px dashed rgba(255, 255, 255, 0.1)', paddingTop: '6px', marginBottom: '6px' }}>
          <div>ENTITY ID: #{entityId}</div>
          {template && <div>TEMPLATE: {template.id}</div>}
          {software && <div>BASE MAGNITUDE: {software.baseMagnitude}</div>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '9px', color: '#00f0ff', fontWeight: 'bold' }}>
        <span>{equipment ? 'DRAG TO EQUIP' : software ? 'DRAG TO LOAD ON GEAR' : ''}</span>
        <span style={{ fontSize: '7px', opacity: 0.6, color: '#8899aa' }}>[ALT: STATS]</span>
      </div>
    </div>
  );
};
