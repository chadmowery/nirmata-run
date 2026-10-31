'use client';

import React from 'react';

export interface BtnLeverProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'cyan' | 'danger';
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}

export const BtnLever: React.FC<BtnLeverProps> = ({
  variant = 'primary',
  rightSlot,
  children,
  className = '',
  disabled,
  ...rest
}) => {
  const variantClass = variant === 'cyan' ? 'cyan' : variant === 'danger' ? 'danger' : '';

  return (
    <button
      type="button"
      className={`btn-lever ${variantClass} ${className}`}
      disabled={disabled}
      {...rest}
    >
      <span>{children}</span>
      {rightSlot && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{rightSlot}</span>}
    </button>
  );
};
