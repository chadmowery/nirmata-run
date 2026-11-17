import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as studioSync from '@dev-tool/hotload/studio-sync';
import { useGamedataStore } from '../store';
import { MixinEditor } from '../editors/MixinEditor';

describe('MixinEditor Hotload & Auto-Revert on Unmount (MED-01, MED-02)', () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    useGamedataStore.setState({
      isDirty: false,
      liveSyncEnabled: true,
      activeEffectiveData: null,
    });
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it('supports LIVE_SYNC preview, Cmd+S save commit, REVERT, and auto-revert on unmount when dirty', async () => {
    const previewSpy = vi.spyOn(studioSync, 'postHotloadPreview').mockImplementation(() => {});
    const commitSpy = vi.spyOn(studioSync, 'postHotloadCommit').mockImplementation(() => {});
    const revertSpy = vi.spyOn(studioSync, 'postHotloadRevert').mockImplementation(() => {});

    const baselineMixin = {
      name: 'combatant',
      components: {
        health: { current: 10, max: 10, isAlive: true },
      },
    };

    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const s = String(url);
      if (s.endsWith('/api/dev/gamedata/components')) {
        return {
          ok: true,
          json: async () => ({
            items: [
              { key: 'health', fields: [{ key: 'max', type: 'number' }] },
              { key: 'defense', fields: [{ key: 'armor', type: 'number' }] },
            ],
          }),
        } as unknown as Response;
      }
      if (s.endsWith('/api/dev/gamedata/mixins/combatant') && init?.method === 'PUT') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            sessionPatches: { s1: { updatedEntities: [] } },
            envelope: { id: 'srv-mixin-1' },
          }),
        } as unknown as Response;
      }
      if (s.endsWith('/api/dev/gamedata/mixins/combatant')) {
        return {
          ok: true,
          json: async () => structuredClone(baselineMixin),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({}) } as unknown as Response;
    });

    const { unmount } = render(<MixinEditor name="combatant" />);

    await waitFor(() => {
      expect(screen.getByText('Mixin: combatant')).toBeDefined();
    });
    expect(useGamedataStore.getState().activeEffectiveData).toEqual(baselineMixin);

    // Mutate component by adding 'defense' -> marks dirty & emits PREVIEW
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'defense' } });

    await waitFor(() => {
      expect(useGamedataStore.getState().isDirty).toBe(true);
      expect(previewSpy).toHaveBeenCalledWith(
        'mixin',
        'combatant',
        expect.objectContaining({ name: 'combatant' }),
        16,
      );
    });

    // Unmount without saving -> auto-reverts with baselinePayload (MED-02)
    unmount();
    expect(revertSpy).toHaveBeenCalledWith('mixin', 'combatant', baselineMixin);

    // Re-mount, mutate, then save via Cmd+S (`gamedata-save`) -> commits with server envelope ID and clears auto-revert
    previewSpy.mockClear();
    revertSpy.mockClear();
    const { unmount: unmount2 } = render(<MixinEditor name="combatant" />);
    await waitFor(() => {
      expect(screen.getByText('Mixin: combatant')).toBeDefined();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'defense' } });
    await waitFor(() => {
      expect(previewSpy).toHaveBeenCalled();
    });

    window.dispatchEvent(new CustomEvent('gamedata-save'));
    await waitFor(() => {
      expect(commitSpy).toHaveBeenCalledWith(
        'mixin',
        'combatant',
        expect.objectContaining({ name: 'combatant' }),
        { s1: { updatedEntities: [] } },
        'srv-mixin-1',
      );
      expect(useGamedataStore.getState().isDirty).toBe(false);
    });

    unmount2();
    expect(revertSpy).not.toHaveBeenCalled();
  });
});
