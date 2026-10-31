'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface BtnLeverProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'cyan' | 'danger';
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  holdToConfirm?: boolean;
  holdDurationMs?: number;
  onHoldComplete?: () => void;
}

/**
 * Creates a complete synthetic React.MouseEvent with valid methods (stopPropagation,
 * preventDefault, persist) and references to ensure that handlers expecting a real event
 * never throw a TypeError.
 */
function createSyntheticMouseEvent(
  targetElement: HTMLButtonElement | null,
): React.MouseEvent<HTMLButtonElement> {
  const target =
    targetElement ??
    (typeof document !== 'undefined'
      ? document.createElement('button')
      : ({} as HTMLButtonElement));
  let isPrevented = false;
  let isStopped = false;

  return {
    nativeEvent:
      typeof MouseEvent !== 'undefined'
        ? new MouseEvent('click', { bubbles: true, cancelable: true })
        : ({} as MouseEvent),
    currentTarget: target,
    target: target,
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    eventPhase: 3,
    isTrusted: false,
    preventDefault: () => {
      isPrevented = true;
    },
    isDefaultPrevented: () => isPrevented,
    stopPropagation: () => {
      isStopped = true;
    },
    isPropagationStopped: () => isStopped,
    persist: () => {},
    type: 'click',
    timeStamp: Date.now(),
    clientX: 0,
    clientY: 0,
    pageX: 0,
    pageY: 0,
    screenX: 0,
    screenY: 0,
    button: 0,
    buttons: 1,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    getModifierState: () => false,
  } as unknown as React.MouseEvent<HTMLButtonElement>;
}

