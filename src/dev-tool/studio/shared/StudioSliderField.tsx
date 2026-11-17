'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import styles from '../editors/editors.module.css';

interface TooltipPosition {
  x: number;
  y: number;
  placement: 'top' | 'bottom';
}

function computeTooltipPosition(anchor: HTMLElement): TooltipPosition {
  const rect = anchor.getBoundingClientRect();
  const tooltipWidth = 280;
  const estimatedHeight = 92;
  const margin = 10;

  let x = rect.left;
  if (typeof window !== 'undefined') {
    if (x + tooltipWidth > window.innerWidth - margin) {
      x = Math.max(margin, window.innerWidth - tooltipWidth - margin);
    }
  }
  if (x < margin) {
    x = margin;
  }

  let y = rect.top - 8;
  let placement: 'top' | 'bottom' = 'top';
  if (rect.top - estimatedHeight - 12 < margin) {
    y = rect.bottom + 8;
    placement = 'bottom';
  }

  return { x, y, placement };
}

function useStudioTooltip() {
  const tooltipId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pos, setPos] = useState<TooltipPosition>({ x: 10, y: 10, placement: 'bottom' });

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openAt = useCallback(
    (anchor: HTMLElement | null) => {
      cancelClose();
      const target = anchor ?? triggerRef.current ?? containerRef.current;
      if (target) {
        setPos(computeTooltipPosition(target));
      }
      setIsOpen(true);
    },
    [cancelClose],
  );

  const closeImmediate = useCallback(() => {
    cancelClose();
    setIsOpen(false);
    setIsPinned(false);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    if (isPinned) return;
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      closeTimerRef.current = null;
    }, 90);
  }, [cancelClose, isPinned]);

  const togglePinned = useCallback(
    (anchor: HTMLElement | null) => {
      cancelClose();
      if (isPinned && isOpen) {
        setIsPinned(false);
        setIsOpen(false);
      } else {
        const target = anchor ?? triggerRef.current ?? containerRef.current;
        if (target) {
          setPos(computeTooltipPosition(target));
        }
        setIsPinned(true);
        setIsOpen(true);
      }
    },
    [cancelClose, isOpen, isPinned],
  );

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeImmediate();
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        containerRef.current?.contains(target) ||
        tooltipRef.current?.contains(target)
      ) {
        return;
      }
      closeImmediate();
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, closeImmediate]);

  return {
    tooltipId,
    containerRef,
    triggerRef,
    tooltipRef,
    isOpen,
    isPinned,
    pos,
    openAt,
    scheduleClose,
    cancelClose,
    togglePinned,
    closeImmediate,
  };
}

interface StudioTooltipPopupProps {
  id: string;
  title: string;
  description: string;
  tag?: string;
  isOpen: boolean;
  pos: TooltipPosition;
  tooltipRef: React.RefObject<HTMLDivElement | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function StudioTooltipPopup({
  id,
  title,
  description,
  tag,
  isOpen,
  pos,
  tooltipRef,
  onMouseEnter,
  onMouseLeave,
}: StudioTooltipPopupProps) {
  if (!isOpen) return null;

  return (
    <div
      ref={tooltipRef}
      id={id}
      role="tooltip"
      className={`${styles.studioTooltip} ${pos.placement === 'top' ? styles.studioTooltipTop : ''}`}
      style={{ left: pos.x, top: pos.y }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={styles.studioTooltipHeader}>
        {tag && <span className={styles.studioTooltipTag}>{tag}</span>}
        <span className={styles.studioTooltipTitle}>{title}</span>
      </div>
      <div className={styles.studioTooltipDesc}>{description}</div>
    </div>
  );
}

export interface StudioFieldHintProps {
  label: string;
  tooltip: string;
  tooltipTag?: string;
}

/**
 * Standalone accessible `[?]` toggletip/tooltip trigger for non-slider studio controls.
 */
export function StudioFieldHint({ label, tooltip, tooltipTag }: StudioFieldHintProps) {
  const tip = useStudioTooltip();

  return (
    <div ref={tip.containerRef} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <button
        ref={tip.triggerRef}
        type="button"
        className={styles.tooltipTrigger}
        aria-label={`About ${label}`}
        aria-expanded={tip.isOpen}
        aria-describedby={tip.isOpen ? tip.tooltipId : undefined}
        onClick={() => tip.togglePinned(tip.triggerRef.current)}
        onMouseEnter={() => tip.openAt(tip.triggerRef.current)}
        onMouseLeave={tip.scheduleClose}
        onFocus={() => tip.openAt(tip.triggerRef.current)}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          if (!next || !tip.containerRef.current?.contains(next)) {
            tip.scheduleClose();
          }
        }}
      >
        ?
      </button>
      <StudioTooltipPopup
        id={tip.tooltipId}
        title={label}
        description={tooltip}
        tag={tooltipTag}
        isOpen={tip.isOpen}
        pos={tip.pos}
        tooltipRef={tip.tooltipRef}
        onMouseEnter={tip.cancelClose}
        onMouseLeave={tip.scheduleClose}
      />
    </div>
  );
}

