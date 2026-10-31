'use client';

import React from 'react';

export interface BarcodeLadderProps {
  code?: string;
  className?: string;
  color?: string;
}

export const BarcodeLadder: React.FC<BarcodeLadderProps> = ({
  code = 'TK-88902-C',
  className = '',
  color = '#d8ff00',
}) => {
  return (
    <div className={`barcode-ladder ${className}`}>
      <svg className="barcode-svg" viewBox="0 0 48 120" aria-hidden="true">
        <rect x="2" y="0" width="3" height="120" fill={color} />
        <rect x="8" y="0" width="2" height="120" fill={color} />
        <rect x="13" y="0" width="6" height="120" fill={color} />
        <rect x="22" y="0" width="2" height="120" fill={color} />
        <rect x="27" y="0" width="4" height="120" fill={color} />
        <rect x="34" y="0" width="2" height="120" fill={color} />
        <rect x="38" y="0" width="5" height="120" fill={color} />
      </svg>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.15em',
          color,
          fontWeight: 800,
        }}
      >
        {code}
      </span>
    </div>
  );
};