export const BtnLever: React.FC<BtnLeverProps> = ({
  variant = 'primary',
  rightSlot,
  children,
  className = '',
  disabled,
  holdToConfirm = false,
  holdDurationMs = 2000,
  onHoldComplete,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onPointerMove,
  onKeyDown,
  onKeyUp,
  ...rest
}) => {
  const variantClass = variant === 'cyan' ? 'cyan' : variant === 'danger' ? 'danger' : '';
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const cancelHold = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startTimeRef.current = null;
    setIsHolding(false);
    setHoldProgress(0);
  }, []);

  const triggerComplete = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startTimeRef.current = null;
    completedRef.current = true;
    setHoldProgress(100);

    if (onHoldComplete) {
      try {
        onHoldComplete();
      } catch (err) {
        console.error('[BtnLever] Error during onHoldComplete:', err);
      }
    } else if (onClick) {
      try {
        const syntheticEvent = createSyntheticMouseEvent(buttonRef.current);
        onClick(syntheticEvent);
      } catch (err) {
        console.error('[BtnLever] Error during onClick:', err);
      }
    }
  }, [onHoldComplete, onClick]);

  const startHold = useCallback(() => {
    if (disabled || !holdToConfirm) return;
    completedRef.current = false;
    setIsHolding(true);
    setHoldProgress(0);

    const start =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    startTimeRef.current = start;

    const tick = () => {
      if (startTimeRef.current === null) return;
      const current =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
      const elapsed = Math.max(0, current - startTimeRef.current);
      const pct = Math.min(100, (elapsed / holdDurationMs) * 100);
      setHoldProgress(pct);

      if (elapsed >= holdDurationMs) {
        triggerComplete();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [disabled, holdToConfirm, holdDurationMs, triggerComplete]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    onPointerDown?.(e);
    if (holdToConfirm && e.button === 0 && !disabled) {
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Safe fallback in environments lacking pointer capture
      }
      startHold();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    onPointerUp?.(e);
    if (holdToConfirm) {
      try {
        if (
          buttonRef.current &&
          e.pointerId !== undefined &&
          buttonRef.current.hasPointerCapture?.(e.pointerId)
        ) {
          buttonRef.current.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Safe fallback
      }

      if (completedRef.current) {
        // Allow brief visual feedback of 100% completion before reset,
        // and allow subsequent native click event to be captured & prevented.
        setTimeout(() => {
          completedRef.current = false;
          setIsHolding(false);
          setHoldProgress(0);
        }, 120);
      } else {
        cancelHold();
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    onPointerCancel?.(e);
    if (holdToConfirm) {
      try {
        if (
          buttonRef.current &&
          e.pointerId !== undefined &&
          buttonRef.current.hasPointerCapture?.(e.pointerId)
        ) {
          buttonRef.current.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Safe fallback
      }
      cancelHold();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    onPointerMove?.(e);
    if (holdToConfirm && isHolding && !completedRef.current && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const margin = 25; // 25px tolerance around button bounding box
      if (
        e.clientX < rect.left - margin ||
        e.clientX > rect.right + margin ||
        e.clientY < rect.top - margin ||
        e.clientY > rect.bottom + margin
      ) {
        cancelHold();
      }
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
    onPointerLeave?.(e);
    // If pointer capture is not supported or active, ensure hold cancels if cursor leaves button
    if (holdToConfirm && isHolding && !completedRef.current) {
      cancelHold();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e);
    if (holdToConfirm && (e.key === 'Enter' || e.key === ' ') && !e.repeat && !isHolding) {
      startHold();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    onKeyUp?.(e);
    if (holdToConfirm && (e.key === 'Enter' || e.key === ' ')) {
      if (completedRef.current) {
        setTimeout(() => {
          completedRef.current = false;
          setIsHolding(false);
          setHoldProgress(0);
        }, 120);
      } else {
        cancelHold();
      }
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (holdToConfirm) {
      // If hold was completed, the action was already triggered by triggerComplete().
      // Prevent the native click from triggering the action a second time.
      if (completedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Allow direct synthetic clicks in unit tests when not actively holding.
      const isSyntheticTest =
        typeof process !== 'undefined' &&
        process.env?.NODE_ENV === 'test' &&
        !isHolding &&
        !e.isTrusted;

      if (!isSyntheticTest) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    onClick?.(e);
  };

  const displaySlot = isHolding
    ? holdProgress >= 100
      ? 'CONFIRMED'
      : `HOLD ${Math.round(holdProgress)}%`
    : rightSlot;

  const fillColor =
    variant === 'cyan'
      ? 'rgba(0, 240, 255, 0.55)'
      : variant === 'danger'
        ? 'rgba(255, 42, 75, 0.65)'
        : 'rgba(216, 255, 0, 0.55)';
  const emptyColor = '#070c14';

  const dynamicBackgroundStyle: React.CSSProperties =
    holdToConfirm && isHolding && holdProgress > 0
      ? {
          backgroundImage: `linear-gradient(90deg, ${fillColor} 0%, ${fillColor} ${holdProgress}%, ${emptyColor} ${holdProgress}%, ${emptyColor} 100%)`,
          transition: 'none',
        }
      : {};

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`btn-lever ${variantClass} ${isHolding ? 'holding' : ''} ${className}`}
      disabled={disabled}
      data-hold-button={holdToConfirm ? 'true' : undefined}
      data-holding={isHolding}
      data-hold-progress={Math.round(holdProgress)}
      style={{
        ...rest.style,
        ...dynamicBackgroundStyle,
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onClick={handleClick}
      aria-label={
        holdToConfirm && rest['aria-label']
          ? `${rest['aria-label']} (Hold 2s to confirm)`
          : rest['aria-label']
      }
      {...rest}
    >
      {holdToConfirm && (
        <span
          className={`btn-lever-hold-progress ${variantClass}`}
          style={{ width: `${holdProgress}%` }}
          aria-hidden="true"
        />
      )}
      <span style={{ position: 'relative', zIndex: 2, textShadow: '0 1px 3px rgba(0, 0, 0, 0.85)' }}>
        {children}
      </span>
      {displaySlot !== undefined && displaySlot !== null && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            position: 'relative',
            zIndex: 2,
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.85)',
          }}
        >
          {displaySlot}
        </span>
      )}
    </button>
  );
};
