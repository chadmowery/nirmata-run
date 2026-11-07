'use client';
import { ChevronRight, ChevronDown, File, Plus } from 'lucide-react';
import { useGamedataStore } from './store';
import { SECTIONS } from './types';
import styles from './gamedata.module.css';

export function Sidebar() {
  const {
    expandedSections,
    toggleSection,
    selectedItem,
    selectItem,
    sectionItems,
    clearCloneSource,
    isDirty,
  } = useGamedataStore();

  const handleSelectItem = (sectionId: typeof SECTIONS[number]['id'], name: string) => {
    if (selectedItem?.section === sectionId && selectedItem?.name === name) return;
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard and switch items?');
      if (!confirmDiscard) return;
    }
    clearCloneSource();
    selectItem(sectionId, name);
  };

  const handleAddNew = (sectionId: typeof SECTIONS[number]['id']) => {
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard and create new?');
      if (!confirmDiscard) return;
    }
    clearCloneSource();
    selectItem(sectionId, '__new__');
  };

  return (
    <aside className={styles.sidebar}>
      <h1 className={styles.sidebarTitle}>Gamedata</h1>
      {SECTIONS.map((section) => {
        const isExpanded = expandedSections.has(section.id);
        const items = sectionItems[section.id] || [];
        const isReadOnly = section.id === 'componentSchemas';

        return (
          <div key={section.id}>
            <div className={styles.sectionHeader} onClick={() => toggleSection(section.id)}>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>{section.label}</span>
              <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '10px' }}>
                {items.length}
              </span>
            </div>
            {isExpanded && (
              <div className={styles.sectionItems}>
                {!isReadOnly && (
                  <button
                    className={styles.addButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddNew(section.id);
                    }}
                  >
                    <Plus size={12} /> New
                  </button>
                )}
                {items.map((name) => {
                  const isActive =
                    selectedItem?.section === section.id && selectedItem?.name === name;
                  return (
                    <div
                      key={name}
                      className={`${styles.sectionItem} ${isActive ? styles.sectionItemActive : ''}`}
                      onClick={() => handleSelectItem(section.id, name)}
                    >
                      <File size={12} />
                      <span>{name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
