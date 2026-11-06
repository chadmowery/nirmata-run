'use client';
import { useEffect, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { useGamedataStore } from './store';
import { Section, SECTIONS } from './types';
import { ResolvedPreviewPanel } from './shared/ResolvedPreviewPanel';
import {
  EntityTemplateEditor,
  MixinEditor,
  SpawnTableEditor,
  ShellEditor,
  ComponentSchemaViewer,
  PrefabEditor,
} from './editors';
import styles from './gamedata.module.css';

interface Props {
  initialData: {
    entities: string[];
    mixins: string[];
    spawnTables: string[];
    shells: string[];
    prefabs?: string[];
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
  } = useGamedataStore();

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
