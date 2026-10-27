import React, { useState, useEffect } from 'react';
import { EquipmentDef, SoftwareDef, Item } from '@shared/components';

interface InRunItemTooltipProps {
  entityId: number;
}

export const InRunItemTooltip: React.FC<InRunItemTooltipProps> = ({ entityId }) => {
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

  // Accessing world from window.gameContext (mocked/available at runtime)
  const world = (window as any).gameContext?.world;
  if (!world) return null;

  const equipment = world.getComponent(entityId, EquipmentDef);
  const software = world.getComponent(entityId, SoftwareDef);
  const itemComponent = world.getComponent(entityId, Item);

  if (!equipment && !software && !itemComponent) return null;

  const itemName = equipment?.name || software?.name || itemComponent?.name || 'Unknown Item';

  return (
    <div
      className="inventory-tooltip"
      style={{
        position: 'fixed',
        zIndex: 1000,
        background: '#111',
        border: '1px solid #444',
        padding: '10px',
        pointerEvents: 'none',
      }}
    >
      <h3>{itemName}</h3>
      <p>Tier: {equipment?.tier || 'N/A'}</p>

      {showDeepStats && (
        <div className="deep-stats">
          <p>Deeper stats here...</p>
          {software && <p>Software Modifiers: {software.modifier}</p>}
        </div>
      )}
      {!showDeepStats && <p className="hint">Hold Alt for deep stats</p>}

      <div style={{ marginTop: '8px', color: '#00F0FF', fontSize: '11px', fontWeight: 'bold' }}>
        {equipment ? 'Drag to Equip' : software ? 'Drag to Install' : ''}
      </div>
    </div>
  );
};
