'use client';
import { useEffect, useCallback, useState } from 'react';
import { getAudioEngine } from '@engine/audio';
import { Sidebar } from './Sidebar';
import { useGamedataStore } from './store';
import { Section, SECTIONS } from './types';
import { ResolvedPreviewPanel } from './shared/ResolvedPreviewPanel';
import { subscribeStudioHeartbeats, requestShellSwitch } from '@dev-tool/hotload/studio-sync';
import {
  EntityTemplateEditor,
  MixinEditor,
  SpawnTableEditor,
  ShellEditor,
  ComponentSchemaViewer,
  PrefabEditor,
  ConfigEditor,
  AudioCueStudio,
} from './editors';
import styles from './gamedata.module.css';

interface Props {
  initialData: {
    entities: string[];
    mixins: string[];
    spawnTables: string[];
    shells: string[];
    prefabs?: string[];
    configs?: string[];
    audioCues?: string[];
  };
}

export function GamedataTool({ initialData }: Props) {
  const {
    setSectionItems,
    selectedItem,
    cloneSource,
    isDirty,
    activeEffectiveData,
    activeValidationStatus,
    sectionItems,
    liveSyncEnabled,
    toggleLiveSync,
    connectedGame,
    setConnectedGame,
  } = useGamedataStore();
  const [launchingRun, setLaunchingRun] = useState(false);

  // Subscribe to running game tab heartbeats via BroadcastChannel
  useEffect(() => {
    const unsubscribe = subscribeStudioHeartbeats((hb) => {
      setConnectedGame(hb);
    });
    const staleTimer = window.setInterval(() => {
      const current = useGamedataStore.getState().connectedGame;
      if (current && Date.now() - current.timestamp > 8000) {
        setConnectedGame(null);
      }
    }, 3000);
    return () => {
      unsubscribe();
      window.clearInterval(staleTimer);
    };
  }, [setConnectedGame]);

  const handleQuickLaunch = async () => {
    if (launchingRun) return;
    setLaunchingRun(true);
    try {
      const targetShell =
        selectedItem?.section === 'shells' && selectedItem.name !== '__new__'
          ? selectedItem.name
          : sectionItems.shells[0] || 'vanguard-v1';
      const res = await fetch('/api/dev/hotload/quick-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shellId: targetShell }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessionId && typeof window !== 'undefined') {
          window.localStorage?.setItem('nimrata_sessionId', data.sessionId);
        }
        window.open('/', '_blank');
      }
    } finally {
      setLaunchingRun(false);
    }
  };

  const refreshSection = async (section: Section) => {
    const secConfig = SECTIONS.find((s) => s.id === section);
    if (!secConfig) return;
    try {
      const res = await fetch(secConfig.apiPath);
      const data = await res.json();
      if (data.items) {
        setSectionItems(section, data.items);
      }
    } catch {
      // ignore network errors
    }
  };

  // Hydrate store with server-loaded data on mount
  useEffect(() => {
    setSectionItems('entities', initialData.entities);
    setSectionItems('mixins', initialData.mixins);
    setSectionItems('spawnTables', initialData.spawnTables);
    setSectionItems('shells', initialData.shells);
    if (initialData.prefabs) {
      setSectionItems('prefabs', initialData.prefabs);
    }
    if (initialData.configs) {
      setSectionItems('configs', initialData.configs);
    }
    if (initialData.audioCues) {
      setSectionItems('audioCues', initialData.audioCues);
    }
  }, [initialData, setSectionItems]);

  // Load component schemas
  useEffect(() => {
    fetch('/api/dev/gamedata/components')
      .then((r) => r.json())
      .then((data) => {
        if (data.items) {
          setSectionItems(
            'componentSchemas',
            data.items.map((s: { key: string }) => s.key),
          );
        }
      })
      .catch(() => {});
  }, [setSectionItems]);

  // Global Cmd+S / Ctrl+S key listener
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('gamedata-save'));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  function renderEditor(item: { section: Section; name: string }) {
    const isNew = item.name === '__new__';
    const cloneFrom = isNew ? cloneSource : undefined;
    const editorKey = `${item.section}-${item.name}-${cloneFrom ?? 'fresh'}`;
    const onRefresh = () => refreshSection(item.section);

    switch (item.section) {
      case 'entities':
        return (
          <EntityTemplateEditor
            key={editorKey}
            name={item.name}
            isNew={isNew}
            cloneFrom={cloneFrom ?? undefined}
            onRefresh={onRefresh}
          />
        );
      case 'mixins':
        return (
          <MixinEditor
            key={editorKey}
            name={item.name}
            isNew={isNew}
            cloneFrom={cloneFrom ?? undefined}
            onRefresh={onRefresh}
          />
        );
      case 'spawnTables':
        return (
          <SpawnTableEditor
            key={editorKey}
            name={item.name}
            isNew={isNew}
            cloneFrom={cloneFrom ?? undefined}
            onRefresh={onRefresh}
          />
        );
      case 'shells':
        return (
          <ShellEditor
            key={editorKey}
            id={item.name}
            isNew={isNew}
            cloneFrom={cloneFrom ?? undefined}
            onRefresh={onRefresh}
          />
        );
      case 'prefabs':
        return (
          <PrefabEditor
            key={editorKey}
            name={item.name}
            isNew={isNew}
            cloneFrom={cloneFrom ?? undefined}
            onRefresh={onRefresh}
          />
        );
      case 'componentSchemas':
        return <ComponentSchemaViewer key={editorKey} name={item.name} />;
      case 'configs':
        return <ConfigEditor key={editorKey} name={item.name} onRefresh={onRefresh} />;
      case 'audioCues':
        return (
          <AudioCueStudio
            key={editorKey}
            name={item.name}
            isNew={isNew}
            cloneFrom={cloneFrom ?? undefined}
            onRefresh={onRefresh}
          />
        );
      default:
        return (
          <div className={styles.emptyState}>
            <span>UNKNOWN_SECTION</span>
          </div>
        );
    }
  }

  const activeName = selectedItem ? `${selectedItem.section} // ${selectedItem.name}` : 'NONE';

  return (
    <div className={styles.container}>
      <header className={styles.headerPlacard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--c-accent-secondary, #00f0ff)' }}>
            [ 開発環境 // GAMEDATA STUDIO ]
          </span>
          <span style={{ color: 'var(--c-text-dim, #79889e)' }}>
            ACTIVE: <span style={{ color: 'var(--c-text-ivory, #f4f4f0)' }}>{activeName}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {connectedGame ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 8px',
                border: '1px solid rgba(0, 240, 255, 0.45)',
                background: 'rgba(0, 240, 255, 0.08)',
                color: 'var(--c-accent-secondary, #00f0ff)',
                fontSize: '11px',
              }}
            >
              <span>
                ● GAME LINKED [F{connectedGame.floorNumber} // {connectedGame.shellId || 'none'}]
              </span>
              {sectionItems.shells.length > 0 && connectedGame.sessionId && (
                <select
                  aria-label="Hot-Swap Player Shell"
                  value={connectedGame.shellId || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      requestShellSwitch(e.target.value, connectedGame.sessionId ?? undefined);
                    }
                  }}
                  style={{
                    background: '#0b111e',
                    color: '#f4f4f0',
                    border: '1px solid #30415c',
                    fontSize: '11px',
                    padding: '1px 4px',
                  }}
                  title="Hot-swap active player Shell in running game"
                >
                  {sectionItems.shells.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <button
              type="button"
              className={styles.addButton}
              onClick={handleQuickLaunch}
              disabled={launchingRun}
              style={{
                margin: 0,
                padding: '2px 8px',
                borderColor: 'rgba(121, 136, 158, 0.5)',
                color: 'var(--c-text-dim, #79889e)',
              }}
              title="Spawn a Floor 1 dev session and open the game tab"
            >
              {launchingRun ? '○ LAUNCHING...' : '○ GAME OFFLINE [ ▶ LAUNCH ]'}
            </button>
          )}

          <button
            type="button"
            className={styles.addButton}
            onClick={toggleLiveSync}
            style={{
              margin: 0,
              padding: '2px 8px',
              borderColor: liveSyncEnabled ? '#00f0ff' : '#4a5568',
              color: liveSyncEnabled ? '#00f0ff' : '#79889e',
              background: liveSyncEnabled ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
            }}
            title="Toggle real-time LIVE_SYNC preview streaming to the running game"
          >
            {liveSyncEnabled ? '● LIVE SYNC: ON' : '○ LIVE SYNC: OFF'}
          </button>

          <button
            type="button"
            className={styles.addButton}
            disabled={!isDirty}
            onClick={() => window.dispatchEvent(new CustomEvent('gamedata-revert'))}
            style={{
              margin: 0,
              padding: '2px 8px',
              opacity: isDirty ? 1 : 0.45,
              borderColor: isDirty ? '#ff9944' : '#4a5568',
              color: isDirty ? '#ff9944' : '#79889e',
            }}
            title="Revert active editor to last saved disk state and restore game preview"
          >
            ↺ REVERT
          </button>

          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: isDirty ? 'var(--c-warning, #ff6600)' : 'var(--c-accent-secondary, #00f0ff)',
            }}
          >
            ● {isDirty ? 'UNSAVED' : 'SAVED'}
          </span>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => getAudioEngine().stopAllAudio()}
            style={{
              margin: 0,
              padding: '2px 8px',
              borderColor: 'var(--c-danger, #ff2a4b)',
              color: 'var(--c-danger, #ff2a4b)',
            }}
            title="Panic audio stop: terminates all active synth voices, loops, and ambiance drones"
          >
            ■ STOP AUDIO
          </button>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => window.dispatchEvent(new CustomEvent('gamedata-save'))}
            style={{ margin: 0, padding: '2px 8px' }}
          >
            CMD+S SAVE
          </button>
        </div>
      </header>

      <div className={styles.workspaceRow}>
        <Sidebar />
        <main className={styles.mainPanel}>
          {selectedItem ? (
            renderEditor(selectedItem)
          ) : (
            <div className={styles.emptyState}>
              <span>SELECT_ITEM</span>
            </div>
          )}
        </main>
        <ResolvedPreviewPanel
          selectedItem={selectedItem}
          effectiveData={activeEffectiveData}
          validationStatus={activeValidationStatus ?? undefined}
        />
      </div>
    </div>
  );
}
