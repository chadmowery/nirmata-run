'use client';

import React from 'react';

export interface PanelCardProps {
  title?: string;
  badge?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  style?: React.CSSProperties;
}

export const PanelCard: React.FC<PanelCardProps> = ({
  title,
  badge,
  headerRight,
  children,
  className = '',
  bodyClassName = '',
  style,
}) => {
  return (
    <section className={`panel-card ${className}`} style={style}>
      {title && (
        <div className="panel-header">
          <span className="panel-heading-text">{title}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {badge && <span className="panel-badge">{badge}</span>}
            {headerRight}
          </div>
        </div>
      )}
      <div className={`panel-body ${bodyClassName}`}>{children}</div>
    </section>
  );
};
