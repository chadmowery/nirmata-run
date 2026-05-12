'use client';
import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useGamedataStore } from './store';
import { Section } from './types';
import {
  EntityTemplateEditor,
  MixinEditor,
  SpawnTableEditor,
  ShellEditor,
  ComponentSchemaViewer,
} from './editors';
import styles from './gamedata.module.css';

interface Props {
  initialData: {
    entities: string[];
    mixins: string[];
    spawnTables: string[];
    shells: string[];
  };
}

export function GamedataTool({ initialData }: Props) {
  const { setSectionItems, selectedItem, cloneSource } = useGamedataStore();

  // Hydrate store with server-loaded data on mount
  useEffect(() => {
    setSectionItems('entities', initialData.entities);
    setSectionItems('mixins', initialData.mixins);
    setSectionItems('spawnTables', initialData.spawnTables);
    setSectionItems('shells', initialData.shells);
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

    switch (item.section) {
      case 'entities':
        return <EntityTemplateEditor key={item.name} name={item.name} isNew={isNew} cloneFrom={cloneFrom ?? undefined} />;
      case 'mixins':
        return <MixinEditor key={item.name} name={item.name} isNew={isNew} cloneFrom={cloneFrom ?? undefined} />;
      case 'spawnTables':
        return <SpawnTableEditor key={item.name} name={item.name} isNew={isNew} cloneFrom={cloneFrom ?? undefined} />;
      case 'shells':
        return <ShellEditor key={item.name} id={item.name} isNew={isNew} cloneFrom={cloneFrom ?? undefined} />;
      case 'componentSchemas':
        return <ComponentSchemaViewer key={item.name} name={item.name} />;
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
