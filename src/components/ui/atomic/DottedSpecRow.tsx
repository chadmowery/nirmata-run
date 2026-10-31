'use client';

import React from 'react';

export interface DottedSpecRowProps {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const DottedSpecRow: React.FC<DottedSpecRowProps> = ({
  label,
  value,
  valueColor,
  className = '',
  style,
}) => {
  return (
    <div className={`dotted-spec-row ${className}`} style={style}>
      <span className="spec-label">{label}</span>
      <span className="spec-val" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </div>
  );
};