export interface StudioSliderFieldProps {
  label: string;
  valueDisplay?: string;
  tooltip: string;
  tooltipTag?: string;
  min: number | string;
  max: number | string;
  step?: number | string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
  valueText?: string;
  layout?: 'cell' | 'row';
  children?: React.ReactNode;
}

/**
 * Accessible range slider field with a hover/focus/click `[?]` tooltip and
 * overflow-safe layout for Gamedata Studio panels.
 */
export function StudioSliderField({
  label,
  valueDisplay,
  tooltip,
  tooltipTag,
  min,
  max,
  step,
  value,
  onChange,
  disabled,
  ariaLabel,
  valueText,
  layout = 'cell',
  children,
}: StudioSliderFieldProps) {
  const inputId = useId();
  const tip = useStudioTooltip();

  const handleContainerBlur = (e: React.FocusEvent<HTMLElement>) => {
    const next = e.relatedTarget as Node | null;
    if (!next || (!tip.containerRef.current?.contains(next) && !tip.tooltipRef.current?.contains(next))) {
      tip.scheduleClose();
    }
  };

  const triggerButton = (
    <button
      ref={tip.triggerRef}
      type="button"
      className={styles.tooltipTrigger}
      aria-label={`About ${label}`}
      aria-expanded={tip.isOpen}
      onClick={() => tip.togglePinned(tip.triggerRef.current)}
      onMouseEnter={() => tip.openAt(tip.triggerRef.current)}
      onMouseLeave={tip.scheduleClose}
      onFocus={() => tip.openAt(tip.triggerRef.current)}
      onBlur={handleContainerBlur}
    >
      ?
    </button>
  );

  const rangeInput = (
    <input
      id={inputId}
      type="range"
      className={styles.slider}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-valuetext={valueText ?? valueDisplay}
      aria-describedby={tip.isOpen ? tip.tooltipId : undefined}
      onChange={(e) => onChange(Number(e.target.value))}
      onMouseEnter={() => tip.openAt(tip.triggerRef.current)}
      onMouseLeave={tip.scheduleClose}
      onFocus={() => tip.openAt(tip.triggerRef.current)}
      onBlur={handleContainerBlur}
    />
  );

  const popup = (
    <StudioTooltipPopup
      id={tip.tooltipId}
      title={label}
      description={tooltip}
      tag={tooltipTag}
      isOpen={tip.isOpen}
      pos={tip.pos}
      tooltipRef={tip.tooltipRef}
      onMouseEnter={tip.cancelClose}
      onMouseLeave={tip.scheduleClose}
    />
  );

  if (layout === 'row') {
    return (
      <div ref={tip.containerRef} className={styles.fieldRow}>
        <div className={styles.fieldLabelWithTip}>
          <label
            htmlFor={inputId}
            className={styles.fieldLabelInline}
            onMouseEnter={() => tip.openAt(tip.triggerRef.current)}
            onMouseLeave={tip.scheduleClose}
          >
            {label}
            {valueDisplay !== undefined ? ` (${valueDisplay})` : ''}
          </label>
          {triggerButton}
        </div>
        <div className={styles.sliderControlWrap}>
          {rangeInput}
          {children}
        </div>
        {popup}
      </div>
    );
  }

  return (
    <div ref={tip.containerRef} className={styles.fieldCell}>
      <div className={styles.fieldCellHeader}>
        <label
          htmlFor={inputId}
          className={styles.fieldCellLabel}
          onMouseEnter={() => tip.openAt(tip.triggerRef.current)}
          onMouseLeave={tip.scheduleClose}
        >
          {label}
          {valueDisplay !== undefined ? ` (${valueDisplay})` : ''}
        </label>
        {triggerButton}
      </div>
      <div className={styles.sliderControlWrap}>
        {rangeInput}
        {children}
      </div>
      {popup}
    </div>
  );
}
