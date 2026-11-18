import { useCallback, useEffect, useRef } from 'react';
import type { HotloadDomain } from './types';
import { postHotloadRevert } from './studio-sync';

/**
 * Tracks whether a LIVE_SYNC preview was emitted for the current item and
 * automatically emits `postHotloadRevert` with the baseline payload if the
 * editor switches items or unmounts before saving or explicitly reverting.
 */
export function useHotloadAutoRevert<T>(
  domain: HotloadDomain | undefined,
  targetId: string | undefined,
  getBaselinePayload: () => T | null,
  enabled: boolean = true,
  onAutoRevert?: (baseline: T) => void,
) {
  const previewSentRef = useRef(false);
  const baselineGetterRef = useRef(getBaselinePayload);
  baselineGetterRef.current = getBaselinePayload;
  const onAutoRevertRef = useRef(onAutoRevert);
  onAutoRevertRef.current = onAutoRevert;

  const markPreviewSent = useCallback(() => {
    previewSentRef.current = true;
  }, []);

  const clearPreviewSent = useCallback(() => {
    previewSentRef.current = false;
  }, []);

  useEffect(() => {
    previewSentRef.current = false;
    return () => {
      if (!enabled || !domain || !targetId || !previewSentRef.current) return;
      const baseline = baselineGetterRef.current();
      if (baseline !== null && baseline !== undefined) {
        onAutoRevertRef.current?.(baseline);
        postHotloadRevert(domain, targetId, baseline);
      }
      previewSentRef.current = false;
    };
  }, [domain, targetId, enabled]);

  return { markPreviewSent, clearPreviewSent };
}
