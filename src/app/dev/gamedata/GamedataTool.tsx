'use client';
import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useGamedataStore } from './store';
import { Section, SECTIONS } from './types';
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
  const { setSectionItems, selectedItem, cloneSource } = useGamedataStore();

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

  return (
    <div className={styles.container}>
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
    </div>
  );
}
