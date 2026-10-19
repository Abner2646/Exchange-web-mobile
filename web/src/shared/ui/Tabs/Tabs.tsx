'use client';
import React, { useRef, KeyboardEvent } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name for the tablist. */
  'aria-label': string;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, value, onChange, 'aria-label': ariaLabel, className }) => {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const focusAndSelect = (id: string) => {
    onChange(id);
    refs.current[id]?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const index = tabs.findIndex((t) => t.id === value);
    if (index < 0) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const next = (index + delta + tabs.length) % tabs.length;
      focusAndSelect(tabs[next].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusAndSelect(tabs[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusAndSelect(tabs[tabs.length - 1].id);
    }
  };

  return (
    <div role="tablist" aria-label={ariaLabel} className={[styles.tablist, className].filter(Boolean).join(' ')}>
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(tab.id)}
            onKeyDown={handleKeyDown}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
