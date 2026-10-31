'use client';

import React from 'react';

export interface TaikokuStampProps {
  children: React.ReactNode;
  variant?: 'danger' | 'cyan' | 'secured';
  className?: string;
  style?: React.CSSProperties;
}

export const TaikokuStamp: React.FC<TaikokuStampProps> = ({
  children,
  variant = 'danger',
  className = '',
  style,
}) => {
  const variantClass = variant === 'cyan' ? 'cyan' : variant === 'secured' ? 'secured' : '';

  return (
    <span className={`taikoku-stamp ${variantClass} ${className}`} style={style}>
      {children}
    </span>
  );
};
